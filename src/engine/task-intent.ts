/** Decisions here affect tool routing, never the user's saved chat content. */
export function isCodeArtifactRequest(message:string):boolean {
  const text=message.trim();
  const explicit=/\b(?:code\s*blocks?|code\s*fences?|fenced\s+(?:code|blocks?)|(?:code|source)\s+in\s+(?:this\s+)?chat|(?:code|source)\s+snippets?)\b/i.test(text);
  const filesystem=/\b(?:apply|save|write|edit|modify|patch)\b.{0,55}\b(?:to|in|inside|into|on)\b.{0,35}\b(?:project|repository|repo|workspace|disk|files?|folder)\b/i.test(text);
  return explicit&&!filesystem;
}
export function isImplementationRequest(message: string, inProject = false): boolean {
  const text = message.trim();
  if (!text) return false;
  if(isCodeArtifactRequest(text))return false;
  // Do not treat ordinary creative writing or advice as a filesystem request.
  if (/^(?:how (?:would|could|do|can|should)|what (?:would|could|should)|explain|describe|tell me how|can you explain)\b/i.test(text)) return false;
  if (inProject && /^(?:please\s+)?(?:fix\s+(?:this|it|that|these)|make\s+this\s+work|do\s+it|finish\s+this)\b/i.test(text)) return true;
  // Descriptive words in a real repair request must not route a linked coding
  // task into generic source/memory research instead of exposing project tools.
  if (inProject && /^(?:please\s+)?(?:fix|repair|modify|edit|refactor|patch)\b/i.test(text) && /\b(?:code|source|files?|tests?|build|bugs?|errors?|functions?|packages?|repositories|repository|codebase|frontend|backend)\b/i.test(text) && !/^(?:please\s+)?(?:fix|repair|modify|edit)\s+(?:the\s+)?(?:chapter|story|dialogue|poem|plot|character)\b/i.test(text)) return true;
  // A technology-specific build instruction inside a linked project is a real
  // file task even when the framework name separates 'build' from 'editor'.
  if (inProject && /\b(?:build|create|implement|scaffold)\b/i.test(text) && /\b(?:tauri|react|rust|mui|project folder|source files?|typescript|frontend|backend)\b/i.test(text)) return true;
  if (/\b(?:implement|scaffold|refactor|run\s+(?:the\s+)?(?:build|tests)|start\s+with\s+phase\s+\d+)\b/i.test(text)) return true;
  if (/\bset\s+(?:it|this|that|the\s+project|the\s+app)\s+up\b/i.test(text)) return true;
  if (/\b(?:create|build|make|develop)\s+(?:(?:the|a|an|my|this|our|new)\s+){0,3}(?:app|application|program|project|website|webapp|editor|frontend|backend|ui|component|module|plugin|source\s+files?|script|repository|codebase)\b/i.test(text)) return true;
  if (/\b(?:fix|modify|edit|write|apply|repair)\s+(?:(?:the|a|my|this|these|our|existing|new|linked|attached|selected|current)\s+){0,4}(?:code|source|files?|component|project|build|bug|error|typescript|rust|css|ui)\b/i.test(text)) return true;
  return false;
}

/** Web access being allowed does not mean every request should cause a search. */
export function wantsWebResearch(message: string): boolean {
  return /(?:\b(?:search|look\s*up|browse|research|find)\b.{0,45}\b(?:online|web|internet|websites?|documentation|docs|sources?|latest|current|release|updates?)\b|\b(?:search online|web search|look online|research online|browse the web|latest news|current documentation)\b)/i.test(message);
}
export function shouldAutoResearch(message: string): boolean {
  return wantsWebResearch(message) && !isImplementationRequest(message);
}
