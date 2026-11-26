import { isCodeArtifactRequest, isImplementationRequest } from '../task-intent';

/** Routing is a host decision, not a tool that a Spark has to discover.
 * Legacy graph projects continue using their own validated SPICA contracts. */
export type ConstructionRoute = 'source' | 'legacy-spica' | 'conversation';
export interface ConstructionIntentInput {
  request: string;
  projectAttached: boolean;
  hasSpicaGraph: boolean;
  spicaIntent?: 'create' | 'edit' | 'inspect' | 'verify' | 'none';
  codeStudio?: boolean;
  codeArtifact?: boolean;
}

const explicitGraph = /\b(?:spica\s+(?:graph(?:\s*v2)?|v2|app|project)|graph\s*v2|universal\s+graph|typed\s+(?:ports?|connections?)|subgraphs?|(?:edit|compose|migrate)\s+(?:the\s+)?(?:block|node)\s+graph)\b/i;
const newApplication = /\b(?:build|create|develop|make|scaffold|implement|generate)\b[\s\S]{0,100}\b(?:game|platformer|rpg|website|web\s*app|desktop\s*app|mobile\s*app|application|app|program|editor|dashboard|tool|frontend|backend|project|site|simulator|utility|ide|software|api|server|cli|library|package|plugin|extension|service)\b/i;
const sourceModification = /\b(?:fix|repair|refactor|patch|edit|modify|implement|write|update)\b[\s\S]{0,100}\b(?:source|code|files?|repository|repo|component|backend|frontend|typescript|javascript|python|rust|css|tests?|build)\b/i;
const writingOnly = /\b(?:write|draft|rewrite|continue|edit|create)\b[\s\S]{0,60}\b(?:chapter|fanfiction|novel|poem|short\s+story|character\s+profile|fiction\s+scene)\b/i;

/** Classify before selecting callable tools. This never authorizes a write. */
export function classifyConstructionIntent(input: ConstructionIntentInput): ConstructionRoute {
  const text = input.request.trim();
  if (!text || input.codeArtifact === true || isCodeArtifactRequest(text)) return 'conversation';
  const explicitSource = Boolean(input.codeStudio) || /\b(?:code\s+studio|source\s+code\s+project|real\s+project\s+files|linked\s+source\s+folder)\b/i.test(text);
  // A question *about* building software is not permission to edit it.
  // Check this before graph-name matching: 'How does SPICA graph V2 work?'
  // is an explanation request, not a graph inspection or mutation.
  if (/^(?:please\s+)?(?:how|what|why|explain|describe|tell\s+me|(?:can|could|would)\s+you\s+(?:explain|describe|show|tell)|i\s+(?:want|would\s+like)\s+to\s+(?:know|understand)\s+how)\b/i.test(text) && !explicitSource) return 'conversation';
  // Existing SPICA graph requests remain graph-backed, unless a new/source
  // project is explicitly requested. Explicit SPICA does not become a file build.
  if (explicitGraph.test(text) && !explicitSource) return 'legacy-spica';
  if (writingOnly.test(text) && !newApplication.test(text) && !explicitSource) return 'conversation';
  if (explicitSource || newApplication.test(text) ||
      /\b(?:create|implement|write|add)\b[\s\S]{0,60}\bspica\s+(?:runtime|source)\s+blocks?\b/i.test(text)) return 'source';
  if (input.hasSpicaGraph && input.spicaIntent && input.spicaIntent !== 'none') return 'legacy-spica';
  if (isImplementationRequest(text, input.projectAttached) || sourceModification.test(text)) return 'source';
  return 'conversation';
}
