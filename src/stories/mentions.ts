import { mentionedCast } from '../engine/intelligence/brief';
import { resolveStoryCharacter, type StoryCharacter } from './repository';
import { fictionNamePattern, isFictionNameList, namedFictionLists, splitFictionNames } from './name-list';

const properName = new RegExp(`^${fictionNamePattern}$`, 'u');
const nameQuery = /^(?:tell me about|who is|what about|how about|save(?: a profile for)?|capture|profile|add|consider|include|introduce|with)\s+/i;
const arcPrefix = /^arc\s+\d+\s*[:,–-]?\s*/i;
const sentenceStart = /^(?:I|We|He|She|They|This|That|What|How|Can|Could|Would|Please|Yes|No|Okay|Thanks|Continue|Resume|Plan|Write|Draft|Research|Read|Look|Hello)\b/;
const mentionedInScene = new RegExp(`\\b(?:include|introduce|about|featuring|meets|alongside)\\s+(${fictionNamePattern})`, 'gu');

/** Extract explicit names for a cast request. The model still establishes fictional identity and fields. */
export function fictionMentions(text: string, cast: readonly StoryCharacter[], inStory: boolean) {
  const brief = text.trim().replace(/[.!?]+$/, '');
  const plain = brief.length <= 145 && !brief.includes('\n') ?
    splitFictionNames(brief.replace(nameQuery, '').replace(arcPrefix, '')) : [];
  const nameOnly = plain.length > 0 && plain.every(part=>resolveStoryCharacter(cast,part) ||
    properName.test(part) && !sentenceStart.test(part) && (inStory || plain.length>1 || part.includes(' ')));
  const names = nameOnly ? plain : [];
  if (inStory) {
    names.push(...mentionedCast(text),...namedFictionLists(text).filter(name=>!sentenceStart.test(name)));
    for(const match of text.matchAll(mentionedInScene)){
      if(!sentenceStart.test(match[1]!))names.push(match[1]!);
    }
    const tokens = ' ' + normalizeName(text) + ' ';
    for (const character of cast) {
      const match = [character.title, ...character.data.aliases].find(name=>tokens.includes(' '+normalizeName(name)+' '));
      if (match) names.push(match);
    }
  }
  return { names:[...new Map(names.map(name=>[normalizeName(name),name])).values()].slice(0,12), nameOnly };
}

function normalizeName(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim();
}

/** A longer canon name can match an explicit short name or one of its supplied aliases. */
export function matchesCharacterMention(name: string, aliases: readonly string[], mentions: readonly string[]) {
  if(isFictionNameList(name))return false;
  const normalized = [name,...aliases].filter(candidate=>!isFictionNameList(candidate)).map(normalizeName);
  return mentions.some(mention=>{
    const expected=normalizeName(mention);
    return Boolean(expected && normalized.some(candidate=>candidate===expected ||
      !expected.includes(' ') && candidate.split(' ').includes(expected)));
  });
}
