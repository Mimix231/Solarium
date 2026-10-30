import type { ChatMessage, ChatSession, Density, LocalModel, MemoryItem, Preferences, Spark, SparkAvatar, ThemeId, Workspace } from './types';
import { defaultAnime, defaultAvatar, defaultTraits, defaultWorkspace, newSpark } from './defaults';
import { now, traitNames, uid } from './types';
import { avatarLayerOrder } from '../avatar/layer-system';
import { restoreVisualAction } from '../engine/visual-actions';
import type { VisualAction } from '../engine/visual-actions';

const object = (data: unknown): Record<string, unknown> => data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
const text = (data: unknown, max = 20_000): string => typeof data === 'string' ? data.slice(0, max) : '';
const number = (data: unknown, fallback: number, min: number, max: number): number =>
  typeof data === 'number' && Number.isFinite(data) ? Math.min(max, Math.max(min, data)) : fallback;
const option = <T extends string>(data: unknown, allowed: readonly T[], fallback: T): T =>
  typeof data === 'string' && allowed.includes(data as T) ? data as T : fallback;
const hexColor = (data: unknown, fallback: string): string => typeof data === 'string' && /^#[a-f0-9]{6}$/i.test(data) ? data : fallback;

export function validateSpark(data: unknown): Spark {
  const d = object(data);
  if (!text(d.name, 60).trim()) throw new Error('Spark is missing a valid name.');
  const fallback = newSpark();
  const traits = object(d.traits);
  const avatar = object(d.avatar);
  const examples = Array.isArray(d.examples) ? d.examples : [];
  const expressionImages = object(avatar.expressionImages);
  const validImage = (image: unknown): image is string => typeof image === 'string' && image.length < 2_100_000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image);
  const rawDna = object(d.dna);
  const anime = object(avatar.anime);
  const safeAnime = {
    skin: hexColor(anime.skin, defaultAnime.skin), hairColor: hexColor(anime.hairColor, defaultAnime.hairColor),
    hairAccent: hexColor(anime.hairAccent, defaultAnime.hairAccent), eyeColor: hexColor(anime.eyeColor, defaultAnime.eyeColor),
    outfitColor: hexColor(anime.outfitColor, defaultAnime.outfitColor), outfitAccent: hexColor(anime.outfitAccent, defaultAnime.outfitAccent),
    background: hexColor(anime.background, defaultAnime.background),
    hairstyle: option(anime.hairstyle, ['soft-bob','shag','long-waves','short-curls','side-braid','high-ponytail','low-twintails','bob', 'long', 'twin-tails', 'ponytail', 'pixie', 'hime', 'messy','wolf-cut','braided-crown','side-ponytail','curly','layered','ahoge'] as const, defaultAnime.hairstyle),
    eyeShape: option(anime.eyeShape, ['gentle','fox','doll','hooded','downturned','round', 'sharp', 'sleepy','almond','droopy','wide','narrow','upturned'] as const, defaultAnime.eyeShape),
    outfit: option(anime.outfit, ['blazer','sailor','cape','gothic','streetwear','hoodie', 'uniform', 'dress', 'jacket','kimono','turtleneck','armor','cardigan'] as const, defaultAnime.outfit),
    accessory: option(anime.accessory, ['hairclip','tiara','nose-bandage','visor','none', 'ribbon', 'glasses', 'earrings', 'cat-ears', 'halo','face-mask','beret','witch-hat','cap','headphones','eyepatch','choker','flower-crown'] as const, defaultAnime.accessory),
    bangs: option(anime.bangs, ['curtain', 'straight', 'swept', 'wispy', 'hime-cut', 'side-part', 'micro'] as const, defaultAnime.bangs),
    face: option(anime.face, ['oval', 'round', 'sharp'] as const, defaultAnime.face),
    blush: number(anime.blush, 25, 0, 100), eyeScale: number(anime.eyeScale, 100, 60, 140),
    hairVolume: number(anime.hairVolume, 100, 70, 140), zoom: number(anime.zoom, 100, 75, 140),
    offsetX: number(anime.offsetX, 0, -45, 45), offsetY: number(anime.offsetY, 0, -45, 45),
    sideHair: option(anime.sideHair, ['none','wispy','braids','ringlets','long-locks','short-locks'] as const, defaultAnime.sideHair),
    brows: option(anime.brows, ['soft','arched','straight'] as const, defaultAnime.brows),
    pupil: option(anime.pupil, ['round','star','slit','heart','diamond','cat'] as const, defaultAnime.pupil),
    mouth: option(anime.mouth, ['subtle','smile','smirk','neutral','grin','laugh','fang','pout','open','cat-smile','frown','soft-smile'] as const, defaultAnime.mouth),
    accessorySecondary: option(anime.accessorySecondary, ['none','ribbon','glasses','earrings','cat-ears','halo'] as const, defaultAnime.accessorySecondary),
    irisPattern: option(anime.irisPattern, ['solid','ringed','sunburst','sparkle','gradient','flower','spiral','nebula','diamond','constellation'] as const, 'solid'),
    makeup: option(anime.makeup, ['none','freckles','eyeliner','beauty-mark','star-cheeks'] as const, 'none'),
    shoulderWidth: number(anime.shoulderWidth, 100, 70, 145),
    sparkle: number(anime.sparkle, 35, 0, 100),
    artStyle: option(anime.artStyle, ['modern', 'classic', 'chibi'] as const, 'modern'),
    ...(typeof anime.leftEyeColor === 'string' ? { leftEyeColor: hexColor(anime.leftEyeColor, defaultAnime.eyeColor) } : {}),
    ...(typeof anime.rightEyeColor === 'string' ? { rightEyeColor: hexColor(anime.rightEyeColor, defaultAnime.eyeColor) } : {}),
    animateEyes: anime.animateEyes !== false,
    expressionPresets: Object.fromEntries((['neutral','curious','happy','focused','sad','angry','surprised','embarrassed'] as const)
      .map((expression) => {
        const overrides = object(object(anime.expressionPresets)[expression]);
        return [expression, {
          ...(typeof overrides.mouth === 'string' ? { mouth: option(overrides.mouth, ['subtle','smile','smirk','neutral','grin','laugh','fang','pout','open','cat-smile','frown','soft-smile'] as const, 'subtle') } : {}),
          ...(typeof overrides.brows === 'string' ? { brows: option(overrides.brows, ['soft','arched','straight'] as const, 'soft') } : {}),
          ...(typeof overrides.eyeShape === 'string' ? { eyeShape: option(overrides.eyeShape, ['gentle','fox','doll','hooded','downturned','round','sharp','sleepy','almond','droopy','wide','narrow','upturned'] as const, 'round') } : {}),
          ...(typeof overrides.blush === 'number' ? { blush: number(overrides.blush, 25, 0, 100) } : {}),
        }];
      })),
    layers: Object.fromEntries(avatarLayerOrder.map((id) => {
      const layer = object(object(anime.layers)[id]);
      return [id, {
        visible: layer.visible !== false,
        offsetX: number(layer.offsetX, 0, -40, 40),
        offsetY: number(layer.offsetY, 0, -40, 40),
        scale: number(layer.scale, 100, 50, 150),
      }];
    })),
  };
  const safeAvatar: SparkAvatar = {
    style: option(avatar.style, ['orb', 'portrait', 'glyph', 'anime'] as const, defaultAvatar.style),
    color: hexColor(avatar.color, defaultAvatar.color),
    secondary: hexColor(avatar.secondary, defaultAvatar.secondary),
    glyph: text(avatar.glyph, 2) || defaultAvatar.glyph,
    expression: option(avatar.expression, ['neutral', 'curious', 'happy', 'focused', 'sad', 'angry', 'surprised', 'embarrassed'] as const, defaultAvatar.expression),
    hair: option(avatar.hair, ['wave', 'short', 'none'] as const, defaultAvatar.hair),
    accessory: option(avatar.accessory, ['none', 'glasses', 'halo'] as const, defaultAvatar.accessory),
    anime: safeAnime,
    animate: typeof avatar.animate === 'boolean' ? avatar.animate : defaultAvatar.animate,
    ...(validImage(avatar.image) ? { image: avatar.image } : {}),
    expressionImages: Object.fromEntries(['neutral','curious','happy','focused','sad','angry','surprised','embarrassed'].filter((key) => validImage(expressionImages[key])).map((key) => [key, expressionImages[key]])),
  };
  return {
    id: text(d.id, 100) || fallback.id,
    name: text(d.name, 60).trim(), description: text(d.description, 500),
    greeting: text(d.greeting, 1200) || fallback.greeting,
    instructions: text(d.instructions, 18_000),
    dna: {
      mode: option(rawDna.mode, ['simple', 'advanced', 'raw'] as const, 'simple'),
      raw: text(rawDna.raw, 64_000),
      identity: text(rawDna.identity, 12_000), speech: text(rawDna.speech, 12_000),
      behavior: text(rawDna.behavior, 12_000), relationships: text(rawDna.relationships, 12_000),
      workStyle: text(rawDna.workStyle, 12_000), boundaries: text(rawDna.boundaries, 12_000),
    },
    traits: Object.fromEntries(traitNames.map((trait) => [trait, number(traits[trait], defaultTraits[trait], 0, 100)])) as unknown as Spark['traits'],
    avatar: safeAvatar, preferredModelId: text(d.preferredModelId, 100) || null,
    examples: examples.slice(0, 20).map((example: unknown) => object(example)).filter((example) => typeof example.user === 'string' && typeof example.assistant === 'string').map((example) => ({ id: text(example.id, 100) || uid(), user: text(example.user, 2000), assistant: text(example.assistant, 5000) })),
    createdAt: text(d.createdAt, 40) || now(), updatedAt: text(d.updatedAt, 40) || now(),
  };
}

