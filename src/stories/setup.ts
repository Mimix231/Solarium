import { mentionedCast } from '../engine/intelligence/brief';
import type { ChatSession } from '../domain/types';
import { uid } from '../domain/types';
import { newRecord } from '../foundation/store';
import type { RecordWrite } from '../foundation/types';
import { StoryRepository, claimSections, type ClaimData, type ClaimSection, type StoryCharacter, type StoryData, type StoryWorld } from './repository';

export interface StorySetup {
  title: string; franchise?: string;
  characters: { name: string; aliases?: string[]; kind?: 'canon' | 'original' | 'adapted'; facts: { section: ClaimSection; field: string; value?: string; message_id: string; quote: string }[] }[];
}
const normalized = (text: string) => text.normalize('NFKC').toLowerCase();
/** Punctuation-only model copying errors may resolve to a unique ORIGINAL passage. */
export function humanPassage(source:string,proposal:string):string|null{
  if(!proposal.trim())return null;
  if(source.includes(proposal))return proposal;
  const words=(text:string)=>[...text.matchAll(/[\p{L}\p{N}\p{M}]+/gu)];
  const wanted=words(proposal),actual=words(source);if(wanted.length<4)return null;
  const matches:string[]=[];
  for(let i=0;i+wanted.length<=actual.length;i++)if(wanted.every((w,j)=>normalized(w[0])===normalized(actual[i+j]![0]))){
    const end=actual[i+wanted.length-1]!;matches.push(source.slice(actual[i]!.index,end.index+end[0].length));
  }
  return matches.length===1?matches[0]!:null;
}
/** All authority is checked against actual human messages before one atomic native save. */
export async function saveStorySetup(repo: StoryRepository, session: ChatSession, input: StorySetup): Promise<{ story: StoryWorld; characters: StoryCharacter[]; savedFacts: number }> {
  if (!input || !input.title?.trim() || !Array.isArray(input.characters) || !input.characters.length || input.characters.length > 20) throw Error('Story setup needs a title and 1–20 characters from this conversation.');
  const users = session.messages.filter(m => m.role === 'user');
  const userText = normalized(users.map(m => m.content).join('\n'));
  const allNames=mentionedCast(users.map(m=>m.content).join('\n'));
  const statements = new Map(users.map((m, index) => [m.id, { ...m, index }]));
  const passages=new Map<StorySetup['characters'][number]['facts'][number],string>();
  for (const character of input.characters) {
    if (!character.name?.trim() || !userText.includes(normalized(character.name)) || !Array.isArray(character.facts) || character.facts.length > 20) throw Error('Character names must occur in the user’s own messages.');
    for (const alias of character.aliases ?? []) if (!userText.includes(normalized(alias))) throw Error('Aliases must come from the user’s messages.');
    for (const fact of character.facts) {
      const source = statements.get(fact.message_id);
      const passage=source&&typeof fact.quote==='string'&&fact.quote?humanPassage(source.content,fact.quote):null;
      const ownNames=[character.name,...(character.aliases??[])];
      const alternatives=()=>users.filter(m=>ownNames.some(name=>normalized(m.content).includes(normalized(name)))).slice(-3).map(m=>({message_id:m.id,text:m.content.slice(0,1100)}));
      if(source&&!ownNames.some(name=>normalized(source.content).includes(normalized(name)))&&allNames.length>1)throw Error('The user statement does not identify this character. Use the correct human message ID and exact quote for '+character.name+': '+JSON.stringify(alternatives()));
      if(typeof fact.quote==='string'&&!ownNames.some(name=>normalized(fact.quote).includes(normalized(name)))&&allNames.some(name=>!ownNames.some(own=>normalized(name)===normalized(own)||normalized(name).split(/\s+/).includes(normalized(own)))&&normalized(fact.quote).includes(normalized(name))))throw Error('The quote names a different character. Do not assign their traits to '+character.name+'. Relevant human statements: '+JSON.stringify(alternatives()));
      if (!source || !passage || !claimSections.includes(fact.section) || !fact.field?.trim() || fact.quote.length > 5000 || fact.value!==undefined&&typeof fact.value!=='string') throw Error(`STORY_FACT_EVIDENCE: ${character.name}/${fact.field}: value=${JSON.stringify(fact.value)}, quote=${JSON.stringify(fact.quote)}, message_id=${fact.message_id}. The value must be copied verbatim from that human quotation, not paraphrased. ${source?'Exact user statement: '+source.content:'Read read_task_brief for valid human message IDs.'}`);
      passages.set(fact,passage);
    }
  }
  const scope = session.projectId ? { kind: 'project' as const, id: session.projectId } : { kind: 'chat' as const, id: session.id };
  let story: StoryWorld;
  const writes: RecordWrite[] = [];
  if (session.storyId) story = await repo.world(session.storyId);
  else {
    story = newRecord('story_world', uid(), scope, input.title.trim().slice(0, 180), { originKind: input.franchise ? 'fanfiction' : 'original', franchiseName: input.franchise ?? '', canonAnchor: '', continuityPoint: '', divergenceNote: '', narration: { pov: 'third person', tense: 'past', tone: '' }, sourceIds: [], createdAt: new Date().toISOString() } satisfies StoryData);
    writes.push({ record: story, expected: null });
  }
  const cast = session.storyId ? await repo.characters(story.id) : [];
  const saved: StoryCharacter[] = []; let savedFacts = 0;
  for (const proposed of input.characters) {
    const names = new Set([proposed.name, ...(proposed.aliases ?? [])].map(normalized));
    let character = cast.find(c => [c.title, ...c.data.aliases].some(n => names.has(normalized(n))));
    if (!character) { character = newRecord('story_character', uid(), story.scope, proposed.name.trim(), { aliases: proposed.aliases ?? [], characterKind: proposed.kind ?? 'original', role: '', createdAt: new Date().toISOString() }, story.id); writes.push({ record: character, expected: null }); cast.push(character); }
    if (saved.some(c => c.id === character.id)) throw Error('Duplicate character in one story setup.');
    saved.push(character);
    const previous = session.storyId && !writes.some(w => w.record.id === character!.id) ? await repo.claims(character.id, story.id) : [];
    const fields = new Set<string>();
    for (const fact of proposed.facts) {
      const quote=passages.get(fact)!;
      const value=fact.value&&quote.includes(fact.value)?fact.value:quote;
      const key = `${fact.section}:${fact.field.toLowerCase()}`;
      if (fields.has(key)) throw Error('Duplicate field in one character update.'); fields.add(key);
      const old = previous.find(c => c.data.section === fact.section && c.data.field.toLowerCase() === fact.field.toLowerCase());
      if (old?.data.value === value) continue;
      if (old?.data.locked) {
        const currentSource = statements.get(fact.message_id)!;
        const oldSource = old.data.userMessageId ? statements.get(old.data.userMessageId) : null;
        if (oldSource ? oldSource.index >= currentSource.index : currentSource.index !== users.length - 1 || !/\b(actually|change|instead|correct|now|set)\b/i.test(currentSource.content)) throw Error(`${character.title}/${fact.field} is protected by a newer or manually saved user fact.`);
      }
      const data: ClaimData = { characterId: character.id, section: fact.section, field: fact.field.trim(), value, kind: 'user_defined', locked: true, reviewed: true, sourceLinks: [], userMessageId: fact.message_id, userQuote: quote, ...(fact.section === 'Knowledge State' ? { dynamicKnowledge: !/\b(never|always)\b/i.test(value), knowledgeAfterEvent: session.storyId ? Math.max(0, ...(await repo.events(story.id)).map(e => e.data.order)) : 0 } : {}) };
      const record = old ? { ...old, data, version: old.version + 1, updatedAt: new Date().toISOString() } : newRecord('character_claim', uid(), story.scope, data.field, data, story.id);
      writes.push({ record, expected: old?.version ?? null }); savedFacts++;
      if (old) writes.push({ record: newRecord('character_claim_revision', uid(), story.scope, old.title, { ...old.data, claimId: old.id, version: old.version }, story.id), expected: null });
    }
  }
  if (writes.length) await repo.store.batch(writes);
  return { story, characters: saved, savedFacts };
}
