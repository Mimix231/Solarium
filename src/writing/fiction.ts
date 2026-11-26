import type { ConversationBrief } from '../engine/intelligence/brief';
import type { StoryData } from '../stories/repository';
import { defaultFanfictionChapterCharacters, lengthTarget } from './length';

export const speakerDialogueGuide = 'Put every spoken turn in its own paragraph in Name: dialogue form. Give unnamed speakers a clear role label. Put action, thoughts, description and lore in their own narration paragraphs. Separate speech from the narration before and after it.';

export const fictionCraftGuide = `Write original fanfiction prose. Adapt the source’s viewpoint, cadence, inner reactions, tension and timing to this AU. Apply the selected edition and the reader's style notes.
Let each character's own motives, register, boundaries, abilities, relationships and limited knowledge determine their decisions. Keep humor, anger and affection proportional to their profile and the situation. Preserve user AU choices. Private facts stay private until the character actually learns them.
Use the group’s story brief to guide the premise and stakes for every chapter. Give each moment its own emotional range. A dark setting can hold courage, warmth, humor and affection when the characters and circumstances earn them. Let danger produce the response this character would actually have. Let relationships develop through the story’s choices and consequences.
Treat world rules and point-of-view knowledge separately. Follow the established consequences of a taboo or a power without letting characters explain information they cannot know or disclose.
Use concrete observations and reactions specific to the viewpoint character. Give each exchange a purpose and make its consequences change what can happen next. Let choices and speech show principles and anxiety in action. Earn threat, intimacy or physical restraint through the character's motives and immediate circumstances. Keep ordinary proximity ordinary. Avoid stock predator/prey comparisons, automatic touching or cornering, melodramatic labels for ordinary actions, and turning concern or embarrassment into flirtation, yelling or a gag. Keep each character's agency visible.
After the outcome is shown, end on a meaningful choice, image or reaction. Let the reader draw the conclusion.`;

export function isFanfictionChapter(brief: ConversationBrief, request: string, story?: StoryData): boolean {
  return brief.writingRequested && Boolean(brief.fanfictionRequested || story && story.originKind !== 'original') &&
    /\b(chapters?|fanfic(?:tion)?|novel)\b/i.test(request) && !/\b(?:short|brief|sample)\s+(?:chapter|excerpt|scene|fanfic)\b/i.test(request);
}

export function applyFanfictionPreferences(brief: ConversationBrief, request: string, story?: StoryData): ConversationBrief {
  const explicitProse = /\b(?:no|without|remove|disable)\s+(?:speaker|character|dialogue)\s+(?:labels|tags)\b|\b(?:use|write in)\s+(?:standard|traditional|quoted)\s+(?:prose\s+)?dialogue\b/i.test(request);
  const dialogueFormat = explicitProse ? '' :
    brief.dialogueFormat || (story?.dialogueLayout === 'prose' ? '' : speakerDialogueGuide);
  const minimum = story?.chapterTarget ?? defaultFanfictionChapterCharacters;
  const target = brief.noLengthTarget ? null : lengthTarget(request) ?? brief.target ?? { unit: 'characters' as const, minimum };
  return { ...brief, dialogueFormat, target };
}
