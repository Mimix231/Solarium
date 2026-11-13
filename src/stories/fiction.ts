import { now, uid } from '../domain/types';
import { rankedEvidence } from '../foundation/relevance';
import { newRecord } from '../foundation/store';
import { assertScope, sameScope, type LibraryScope, type StoredRecord, type RecordWrite } from '../foundation/types';
import type { ClaimData, StoryCharacter, StoryRepository, StoryWorld } from './repository';

export const profileFields = ['personality', 'appearance', 'voice', 'motives', 'history', 'abilities', 'relationships', 'knowledge', 'constraints'] as const;
export type ProfileField = typeof profileFields[number];
export type ProfileText = Partial<Record<ProfileField, string>>;
export const profileLimit = 50_000;
export const profileLength = (text: string) => Array.from(text).length;
export interface FictionSelection { categoryId: string; characterIds: string[] }
export interface StoryCategoryData { arc?: number; chapter?: number; continuity?: string }
export type StoryCategory = StoredRecord<StoryCategoryData>;
export interface ProfileData { categoryId: string; characterId: string }
export type StoryProfile = StoredRecord<ProfileData>;
export const fictionCollections = ['story_category', 'story_profile', 'story_profile_revision'] as const;
export const isStoryIcon = (value: unknown): value is string => typeof value === 'string' && value.length <= 2_000_100 &&
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/i.test(value);

export function validateStoryCategory(data: StoryCategoryData) {
  if (!data || [data.arc, data.chapter].some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > 100_000)) ||
      (data.continuity !== undefined && (typeof data.continuity !== 'string' || data.continuity.length > 100))) throw Error('Invalid story category boundary.');
}

export function readProfileText(body: string | null): ProfileText {
  if (body === null) throw Error('The saved character profile body is missing.');
  const fields: unknown = JSON.parse(body);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.entries(fields).some(([field, text]) =>
    !profileFields.includes(field as ProfileField) || typeof text !== 'string' || profileLength(text) > profileLimit)) {
    throw Error('Each character profile field allows up to 50,000 characters.');
  }
  return fields as ProfileText;
}

export class FictionRepository {
  constructor(readonly stories: StoryRepository) {}

  async categories(storyId: string) {
    const story = await this.stories.world(storyId);
    const categories = await this.stories.store.list<StoryCategoryData>({ collection: 'story_category', scopes: [story.scope], storyId });
    return categories.sort((a, b) => (a.data.arc ?? Infinity) - (b.data.arc ?? Infinity) || a.title.localeCompare(b.title));
  }

  async saveCategory(storyId: string, title: string, data: StoryCategoryData, current?: StoryCategory) {
    const story = await this.stories.world(storyId);
    const categories = await this.categories(storyId);
    title = title.trim();
    validateStoryCategory(data);
    if (!title || title.length > 100 || categories.some(item => item.id !== current?.id && item.title.toLowerCase() === title.toLowerCase())) {
      throw Error('Use a distinct category name of up to 100 characters.');
    }
    if (current && !categories.some(item => item.id === current.id && item.version === current.version)) throw Error('This category changed. Reopen it before saving.');
    const record = current ? { ...current, title, data, version: current.version + 1, updatedAt: now() } :
      newRecord('story_category', uid(), story.scope, title, data, storyId);
    await this.stories.store.batch([{ record, expected: current?.version ?? null }]);
    return record;
  }

  async profiles(storyId: string, categoryId: string) {
    const story = await this.stories.world(storyId);
    if (!(await this.categories(storyId)).some(category => category.id === categoryId)) throw Error('This category is outside the selected story.');
    return (await this.stories.store.list<ProfileData>({ collection: 'story_profile', scopes: [story.scope], storyId }))
      .filter(profile => profile.data.categoryId === categoryId);
  }

  async read(profile: StoryProfile) {
    const saved = (await this.profiles(profile.storyId!, profile.data.categoryId)).find(item => item.id === profile.id);
    if (!saved) throw Error('Character profile is outside this category.');
    return readProfileText(await this.stories.store.body(saved.id, [saved.scope]));
  }

  async saveProfile(storyId: string, categoryId: string, characterId: string, text: ProfileText, expected: number | null) {
    const cast = await this.stories.characters(storyId);
    const character = cast.find(item => item.id === characterId);
    if (!character) throw Error('Choose a character from this story.');
    const previous = (await this.profiles(storyId, categoryId)).find(profile => profile.data.characterId === characterId);
    if ((previous?.version ?? null) !== expected) throw Error('This profile changed. Reopen it before saving.');
    const body = JSON.stringify(text);
    readProfileText(body);
    const data = { categoryId, characterId };
    const record = previous ? { ...previous, title: character.title, version: previous.version + 1, updatedAt: now() } :
      newRecord('story_profile', `profile:${categoryId}:${characterId}`, character.scope, character.title, data, storyId);
    const writes: RecordWrite[] = [{ record, body, expected }];
    if (previous) {
      const original = await this.stories.store.body(previous.id, [previous.scope]);
      if (original === null) throw Error('The previous profile body could not be read.');
      writes.push({ record: newRecord('story_profile_revision', uid(), previous.scope, previous.title,
        { ...data, profileId: previous.id, version: previous.version }, storyId), body: original, expected: null });
    }
    await this.stories.store.batch(writes);
    return record;
  }

