/** Bounded, evidence-driven recovery for a construction model turn that could
 * not produce a complete answer/action. This does NOT resume the KV stream or
 * manufacture a tool call. A retry is a fresh, independent action decision
 * based on the original goal and verified construction checkpoint only. */
export interface ConstructionInferenceEvidence {
  finishReason: string;
  hasFinalAnswer: boolean;
  completedToolCalls: number;
  partialToolCalls?: number;
  offeredToolNames: readonly string[];
  toolsSupported: boolean;
  stage: string;
  confirmedWrites: number;
  attempts: number;
  contextShift?:'supported'|'unsupported'|'unknown';
  contextSize?:number|null;
  cancelled?: boolean;
}
export type ConstructionInferenceRecovery =
  | {kind:'retry'; nextAttempts:number; operationalPrompt:string}
  | {kind:'pause'; diagnostic:string}
  | {kind:'none'};

const MAX_INCOMPLETE_DECISIONS = 2;
export function constructionInferenceRecovery(evidence:ConstructionInferenceEvidence):ConstructionInferenceRecovery {
  if(evidence.cancelled || evidence.hasFinalAnswer || evidence.completedToolCalls > 0) return {kind:'none'};
  if(evidence.finishReason === 'content_filter') return {kind:'pause',diagnostic:'The inference backend restricted the response.'};
  if(!evidence.toolsSupported || !evidence.offeredToolNames.length) return {
    kind:'pause',diagnostic:'No supported callable project tool was offered in this model turn.'};
  if(!['length','stop','unknown','tool_calls'].includes(evidence.finishReason)) return {kind:'pause',diagnostic:'The generation did not end in a recoverable state.'};
  if(evidence.attempts >= MAX_INCOMPLETE_DECISIONS) return {kind:'pause',diagnostic:
    `${evidence.attempts} independent construction decisions ended without an executable operation or final answer. `+
    (evidence.contextShift==='unsupported'?`The active ${evidence.contextSize??'finite'}-token model/server does not support context shifting; use a larger context or a compatible model/template for substantial reasoning and native tools. `:'')+
    `The task remains resumable.`};
  const offered = [...new Set(evidence.offeredToolNames)].slice(0,4);
  // The tool name is not an invented operation: this is the actual offered set.
  return {kind:'retry',nextAttempts:evidence.attempts+1,operationalPrompt:
    `INCOMPLETE CONSTRUCTION DECISION (runtime evidence, not previous model reasoning): `+
    `Previous inference finish_reason=${evidence.finishReason}; `+
    `${evidence.partialToolCalls??0} partial tool proposals were discarded without execution; `+
    `confirmed source writes in this attempt=${evidence.confirmedWrites}; `+
    `current construction stage=${evidence.stage}. `+
    `Begin a NEW independent decision using the original user request and SOURCE CONSTRUCTION CHECKPOINT. `+
    `Choose one currently offered registered operation (${offered.join(', ')}) and return its COMPLETE native tool arguments. `+
    `Do not repeat previous reasoning, invent results, create unregistered tools or claim edits. `+
    `If no valid operation is possible, state the exact missing prerequisite. `+
    `Recovery decision ${evidence.attempts+1} of ${MAX_INCOMPLETE_DECISIONS}.`};
}

/** The model can stream a partial function name/JSON before finish_reason=length.
 * Such calls are proposals, not complete executable actions. */
export function completedModelToolCalls<T>(finishReason:string, calls:readonly T[]): {calls:T[];discarded:number} {
  return finishReason==='length'
    ? {calls:[],discarded:calls.length}
    : {calls:[...calls],discarded:0};
}
