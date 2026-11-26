import type { Capabilities, GenerationMetrics, InferenceBackend, LocalModel } from '../domain/types';
import { countChatInputTokens, countInputTokens, inspectModel, streamLlamaTurn, type GenerationRequestOptions, type LlamaCallbacks, type LlamaMessage } from './llama';

/** Both backends implement the OpenAI-compatible chat API; their capabilities still differ. */
export interface InferenceAdapter {
  readonly kind: InferenceBackend;
  inspect(model: LocalModel, signal?: AbortSignal): Promise<{ ids: string[]; capabilities: Capabilities }>;
  countTokens(model: LocalModel, messages: LlamaMessage[], signal: AbortSignal): Promise<number | null>;
  /** Optional tool-aware count; null means the backend cannot verify it. */
  countChatTokens?(
    model: LocalModel, messages: LlamaMessage[], tools: NonNullable<GenerationRequestOptions['tools']>,
    signal: AbortSignal, toolChoice?: 'auto' | 'required',
  ): Promise<number | null>;
  generate(model: LocalModel, messages: LlamaMessage[], capabilities: Capabilities, callbacks: LlamaCallbacks, signal: AbortSignal, options?: GenerationRequestOptions): ReturnType<typeof streamLlamaTurn>;
}
function adapter(kind: InferenceBackend): InferenceAdapter {
  return {
    kind,
    inspect: (model, signal) => inspectModel(model, signal),
    countTokens: (model, messages, signal) => countInputTokens(model, messages, signal),
    ...(kind === 'llama.cpp' ? {
      countChatTokens: (model: LocalModel, messages: LlamaMessage[], tools: NonNullable<GenerationRequestOptions['tools']>,
        signal: AbortSignal, toolChoice?: 'auto' | 'required') =>
        countChatInputTokens(model, messages, tools, signal, toolChoice),
    } : {}),
    generate: (model, messages, capabilities, callbacks, signal, options) => streamLlamaTurn(model, messages, capabilities, callbacks, signal, options),
  };
}
export const inferenceAdapters: Record<InferenceBackend, InferenceAdapter> = {
  'llama.cpp': adapter('llama.cpp'),
  vllm: adapter('vllm'),
  ollama: adapter('ollama'),
};
export const adapterFor = (model: LocalModel): InferenceAdapter => inferenceAdapters[model.backend ?? 'llama.cpp'];

/** Per-request measurement; tokens are estimated when the backend omits usage. */
export function generationMetrics(kind: InferenceBackend, model: string, started: number, firstToken: number | null, ended: number, output: string, exactTokens?: number): GenerationMetrics {
  const elapsedMs = Math.max(0, ended - started);
  const estimatedTokens = Math.ceil(output.length / 4);
  const firstTokenMs = firstToken === null ? null : Math.max(0, firstToken - started);
  const generationSeconds = (ended - (firstToken ?? started)) / 1000;
  return {
    backend: kind, model, elapsedMs, firstTokenMs,
    completionTokens: exactTokens ?? null, estimatedTokens,
    tokensPerSecond: generationSeconds > 0 ? Number(((exactTokens ?? estimatedTokens) / generationSeconds).toFixed(1)) : null,
  };
}
