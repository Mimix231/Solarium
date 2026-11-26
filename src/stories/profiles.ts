import type { LibraryScope } from '../foundation/types';
import { SourceRepository, type SourceData } from '../sources/repository';
import { FictionRepository, hasProfileDetail, type FictionDestination, type FictionSelection, type ProfileField, type ProfileText } from './fiction';
import { profileClaimsAt, resolveStoryCharacter, type ClaimData, type StoryRepository, type StoryRule, type StoryWorld } from './repository';
import { editionMatches, pointIsAvailable, type CanonPoint } from './canon';
import { hasUntranslatedScript } from './language';
import { isFictionNameList } from './name-list';

export const profileSections = {
  personality: 'Personality & Voice',
  appearance: 'Appearance',
  voice: 'Personality & Voice',
  motives: 'Motivations',
  history: 'History',
  abilities: 'Abilities',
  relationships: 'Relationships',
  knowledge: 'Knowledge State',
  constraints: 'AU Changes',
} as const satisfies Record<ProfileField, ClaimData['section']>;

export interface FictionProfileProposal {
  name: string;
  aliases?: string[];
  kind: 'canon' | 'original' | 'adapted';
  sections: ProfileText;
  evidence?: { field: ProfileField; source_id: string; quote: string }[];
}

export interface FictionProfileInput {
  story?: { title: string; franchise: string; edition?: string; arc?: number; chapter?: number; divergence?: string; style?: string };
  rules?: { quote: string }[];
  profiles: FictionProfileProposal[];
}

