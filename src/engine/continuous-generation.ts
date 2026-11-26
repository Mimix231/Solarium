import type { Capabilities, GenerationMetrics, LocalModel } from '../domain/types';
import type { InferenceAdapter } from './backends';
import { generationMetrics } from './backends';
import { prepareGeneration, streamingDecisionHeadroom, CHUNK_SIZE, CONTEXT_HEADROOM } from './context-window';
import type { GenerationRequestOptions, LlamaMessage, LlamaTurnResult } from './llama';
export interface GenerationOutcome {backend:string;reason:'natural_eos'|'tool_call'|'output_or_context_limit'|'content_filter'|'unknown'|'cancelled'|'transport_error'|'input_limit';contextSize:number|null;promptTokens:number|null;contextShift:'supported'|'unsupported'|'unknown';tokenCountSource?:'server'|'estimate'|'unknown';requestedOutputTokens?:number;keptPromptTokens?:number;completionTokens?:number;reasoningOpen?:boolean;detail?:string}

/** Retained for compatibility: 2048 is a streaming *batch*, not a new LLM request. */
export const OUTPUT_SEGMENT_TOKENS = CHUNK_SIZE;

export interface ContinuousAnswerOptions {
  adapter: InferenceAdapter;
  model: LocalModel;
  capabilities: Capabilities;
  messages: LlamaMessage[];
  signal: AbortSignal;
  request?: GenerationRequestOptions;
  /** Limit input assembly per natural tool turn, not streamed output tokens. */
  workingContextLimit?:number;
  onAnswer(delta: string): void;
  onReasoning(delta: string): void;
  onToolDelta?(index: number, name: string, argsSoFar: string): void;
  onReasoningState?(active: boolean): void;
  onMetrics?(metrics: GenerationMetrics): void;
  onOutcome?(outcome:GenerationOutcome):void;
}

export interface ContinuousAnswerResult {
  answer: string;
  result: LlamaTurnResult;
  segments: number;
  warning?: string;
}

/**
 * Stream a complete assistant turn from one server-side inference request.
 *
 * Previously we repeatedly ended a request at 2048 tokens, then invented an
 * assistant reasoning-tail message and a user instruction to "continue
 * thinking". That is NOT resuming the model's generation state: it turns
 * unfinished reasoning into a fresh chat exchange and can make the model
 * reconstruct the same plan indefinitely.
 *
 * llama.cpp: -1 means keep predicting in the SAME active inference stream,
 * including the reasoning -> answer transition when the backend supports it.
 * Server-side context shifting is not supported by every model or server,
 * even when the launcher requested it. Finite contexts cannot stream forever.
 * vLLM: use the output capacity of the actual loaded context in a single
 * request. Its OpenAI-compatible API cannot indefinitely extend a full context
 * or reliably resume an unfinished reasoning channel. We never silently
 * fabricate another user message to re-trigger thought.
 *
 * Neither channel has a separate reasoning quota, a replay loop, or a
 * fabricated phase transition. The backend's real stop signal ends the turn.
 */
