import type { Spark, SparkAvatar, Traits, Workspace } from './types';
import { now, uid } from './types';

export const defaultAnime = {
  skin: '#f5cbbd', hairColor: '#392b55', hairAccent: '#8a6db1', eyeColor: '#6a8fdc',
  outfitColor: '#3b507e', outfitAccent: '#f4d7e6', background: '#29284c',
  hairstyle: 'long', eyeShape: 'round', outfit: 'uniform', accessory: 'ribbon',
  bangs: 'curtain', face: 'oval', blush: 25, eyeScale: 100, hairVolume: 100,
  zoom: 100, offsetX: 0, offsetY: 0, sideHair: 'wispy', brows: 'soft', pupil: 'round', mouth: 'subtle', accessorySecondary: 'none', shoulderWidth: 100, sparkle: 35, irisPattern: 'solid', makeup: 'none', artStyle: 'modern', layers: {},
} as const;
export const defaultAvatar: SparkAvatar = {
  style: 'anime', anime: { ...defaultAnime }, color: '#8d7af2', secondary: '#e0b9b6', glyph: '✦',
  expression: 'curious', hair: 'wave', accessory: 'none', animate: true,
};
export const defaultTraits: Traits = {
  curiosity: 90, analysis: 85, empathy: 65, humor: 50, sarcasm: 20,
  patience: 80, creativity: 75, confidence: 75,
};
export function newSpark(): Spark {
  const timestamp = now();
  return {
    id: uid(), name: 'New Spark', description: 'A personality waiting to be discovered.',
    greeting: 'Hello! What should we explore today?', instructions: '',
    traits: { ...defaultTraits }, examples: [], avatar: { ...defaultAvatar },
    preferredModelId: null, createdAt: timestamp, updatedAt: timestamp,
  };
}
export function defaultWorkspace(): Workspace {
  const explorer = newSpark();
  explorer.name = 'Astra';
  explorer.description = 'A brilliant, endlessly curious research companion.';
  explorer.greeting = 'How intriguing. Tell me what you would like to investigate.';
  explorer.instructions = 'Speak elegantly and clearly, show enthusiasm for discovery, and treat questions as opportunities to explore. State uncertainty plainly. Be practical when work needs doing.';
  const maker = newSpark();
  maker.name = 'Forge';
  maker.description = 'A focused engineering partner who gets things built.';
  maker.greeting = 'Ready when you are. What are we building?';
  maker.avatar = { ...defaultAvatar, style: 'glyph', color: '#5ba99c', secondary: '#9ad8b9', glyph: '⬡' };
  maker.instructions = 'Prioritize correctness, clear steps, executable code, and measurable validation.';
  maker.traits = { ...maker.traits, analysis: 100, humor: 25, patience: 95 };
  return {
    schemaVersion: 1, sparks: [explorer, maker], projects: [], activeProjectId: null, sessions: [], models: [], memories: [], assets: [], worlds: [], labCases: [], teamRuns: [],
    selectedSparkId: explorer.id, activeSessionId: null,
    preferences: {
      theme: 'obsidian', density: 'compact', reducedMotion: false, workspaceMode: 'companion',
      sidebarOpen: true, showActivity: false, actionMode: 'ask', consoleChannels: [], startupView: 'home',
      toolPermissions: { inspect_project: 'ask', search_project_code: 'ask', apply_project_changes: 'ask', replace_project_text: 'ask', get_current_time: 'ask', calculate: 'ask', search_memories: 'ask', search_web: 'ask', open_web_page: 'ask', list_project_files: 'ask', read_project_file: 'ask', run_project_check: 'ask' },
      llamaExecutable: '', serverPort: 8080, ggufDirectory: '',
    },
  };
}
