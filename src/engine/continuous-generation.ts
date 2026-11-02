import type { Capabilities, GenerationMetrics, LocalModel } from '../domain/types';
import type { InferenceAdapter } from './backends';
import { generationMetrics } from './backends';
import { prepareGeneration, CHUNK_SIZE, CONTEXT_HEADROOM } from './context-window';
import type { GenerationRequestOptions, LlamaMessage, LlamaTurnResult } from './llama';
export interface GenerationOutcome {backend:string;reason:'natural_eos'|'tool_call'|'output_or_context_limit'|'content_filter'|'unknown'|'cancelled'|'transport_error'|'input_limit';contextSize:number|null;promptTokens:number|null;contextShift:'supported'|'unsupported'|'unknown';detail?:string}

/** Retained for compatibility: 2048 is a streaming *batch*, not a new LLM request. */
export const OUTPUT_SEGMENT_TOKENS = CHUNK_SIZE;

export interface ContinuousAnswerOptions {
  adapter: InferenceAdapter;
  model: LocalModel;
  capabilities: Capabilities;
  messages: LlamaMessage[];
  signal: AbortSignal;
  request?: GenerationRequestOptions;
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
 * including the reasoning -> answer transition. Server-side context shifting
 * (enabled for Solarium-managed servers) bounds the available KV allocation.
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
  let contextSize:number|null=capabilities.contextSize??model.contextSize??null;
  try {
    const prepared = await prepareGeneration(adapter, model, capabilities, messages, signal, request);
    promptTokens=prepared.promptTokens;contextSize=prepared.contextSize;
    // Continue on the same loaded engine: -1 asks llama.cpp to keep streaming
    // until the model's own stop or a genuine server limitation. The server
    // handles context shifting without a fresh chat/reasoning exchange.
    const outputTokens = adapter.kind === 'llama.cpp'
      ? -1
      : Math.max(1, prepared.contextSize - prepared.promptTokens - CONTEXT_HEADROOM);
    result = await adapter.generate(model, prepared.messages, capabilities,
      { answer: onAnswer, reasoning: onReasoning, toolDelta: options.onToolDelta }, signal,
      { ...request, tools: prepared.tools, outputTokens });
  } catch(error){
    options.onOutcome?.({backend:adapter.kind,reason:signal.aborted?'cancelled':error instanceof Error&&(/INPUT context|oversized context|ModelContextError/i.test(error.message)||error.name==='ModelContextError')?'input_limit':'transport_error',contextSize,promptTokens,contextShift:capabilities.contextShift??'unknown',detail:String(error)});
    throw error;
  } finally {
    setThinking(false);
  }
  const generated=reasoning+answer+result.calls.map(call=>call.function.arguments).join('');
  onMetrics?.(generationMetrics(adapter.kind, model.modelId, started, firstToken, performance.now(), generated,
    result.usage?.completionTokens));
  options.onOutcome?.({backend:adapter.kind,reason:result.calls.length&&result.finishReason!=='length'?'tool_call':result.finishReason==='stop'?'natural_eos':result.finishReason==='tool_calls'?'tool_call':result.finishReason==='length'?'output_or_context_limit':result.finishReason==='content_filter'?'content_filter':'unknown',contextSize,promptTokens,contextShift:capabilities.contextShift??'unknown'});
  const warning = result.finishReason === 'length'
    ? (reasoning && !answer
      ? 'The inference backend reached its context/output capacity during reasoning before producing an answer. The reasoning is saved; enlarge the loaded model context to allow completion.'
      : 'The inference backend reached its context/output capacity before reporting a natural end. The generated content has been preserved.')
    : !answer && reasoning && !result.calls.length
      ? 'The model finished reasoning without emitting a final answer. Check the model chat template/reasoning configuration; the emitted reasoning was preserved.'
      : undefined;
  return { answer, result, segments: 1, ...(warning ? { warning } : {}) };
}
