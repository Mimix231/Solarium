/** Project-aware routing. Chat questions NEVER mutate project state. */
export type SpicaIntent = 'none' | 'discuss' | 'inspect' | 'verify' | 'edit' | 'create';
export function normalizedSpicaRequest(input: string): string {
  return input.trim().replace(/^(?:(?:hey|hi|hello)\s+)?(?:dona|spark|assistant)[,!:;\s]+/i, '')
    .replace(/^(?:(?:can|could|would|will) you|i(?:'d| would) like you to|i want you to|please)\s+/i, '').trim();
}
const conceptual = /^(?:what if|imagine|how (?:would|could|do|can)|why|explain|describe|plan|brainstorm|suggest|tell me|show me ideas|give me ideas|should we|do you think|is it possible|what are|what's|what is)\b/i;
const command = /^(?:in (?:the|my|this) (?:app|application|project|notes? organizer)[,:]?\s*)?(?:add|implement|create|build|make|develop|assemble|change|modify|edit|update|extend|integrate|include|introduce|replace|remove|fix|repair|style|restyle|set up|enable|disable)\b/i;
const graphSubject = /\b(?:spica|warehouse|app|application|notes?|recents?|recent items?|tasks?|settings?|screens?|pages?|fields?|forms?|editor|markdown|formatting|rich text|layout|style|theme|design|ui|interfaces?|buttons?|panels?|navigation|collections?|workflow|feature|search)\b/i;
const readAction = /^(?:inspect|read|list|show|check|verify|test|run|rebuild|export)\b/i;
const creation = /^(?:build|create|make|develop|assemble)\s+(?:(?:a|an|the|new|my|fully|professional)\s+)*(?:spica\s+)?(?:app|application|program|desktop app|notes? organizer|tasks? manager)\b/i;
export function classifySpicaIntent(request: string, hasActiveGraph: boolean): SpicaIntent {
  const text = normalizedSpicaRequest(request);
  if (conceptual.test(text) || /^(?:can|could|would|should) (?:we|i)\b/i.test(text)) return 'discuss';
  const explicit = /\b(?:spica|block warehouse)\b/i.test(text);
  if (readAction.test(text) && (hasActiveGraph || explicit) && graphSubject.test(text))
    return /^(?:inspect|read|list|show|check)\b/i.test(text) ? 'inspect' : 'verify';
  if (!command.test(text)) return 'none';
  // The active SPICA project is the context. Do not require an exhaustive list
  // of feature keywords; new block capabilities must not require router changes.
  if (hasActiveGraph) return 'edit';
  if (!graphSubject.test(text)) return 'none';
  if (creation.test(text)) return 'create';
  return explicit ? 'create' : 'none';
}
