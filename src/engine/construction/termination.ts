/** Explain a genuine model stop without inventing a tool call or restarting inference.
 * A reasoning-only end is an incomplete model turn, not a project failure or save. */
export interface ConstructionStopEvidence {
  readonly finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown' | string;
  readonly hadReasoning: boolean;
  readonly reasoningOpen?: boolean;
  readonly hadAnswer: boolean;
  readonly requestedTool: boolean;
  readonly confirmedWrites: number;
  readonly stage: string;
  /** Transport measurements, not guarantees that native context shifting worked. */
  readonly transport?: {
    backend?:string; contextSize?:number|null; promptTokens?:number|null;
    tokenCountSource?:string; requestedOutputTokens?:number;
    keptPromptTokens?:number; completionTokens?:number;
    contextShift?:'supported'|'unsupported'|'unknown';
  };
}
export function describeConstructionStop(evidence: ConstructionStopEvidence): string {
  const {finishReason,hadReasoning,hadAnswer,reasoningOpen,requestedTool,confirmedWrites,stage}=evidence;
  const status=`**Source construction paused — not completed.** Confirmed writes in this attempt: ${confirmedWrites}. Current stage: ${stage}.`;
  let diagnostic:string;
  if(finishReason==='length'){
    diagnostic='The inference server returned finish_reason=length before completing the assistant turn. This means a generation limit was encountered; the API did not distinguish output, context, or another server limit.';
  }else if(finishReason==='content_filter'){
    diagnostic='The inference backend stopped generation under its content restrictions.';
  }else if(finishReason==='unknown'){
    diagnostic='The inference server did not report why generation stopped.';
  }else if(hadReasoning&&!hadAnswer&&reasoningOpen){
    diagnostic='The backend ended while the model reasoning channel was still open. The chat template or reasoning-tag format may be incompatible.';
  }else if(hadReasoning&&!hadAnswer){
    diagnostic='The model emitted reasoning but no final answer or callable action.';
  }else if(requestedTool){
    diagnostic='The model ended without a tool call even though a valid project operation was requested.';
  }else if(!hadAnswer){
    diagnostic='The model produced neither a final response nor a tool call.';
  }else{
    diagnostic='The model responded without a verified project operation.';
  }
  const details=evidence.transport;
  const measurements=details ? [
    details.backend ? `backend=${details.backend}` : '',
    details.contextSize!=null ? `n_ctx=${details.contextSize}` : '',
    details.promptTokens!=null ? `input≈${details.promptTokens} tokens (${details.tokenCountSource??'unknown'} count)` : '',
    details.keptPromptTokens!=null ? `n_keep=${details.keptPromptTokens}` : '',
    details.requestedOutputTokens!=null ? `max_tokens=${details.requestedOutputTokens}` : '',
    details.completionTokens!=null ? `generated=${details.completionTokens} tokens` : '',
    details.contextShift ? `context shift=${details.contextShift}` : '',
  ].filter(Boolean).join('; ') : '';
  return `${status}\n\n${diagnostic} `+
    (measurements?`Observed inference settings: ${measurements}. `:'')+
    'Solarium preserved the task, project state and diagnostic evidence. ' +
    'No tool was invented or executed after this model stop. ' +
    'Use **Resume task** after checking the loaded model’s tool-aware chat template, tool-calling capability and context settings. ' +
    'A resumed task must inspect the saved state before making new changes.';
}
