import type { AgentToolDefinition } from '../tools';

/**
 * Restrict each model-facing fiction save to a small, independently confirmable
 * batch. This is a schema projection for the CURRENT stage, not a second
 * executor contract: the knowledge tool still validates the full authored
 * record and the existing permission gate still authorizes the write.
 */
export function fictionProfileToolForStage(
  definition: AgentToolDefinition,
  hasActiveWorld: boolean,
  maxProfiles = 2,
): AgentToolDefinition {
  if (definition.function.name !== 'save_fiction_profiles') {
    throw new Error('Fiction profile staging requires the registered save_fiction_profiles tool.');
  }
  const parameters = definition.function.parameters;
  const source = parameters.properties.profiles as { type: string; minItems?: number; maxItems?: number; items: unknown };
  return {
    ...definition,
    function: {
      ...definition.function,
      description: `${definition.function.description} Save at most ${maxProfiles} explicitly requested characters per call; continue with the remaining names after each successful save. ${hasActiveWorld ? 'The active Story World is already selected: omit story.' : 'No Story World exists yet: story.title and story.franchise are REQUIRED in the first save. Use only a recognizable work named by the user; do not invent a franchise.'}`,
      parameters: {
        ...parameters,
        properties: { ...parameters.properties, profiles: { ...source, maxItems: Math.min(source.maxItems ?? 12, maxProfiles) } },
        required: hasActiveWorld ? ['profiles'] : ['profiles', 'story'],
      },
    },
  };
}

/** The profile workflow's success counter must not also count as a failure. */
export function nextFictionProfileProgress(
  remaining: readonly string[],
  saved: readonly string[],
  failures: number,
): { remaining: string[]; failures: number; pending: boolean } {
  const confirmed = new Set(saved.map(name => name.trim().toLocaleLowerCase()).filter(Boolean));
  const pending = remaining.filter(name => !confirmed.has(name.trim().toLocaleLowerCase()));
  // A successful repository response is not completion if it did not save any
  // of the requested cast. Count that as a no-progress attempt, not success.
  const confirmedRequested = pending.length < remaining.length;
  return { remaining: pending, failures: confirmedRequested ? 0 : pending.length ? failures + 1 : 0, pending: pending.length > 0 };
}
