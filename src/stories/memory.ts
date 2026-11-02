import type { WritingDocument } from '../writing/types';
import { containsWritingPassage } from '../writing/schema';
import { WritingRepository } from '../writing/repository';
import { StoryRepository, resolveStoryCharacter, type StoryEvent } from './repository';

export interface StoryMemoryInput { summary: string; quote: string; knowledge: { character: string; state: 'knows' | 'suspects' | 'unknown'; belief?:string; belief_quote?:string }[] }
export const MEMORY_OPEN = '<solarium-memory>';
export const MEMORY_CLOSE = '</solarium-memory>';
/** Keep application metadata out of prose even when its delimiter crosses stream chunks. */
export class StoryMemoryStream {
  private pending = ''; private metadata = ''; private inside = false;private found=false;private ended=false;
  constructor(private output: (delta: string) => void) {}
  push(delta: string): void {
    if(this.ended){this.output(delta);return;}
    if (this.inside) { this.metadata += delta;this.closeMetadata(); return; }
    this.pending += delta;
    const at = this.pending.indexOf(MEMORY_OPEN);
    if (at >= 0) { this.output(this.pending.slice(0, at)); this.metadata = this.pending.slice(at + MEMORY_OPEN.length); this.pending = ''; this.inside = true;this.found=true;this.closeMetadata(); return; }
    let hold = 0;
    for (let size = 1; size < MEMORY_OPEN.length; size++) if (this.pending.endsWith(MEMORY_OPEN.slice(0, size))) hold = size;
    const ready = this.pending.slice(0, this.pending.length - hold); this.pending = this.pending.slice(this.pending.length - hold);
    if (ready) this.output(ready);
  }
  private closeMetadata():void {
    const end=this.metadata.indexOf(MEMORY_CLOSE);if(end<0)return;
    const trailing=this.metadata.slice(end+MEMORY_CLOSE.length);this.metadata=this.metadata.slice(0,end);this.ended=true;this.inside=false;if(trailing)this.output(trailing);
  }
  finish(): StoryMemoryInput[] {
    if (this.pending) this.output(this.pending);
    this.pending = '';
    if (!this.found) return [];
    if (!this.ended) throw Error('The scene memory metadata was incomplete. Prose remains saved; no memory was inferred.');
    const value: unknown = JSON.parse(this.metadata.trim());
    if (!Array.isArray(value) || value.length > 12) throw Error('Invalid scene memory metadata.');
    return value as StoryMemoryInput[];
  }
}

/** A memory is grounded in accepted prose, never the scene plan or a stopped response. */
export async function rememberStoryEvents(stories: StoryRepository, writing: WritingRepository, document: WritingDocument, inputs: StoryMemoryInput[]): Promise<StoryEvent[]> {
  if (!document.storyId) throw Error('This document has no story.');
  const current = await writing.get(document.id);
  if (current.document.data.currentRevisionId !== document.data.currentRevisionId) throw Error('Document changed before its memories were saved.');
  const cast = await stories.characters(document.storyId); const existing = await stories.events(document.storyId);
  const proposed = inputs.map(input => {
    if (!input || typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > 700 || typeof input.quote !== 'string' || input.quote.length < 8 || input.quote.length > 500 || !containsWritingPassage(current.content,input.quote) || !Array.isArray(input.knowledge)) throw Error('Story memory needs a concise summary and an exact passage from the saved prose.');
    const knowledge: Record<string, 'knows' | 'suspects' | 'unknown'> = {};
    const beliefs:Record<string,{text:string;quote:string}>={};
    for (const entry of input.knowledge) {
      const character = typeof entry.character==='string'?resolveStoryCharacter(cast,entry.character):null;
      if (!character || !['knows', 'suspects', 'unknown'].includes(entry.state)) throw Error('Memory knowledge must name a character in this story and an explicit knowledge state.');
      knowledge[character.id] = entry.state;
      if(entry.belief){if(entry.belief.length>500||!entry.belief_quote||!entry.belief_quote.includes(entry.belief)||!containsWritingPassage(current.content,entry.belief_quote))throw Error('A character belief needs its exact supporting passage, separate from confirmed world truth.');beliefs[character.id]={text:entry.belief,quote:entry.belief_quote};}
    }
    return { input, knowledge, beliefs };
  });
  const saved: StoryEvent[] = [];
  for (const { input, knowledge, beliefs } of proposed) {
    const duplicate = existing.find(e => e.data.documentId === document.id && e.data.quote === input.quote && e.data.summary === input.summary);
    if (duplicate) { saved.push(duplicate); continue; }
    const event = await stories.event(document.storyId, input.summary.slice(0, 100), { order: Math.max(0, ...existing.map(e => e.data.order)) + 1, characters: Object.keys(knowledge), knowledge,...(Object.keys(beliefs).length?{beliefs}:{}), kind: 'story_established', sourceLinks: [], summary: input.summary, documentId: document.id, revisionId: document.data.currentRevisionId, quote: input.quote });
    existing.push(event); saved.push(event);
  }
  return saved;
}

export const sceneMemoryInstruction = `After the scene prose, append ${MEMORY_OPEN}[{"summary":"one actual event, not a plan or a new personality rule","quote":"an exact short passage from this scene","knowledge":[{"character":"saved character name","state":"knows"}]}]${MEMORY_CLOSE}. State must be knows, suspects or unknown. Use [] when nothing changed. Record only events that actually occurred in the prose. Include who knows, suspects, or remains unaware; omission means knowledge is unspecified. A knowledge entry may include belief and belief_quote for an exact belief stated in the scene; a belief is not confirmed world truth. Do not invent memories, change locked identity, or promote story events to external canon. This metadata is saved privately with the story, outside the writing block.`;