export async function streamContinuousAnswer(options: ContinuousAnswerOptions): Promise<ContinuousAnswerResult> {
  const { adapter, model, capabilities, messages, signal, request, onMetrics } = options;
  if (signal.aborted) throw new DOMException('Stopped', 'AbortError');

  let answer = '';
  let reasoning = '';
  let thinking = false;
  const setThinking = (active: boolean): void => {
    if (thinking === active) return;
    thinking = active;
    options.onReasoningState?.(active);
  };
  const started = performance.now();
  let firstToken: number | null = null;
  const onReasoning = (delta: string): void => {
    if (!delta) return;
    firstToken ??= performance.now();
    reasoning += delta;
    setThinking(true);
    options.onReasoning(delta);
  };
  const onAnswer = (delta: string): void => {
    if (!delta) return;
    firstToken ??= performance.now();
    answer += delta;
    setThinking(false);
    options.onAnswer(delta);
  };

  let result: LlamaTurnResult;
  let promptTokens:number|null=null;
  let tokenCountSource:'server'|'estimate'|'unknown'='unknown';
  let contextSize:number|null=capabilities.contextSize??model.contextSize??null;
  let requestedOutputTokens:number|undefined;
  let keptPromptTokens:number|undefined;
  try {
    const prepared = await prepareGeneration(adapter, model, capabilities, messages, signal, request, 0, options.workingContextLimit);
    tokenCountSource=prepared.tokenCountSource;
    promptTokens=prepared.promptTokens;contextSize=prepared.contextSize;
    // max_tokens=-1 requests a single long stream. A BOUNDED n_keep lets the
    // server evict older tokens when shifting context; -1 would pin the entire
    // prompt and defeat that mechanism for long construction requests.
    const outputTokens = adapter.kind === 'llama.cpp' && capabilities.contextShift !== 'unsupported'
      ? -1
      // A non-shifting backend has finite KV capacity. Requesting -1 cannot
      // make its context infinite; allocate the actual remaining token space.
      : Math.max(1, prepared.contextSize - prepared.promptTokens - CONTEXT_HEADROOM);
    // Retain the real fitted prompt (including goal and callable contracts),
    // but leave a guaranteed shiftable region. An arbitrary 512-token keep
    // prefix caused older Solarium models to forget user/project instructions.
    const keepTokens = capabilities.contextShift === 'unsupported' ? 0 :
      Math.max(0, Math.min(prepared.promptTokens, Math.floor(prepared.contextSize / 4),
        prepared.contextSize - streamingDecisionHeadroom(prepared.contextSize, capabilities.contextShift) - CONTEXT_HEADROOM));
    requestedOutputTokens=outputTokens;
    keptPromptTokens=adapter.kind==='llama.cpp'?keepTokens:undefined;
    result = await adapter.generate(model, prepared.messages, capabilities,
      { answer: onAnswer, reasoning: onReasoning, toolDelta: options.onToolDelta }, signal,
      { ...request, tools: prepared.tools, outputTokens, ...(adapter.kind==='llama.cpp' ? {keepTokens} : {}) });
  } catch(error){
    options.onOutcome?.({backend:adapter.kind,reason:signal.aborted?'cancelled':error instanceof Error&&(/INPUT context|oversized context|ModelContextError/i.test(error.message)||error.name==='ModelContextError')?'input_limit':'transport_error',contextSize,promptTokens,contextShift:capabilities.contextShift??'unknown',tokenCountSource,
      requestedOutputTokens,keptPromptTokens,detail:String(error)});
    throw error;
  } finally {
    setThinking(false);
  }
  const generated=reasoning+answer+result.calls.map(call=>call.function.arguments).join('');
  onMetrics?.(generationMetrics(adapter.kind, model.modelId, started, firstToken, performance.now(), generated,
    result.usage?.completionTokens));
  options.onOutcome?.({backend:adapter.kind,reason:result.calls.length&&result.finishReason!=='length'?'tool_call':result.finishReason==='stop'?'natural_eos':result.finishReason==='tool_calls'?'tool_call':result.finishReason==='length'?'output_or_context_limit':result.finishReason==='content_filter'?'content_filter':'unknown',contextSize,promptTokens,contextShift:capabilities.contextShift??'unknown',tokenCountSource,
    requestedOutputTokens,keptPromptTokens,completionTokens:result.usage?.completionTokens,
    reasoningOpen:result.reasoningOpen});
  const warning = result.finishReason === 'length'
    ? (reasoning && !answer
      ? 'The inference backend ended this reasoning turn at a generation limit. The exact limit (output, context, or server constraint) was not reported. Reasoning was preserved.'
      : 'The inference backend ended at a generation limit before reporting a natural end. The generated content has been preserved.')
    : !answer && reasoning && !result.calls.length
      ? 'The model finished reasoning without emitting a final answer. Check the model chat template/reasoning configuration; the emitted reasoning was preserved.'
      : undefined;
  return { answer, result, segments: 1, ...(warning ? { warning } : {}) };
}
