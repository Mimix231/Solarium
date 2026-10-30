import type { ChatSource } from '../domain/types';

export interface SearchIntent {
  query: string;
  topic: 'software' | 'interface' | 'general';
  terms: string[];
}
const STACK = ['Tauri', 'Rust', 'React', 'TypeScript', 'FFmpeg', 'Python', 'Electron', 'WebGPU', 'CUDA', 'llama.cpp', 'vLLM', 'CSS', 'MUI'];
const STOP = new Set(['that','this','these','about','from','what','with','when','where','please','would','could','should','create','build','make','want','thing','using','them','their','have','more','like','some','then','also','implement','explain']);
function stackTerms(text: string): string[] {
  return STACK.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
}
function intentWords(text: string): string[] {
  return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}+#.-]{3,}/gu) ?? [])
    .filter((word) => !STOP.has(word) && !/^https?/.test(word)))].slice(0, 16);
}
/** Search specific technical concepts, not general software-download pages or whole conversational prompts. */
export function buildSearchIntent(message: string): SearchIntent {
  const text = message.replace(/https:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim();
  const glass = /\b(liquid.?glass|glassmorphism|frosted.?glass|translucen\w*|backdrop.?filter|glass.?effect)\b/i.test(text);
  const animation = /\b(animat\w*|motion|transition|gradient|blur|refraction|spring)\b/i.test(text);
  const video = /\b(video.?edit\w*|footage|timeline.?edit\w*|video.?processing)\b/i.test(text);
  const image = /\b(image.?edit\w*|photo.?edit\w*|raster|vector.?edit\w*)\b/i.test(text);
  const game = /\b(game.?engine|voxel|three\.js|game.?develop\w*)\b/i.test(text);
  const programming = /\b(app|application|program|software|editor|ide|code|coding|programming|build|create|develop|implement|debug|typescript|javascript|react|rust|tauri|ffmpeg|python|llama\.?cpp|vllm|gpu|ui|interface|frontend|backend)\b/i.test(text);
  const stack = stackTerms(text);
  if (glass) {
    const terms = ['CSS', 'backdrop-filter', 'translucent', 'glassmorphism', ...(animation ? ['animation','gradients'] : []), ...stack];
    return { topic: 'interface', terms, query: ['CSS backdrop-filter glassmorphism translucent UI design', ...(animation ? ['animation gradients motion'] : []), ...stack, 'implementation documentation'].join(' ').slice(0, 240) };
  }
  if (programming || video || image || game) {
    const major = video ? 'video editing software architecture development' : image ? 'image editing application development architecture' : game ? 'game engine development architecture' : /(bug|error|fix|debug)/i.test(text) ? 'programming debugging documentation' : 'software implementation architecture';
    const terms = [...intentWords(major), ...stack];
    return { topic: 'software', terms, query: [major, ...stack, 'documentation'].join(' ').slice(0, 240) };
  }
  const terms = intentWords(text);
  return { topic: 'general', terms, query: terms.join(' ').slice(0, 240) || text.slice(0, 240) };
}
const DOWNLOAD_SPAM = /\b(free (software )?download|download now|best downloads|app store|windows download|latest freeware|top freeware|gratis software|software downloaden|download software)\b/i;
const MOVIES = /\b(cinema|movie theater|movie theatre|showtimes|tickets|screenings|box office|film festival|cinemas near)\b/i;
const DEV = /\b(programming|source code|library|api|sdk|development|editor|github|documentation|tutorial|framework|ffmpeg|rust|tauri|react|typescript|javascript|gpu|video processing|timeline|css|html|browser|frontend|backend|implementation)\b/i;
const GLASS = /\b(backdrop.?filter|glassmorphism|translucen\w*|frosted|glass.?effect|opacity|refract\w*|blur\w*|compositing|css|ui design|interface design)\b/i;
export function rankResearchResults(results: ChatSource[], intent: SearchIntent): ChatSource[] {
  const seen = new Set<string>();
  return results.map((item) => {
    let url: URL;
    try { url = new URL(item.url); } catch { return { item, score: -999 }; }
    if (url.protocol !== 'https:' || url.username || url.password) return { item, score: -999 };
    const normalized = url.origin + url.pathname.replace(/\/$/, '');
    if (seen.has(normalized)) return { item, score: -999 };
    seen.add(normalized);
    const body = `${item.title} ${item.excerpt ?? ''} ${url.pathname}`;
    const lower = body.toLowerCase();
    let score = 0;
    if (intent.topic !== 'general') {
      if (DOWNLOAD_SPAM.test(body) || MOVIES.test(body)) score -= 22;
      if (DEV.test(body)) score += 3;
      if (/^(docs\.|developer\.|learn\.|mdn\.)|(?:^|\.)(?:github\.com|docs\.rs|crates\.io|web\.dev)$/.test(url.hostname)) score += 3;
      if (intent.topic === 'interface') {
        if (GLASS.test(body)) score += 7;
        if (!GLASS.test(body)) score -= 12;
      }
      const matches = intent.terms.filter((term) => lower.includes(term.toLowerCase()));
      score += Math.min(8, matches.length * 2);
      if (intent.topic === 'software' && !DEV.test(body) && matches.length === 0) score -= 10;
    } else {
      score += intent.terms.filter((term) => lower.includes(term.toLowerCase())).length;
    }
    return { item, score };
  }).filter(({ score }) => score >= (intent.topic === 'interface' ? 7 : intent.topic === 'software' ? 3 : 1))
    .sort((a, b) => b.score - a.score).map(({ item }) => item);
}

/** Resolve vague follow-up research requests against the known project topic. */
export function buildContextualSearchIntent(message: string, projectObjective: string): SearchIntent {
  const specific = /\b(?:tauri|rust|react|typescript|ffmpeg|css|python|gpu|llama|vllm|webkit|webgpu|html|api|sdk|library|framework|video.?edit|image.?edit|timeline|glassmorphism|backend|frontend)\b/i.test(message);
  return buildSearchIntent(specific ? message : `${projectObjective.slice(0, 650)} ${message}`);
}
