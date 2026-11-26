import { rankedEvidence } from '../foundation/relevance';
import { now, uid } from '../domain/types';
import { foundationStore, newRecord } from '../foundation/store';
import { accessibleScopes, assertScope, sameScope, type AccessContext, type LibraryScope, type RecordStore, type StoredRecord } from '../foundation/types';
import { SourceRepository } from '../sources/repository';
import { containsWritingPassage } from '../writing/schema';
import { WritingRepository } from '../writing/repository';
import { castForSelection, FictionRepository, fictionCollections, hasProfileDetail, isStoryIcon, type FictionSelection } from './fiction';
import { authoredPointIsAvailable, canonPointLabel, editionMatches, pointIsAvailable, type CanonPoint } from './canon';
import { hasUntranslatedScript } from './language';
export interface StoryRule { quote: string; messageId: string }
export interface StoryData {originKind:'original'|'fanfiction'|'mixed';franchiseName:string;canonAnchor:string;continuityPoint:string;spoilerArc?:number;spoilerChapter?:number;divergenceNote:string;storyBrief?:string;narration:{pov:string;tense:string;tone:string};parentStoryId?:string;sourceIds:string[];createdAt:string;icon?:string;chapterTarget?:number;dialogueLayout?:'speaker'|'prose';rules?:StoryRule[]}
export type StoryWorld=StoredRecord<StoryData>;
export const claimSections=['Identity','Appearance','Personality & Voice','Motivations','History','Abilities','Relationships','Knowledge State','Situation','Story Role','AU Changes'] as const;
export type ClaimSection=typeof claimSections[number];
export const claimKinds=['canon_confirmed','source_supported','interpretation','user_defined','au_override','disputed','unknown','story_established'] as const;
export type ClaimKind=typeof claimKinds[number];
export interface EvidenceLink {sourceId:string;locator:string;synopsis:string;quote?:string;continuity?:string;confidence:'high'|'medium'|'low'}
export interface CharacterData {aliases:string[];characterKind:'canon'|'original'|'adapted';role:string;portrait?:string;createdAt:string}
export type StoryCharacter=StoredRecord<CharacterData>;
export interface ClaimData {characterId:string;section:ClaimSection;field:string;value:string;kind:ClaimKind;sourceLinks:EvidenceLink[];locked:boolean;effectiveArc?:number;effectiveChapter?:number;reviewed:boolean;dynamicKnowledge?:boolean;knowledgeAfterEvent?:number;userMessageId?:string;userQuote?:string;profileDraft?:true;continuity?:string}
export type CharacterClaim=StoredRecord<ClaimData>;
export interface EventData {order:number;arc?:number;chapter?:number;continuity?:string;characters:string[];kind:ClaimKind;sourceLinks:EvidenceLink[];knowledge:Record<string,'knows'|'suspects'|'unknown'>;summary:string;beliefs?:Record<string,{text:string;quote:string}>;documentId?:string;revisionId?:string;quote?:string}
export interface RelationData {from:string;to:string;nature:string;effectiveArc?:number;effectiveChapter?:number;sourceLinks:EvidenceLink[]}
export type StoryEvent=StoredRecord<EventData>;
export type StoryRelation=StoredRecord<RelationData>;
export const storyBriefLimit = 12_000;
export function validateStoryAppearance(data: Partial<StoryData>) {
  if (data.icon !== undefined && !isStoryIcon(data.icon)) throw Error('Choose a local PNG, JPEG, or WebP group icon up to 1.5 MB.');
  if (data.chapterTarget !== undefined && (!Number.isSafeInteger(data.chapterTarget) || data.chapterTarget < 8_000 || data.chapterTarget > 1_500_000)) {
    throw Error('Use a chapter target from 8,000 to 1,500,000 characters.');
  }
  if (data.dialogueLayout !== undefined && !['speaker', 'prose'].includes(data.dialogueLayout)) throw Error('Invalid dialogue layout.');
  if(data.storyBrief!==undefined&&(typeof data.storyBrief!=='string'||data.storyBrief.length>storyBriefLimit))throw Error('Use up to 12,000 characters for the story brief.');
}
export function withinBoundary(arc:number|undefined,chapter:number|undefined,story:StoryWorld):boolean {
  if(story.data.spoilerArc===undefined||arc===undefined)return true;
  return arc<story.data.spoilerArc||arc===story.data.spoilerArc&&(story.data.spoilerChapter===undefined||chapter===undefined||chapter<=story.data.spoilerChapter);
}
/** Exact IDs/names first; a short name is usable only when it resolves uniquely. */
export function storyCanonPoint(story: StoryWorld): CanonPoint {
  return { arc: story.data.spoilerArc, chapter: story.data.spoilerChapter, continuity: story.data.canonAnchor };
}

