export const traitNames = ['curiosity', 'analysis', 'empathy', 'humor', 'sarcasm', 'patience', 'creativity', 'confidence'] as const;
export type Trait = typeof traitNames[number];
export type Traits = Record<Trait, number>;
export type SparkMode = 'conversation' | 'work' | 'research' | 'creative';
export type ActionMode = 'ask' | 'auto' | 'yolo';
export type Expression = 'neutral' | 'curious' | 'happy' | 'focused' | 'sad' | 'angry' | 'surprised' | 'embarrassed';
export type AvatarStyle = 'orb' | 'portrait' | 'glyph' | 'anime';
export type AnimeHair = 'soft-bob' | 'shag' | 'long-waves' | 'short-curls' | 'side-braid' | 'high-ponytail' | 'low-twintails' | 'bob' | 'long' | 'twin-tails' | 'ponytail' | 'pixie' | 'hime' | 'messy' | 'wolf-cut' | 'braided-crown' | 'side-ponytail' | 'curly' | 'layered' | 'ahoge';
export type AnimeEyes = 'gentle' | 'fox' | 'doll' | 'hooded' | 'downturned' | 'round' | 'sharp' | 'sleepy' | 'almond' | 'droopy' | 'wide' | 'narrow' | 'upturned';
export type AnimeOutfit = typeof import('../avatar/layer-system').animeOutfits[number];
export type AnimeAccessory = typeof import('../avatar/layer-system').animeAccessories[number];
export interface AnimeExpressionPreset { mouth?: AnimeAppearance['mouth']; brows?: AnimeAppearance['brows']; eyeShape?: AnimeEyes; blush?: number }
export interface AnimeAppearance {
  skin: string; hairColor: string; hairAccent: string; eyeColor: string; outfitColor: string; outfitAccent: string; background: string;
  accessoryAccent?: string;
  hairstyle: AnimeHair; eyeShape: AnimeEyes; outfit: AnimeOutfit; accessory: AnimeAccessory;
  bangs: 'curtain' | 'straight' | 'swept' | 'wispy' | 'hime-cut' | 'side-part' | 'micro'; face: 'oval' | 'round' | 'sharp';
  bodyShape: typeof import('../avatar/layer-system').animeBodyShapes[number];
  ears: typeof import('../avatar/layer-system').animeEarShapes[number];
  nose: typeof import('../avatar/layer-system').animeNoses[number];
  backdrop: typeof import('../avatar/layer-system').animeBackdrops[number];
  neckWidth: number;
  blush: number; eyeScale: number; hairVolume: number; zoom: number; offsetX: number; offsetY: number;
  sideHair: 'none' | 'wispy' | 'braids' | 'ringlets' | 'long-locks' | 'short-locks'; brows: 'soft' | 'arched' | 'straight'; pupil: 'round' | 'star' | 'slit' | 'heart' | 'diamond' | 'cat';
  mouth: 'subtle' | 'smile' | 'smirk' | 'neutral' | 'grin' | 'laugh' | 'fang' | 'pout' | 'open' | 'cat-smile' | 'frown' | 'soft-smile'; accessorySecondary: AnimeAccessory;
  shoulderWidth: number; sparkle: number; irisPattern?: 'solid' | 'ringed' | 'sunburst' | 'sparkle' | 'gradient' | 'flower' | 'spiral' | 'nebula' | 'diamond' | 'constellation';
  artStyle?: import('../avatar/layer-system').CharacterArtStyle;
  layers?: import('../avatar/layer-system').AvatarLayerSettings;
  leftEyeColor?: string; rightEyeColor?: string; animateEyes?: boolean;
  expressionPresets?: Partial<Record<Expression, AnimeExpressionPreset>>;
  makeup?: 'none' | 'freckles' | 'eyeliner' | 'beauty-mark' | 'star-cheeks';
}
export type AvatarHair = 'wave' | 'short' | 'none';
export type AvatarAccessory = 'none' | 'glasses' | 'halo';
export interface SparkAvatar {
  style: AvatarStyle;
  color: string;
  secondary: string;
  glyph: string;
  image?: string;
  expression: Expression;
  hair: AvatarHair; accessory: AvatarAccessory;
  animate: boolean; expressionImages?: Partial<Record<Expression, string>>; anime?: AnimeAppearance;
}
export interface ExampleTurn { id: string; user: string; assistant: string }
export type PersonalityMode = 'simple' | 'advanced' | 'raw';
export interface SparkDNA {
  mode: PersonalityMode;
  raw: string;
  identity: string;
  speech: string;
  behavior: string;
  relationships: string;
  workStyle: string;
  boundaries: string;
}
export type InferenceBackend = 'llama.cpp' | 'vllm' | 'ollama';
export interface GenerationMetrics {
  backend: InferenceBackend;
  model: string;
  elapsedMs: number;
  firstTokenMs: number | null;
  completionTokens: number | null;
  estimatedTokens: number;
  tokensPerSecond: number | null;
}
export interface Spark {
  id: string; name: string; description: string; greeting: string;
  instructions: string; dna?: SparkDNA; traits: Traits; examples: ExampleTurn[];
  avatar: SparkAvatar; preferredModelId: string | null;
  createdAt: string; updatedAt: string;
}
export interface LocalModel {
  runtime?:{mode:'auto'|'manual';gpuLayers?:number};
  backend?: InferenceBackend;
  id: string; name: string; endpoint: string; modelId: string;
  ggufPath?: string; visionEnabled?: boolean; toolCalling?: boolean; contextSize: number; temperature: number;
  maxTokens: number; createdAt: string;
}
export interface ChatAttachment { id: string; name: string; mime: string; kind: 'image' | 'text' | 'document'; size: number; text?: string; dataUrl?: string }
export interface ChatSource { title: string; url: string; excerpt?: string; readState?:'found'|'read' }
export interface BlockAsset {
  id: string; sessionId: string; messageId: string; blockId: string;
  projectId: string | null; kind: import('../blocks/protocol').BlockKind; title: string; language: string;
  content: string; updatedAt: string; createdAt: string; history?: { content: string; updatedAt: string }[];
}
export interface TerminalRun { runId?:string;cancelled?:boolean;outputComplete?:boolean; command: string; exitCode: number | null; stdout: string; stderr: string; timedOut: boolean }
export interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; sparkId?: string; attachments?: ChatAttachment[]; sources?: ChatSource[]; savedSourceRefs?:{id:string;title:string}[]; reasoning?: string; reasoningMs?: number; terminalRuns?: TerminalRun[]; generationWarning?: string; generationOutcomes?: import('../engine/continuous-generation').GenerationOutcome[] }
export interface ConsoleChannel { id: string; title: string; projectId: string | null; sparkId: string | null; icon: string; createdAt: string }
export interface CreatorProject { id: string; name: string; description: string; instructions: string; folder: string; sparkId: string | null; modelId: string | null; createdAt: string; updatedAt: string }
export interface ChatSession {
  storyId?: string | null;
  fiction?: import('../stories/fiction').FictionSelection | null;
  profileDestination?: import('../stories/fiction').FictionDestination | null;
  parentSessionId?: string; forkMessageId?: string;
  id: string; title: string; sparkId: string; modelId: string | null; projectId?: string | null;
  mode: SparkMode; createdAt: string; updatedAt: string; messages: ChatMessage[];
}
export interface WorldEntry { id: string; title: string; content: string; keywords: string[]; enabled: boolean }
export interface SparkWorld { id: string; sparkId: string; title: string; description: string; entries: WorldEntry[]; createdAt: string }
export interface LabCase { id: string; sparkId: string; title: string; prompt: string; expectedPhrases: string[]; lastResponse?: string; rating?: number }
export interface TeamRun { id: string; title: string; task: string; sparkIds: string[]; modelId: string; createdAt: string; steps: { sparkId: string; content: string; error?: string }[] }
export interface MemoryItem {
  id: string; text: string; scope: 'global' | 'spark'; sparkId: string | null;
  enabled: boolean; createdAt: string;
}
export type ThemeId = 'crystal' | 'obsidian' | 'aurora' | 'material' | 'slate' | 'solar' | 'peach' | 'cherry' | 'lime' | 'blueberry' | 'tangerine' | 'kiwi' | 'strawberry';
export type Density = 'ultra' | 'compact' | 'comfortable';
export interface Preferences {
  spicaCycleBudget?: 2048 | 4096 | 8192 | 'auto';
  sceneSpacer?: import('../writing/prose').SceneSpacerStyle;
  searchProvider?: import('../research/research').SearchProviderConfig;
  theme: ThemeId; density: Density; reducedMotion: boolean; workspaceMode?: 'companion' | 'workspace'; interfaceTheme?: 'classic' | 'cosmic';
  sidebarOpen: boolean; showActivity: boolean; actionMode?: ActionMode; consoleChannels?: ConsoleChannel[]; startupView?: 'home' | 'chat';
  toolPermissions: Record<string, 'ask' | 'allow' | 'deny'>;
  llamaExecutable: string; serverPort: number; ggufDirectory: string;
}
export interface Workspace {
  schemaVersion: 1;
  sparks: Spark[]; sessions: ChatSession[]; models: LocalModel[];
  memories: MemoryItem[]; workEvents?: ActivityEvent[]; visualActions?: import('../engine/visual-actions').VisualAction[]; assets?: BlockAsset[]; projects?: CreatorProject[]; activeProjectId?: string | null; worlds?: SparkWorld[]; labCases?: LabCase[]; teamRuns?: TeamRun[]; preferences: Preferences;
  selectedSparkId: string; activeSessionId: string | null;
}
export type WorkAction = 'search' | 'inspect' | 'generate' | 'edit' | 'writing' | 'execute' | 'check' | 'save';
export type ActivityPhase = 'looking' | 'thinking' | 'browsing' | 'observing' | 'verifying' | 'answering';
export type ActivityEvent = {
  id: string; runId: string; sessionId?: string; sequence: number; at: string;
  kind: 'phase' | 'reasoning' | 'tool_call' | 'tool_result' | 'operation' | 'error';
  action?: WorkAction; subject?: string;
  phase?: ActivityPhase; status?: 'started' | 'completed' | 'failed' | 'denied';
  text?: string; tool?: string;
};
export interface Capabilities {
  contextShift?: 'supported' | 'unsupported' | 'unknown';
  reasoning: 'observed' | 'unknown';
  tools: 'supported' | 'unknown';
  vision: 'supported' | 'unknown' | 'user-enabled';
  contextSize: number | null;
  source: 'server-properties' | 'unavailable';
}
export const uid = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const now = (): string => new Date().toISOString();