function validateModel(data: unknown): LocalModel | null {
  const m = object(data);
  const endpoint = text(m.endpoint, 200);
  const identifier = text(m.modelId, 255);
  if (!identifier) return null;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) return null;
    return {
      id: text(m.id, 100) || uid(), name: text(m.name, 100) || identifier,
      backend: option(m.backend, ['llama.cpp','vllm','ollama'] as const, 'llama.cpp'),
      endpoint: url.origin, modelId: identifier,
      ...(typeof m.ggufPath === 'string' ? { ggufPath: text(m.ggufPath, 1200) } : {}),
      visionEnabled: m.visionEnabled === true, toolCalling: m.toolCalling === true,
      contextSize: number(m.contextSize, 4096, 256, 262144),
      temperature: number(m.temperature, .7, 0, 2),
      maxTokens: number(m.maxTokens, 2048, 32, 131072),
      createdAt: text(m.createdAt, 40) || now(),
    };
  } catch { return null; }
}

function validateMessage(data: unknown): ChatMessage | null {
  const m = object(data);
  if (m.role !== 'user' && m.role !== 'assistant') return null;
  return {
    id: text(m.id, 100) || uid(), role: m.role,
    content: text(m.content, m.role === 'assistant' ? 2_000_000 : 120_000), createdAt: text(m.createdAt, 40) || now(),
    ...(typeof m.sparkId === 'string' ? { sparkId: text(m.sparkId, 100) } : {}),
    ...(typeof m.reasoning === 'string' ? { reasoning: text(m.reasoning, 2_000_000) } : {}),
    ...(typeof m.generationWarning === 'string' ? { generationWarning: text(m.generationWarning, 1200) } : {}),
    ...(typeof m.reasoningMs === 'number' && Number.isFinite(m.reasoningMs) ? { reasoningMs: number(m.reasoningMs, 0, 0, 100_000_000) } : {}),
    attachments: (Array.isArray(m.attachments) ? m.attachments : []).slice(0, 8).map((a: unknown) => { const x = object(a); const image = text(x.dataUrl, 2_500_000); return { id: text(x.id,100) || uid(), name: text(x.name,180), mime: text(x.mime,100), kind: option(x.kind,['image','text','document'] as const,'document'), size: number(x.size,0,0,10_000_000), ...(image.length < 2_500_000 && /^data:image\/(?:png|jpeg|webp);base64,/i.test(image) ? { dataUrl: image } : {}), ...(x.text ? { text: text(x.text,120_000) } : {}) }; }).filter((a) => a.name),
    terminalRuns: (Array.isArray(m.terminalRuns) ? m.terminalRuns : []).slice(0, 20).map((run: unknown) => { const item = object(run); return { command: text(item.command, 1000), exitCode: typeof item.exitCode === 'number' ? number(item.exitCode, 0, -100000, 100000) : null, stdout: text(item.stdout, 80_000), stderr: text(item.stderr, 80_000), timedOut: item.timedOut === true }; }),
    savedSourceRefs:(Array.isArray(m.savedSourceRefs)?m.savedSourceRefs:[]).slice(0,10).map((s:unknown)=>{const r=object(s);return {id:text(r.id,180),title:text(r.title,180)};}).filter(s=>s.id),
    sources: (Array.isArray(m.sources) ? m.sources : []).slice(0, 16).map((s: unknown) => object(s)).filter((s) => typeof s.url === 'string' && /^https:\/\//.test(s.url)).map((s) => ({ title: text(s.title,200), url: text(s.url,1500), excerpt: text(s.excerpt,4000), readState:option(s.readState,['found','read'] as const,'found') })),
  };
}

function validateSession(data: unknown, sparkIds: Set<string>): ChatSession | null {
  const d = object(data);
  const sparkId = text(d.sparkId, 100);
  if (!sparkIds.has(sparkId)) return null;
  const raw = Array.isArray(d.messages) ? d.messages : [];
  return {
    id: text(d.id, 100) || uid(), sparkId,
    ...(text(d.parentSessionId, 100) ? { parentSessionId: text(d.parentSessionId, 100) } : {}),
    ...(text(d.forkMessageId, 100) ? { forkMessageId: text(d.forkMessageId, 100) } : {}),
    storyId: text(d.storyId,100) || null,
    title: text(d.title, 100) || 'Conversation', modelId: text(d.modelId, 100) || null, projectId: text(d.projectId, 100) || null,
    mode: option(d.mode, ['conversation', 'work', 'research', 'creative'] as const, 'conversation'),
    createdAt: text(d.createdAt, 40) || now(), updatedAt: text(d.updatedAt, 40) || now(),
    messages: raw.map(validateMessage).filter((message): message is ChatMessage => message !== null).slice(-2_000),
  };
}

function validateMemory(data: unknown, sparkIds: Set<string>): MemoryItem | null {
  const m = object(data);
  if (!text(m.text, 3000).trim()) return null;
  const sparkId = text(m.sparkId, 100);
  const scope = m.scope === 'spark' ? 'spark' : 'global';
  if (scope === 'spark' && !sparkIds.has(sparkId)) return null;
  return { id: text(m.id, 100) || uid(), text: text(m.text, 3000), scope,
    sparkId: scope === 'global' ? null : sparkId,
    enabled: m.enabled !== false, createdAt: text(m.createdAt, 40) || now() };
}

function validatePreferences(data: unknown): Preferences {
  const p = object(data);
  const fallback = defaultWorkspace().preferences;
  const permissions = object(p.toolPermissions);
  const allowed: Record<string, 'ask' | 'allow' | 'deny'> = { ...fallback.toolPermissions };
  for (const name of new Set([...Object.keys(allowed),...Object.keys(permissions)])) allowed[name] = option(permissions[name], ['ask', 'allow', 'deny'] as const, 'ask');
  return {
    theme: option<ThemeId>(p.theme, ['crystal','obsidian','aurora','material','slate','solar','peach','cherry','lime','blueberry','tangerine','kiwi','strawberry'], fallback.theme),
    density: option<Density>(p.density, ['ultra','compact','comfortable'], fallback.density),
    reducedMotion: p.reducedMotion === true, workspaceMode: option(p.workspaceMode, ['companion','workspace'] as const, 'companion'),
    sidebarOpen: p.sidebarOpen !== false, showActivity: p.showActivity === true, actionMode: option(p.actionMode, ['ask','auto','yolo'] as const, 'ask'),
    llamaExecutable: text(p.llamaExecutable, 1200),
    serverPort: number(p.serverPort, 8080, 1024, 65535),
    ggufDirectory: text(p.ggufDirectory, 2048),
    toolPermissions: allowed,
    searchProvider: {kind: option(object(p.searchProvider).kind,['bing','searxng'] as const,'bing'),endpoint:text(object(p.searchProvider).endpoint,1000)},
    startupView: option(p.startupView, ['home','chat'] as const, 'home'),
    consoleChannels: (Array.isArray(p.consoleChannels) ? p.consoleChannels : []).slice(0, 80).map((value: unknown) => {
      const c = object(value);
      return { id: text(c.id,100) || uid(), title: text(c.title,60), projectId: text(c.projectId,100) || null,
        sparkId: text(c.sparkId,100) || null, icon: text(c.icon,4) || '✦', createdAt: text(c.createdAt,40) || now() };
    }).filter((c) => c.title),
  };
}

export function validateWorkspace(data: unknown): Workspace {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Workspace file must be a JSON object.');
  const d = object(data);
  if (d.schemaVersion !== 1 || !Array.isArray(d.sparks) || !Array.isArray(d.sessions) || !Array.isArray(d.models) || !Array.isArray(d.memories)) {
    throw new Error('Unrecognized or incomplete Solarium workspace.');
  }
  const sparks: Spark[] = [];
  const seen = new Set<string>();
  for (const candidate of d.sparks.slice(0, 500)) {
    try {
      const spark = validateSpark(candidate);
      if (!seen.has(spark.id)) { sparks.push(spark); seen.add(spark.id); }
    } catch { /* Skip a malformed imported profile. */ }
  }
  if (!sparks.length) throw new Error('Workspace contains no valid Sparks.');
  const models = d.models.map(validateModel).filter((m): m is LocalModel => m !== null).slice(0, 300);
  const sessions = d.sessions.map((s) => validateSession(s, seen)).filter((s): s is ChatSession => s !== null).slice(0, 50_000);
  const memories = d.memories.map((m) => validateMemory(m, seen)).filter((m): m is MemoryItem => m !== null).slice(0, 10_000);
  const selectedSparkId = seen.has(text(d.selectedSparkId, 100)) ? text(d.selectedSparkId, 100) : sparks[0]!.id;
  const activeSessionId = sessions.find((s) => s.id === d.activeSessionId)?.id ?? null;
  const modelIds = new Set(models.map((m) => m.id));
  for (const spark of sparks) if (spark.preferredModelId && !modelIds.has(spark.preferredModelId)) spark.preferredModelId = null;
  for (const session of sessions) if (session.modelId && !modelIds.has(session.modelId)) session.modelId = null;
  const worlds = (Array.isArray(d.worlds) ? d.worlds : []).slice(0, 200).map((candidate) => {
    const w = object(candidate); const sparkId = text(w.sparkId, 100);
    if (!seen.has(sparkId)) return null;
    const entries = (Array.isArray(w.entries) ? w.entries : []).slice(0, 500).map((candidate) => {
      const e = object(candidate);
      return { id: text(e.id, 100) || uid(), title: text(e.title, 120), content: text(e.content, 12_000),
        keywords: (Array.isArray(e.keywords) ? e.keywords : []).map((word) => text(word, 80).trim()).filter(Boolean).slice(0, 24), enabled: e.enabled !== false };
    });
    return { id: text(w.id, 100) || uid(), sparkId, title: text(w.title, 120) || 'World',
      description: text(w.description, 400), entries, createdAt: text(w.createdAt, 40) || now() };
  }).filter((w): w is NonNullable<typeof w> => w !== null);
  const labCases = (Array.isArray(d.labCases) ? d.labCases : []).slice(0, 500).map((candidate) => {
    const c = object(candidate); const sparkId = text(c.sparkId, 100);
    if (!seen.has(sparkId)) return null;
    return { id: text(c.id, 100) || uid(), sparkId, title: text(c.title, 120), prompt: text(c.prompt, 5000),
      expectedPhrases: (Array.isArray(c.expectedPhrases) ? c.expectedPhrases : []).map((x) => text(x, 100)).slice(0, 20),
      ...(c.lastResponse ? { lastResponse: text(c.lastResponse, 15_000) } : {}),
      ...(typeof c.rating === 'number' ? { rating: number(c.rating, 0, 0, 5) } : {}) };
  }).filter((c): c is NonNullable<typeof c> => c !== null);
  const teamRuns = (Array.isArray(d.teamRuns) ? d.teamRuns : []).slice(-100).map((candidate) => {
    const r = object(candidate);
    const sparkIds = (Array.isArray(r.sparkIds) ? r.sparkIds : []).filter((x): x is string => typeof x === 'string' && seen.has(x)).slice(0, 8);
    if (!sparkIds.length) return null;
    const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, 12).map((step) => {
      const x = object(step);
      return { sparkId: text(x.sparkId, 100), content: text(x.content, 20_000), ...(x.error ? { error: text(x.error, 2000) } : {}) };
    });
    return { id: text(r.id,100) || uid(), title: text(r.title,120), task: text(r.task,8000), sparkIds,
      modelId: text(r.modelId,100), createdAt: text(r.createdAt,40) || now(), steps };
  }).filter((r): r is NonNullable<typeof r> => r !== null);
  const projects = (Array.isArray(d.projects) ? d.projects : []).slice(0, 300).map((item: unknown) => { const x = object(item); return { id: text(x.id,100) || uid(), name: text(x.name,120), description: text(x.description,800), instructions: text(x.instructions,10000), folder: text(x.folder,1600), sparkId: seen.has(text(x.sparkId,100)) ? text(x.sparkId,100) : null, modelId: modelIds.has(text(x.modelId,100)) ? text(x.modelId,100) : null, createdAt: text(x.createdAt,40) || now(), updatedAt: text(x.updatedAt,40) || now() }; }).filter((x) => x.name);
  const projectIds = new Set(projects.map((x) => x.id));
  // Never promote an orphaned project's private conversations into general chats.
  // If its project metadata is missing, keep it out of the active workspace.
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i]!.projectId && !projectIds.has(sessions[i]!.projectId!)) sessions.splice(i, 1);
  }
  const assets = (Array.isArray(d.assets) ? d.assets : []).slice(0, 5_000).flatMap((item: unknown) => {
    const x = object(item);
    const sessionId = text(x.sessionId, 100);
    const messageId = text(x.messageId, 100);
    const session = sessions.find((s) => s.id === sessionId);
    // Orphaned saved assets remain available if their original message is no longer present.
    if (!sessionId || !messageId || !text(x.id, 250)) return [];
    const kind = option(x.kind, ['writing','code','table','chart','research','image','equation','workflow','terminal','file','preview'] as const, 'writing');
    return [{ id: text(x.id, 250), sessionId, messageId, blockId: text(x.blockId, 100),
      projectId: projectIds.has(text(x.projectId,100)) ? text(x.projectId,100) : session?.projectId ?? null,
      kind, title: text(x.title, 200), language: text(x.language, 50),
      content: text(x.content, 1_000_000), history: (Array.isArray(x.history) ? x.history : []).slice(-20).map((item: unknown) => { const revision = object(item); return { content: text(revision.content, 1_000_000), updatedAt: text(revision.updatedAt, 40) || now() }; }), updatedAt: text(x.updatedAt, 40) || now(), createdAt: text(x.createdAt, 40) || now() }];
  });
  const preferences = validatePreferences(d.preferences);
  preferences.consoleChannels = (preferences.consoleChannels ?? []).map((channel) => ({ ...channel,
    projectId: channel.projectId && projectIds.has(channel.projectId) ? channel.projectId : null,
    sparkId: channel.sparkId && seen.has(channel.sparkId) ? channel.sparkId : null,
  }));
  const workEvents = (Array.isArray(d.workEvents) ? d.workEvents : []).slice(-180).flatMap((value: unknown) => {
    const e = object(value);
    if (!['tool_call','tool_result','operation'].includes(String(e.kind))) return [];
    const status = option(e.status, ['started','completed','failed','denied'] as const, 'started');
    return [{ id: text(e.id,100) || uid(), runId: text(e.runId,100), ...(text(e.sessionId,100) ? { sessionId: text(e.sessionId,100) } : {}), sequence: number(e.sequence,0,0,100_000),
      at: text(e.at,40) || now(), kind: e.kind as 'tool_call' | 'tool_result' | 'operation',
      text: text(e.text,1400), tool: text(e.tool,100),
      ...(e.kind === 'operation' && ['search','inspect','generate','edit','writing','execute','check','save'].includes(String(e.action))
        ? { action: e.action as import('./types').WorkAction, subject: text(e.subject,300) } : {}), status }];
  });
  const sessionIds = new Set(sessions.map(session => session.id));
  const messageIds = new Set(sessions.flatMap(session => session.messages.map(message => `${session.id}:${message.id}`)));
  const visualActions: VisualAction[] = (Array.isArray(d.visualActions) ? d.visualActions : []).slice(-300).flatMap((value: unknown) => {
    const item = object(value);
    const id = text(item.id, 200), sessionId = text(item.sessionId, 100), messageId = text(item.messageId, 100);
    if (!id || !sessionIds.has(sessionId) || !messageIds.has(`${sessionId}:${messageId}`)) return [];
    const kind = option(item.kind, ['search','inspect','generate','edit','writing','execute','check','save'] as const, 'inspect');
    const status = option(item.status, ['running','completed','failed','denied'] as const, 'failed');
    const files = (Array.isArray(item.files) ? item.files : []).slice(0,12).map((entry: unknown) => {
      const file = object(entry);
      return { path: text(file.path,1024), content: text(file.content,120_000), complete: file.complete === true };
    }).filter(file => file.path);
    const sources = (Array.isArray(item.sources) ? item.sources : []).slice(0,24).map((entry: unknown) => {
      const source = object(entry);
      return { title: text(source.title,240), url: text(source.url,1800), excerpt: text(source.excerpt,1000), status: option(source.status, ['found','reading','read','failed'] as const, 'found') };
    }).filter(source => /^https:\/\//i.test(source.url));
    return [restoreVisualAction({ id, sessionId, messageId, kind, status,
      title: text(item.title,260), detail: text(item.detail,1600),
      createdAt: text(item.createdAt,40) || now(), updatedAt: text(item.updatedAt,40) || now(),
      ...(files.length ? { files } : {}), ...(sources.length ? { sources } : {}),
      ...(text(item.activeFile,1024) ? { activeFile: text(item.activeFile,1024) } : {}),
      ...(text(item.output,48_000) ? { output: text(item.output,48_000) } : {}),
      ...(text(item.url,1800) ? { url: text(item.url,1800) } : {}),
      ...(text(item.query,1000) ? { query: text(item.query,1000) } : {}),
    })];
  });
  return {
    schemaVersion: 1, sparks, sessions, models, memories, workEvents, visualActions, assets, projects, activeProjectId: projectIds.has(text(d.activeProjectId,100)) ? text(d.activeProjectId,100) : null, worlds, labCases, teamRuns,
    preferences, selectedSparkId, activeSessionId: sessions.some((s) => s.id === activeSessionId) ? activeSessionId : null,
  };
}