/** The profile save can retain clearly stated human restrictions verbatim. */
export function statedFictionRules(text:string,messageId:string):StoryRule[] {
  if(/\b(?:don['’]t|do not|never)\s+save\b.{0,30}\b(?:rules?|restrictions?)\b/i.test(text))return [];
  return text.split(/(?<=[.!?])\s+|\r?\n/).map(line=>line.trim()).filter(line=>
    line.length>=12&&line.length<=400&&!line.endsWith('?')&&(
      /^(?:(?:canon|world|magic) rule|taboo)\s*:/i.test(line)||
      /\b(?:cannot|can['’]t|must never|must not|may not|is forbidden to)\s+(?:disclose|reveal|share|mention|discuss|speak\s+(?:of|about)|know)\b/i.test(line)||
      /\b(?:remains?|stays?|must remain)\s+unaware\b/i.test(line)
    )).slice(0,8).map(quote=>({quote,messageId}));
}

/** Unlocated cast pages may support traits that do not depend on a story event. */
export function profileSourceAt(field:ProfileField,boundary:CanonPoint,source:SourceData):boolean {
  const {arc,chapter,continuity}=source;
  const correctPoint=(boundary.arc===undefined||arc!==undefined&&arc<=boundary.arc)&&
    (boundary.chapter===undefined||arc!==undefined&&boundary.arc!==undefined&&arc<boundary.arc||chapter!==undefined&&chapter<=boundary.chapter);
  const timeless=['appearance','personality','voice','constraints'].includes(field)&&arc===undefined&&chapter===undefined;
  return (correctPoint||timeless)&&editionMatches(boundary.continuity,continuity)&&pointIsAvailable(boundary,{arc,chapter,continuity});
}

/** Persist the model's summaries through the existing scoped character/claim store. */
export async function saveFictionProfiles(
  stories: StoryRepository, scope: LibraryScope, storyId: string | null | undefined,
  selection: FictionSelection | null | undefined, input: FictionProfileInput, point?: CanonPoint, rules: StoryRule[] = [],
  allowNameOnly = false, destination?: FictionDestination, english = false,
) {
  let world = storyId ? await stories.world(storyId) : undefined;
  const setup = world ? undefined : input.story;
  if (!world && !setup?.title.trim()) throw Error('Provide story.title and the requested franchise for a new fiction profile.');
  const sources = new SourceRepository(stories.context, stories.store);
  const fiction=new FictionRepository(stories);
  const category = world && selection ? (await fiction.selection(world.id, selection)).category : undefined;
  if (destination && (world?.id!==destination.storyId || category?.id!==destination.categoryId)) {
    throw Error('The requested fiction destination changed before saving.');
  }
  if (world?.scope.kind==='library'&&!destination) throw Error('Select the personal fiction group and category in chat before saving there.');
  const defaults = { arc: category?.data.arc ?? world?.data.spoilerArc ?? setup?.arc,
    chapter: category?.data.chapter ?? world?.data.spoilerChapter ?? setup?.chapter,
    continuity: category?.data.continuity || world?.data.canonAnchor || setup?.edition };
  const boundary = point ? {
    arc:point.arc??defaults.arc,
    chapter:point.arc!==undefined||point.chapter!==undefined?point.chapter:defaults.chapter,
    continuity:point.continuity??defaults.continuity,
  } : defaults;
  const cast = world ? await stories.characters(world.id) : [];
  const existingProfiles = world&&category?await fiction.profiles(world.id,category.id):[];
  const identities = new Set<string>();
  const acceptedSourceIds = new Set<string>();
  const proposals = await Promise.all(input.profiles.map(async profile => {
    const name = profile.name.trim();
    if(isFictionNameList(name))throw Error('Save one profile per character. Give each profile its individual name and its own fields.');
    const existing = resolveStoryCharacter(cast, name);
    const identity = existing?.id ?? name.normalize('NFKC').toLowerCase();
    if (!name || identities.has(identity)) throw Error('Each proposed profile needs a distinct character name.');
    identities.add(identity);
    if (selection?.characterIds.length && !selection.characterIds.includes(existing?.id ?? '')) {
      throw Error(`${name} is outside the selected chapter cast. Save profiles for the selected characters.`);
    }
    const claims: Omit<ClaimData, 'characterId'>[] = [];
    const categorized=existingProfiles.find(profile=>profile.data.characterId===existing?.id);
    const authored=categorized?await fiction.read(categorized):{};
    const protectedFields:ProfileField[]=[];
    for (const [field, summary] of Object.entries(profile.sections) as [ProfileField, string][]) {
      if (!Object.hasOwn(profileSections, field) || typeof summary!=='string') throw Error('Provide text for an actual profile section.');
      if (!hasProfileDetail(summary)) continue;
      if(authored[field]?.trim()&&!categorized?.data.generatedFields?.includes(field)){protectedFields.push(field);continue;}
      if(english&&hasUntranslatedScript(summary))throw Error(`Translate ${name} / ${field} into English before saving. Source citations can retain the exact original quotation.`);
      const links: ClaimData['sourceLinks'] = [];
      for (const evidence of profile.evidence?.filter(item => item.field === field) ?? []) {
        const { source, content } = await sources.get(evidence.source_id);
        if (!source.data.enabled || source.data.origin.kind === 'web' && source.data.origin.readState !== 'read' ||
          evidence.quote.trim().length < 8 || !content.includes(evidence.quote)) {
          throw Error(`${name} / ${field}: evidence requires an enabled read source and a short exact supporting passage.`);
        }
        if (!profileSourceAt(field,boundary,source.data)) {
          throw Error(`${name} / ${field}: evidence does not establish the active continuity. Use the matching source or leave this section an AU draft.`);
        }
        acceptedSourceIds.add(source.id);
        links.push({ sourceId: source.id, locator: source.data.origin.kind === 'web' ? source.data.origin.locator ?? source.title : source.title,
          synopsis: summary.slice(0, 500), quote: evidence.quote, continuity:source.data.continuity, confidence: 'medium' });
      }
      claims.push({ field, section: profileSections[field], value: summary.trim(), kind: links.length ? 'source_supported' : 'interpretation',
        sourceLinks: links, locked: false, reviewed: false, effectiveArc: boundary.arc, effectiveChapter: boundary.chapter, continuity: boundary.continuity,
        ...(!links.length ? { profileDraft: true as const } : {}) });
    }
    if (!claims.length && !protectedFields.length && (!allowNameOnly || profile.kind!=='original' || Object.keys(profile.sections).length)) {
      throw Error(`${name} needs specific character details. Omit unknown fields and use actual source or user evidence in the available sections.`);
    }
    return { profile, name, existing, claims,protectedFields };
  }));
  if (!world && setup) {
    world = await stories.create(setup.title, scope, {
      originKind: 'fanfiction', franchiseName: setup.franchise.trim(), canonAnchor: boundary.continuity ?? '',
      spoilerArc: boundary.arc, spoilerChapter: boundary.chapter, divergenceNote: setup.divergence?.trim() ?? '',
      narration: { pov: 'third person', tense: 'past', tone: setup.style?.trim() ?? '' },
    });
  }
  const activeWorld: StoryWorld = world!;
  const saved = [];
  for (const { profile, name, existing, claims,protectedFields } of proposals) {
    let character = existing ?? await stories.character(activeWorld.id, name, profile.aliases ?? [], profile.kind);
    if(existing&&existing.data.characterKind==='original'&&profile.kind!=='original'&&claims.some(claim=>claim.sourceLinks.length)){
      const older=await stories.claims(existing.id,activeWorld.id);
      if(older.length&&older.every(({data})=>data.profileDraft&&!hasProfileDetail(data.value))){
        character=await stories.editCharacter(existing,existing.title,{...existing.data,characterKind:profile.kind});
      }
    }
    const written = await stories.saveClaims(character, claims.map(claim => ({ ...claim, characterId: character.id })), false, true, boundary,english);
    const active=category?profileClaimsAt(await stories.claims(character.id,activeWorld.id),boundary):[];
    const activeFields=Object.fromEntries(active.filter(({data})=>Object.hasOwn(profileSections,data.field)).map(({data})=>[data.field,data.value]));
    const categorized=category?await fiction.fillProfile(activeWorld.id,category.id,character.id,activeFields,
      written.filter(claim=>claim.data.kind==='source_supported').map(claim=>claim.data.field),english):undefined;
    saved.push({ id: character.id, name: character.title, saved: written.map(claim => ({ field: claim.data.field, kind: claim.data.kind })),
      preserved: [...protectedFields,...claims.filter(claim => !written.some(item => item.data.field === claim.field)).map(claim => claim.field)],
      ...(categorized?{profileId:categorized.id}:{}) });
  }
  const sourceIds = activeWorld.scope.kind==='library' ? activeWorld.data.sourceIds : [...new Set([...activeWorld.data.sourceIds, ...acceptedSourceIds])];
  const priorRules = activeWorld.data.rules ?? [];
  const nextRules = [...new Map([...priorRules, ...rules].map(rule=>[rule.quote,rule])).values()].slice(0, 16);
  if (sourceIds.length > activeWorld.data.sourceIds.length || nextRules.length > priorRules.length) {
    await stories.update(activeWorld, { sourceIds, rules: nextRules });
  }
  return { storyId: activeWorld.id, profiles: saved, sourceIds: [...acceptedSourceIds],
    ...(category?{destination:{storyId:activeWorld.id,categoryId:category.id,group:activeWorld.title,category:category.title}}:{}) };
}