export function profileClaimsAt(claims: readonly CharacterClaim[], point: CanonPoint): CharacterClaim[] {
  const available = claims.filter(({data}) => pointIsAvailable(point, {arc:data.effectiveArc,chapter:data.effectiveChapter,continuity:data.continuity}) &&
    data.sourceLinks.every(link => editionMatches(point.continuity, link.continuity)) &&
    (!data.profileDraft || hasProfileDetail(data.value)));
  const appliesLock = (data: ClaimData) => data.locked && (data.effectiveArc === undefined || point.arc === undefined || data.effectiveArc === point.arc);
  available.sort((a,b) => Number(appliesLock(b.data))-Number(appliesLock(a.data)) ||
    (b.data.effectiveArc??0)-(a.data.effectiveArc??0) || (b.data.effectiveChapter??0)-(a.data.effectiveChapter??0) ||
    Number(b.data.kind==='source_supported')-Number(a.data.kind==='source_supported') || b.updatedAt.localeCompare(a.updatedAt));
  const seen = new Set<string>();
  return available.filter(({data}) => {
    const key = `${data.section}:${data.field.toLowerCase()}`;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

export function resolveStoryCharacter(cast:readonly StoryCharacter[],reference:string):StoryCharacter|null{
  const key=reference.trim().normalize('NFKC').toLowerCase();
  const exact=cast.filter(c=>c.id===reference||[c.title,...c.data.aliases].some(n=>n.trim().normalize('NFKC').toLowerCase()===key));
  if(exact.length===1)return exact[0]!;if(exact.length>1)return null;
  if(!key||/\s/.test(key))return null;
  const short=cast.filter(c=>c.title.normalize('NFKC').toLowerCase().split(/\s+/).includes(key));
  return short.length===1?short[0]!:null;
}
export class StoryRepository {
  constructor(public context:AccessContext,public store:RecordStore=foundationStore){}
  scopes(){return accessibleScopes(this.context,true);}
  async list():Promise<StoryWorld[]>{return this.store.list<StoryData>({collection:'story_world',scopes:this.scopes()});}
  async world(id:string):Promise<StoryWorld>{const s=(await this.list()).find(s=>s.id===id);if(!s)throw Error('Story World is outside this conversation/project.');return s;}
  async create(title:string,scope:LibraryScope,data:Partial<StoryData>={}):Promise<StoryWorld>{
    assertScope(scope,this.context,true);if(!title.trim())throw Error('A Story World title is required.');
    validateStoryAppearance(data);
    const rec=newRecord('story_world',uid(),scope,title.trim().slice(0,180),{originKind:'original',franchiseName:'',canonAnchor:'',continuityPoint:'',divergenceNote:'',narration:{pov:'third person',tense:'past',tone:''},sourceIds:[],createdAt:now(),...data} satisfies StoryData);
    await this.store.batch([{record:rec,expected:null}]);return rec;
  }
  async update(story:StoryWorld,patch:Partial<StoryData>,title=story.title):Promise<StoryWorld>{
    await this.world(story.id);if(!title.trim())throw Error('A story title is required.');
    validateStoryAppearance(patch);
    if(patch.sourceIds)for(const id of patch.sourceIds)await new SourceRepository(this.context,this.store).get(id);
    const next={...story,title:title.slice(0,180),version:story.version+1,data:{...story.data,...patch},updatedAt:now()};await this.store.batch([{record:next,expected:story.version}]);return next;
  }
  async characters(storyId:string):Promise<StoryCharacter[]>{await this.world(storyId);return this.store.list<CharacterData>({collection:'story_character',scopes:this.scopes(),storyId});}
  async character(storyId:string,name:string,aliases:string[]=[],kind:CharacterData['characterKind']='canon'):Promise<StoryCharacter>{
    const story=await this.world(storyId);if(!name.trim())throw Error('A character name is required.');
    const names=new Set([name,...aliases].map(n=>n.trim().normalize('NFKC').toLowerCase()));
    const existing=(await this.characters(storyId)).find(c=>[c.title,...c.data.aliases].some(n=>names.has(n.trim().normalize('NFKC').toLowerCase())));if(existing)return existing;
    const rec=newRecord('story_character',uid(),story.scope,name.trim().slice(0,120),{aliases,characterKind:kind,role:'',createdAt:now()},storyId);await this.store.batch([{record:rec,expected:null}]);return rec;
  }
  async editCharacter(character:StoryCharacter,title:string,data:CharacterData):Promise<StoryCharacter>{
    const cast=await this.characters(character.storyId!);if(!cast.some(c=>c.id===character.id&&sameScope(c.scope,character.scope)))throw Error('Character is unavailable.');
    title=title.trim();if(!title)throw Error('A character name is required.');
    const names=new Set([title,...data.aliases].map(n=>n.trim().normalize('NFKC').toLowerCase()));if(cast.some(c=>c.id!==character.id&&[c.title,...c.data.aliases].some(n=>names.has(n.trim().normalize('NFKC').toLowerCase()))))throw Error('Another character already uses that name or alias. Open its card instead.');
    if(data.portrait&&!/^data:image\/(?:png|jpeg|webp);base64,/.test(data.portrait))throw Error('Use a local image; remote portrait requests are disabled.');
    const next={...character,title,version:character.version+1,updatedAt:now(),data};await this.store.batch([{record:next,expected:character.version}]);return next;
  }
  async claims(characterId:string,storyId:string):Promise<CharacterClaim[]>{
    if(!(await this.characters(storyId)).some(c=>c.id===characterId))throw Error('Character is outside this story.');
    return (await this.store.list<ClaimData>({collection:'character_claim',scopes:this.scopes(),storyId})).filter(c=>c.data.characterId===characterId);
  }
  async saveClaims(character:StoryCharacter,claims:ClaimData[],userEdit=false,fillEmpty=false,point?:CanonPoint,english=false):Promise<CharacterClaim[]>{
    const story=await this.world(character.storyId!);if(!(await this.characters(story.id)).some(c=>c.id===character.id))throw Error('Character is outside this story.');
    const previous=await this.claims(character.id,story.id);const sources=new SourceRepository(this.context,this.store);const writes:import('../foundation/types').RecordWrite[]=[];const result:CharacterClaim[]=[];const fields=new Set<string>();
    for(const claim of claims){
      if(!claimSections.includes(claim.section)||!claimKinds.includes(claim.kind)||!claim.field?.trim()||typeof claim.value!=='string'||claim.value.length>5000)throw Error('Invalid character section/claim.');
      const boundary=point??storyCanonPoint(story);
      if(!pointIsAvailable(boundary,{arc:claim.effectiveArc,chapter:claim.effectiveChapter,continuity:claim.continuity}))throw Error('Claim is outside the selected continuity or beyond the spoiler boundary.');
      const key=`${claim.section}:${claim.field.toLowerCase()}`;if(fields.has(key))throw Error('Duplicate claim field in one update.');fields.add(key);
      const versions=previous.filter(c=>c.data.section===claim.section&&c.data.field.toLowerCase()===claim.field.toLowerCase());
      if(fillEmpty&&versions.some(c=>c.data.locked && (c.data.effectiveArc===undefined||boundary.arc===undefined||c.data.effectiveArc===boundary.arc) && pointIsAvailable(boundary,{
        arc:c.data.effectiveArc,chapter:c.data.effectiveChapter,continuity:c.data.continuity})))continue;
      const old=versions.find(c=>c.data.effectiveArc===claim.effectiveArc && c.data.effectiveChapter===claim.effectiveChapter &&
        Boolean(c.data.continuity)===Boolean(claim.continuity) && editionMatches(c.data.continuity,claim.continuity));
      const translated=old&&english&&!old.data.reviewed&&hasUntranslatedScript(old.data.value)&&!hasUntranslatedScript(claim.value);
      if(old&&fillEmpty&&!translated&&!(old.data.profileDraft&&(claim.kind==='source_supported'||!hasProfileDetail(old.data.value))))continue;
      if(old?.data.locked&&!userEdit)throw Error(`${old.title} is locked by the user.`);
      if(['canon_confirmed','source_supported'].includes(claim.kind)){
        if(!claim.sourceLinks?.length)throw Error('Supported claims require an evidence source.');
        for(const link of claim.sourceLinks){
          const source=await sources.get(link.sourceId);
          if(!pointIsAvailable(boundary,source.source.data))throw Error('Evidence is beyond the story spoiler boundary or uses a different continuity.');
          if(!userEdit&&(!link.quote||link.quote.length>500||!source.content.includes(link.quote)))throw Error('Machine extraction requires a short exact supporting excerpt from the saved source.');
          if(!userEdit&&claim.kind==='canon_confirmed')throw Error('Canon confirmation requires user review. Use source_supported for machine extraction.');
        }
      }
      if(!userEdit&&['au_override','user_defined','story_established'].includes(claim.kind)&&story.data.originKind!=='original')throw Error('New AU or story facts require explicit user approval.');
      const rec:CharacterClaim=old?{...old,data:{...claim,characterId:character.id,reviewed:userEdit},version:old.version+1,updatedAt:now()}:newRecord('character_claim',uid(),story.scope,claim.field,{...claim,characterId:character.id,reviewed:userEdit},story.id);
      writes.push({record:rec,expected:old?.version??null});result.push(rec);
      if(old)writes.push({record:newRecord('character_claim_revision',uid(),story.scope,old.title,{...old.data,claimId:old.id,version:old.version},story.id),expected:null});
    }
    if(writes.length)await this.store.batch(writes);return result;
  }
  async events(storyId:string):Promise<StoryEvent[]>{await this.world(storyId);return this.store.list<EventData>({collection:'story_event',scopes:this.scopes(),storyId});}
  async relations(storyId:string):Promise<StoryRelation[]>{await this.world(storyId);return this.store.list<RelationData>({collection:'story_relation',scopes:this.scopes(),storyId});}
  async event(storyId:string,title:string,data:EventData):Promise<StoryEvent>{const s=await this.world(storyId);const cast=await this.characters(storyId);if(data.characters.some(id=>!cast.some(c=>c.id===id)))throw Error('An event character belongs to another story.');const rec=newRecord('story_event',uid(),s.scope,title,data,storyId);await this.store.batch([{record:rec,expected:null}]);return rec;}
  async relation(storyId:string,title:string,data:RelationData):Promise<StoryRelation>{const s=await this.world(storyId);const cast=await this.characters(storyId);if(!cast.some(c=>c.id===data.from)||!cast.some(c=>c.id===data.to))throw Error('Relationship participants must belong to this Story World.');const rec=newRecord('story_relation',uid(),s.scope,title,data,storyId);await this.store.batch([{record:rec,expected:null}]);return rec;}
  async branch(storyId:string,title:string,divergence:string):Promise<StoryWorld>{
    const parent=await this.world(storyId);const child=await this.create(title,parent.scope,{...parent.data,parentStoryId:parent.id,divergenceNote:divergence});
    const records=(await this.store.list({scopes:this.scopes(),storyId})).filter(r=>['story_character','character_claim','story_event','story_relation', ...fictionCollections].includes(r.collection));
    const map=new Map(records.map(r=>[r.id,uid()]));
    const remap=(v:unknown):unknown=>typeof v==='string'?(map.get(v)??v):Array.isArray(v)?v.map(remap):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,val])=>[map.get(k)??k,remap(val)])):v;
    await this.store.batch(await Promise.all(records.map(async r=>({record:{...r,id:map.get(r.id)!,storyId:child.id,version:1,updatedAt:now(),data:remap(r.data)},
      ...(r.collection.startsWith('story_profile') ? { body: (await this.store.body(r.id, [r.scope])) ?? undefined } : {}), expected:null}))));return child;
  }
  async contextPack(storyId:string,request:string,compact=false,selection?:FictionSelection|null,point?:CanonPoint,castIds?:readonly string[]):Promise<string>{
    const original=await this.world(storyId),characters=await this.characters(storyId);
    const fiction=new FictionRepository(this);
    const selected=selection?await fiction.selection(storyId,selection):undefined;
    const categoryPoint=selected?.category.data;
    const boundary=point??{arc:categoryPoint?.arc??original.data.spoilerArc,chapter:categoryPoint?.chapter??original.data.spoilerChapter,
      continuity:categoryPoint?.continuity||original.data.canonAnchor};
    const story=original;
    const events=await this.activeEvents(storyId,boundary);
    const requestWords = ' ' + request.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ') + ' ';
    const named=characters.filter(character => [character.title, ...character.data.aliases].some(name => {
      const words = name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      return words && requestWords.includes(` ${words} `);
    }));
    const recent=new Set(events.slice(-3).flatMap(e=>e.data.characters));
    const restricted=castIds??(selection?.characterIds.length?selection.characterIds:undefined);
    const cast=restricted?restricted.length?castForSelection(characters,{categoryId:selection?.categoryId??'',characterIds:[...restricted]}):[]:
      rankedEvidence(characters,request,c=>[c.title,...c.data.aliases,c.data.role].join(' '),c=>(named.includes(c)?30:0)+(recent.has(c.id)?3:0)).map(r=>r.item).slice(0, compact ? 8 : 24);
    const matchingProfiles=(selected?.profiles.length?selected.profiles:selected?await fiction.profiles(storyId,selected.category.id):[])
      .filter(profile=>cast.some(character=>character.id===profile.data.characterId));
    const profiles=matchingProfiles.length&&pointIsAvailable(boundary,categoryPoint??{})&&
      (!categoryPoint?.arc||categoryPoint.arc===boundary.arc)?await fiction.excerpts(matchingProfiles,request,compact?1700:4500):'';
    const claimBudget=compact?Math.max(1000,3100-profiles.length):Math.max(4000,12000-profiles.length);
    const perCharacter = Math.max(100, Math.floor(claimBudget / Math.max(1, cast.length)));
    const sections:string[]=profiles?['Selected category '+selected!.category.title+' · User profile excerpts',profiles]:[];
    const brief=story.data.storyBrief?.trim()??'';
    const briefLimit=compact?1900:6200;
    if(brief){
      const parts=brief.length>briefLimit?(brief.match(/[\s\S]{1,595}(?:\s|$)|[\s\S]{1,595}/gu)??[]):[];
      const excerpt=parts.length?[parts[0],...rankedEvidence(parts.slice(1),request,part=>part)
        .slice(0,Math.floor(briefLimit/600)-1).map(hit=>hit.item)].join('\n').slice(0,briefLimit):brief;
      sections.unshift('Author’s story brief\n'+excerpt);
    }
    for(const character of cast){
      const claims=profileClaimsAt(await this.claims(character.id,story.id),boundary);
      const ranked=rankedEvidence(claims,request,c=>`${c.data.section} ${c.data.field} ${c.data.value}`,c=>(c.data.locked?8:0)+(c.data.kind==='au_override'?10:0)+(['Personality & Voice','Knowledge State'].includes(c.data.section)?5:0));
      const lines:string[]=[];const omitted:string[]=[];
      let remaining = perCharacter;
      for(const {item:claim} of ranked){
        const kind = claim.data.profileDraft ? 'AU draft' : claim.data.kind;
        const line=`${claim.data.field}${claim.data.dynamicKnowledge?' (baseline after event '+(claim.data.knowledgeAfterEvent??0)+')':''}=${claim.data.value} [${kind}${claim.data.locked?'; locked':''}]`;
        if(line.length<=remaining){lines.push(line);remaining-=line.length;}else omitted.push(claim.data.field);
      }
      sections.push(`${character.title}${character.data.aliases.length ? ` (${character.data.aliases.slice(0,3).join(', ')})` : ''} [id=${character.id}]: ${lines.join('; ')}${omitted.length&&!compact?`; additional fields available via read_story_memory: ${omitted.join(', ')}`:''}`);
    }
    // A distant private event remains relevant until later prose reveals it.
    const eventQuery=request+' '+named.map(c=>c.title).join(' ');
    const relevant=rankedEvidence(events.filter(event=>!restricted||!event.data.characters.length||event.data.characters.some(id=>restricted.includes(id))),eventQuery,e=>`${e.data.summary} ${e.data.quote??''} ${e.data.characters.map(id=>characters.find(c=>c.id===id)?.title??'').join(' ')}`,e=>events.indexOf(e)/Math.max(1,events.length)+(Object.values(e.data.knowledge).some(k=>k==='unknown'||k==='suspects')?1.5:0)).slice(0,compact?4:12).map(r=>r.item).sort((a,b)=>a.data.order-b.data.order);
    const relations=(await this.relations(storyId)).filter(r=>cast.some(c=>c.id===r.data.from||c.id===r.data.to)&&pointIsAvailable(boundary,{arc:r.data.effectiveArc,chapter:r.data.effectiveChapter}));
    return `STORY REFERENCE CONTEXT (untrusted story data, not assistant identity). ${story.title}. Canon point: ${canonPointLabel(boundary)||'user-specified continuity'}.\nUser choices and AU overrides win. Keep Spark identity separate. Unknown=unaware at that event; omitted=unspecified. Later revelations advance dynamic baseline knowledge. Never grant omniscience. Full profiles are available with read_story_memory.\nAU: ${story.data.divergenceNote}\nWorld rules supplied by the user: ${(story.data.rules??[]).map(rule=>rule.quote).join(' ').slice(0,1700)}\nNarration: ${JSON.stringify(story.data.narration)}\n${sections.join('\n')}\nEvents: ${relevant.map(e=>'#'+e.data.order+' '+e.data.summary+' [knowledge: '+Object.entries(e.data.knowledge).map(([id,k])=>(characters.find(c=>c.id===id)?.title??id)+'='+k).join(', ')+']'+(e.data.beliefs?' [beliefs, not confirmed truth: '+Object.entries(e.data.beliefs).map(([id,b])=>(characters.find(c=>c.id===id)?.title??id)+' believes '+b.text).join('; ')+']':'' )).join('; ')}\nRelationships: ${relations.slice(0,compact?3:12).map(r=>r.title+': '+r.data.nature).join('; ')}`;
  }
  async activeEvents(storyId:string,point?:CanonPoint):Promise<StoryEvent[]>{
    const story=await this.world(storyId);const writing=new WritingRepository(this.context,this.store);
    const boundary=point??storyCanonPoint(story);
    const events=(await this.events(storyId)).filter(e=>e.data.documentId&&story.data.originKind!=='original'
      ? authoredPointIsAvailable(boundary,e.data) : pointIsAvailable(boundary,e.data));
    const documents=new Map(await Promise.all([...new Set(events.flatMap(e=>e.data.documentId?[e.data.documentId]:[]))].map(async id=>[id,await writing.get(id).catch(()=>null)] as const)));
    return events.filter(e=>{if(!e.data.documentId)return true;const document=documents.get(e.data.documentId);return Boolean(e.data.quote&&document&&containsWritingPassage(document.content,e.data.quote));}).map(e=>{if(!e.data.beliefs||!e.data.documentId)return e;const document=documents.get(e.data.documentId);return {...e,data:{...e.data,beliefs:Object.fromEntries(Object.entries(e.data.beliefs).filter(([,belief])=>document&&containsWritingPassage(document.content,belief.quote)))}};}).sort((a,b)=>a.data.order-b.data.order);
  }
  async review(storyId:string,text:string):Promise<{claimId:string;message:string}[]>{
    const story=await this.world(storyId);const issues:{claimId:string;message:string}[]=[];
    for(const c of await this.characters(storyId))for(const cl of await this.claims(c.id,storyId)){
      if(!withinBoundary(cl.data.effectiveArc,cl.data.effectiveChapter,story)&&text.toLowerCase().includes(cl.data.value.toLowerCase()))issues.push({claimId:cl.id,message:`Possible spoiler: ${cl.data.field} is after this story's boundary.`});
      if(cl.data.kind==='disputed'&&text.toLowerCase().includes(c.title.toLowerCase()))issues.push({claimId:cl.id,message:`${c.title}: review disputed ${cl.data.field} against its evidence.`});
      if(cl.data.locked&&cl.data.value.startsWith('Never ')&&text.toLowerCase().includes(cl.data.value.slice(6).toLowerCase()))issues.push({claimId:cl.id,message:`Possible conflict with locked constraint ${c.title}: ${cl.data.value}`});
    }return issues;
  }
}
