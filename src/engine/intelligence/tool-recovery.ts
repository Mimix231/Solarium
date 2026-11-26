import type { ToolValidationDefinition, ToolValidation } from './tool-validation';

/** Actionable, read-only diagnostics. A correction proposal never runs tools. */
export function validationRecovery(
  name: string,
  validation: ToolValidation,
  exposed: readonly ToolValidationDefinition[],
) {
  if (validation.ok) return null;
  const target = exposed.find(item => item.function.name === name);
  const available = exposed.map(item => item.function.name);
  return {
    category: target ? 'ARGUMENT_CONTRACT' as const : 'TOOL_NOT_OFFERED' as const,
    attemptedTool: name,
    ...(target ? {
      required: target.function.parameters.required ?? [],
      acceptedProperties: Object.keys(target.function.parameters.properties),
      issues: validation.error.issues,
    } : { availableTools: available }),
    nextAction: target
      ? `Construct a NEW ${name} call matching the currently offered contract. Correct only the listed fields; omitted facts must not be invented. The rejected call performed no operation.`
      : `Only these tools were offered for this stage: ${available.join(', ') || '(none)'}. Choose an offered tool or wait for the next legitimate stage. The rejected call performed no operation.`,
  };
}

export function runtimeFailureRecovery(tool: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const category = /\b(?:denied|permission|forbidden|not authorized)\b/i.test(message) ? 'PERMISSION'
    : /\b(?:revision|changed since|stale|conflict|locked)\b/i.test(message) ? 'STATE_CONFLICT'
    : /\b(?:source|quote|evidence|continuity|untranslated)\b/i.test(message) ? 'EVIDENCE'
    : /\b(?:story world|story\.title|franchise|no active|missing|requires)\b/i.test(message) ? 'MISSING_CONTEXT'
    : /\b(?:timeout|connection|offline|network|unavailable)\b/i.test(message) ? 'UNAVAILABLE'
    : 'EXECUTION';
  const nextAction = category === 'PERMISSION' ? 'Keep the task blocked until the user explicitly authorizes the operation. Do not retry.'
    : category === 'STATE_CONFLICT' ? 'Read the latest authoritative state, preserve saved work, then submit a new revision-correct proposal.'
    : category === 'EVIDENCE' ? 'Inspect actual saved source and character evidence; quote exact supported passages or leave interpretations uncited.'
    : category === 'MISSING_CONTEXT' ? 'Use existing verified state or supply the user-provided required context. Never invent a story, ID, or source.'
    : category === 'UNAVAILABLE' ? 'Preserve the error and pause or choose a supported offline operation; do not blindly replay the same call.'
    : 'Inspect the exact error and tool contract before submitting a different, corrected action.';
  return { tool, category, message, nextAction, executedSuccessfully: false };
}
