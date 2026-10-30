import type { Capabilities, LocalModel } from '../domain/types';
import { detectCapabilities } from './capabilities';
import { ReasoningSplitter } from './reasoning';
import { SSEDecoder } from './sse';
import type { AgentToolDefinition } from './tools';

interface ChatToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
export interface LlamaMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[]; tool_call_id?: string; tool_calls?: ChatToolCall[] }
export interface LlamaCallbacks { answer: (text: string) => void; reasoning: (text: string) => void; toolDelta?: (index: number, name: string, argsSoFar: string) => void }
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'unknown';
export interface LlamaTurnResult {
  answer: string;
  /** Actual model-emitted reasoning, never synthesized by the application. */
  reasoning?: string;
  /** Whether a textual <think> region was still open at a request boundary. */
  reasoningOpen?: boolean;
  calls: ChatToolCall[];
  finishReason: FinishReason;
  usage?: { completionTokens: number };
}
/** Structured input-context failure. Never replay or restart model reasoning to mask it. */
export class ModelContextError extends Error {
  constructor(message: string, readonly promptTokens: number | null, readonly contextSize: number | null) {
    super(message);
    this.name = 'ModelContextError';
  }
}

export interface GenerationRequestOptions {
  /** A reusable per-request output allowance; never increases the KV context capacity. */
  outputTokens?: number;
  /** Definitions are supplied by the permission-aware agent, not automatically enabled. */
  tools?: AgentToolDefinition[];
  /** Keep at least one real tool available for a required tool call; other schemas are paged by the agent. */
  requireTools?: boolean;
  /** Only request forced tool calling for an explicit executable user task, and only while starting it. */
  toolChoice?: 'auto' | 'required';
}
interface DeltaCall { index?: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }
interface StreamChunk {
  error?: { message?: string };
  usage?: { completion_tokens?: number };
  choices?: { delta?: { content?: string | null; reasoning_content?: string | null; reasoning?: string | null; tool_calls?: DeltaCall[] }; finish_reason?: string | null }[];
}
function baseUrl(endpoint: string): URL {
  const url = new URL(endpoint);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Only local HTTP inference servers are permitted (127.0.0.1 or localhost).');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}
const pathFor = (endpoint: string, path: string): string => new URL(path.replace(/^\//, ''), baseUrl(endpoint)).toString();
async function readJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Inference server responded ${response.status}.`);
  return response.json() as Promise<unknown>;
}
/** Count the real prompt with the active backend tokenizer when available. */
export async function countInputTokens(model: LocalModel, messages: LlamaMessage[], signal: AbortSignal): Promise<number | null> {
  const post = async (path: string, body: unknown): Promise<unknown> => {
    const response = await fetch(pathFor(model.endpoint, path), {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    return response.json() as Promise<unknown>;
  };
  if (model.backend === 'vllm') {
    // vLLM exposes a chat-aware /tokenize endpoint, but not all versions enable it.
    const data = await post('/tokenize', { model: model.modelId, messages });
    if (data && typeof data === 'object') {
      const result = data as { count?: number; tokens?: unknown[] };
      if (Number.isInteger(result.count) && result.count! >= 0) return result.count!;
      if (Array.isArray(result.tokens)) return result.tokens.length;
    }
    return null;
  }
  if (model.backend !== 'llama.cpp') return null;
  // Apply the loaded model's chat template first. Tokenizing bare message text
  // undercounts delimiters, role headers and special model tokens.
  const applied = await post('/apply-template', { messages });
  if (!applied || typeof applied !== 'object' || typeof (applied as { prompt?: unknown }).prompt !== 'string') return null;
  const tokenized = await post('/tokenize', { content: (applied as { prompt: string }).prompt, add_special: false });
  if (tokenized && typeof tokenized === 'object') {
    const tokens = (tokenized as { tokens?: unknown }).tokens;
    if (Array.isArray(tokens)) return tokens.length;
  }
  return null;
}

export async function inspectModel(model: LocalModel, signal?: AbortSignal): Promise<{ ids: string[]; capabilities: Capabilities }> {
  const [models, props] = await Promise.all([
    readJson(pathFor(model.endpoint, '/v1/models'), signal),
    readJson(pathFor(model.endpoint, '/props'), signal).catch(() => null),
  ]);
  const collection = models as { data?: { id?: string }[] };
  return {
    ids: (collection?.data ?? []).map((item) => item.id).filter((id): id is string => typeof id === 'string'),
    capabilities: (() => { const c = detectCapabilities(props); return { ...c, tools: c.tools === 'supported' || model.toolCalling ? 'supported' as const : 'unknown' as const, vision: c.vision === 'supported' ? 'supported' as const : model.visionEnabled ? 'user-enabled' as const : 'unknown' as const }; })(),
  };
}
export async function streamLlamaTurn(
  model: LocalModel,
  messages: LlamaMessage[],
  capabilities: Capabilities,
  callbacks: LlamaCallbacks,
  signal: AbortSignal,
  options: GenerationRequestOptions = {},
): Promise<LlamaTurnResult> {
  const response = await fetch(pathFor(model.endpoint, '/v1/chat/completions'), {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model.modelId, messages, stream: true,
      temperature: model.temperature, max_tokens: options.outputTokens ?? model.maxTokens,
      ...(model.backend === 'vllm' ? { stream_options: { include_usage: true } } : {}),
      ...(capabilities.tools === 'supported' && options.tools?.length ? { tools: options.tools, tool_choice: options.toolChoice ?? 'auto' } : {}),
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1400);
    if (response.status === 400 && /exceed(s|ed)? (?:the )?(?:available )?context|n_ctx|context.length|maximum context/i.test(detail)) {
      let promptTokens: number | null = null;
      let contextSize: number | null = null;
      try {
        const parsed = JSON.parse(detail) as { error?: { n_prompt_tokens?: number; n_ctx?: number } };
        promptTokens = Number.isFinite(parsed.error?.n_prompt_tokens) ? parsed.error!.n_prompt_tokens! : null;
        contextSize = Number.isFinite(parsed.error?.n_ctx) ? parsed.error!.n_ctx! : null;
      } catch { /* Some engines return plain text instead of a JSON error. */ }
      throw new ModelContextError(`Model rejected an oversized context request: ${detail.slice(0, 460)}`, promptTokens, contextSize);
    }
    throw new Error(`Model request failed (${response.status}): ${detail.slice(0, 320)}`);
  }
  if (!response.body) throw new Error('Inference server returned no response stream.');
  const reader = response.body.getReader();
  const utf8 = new TextDecoder();
  const sse = new SSEDecoder();
  const splitter = new ReasoningSplitter();
  const toolCalls = new Map<number, ChatToolCall>();
  let answer = '';
  let reasoningText = '';
  const emitReasoning = (text: string): void => { reasoningText += text; callbacks.reasoning(text); };
  let completionTokens: number | undefined;
  let finishReason: FinishReason = 'unknown';
  let doneEvent = false;
  function parseEvent(payload: string): void {
    if (payload === '[DONE]') { doneEvent = true; return; }
    let event: StreamChunk;
    try { event = JSON.parse(payload) as StreamChunk; }
    catch { throw new Error('Inference server returned malformed streamed JSON.'); }
    if (event.error) throw new Error(event.error.message || 'Inference server failed.');
    if (typeof event.usage?.completion_tokens === 'number') completionTokens = event.usage.completion_tokens;
    const choice = event.choices?.[0];
    if (choice?.finish_reason) {
      finishReason = ['stop', 'length', 'tool_calls', 'content_filter'].includes(choice.finish_reason)
        ? choice.finish_reason as FinishReason : 'unknown';
    }
    const delta = choice?.delta;
    if (!delta) return;
    const reasoning = delta.reasoning_content ?? delta.reasoning;
    if (reasoning) emitReasoning(reasoning);
    if (typeof delta.content === 'string') {
      for (const segment of splitter.push(delta.content)) {
        if (segment.kind === 'reasoning') emitReasoning(segment.text);
        else { answer += segment.text; callbacks.answer(segment.text); }
      }
    }
    for (const part of delta.tool_calls ?? []) {
      const index = part.index ?? 0;
      const current = toolCalls.get(index) ?? { id: '', type: 'function' as const, function: { name: '', arguments: '' } };
      if (part.id) current.id += part.id;
      if (part.function?.name) current.function.name += part.function.name;
      if (part.function?.arguments) current.function.arguments += part.function.arguments;
      toolCalls.set(index, current);
      callbacks.toolDelta?.(index, current.function.name, current.function.arguments);
    }
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const item of sse.push(utf8.decode(value, { stream: true }))) parseEvent(item);
    }
    for (const item of sse.push(utf8.decode())) parseEvent(item);
    for (const item of sse.flush()) parseEvent(item);
    for (const segment of splitter.finish()) {
      if (segment.kind === 'reasoning') emitReasoning(segment.text);
      else { answer += segment.text; callbacks.answer(segment.text); }
    }
  } finally { reader.releaseLock(); }
  // Older OpenAI-compatible engines can close a valid SSE response without a [DONE] frame.
  // Leave finishReason='unknown' in that case: do not guess that continuation is required.
  void doneEvent;
  return { answer, reasoning: reasoningText, reasoningOpen: splitter.isReasoning, finishReason, calls: [...toolCalls.entries()].sort(([a], [b]) => a - b).map(([, value]) => value),
    ...(completionTokens === undefined ? {} : { usage: { completionTokens } }),
  };
}