  async selection(storyId: string, input: FictionSelection) {
    const category = (await this.categories(storyId)).find(item => item.id === input.categoryId);
    if (!category) throw Error('Select a category in the current story.');
    const profiles = await this.profiles(storyId, category.id);
    const ids = [...new Set(input.characterIds)];
    if (ids.length > 12 || ids.some(id => !profiles.some(profile => profile.data.characterId === id))) {
      throw Error('Choose up to 12 profiles in the selected category.');
    }
    return { category, profiles: ids.map(id => profiles.find(profile => profile.data.characterId === id)!) };
  }

  async excerpts(profiles: readonly StoryProfile[], request: string, budget: number) {
    const perCharacter = Math.floor(budget / Math.max(1, profiles.length));
    return (await Promise.all(profiles.map(async profile => {
      const fields = await this.read(profile);
      const snippets = profileFields.flatMap(field => {
        const text = fields[field];
        if (!text) return [];
        const segments = text.match(/[\s\S]{1,520}(?:\s|$)|[\s\S]{1,520}/gu) ?? [];
        return segments.map((passage, index) => ({ field, passage, index }));
      });
      const ranked = rankedEvidence(snippets, request, item => item.field + ' ' + item.passage,
        item => (item.field === 'constraints' || item.field === 'knowledge' ? 10 : item.field === 'personality' || item.field === 'voice' ? 6 : 2) + (item.index === 0 ? 2 : 0));
      const lines: string[] = [];
      let remaining = perCharacter - profile.title.length - 20;
      for (const { item } of ranked) {
        if (remaining < 85) break;
        const excerpt = item.passage.slice(0, Math.min(remaining - 24, 440));
        lines.push(`${item.field} [user profile excerpt]: ${excerpt}`);
        remaining -= excerpt.length + item.field.length + 26;
      }
      return `${profile.title} [${profile.data.characterId}]\n${lines.join('\n')}`;
    }))).join('\n');
  }

  /** A personal template is explicitly copied to the chosen chat/project owner before writing. */
  async copyPersonal(storyId: string, scope: LibraryScope): Promise<StoryWorld> {
    const story = await this.stories.world(storyId);
    assertScope(scope, this.stories.context, true);
    if (sameScope(story.scope, scope)) return story;
    if (story.scope.kind !== 'library' || scope.kind === 'library') throw Error('Only a personal story can be copied into this chat or project.');
    const existing = (await this.stories.list()).find(item => sameScope(item.scope, scope) && item.data.parentStoryId === story.id);
    if (existing) return existing;
    const record = newRecord('story_world', uid(), scope, story.title, { ...story.data, parentStoryId: story.id, sourceIds: [] });
    const categories = await this.categories(storyId);
    const characters = await this.stories.characters(storyId);
    const categoryIds = new Map(categories.map(category => [category.id, uid()]));
    const characterIds = new Map(characters.map(character => [character.id, uid()]));
    const writes: RecordWrite[] = [{ record, expected: null }];
    for (const category of categories) writes.push({ record: newRecord('story_category', categoryIds.get(category.id)!, scope,
      category.title, category.data, record.id), expected: null });
    for (const character of characters) {
      const characterId = characterIds.get(character.id)!;
      writes.push({ record: newRecord('story_character', characterId, scope, character.title, character.data, record.id), expected: null });
      for (const claim of await this.stories.claims(character.id, storyId)) {
        if (!['user_defined', 'au_override'].includes(claim.data.kind)) continue;
        const data: ClaimData = { ...claim.data, characterId, sourceLinks: [] };
        writes.push({ record: newRecord('character_claim', uid(), scope, claim.title, data, record.id), expected: null });
      }
    }
    for (const category of categories) for (const profile of await this.profiles(storyId, category.id)) {
      const categoryId = categoryIds.get(category.id)!;
      const characterId = characterIds.get(profile.data.characterId);
      if (!characterId) throw Error('A profile has no character in this story.');
      const body = JSON.stringify(await this.read(profile));
      writes.push({ record: newRecord('story_profile', `profile:${categoryId}:${characterId}`, scope,
        profile.title, { categoryId, characterId }, record.id), body, expected: null });
    }
    await this.stories.store.batch(writes);
    return record;
  }
}

export function castForSelection(cast: StoryCharacter[], selection: FictionSelection | undefined) {
  return selection?.characterIds.length ? selection.characterIds.flatMap(id => cast.filter(character => character.id === id)) : cast;
}
