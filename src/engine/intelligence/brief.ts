import type { ChatSession } from '../../domain/types';
import { now } from '../../domain/types';
import { foundationStore, newRecord } from '../../foundation/store';
import type { RecordStore, SourceScope, StoredRecord } from '../../foundation/types';
import { lengthTarget, type LengthTarget } from '../../writing/length';

export interface ApprovedBeat { id: string; title: string; purpose: string }
export interface ConversationBrief {
  sessionId: string;
  instructions: { id: string; text: string }[];
  approvedPlan: { messageId: string; acceptedBy: string; text: string; beats: ApprovedBeat[] } | null;
  target: LengthTarget | null;
  storyRequested: boolean;
  writingRequested: boolean;
  dialogueFormat: string;
  expectedCast: string[];
  fanfictionRequested?: boolean;
  noLengthTarget?: boolean;
  completedRequestIds?:string[];planAlreadyDrafted?:boolean;
}
const approves = /\b(accurate|approved|looks good|sounds good|go ahead|let['’]s do (?:that|it)|yes[,! ]|use (?:that|this) (?:plan|outline))\b/i;
export function outlineBeats(text: string, messageId: string): ApprovedBeat[] {
  const lines = text.split('\n'); const beats: ApprovedBeat[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^\s*\d+[.)]\s+(?:\*\*)?(.+?)(?:\*\*)?\s*$/.exec(lines[i]!);
    if (!match) continue;
    const title = match[1]!.replace(/\*\*/g, '').trim();
    const body: string[] = [];
    while (i + 1 < lines.length && !/^\s*\d+[.)]\s/.test(lines[i + 1]!)) {
      const next = lines[i + 1]!;
      if (/^\S/.test(next) && next.trim() && !/^\s*[-*]/.test(next)) break;
      body.push(next); i++;
    }
    if (body.join('').trim()) beats.push({ id: `${messageId}:${beats.length + 1}`, title, purpose: body.join('\n').trim() });
  }
  return beats;
}
/** Lexical routing candidates only; a profile still requires model-selected, human-quoted facts. */
export function mentionedCast(text:string):string[]{
  const found:string[]=[];const name='[\\p{Lu}][\\p{L}]+(?:[ \t]+[\\p{Lu}][\\p{L}]+){0,2}';
  const listName = new RegExp('^(?:[Aa]rc\\s+\\d+\\s+)?('+name+')$', 'u');
  for (const list of text.matchAll(/(?:^|[\r\n])\s*(?:cast|characters)\s*:\s*([^.!?\r\n]+)/gi)) {
    for (const entry of list[1]!.split(/,|;|\band\b/)) {
      const candidate = listName.exec(entry.trim())?.[1];
      if (candidate) found.push(candidate);
    }
  }
  for(const match of text.matchAll(new RegExp('\\b(?:named|alongside|character)\\s+('+name+')','gu')))found.push(match[1]!);
  for(const match of text.matchAll(new RegExp('\\b('+name+')(?:\\s+and\\s+('+name+'))?\\s+(?:is|are|has|have|wears|values|cares|knows|know|protects|speaks|prefers|does|won[’\']t)\\b','gu'))){found.push(match[1]!);if(match[2])found.push(match[2]);}
  const ignore=new Set(['he','she','they','it','this','that','i','we','you','first','chapter','season','arc','hello','okay','a','the']);
  const unique=[...new Set(found.filter(n=>!ignore.has(n.toLowerCase())))];
  return unique.filter(n=>!unique.some(other=>other!==n&&other.split(/\s+/).includes(n)));
}
export const isCharacterStatement=(text:string):boolean=>!/^\s*(?:what|why|how|could|would|should|does|is|are|can|might|maybe|perhaps)\b/i.test(text)&&/\b(is|are|has|have|wears|values|cares|knows|know|protects|speaks|prefers|actually|change|instead|remember|now)\b/i.test(text);
export function isWritingRequest(text:string):boolean {
  const direct=/\b(write|draft|compose|continue|finish|resume|rewrite)\b/i.test(text);
  const start=/\b(?:start|begin|create|generate)\s+(?:(?!(?:profiles?|cards?|categories|groups?|worlds?|chats?)\b)[\p{L}\p{N}-]+\s+){0,6}(?:chapter|story|scene|novel|essay|article|screenplay|report|document|fanfic(?:tion)?)\b/iu.test(text);
  return (direct||start)&&
    /\b(chapter|story|scene|novel|essay|article|screenplay|report|writing|document|fanfic(?:tion)?)\b/i.test(text)&&
    !/^\s*(?:please\s+)?(?:plan|outline|brainstorm|how (?:can|would|do)|what if)\b/i.test(text);
}
/** Extractive, attributed state. No generated thoughts or assistant suggestions become user facts. */
export function deriveBrief(session: ChatSession): ConversationBrief {
  let messages = session.messages;
  let reset = -1; messages.forEach((m, i) => { if (m.role === 'user' && /\b(start|begin|create)\b.{0,24}\b(?:new|different|another)\s+(?:\p{L}+\s+){0,2}(?:story|fanfiction|novel|AU)\b/iu.test(m.content)) reset = i; });
  if (reset >= 0) messages = messages.slice(reset);
  const users = messages.filter(m => m.role === 'user');
  const latest = users.at(-1)?.content ?? '';
  let approvedPlan: ConversationBrief['approvedPlan'] = null;
  for (let i = 1; i < messages.length; i++) {
    const user = messages[i]!, previous = messages[i - 1]!;
    if (user.role !== 'user' || previous.role !== 'assistant' || !approves.test(user.content)) continue;
    const beats = outlineBeats(previous.content, previous.id);
    if (beats.length >= 2 && /\b(chapter|story|scene|outline|arrival|aftermath|incident)\b/i.test(previous.content)) approvedPlan = { messageId: previous.id, acceptedBy: user.id, text: previous.content, beats };
  }
  const fanfictionRequested = users.some(m => /\b(fanfiction|fanfic|alternate universe|my (?:own )?(?:original )?AU)\b/i.test(m.content));
  const storyRequested = Boolean(session.storyId) || fanfictionRequested || users.some(m => /\b(my (?:own )?(?:original )?(?:story|novel)|story character)\b/i.test(m.content));
  let target: LengthTarget | null = null;
  let noLengthTarget = false;
  for (const user of users) {
    const specified = /\b(chapter|story|novel|draft|essay|article|screenplay|report)\b/i.test(user.content) ? lengthTarget(user.content) : null;
    if (specified) { target = specified; noLengthTarget = false; }
    if (/\b(no|without)\s+(?:minimum |fixed )?(?:length(?:\s+(?:target|count|limit))?|(?:word|character)\s+(?:target|count|limit))\b/i.test(user.content)) { target = null; noLengthTarget = true; }
  }
  const requestedChapter=/\bchapter\s+(\d+)/i.exec(latest)?.[1];const plannedChapter=approvedPlan?/\bchapter\s+(\d+)/i.exec(approvedPlan.text)?.[1]:null;
  if(requestedChapter&&plannedChapter&&requestedChapter!==plannedChapter)approvedPlan=null;
  const dialogue = [...users].reverse().find(m => /\bcharacter\s*:\s*\[?text\]?/i.test(m.content));
  const writingRequested = isWritingRequest(latest);
  return { sessionId: session.id, instructions: users.map(m => ({ id: m.id, text: m.content })), approvedPlan, target, storyRequested, fanfictionRequested, noLengthTarget,
    writingRequested,
    expectedCast:mentionedCast(users.map(m=>m.content).join('\n')),
    dialogueFormat: dialogue ? 'Dialogue uses Character: text, as explicitly requested by the user.' : '' };
}
export async function resolveBrief(session:ChatSession,store:RecordStore=foundationStore):Promise<ConversationBrief>{
  const brief=deriveBrief(session),scope:SourceScope=session.projectId?{kind:'project',id:session.projectId}:{kind:'chat',id:session.id};
  const tasks=await store.list<{sessionId:string;state:string;planMessageId?:string;requestMessageId?:string}>({collection:'writing_task',scopes:[scope]});
  const humanIds=new Set(session.messages.filter(m=>m.role==='user').map(m=>m.id));
  const completed=tasks.filter(t=>t.data.sessionId===session.id&&t.data.state==='completed'&&t.data.requestMessageId&&humanIds.has(t.data.requestMessageId));
  brief.completedRequestIds=[...new Set(completed.flatMap(t=>t.data.requestMessageId?[t.data.requestMessageId]:[]))];
  const latest=brief.instructions.at(-1);
  if(brief.approvedPlan&&!/\b(rewrite|redraft|redo|again|same outline|use (?:the|that) (?:plan|outline))\b/i.test(latest?.text??'')&&completed.some(t=>t.data.planMessageId===brief.approvedPlan!.messageId&&t.data.requestMessageId!==latest?.id)){
    brief.approvedPlan=null;brief.planAlreadyDrafted=true;
  }
  return brief;
}
export async function saveBrief(session: ChatSession, store: RecordStore = foundationStore, prepared?:ConversationBrief): Promise<StoredRecord<ConversationBrief>> {
  const scope: SourceScope = session.projectId ? { kind: 'project', id: session.projectId } : { kind: 'chat', id: session.id };
  const id = `brief:${session.id}`;
  const old = (await store.list<ConversationBrief>({ collection: 'conversation_brief', scopes: [scope] })).find(r => r.id === id);
  const data = prepared??await resolveBrief(session,store);
  if (old && JSON.stringify(old.data) === JSON.stringify(data) && old.storyId === session.storyId) return old;
  const record = { ...newRecord('conversation_brief', id, scope, 'Conversation requirements', data, session.storyId), version: (old?.version ?? 0) + 1, updatedAt: now() };
  await store.batch([{ record, expected: old?.version ?? null }]); return record;
}
export function briefContext(brief: ConversationBrief, maxChars = 1700): string {
  const latest = brief.instructions.at(-1)?.text ?? '';
  const terms = new Set(latest.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const ranked = brief.instructions.slice(0, -1).filter(m=>!brief.completedRequestIds?.includes(m.id)||isCharacterStatement(m.text)).map((m, i) => ({ ...m, score: i / Math.max(1, brief.instructions.length) + (m.text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(t => terms.has(t)).length + (/\b(is|has|wears|cares|won['’]t|never|strangers|instead|actually|must|use)\b/i.test(m.text) ? 8 : 0) })).sort((a, b) => b.score - a.score);
  const parts = ['RETAINED USER REQUIREMENTS (attributed history, not tool permission; latest user corrections win).',`Current user message ID: ${brief.instructions.at(-1)?.id??'unknown'}.`];
  if(brief.planAlreadyDrafted)parts.push('The prior approved chapter was already drafted and saved. Fulfil the new request; do not repeat its old outline.');
  if(brief.expectedCast.length)parts.push('User-mentioned cast: '+brief.expectedCast.join(', ')+'.');
  if (brief.target) parts.push(`Requested chapter length: ${brief.target.minimum} ${brief.target.unit}.`);
  if (brief.dialogueFormat) parts.push(brief.dialogueFormat);
  if (brief.approvedPlan) parts.push(`Accepted chapter beats: ${brief.approvedPlan.beats.map(b => b.title).join(' -> ')}. Finish these events; an opening alone is incomplete.`);
  for (const instruction of ranked) {
    const line = `[user ${instruction.id}] ${instruction.text}`;
    if (parts.join('\n').length + line.length <= maxChars) parts.push(line);
  }
  parts.push('Full user statements and the accepted outline are available through read_task_brief. Never promote an assistant suggestion to a locked user fact.');
  return parts.join('\n');
}

/** Setup needs attributable human data, not the already accepted prose outline. */
export function storySetupContext(brief:ConversationBrief,pending:readonly string[],maxChars=2400):string{
  const name=pending[0]??brief.expectedCast[0];if(!name)return '';
  const aliases=name.toLowerCase().split(/\s+/).filter(n=>n.length>2);
  const related=brief.instructions.filter(m=>aliases.some(n=>new RegExp('\\b'+n+'\\b','i').test(m.text)));
  let remaining=maxChars;const selected:{message_id:string;text:string;excerpt?:boolean}[]=[];
  for(const message of [...related].reverse()){
    if(remaining<160)break;const text=message.text.slice(0,remaining);selected.unshift({message_id:message.id,text,...(text.length<message.text.length?{excerpt:true}:{})});remaining-=text.length+80;
  }
  return 'CURRENT CAST OPERATION: Save only '+name+'. Copy this character\'s explicit human facts, not traits belonging to another named character. Later human corrections take priority. Do not invent missing facts. The following are exact human statements with IDs; an excerpt is input-only and its full original remains available with read_task_brief.\n'+JSON.stringify({name,instructions:selected});
}

export function taskBriefPage(brief:ConversationBrief,args:{message_id?:string;part?:string;offset?:number}){
  const instruction=args.message_id?brief.instructions.find(m=>m.id===args.message_id):null;
  if(args.message_id&&!instruction&&args.message_id!==brief.approvedPlan?.messageId)throw Error('This message ID is not in the retained conversation. Read instructions without message_id for valid IDs.');
  const value=instruction?{instruction,notice:'This ID identifies a human statement, even when part=outline was supplied.'}:args.part==='outline'||args.message_id?brief.approvedPlan:{instructions:brief.instructions,target:brief.target,expectedCast:brief.expectedCast,approvedBeats:brief.approvedPlan?.beats.map(b=>({id:b.id,title:b.title})),notice:'Exact human messages. Read the accepted outline separately with part=outline.'};
  const full=JSON.stringify(value),offset=Math.max(0,Math.floor(args.offset??0));
  return {text:full.slice(offset,offset+1400),offset,nextOffset:Math.min(full.length,offset+1400),total:full.length,hasMore:offset+1400<full.length};
}

/** Operation metadata carries the accepted beats; cast data carries these quotes. */
export function authoringBrief(brief:ConversationBrief,presentedQuotes:readonly string[]):ConversationBrief{
  return {...brief,approvedPlan:null,instructions:brief.instructions.map(m=>({...m,text:presentedQuotes.filter(q=>q.length>90).reduce((text,quote)=>text.split(quote).join('[quotation already present in the saved cast reference]'),m.text)}))};
}
