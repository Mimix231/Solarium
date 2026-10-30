/** Decisions here affect tool routing, never the user's saved chat content. */
export function isImplementationRequest(message: string, inProject = false): boolean {
  const text = message.trim();
  if (!text) return false;
  // Do not treat ordinary creative writing or advice as a filesystem request.
  if (/^(?:how (?:would|could|do|can|should)|what (?:would|could|should)|explain|describe|tell me how|can you explain)\b/i.test(text)) return false;
  if (inProject && /^(?:please\s+)?(?:fix\s+(?:this|it|that|these)|make\s+this\s+work|do\s+it|finish\s+this)\b/i.test(text)) return true;
  // A technology-specific build instruction inside a linked project is a real
  // file task even when the framework name separates 'build' from 'editor'.
  if (inProject && /\b(?:build|create|implement|scaffold)\b/i.test(text) && /\b(?:tauri|react|rust|mui|project folder|source files?|typescript|frontend|backend)\b/i.test(text)) return true;
  if (/\b(?:implement|scaffold|refactor|run\s+(?:the\s+)?(?:build|tests)|start\s+with\s+phase\s+\d+)\b/i.test(text)) return true;
  if (/\bset\s+(?:it|this|that|the\s+project|the\s+app)\s+up\b/i.test(text)) return true;
  if (/\b(?:create|build|make|develop)\s+(?:(?:the|a|an|my|this|our|new)\s+){0,3}(?:app|application|program|project|website|webapp|editor|frontend|backend|ui|component|module|plugin|source\s+files?|script|repository|codebase)\b/i.test(text)) return true;
  if (/\b(?:fix|modify|edit|write|apply|repair)\s+(?:(?:the|a|my|this|these|our|existing|new)\s+){0,3}(?:code|source|files?|component|project|build|bug|error|typescript|rust|css|ui)\b/i.test(text)) return true;
  return false;
}

/** Web access being allowed does not mean every request should cause a search. */
export function wantsWebResearch(message: string): boolean {
  return /(?:\b(?:search|look\s*up|browse|research|find)\b.{0,45}\b(?:online|web|internet|websites?|documentation|docs|sources?|latest|current|release|updates?)\b|\b(?:search online|web search|look online|research online|browse the web|latest news|current documentation)\b)/i.test(message);
}
export function shouldAutoResearch(message: string): boolean {
  return wantsWebResearch(message) && !isImplementationRequest(message);
}
