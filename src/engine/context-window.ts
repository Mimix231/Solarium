import type { Capabilities, LocalModel } from '../domain/types';
import type { InferenceAdapter } from './backends';
import type { GenerationRequestOptions, LlamaMessage } from './llama';

/** Legacy 2048 estimate for finite-backend prompt fitting; never splits llama.cpp streams or forces a new request. */
export const CHUNK_SIZE = 2048;
export const CONTEXT_HEADROOM = 96;
export const MIN_OUTPUT = 64;

export interface PreparedGeneration {
  messages: LlamaMessage[];
  outputTokens: number;
  promptTokens: number;
  contextSize: number;
  discardedHistory: number;
  tokenCountSource: 'server' | 'estimate';
  tools: NonNullable<GenerationRequestOptions['tools']>;
}

export function effectiveContextSize(model: LocalModel, capabilities: Capabilities): number {
  const limits = [model.contextSize, capabilities.contextSize].filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  return Math.floor(Math.min(...(limits.length ? limits : [4096])));
}

export function conservativeTokenEstimate(messages: LlamaMessage[]): number {
  let tokens = 0;
  for (const message of messages) {
    // Conservative for mixed code/non-English text. Never treat a data URL as prompt text.
    tokens += 32 + message.role.length;
    if (typeof message.content === 'string') {
      tokens += Math.ceil(new TextEncoder().encode(message.content).length / 2);
    } else {
      for (const part of message.content) {
        tokens += part.type === 'text' ? Math.ceil(new TextEncoder().encode(part.text).length / 2) : 1400;
      }
    }
    if (message.tool_calls?.length) tokens += Math.ceil(new TextEncoder().encode(JSON.stringify(message.tool_calls)).length / 2);
  }
  return tokens + 32;
}

function latestUserIndex(messages: LlamaMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === 'user') return i;
  return -1;
}

function isOptionalSystem(message: LlamaMessage): boolean {
  return message.role === 'system' && typeof message.content === 'string' && /^(?:WEB RESEARCH MATERIAL|SAVED REFERENCE MATERIAL|PROJECT INSTRUCTIONS|PROJECT FILE SNAPSHOT) \(/.test(message.content);
}

/**
 * Fits a real inference request into the currently loaded model's context window.
 * - No chat-history deletion: only the temporary request gets pruned.
 * - The primary Spark instructions and user request are kept unchanged.
 * - Runtime tokenizer is preferred; we reserve template/output headroom even then.
 */
export async function prepareGeneration(
  adapter: InferenceAdapter,
  model: LocalModel,
  capabilities: Capabilities,
  original: LlamaMessage[],
  signal: AbortSignal,
  request: GenerationRequestOptions = {},
  extraHeadroom = 0,
): Promise<PreparedGeneration> {
  if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
  if (!original.some((m) => m.role === 'user')) throw new Error('A user message is required for inference.');
  const contextSize = effectiveContextSize(model, capabilities);
  const headroom = CONTEXT_HEADROOM + Math.max(0, Math.floor(extraHeadroom));
  const messages = [...original];
  let discardedHistory = 0;
  let tools = [...(request.tools ?? [])];
  let source: 'server' | 'estimate' = 'estimate';
  const count = async (): Promise<number> => {
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
    try {
      const tokens = await adapter.countTokens(model, messages, signal);
      if (tokens !== null && Number.isSafeInteger(tokens) && tokens >= 0) {
        source = 'server';
        return tokens + (tools.length ? Math.ceil(JSON.stringify(tools).length / 2) + 64 : 0);
      }
    } catch (error) {
      if (signal.aborted) throw error;
      // Older backends may not implement tokenizer APIs. Conservatively estimate instead.
    }
    source = 'estimate';
    return conservativeTokenEstimate(messages) + (tools.length ? Math.ceil(JSON.stringify(tools).length / 2) + 64 : 0);
  };
  let promptTokens = await count();

  // Context integrity comes before reserving a large output allowance.
  // A smaller initial output allowance is preferable to making a follow-up
  // question forget the project it belongs to. llama.cpp streams natively
  // with outputTokens=-1 and is not interrupted at this allowance.
  // Trim untrusted retrieved pages before discarding actual conversation.
  while (promptTokens + MIN_OUTPUT + headroom > contextSize) {
    const optional = messages.findIndex(isOptionalSystem);
    if (optional < 0) break;
    messages.splice(optional, 1);
    discardedHistory++;
    promptTokens = await count();
  }
  // Long coding tasks have tool exchanges AFTER the original user goal. Page
  // whole completed exchanges out of the temporary request, preserving the
  // latest exchange, tool-call/result pairing and the durable verification
  // state. Their full originals remain in task archives and `original`.
  while(promptTokens+MIN_OUTPUT+headroom>contextSize){
    const groups=messages.flatMap((m,i)=>m.role==='assistant'&&m.tool_calls?.length?[i]:[]);
    if(groups.length<2)break;
    const first=groups[0]!,end=groups[1]!;
    const remove=messages.slice(first,end).filter(m=>m.role!=='system'&&m.role!=='user');
    for(const item of remove){messages.splice(messages.indexOf(item),1);discardedHistory++;}
    if(!remove.length)break;promptTokens=await count();
  }
  while (promptTokens + MIN_OUTPUT + headroom > contextSize) {
    const latestUser = latestUserIndex(messages);
    const oldest = messages.findIndex((message, index) => index < latestUser && message.role !== 'system');
    if (oldest < 0) break;
    messages.splice(oldest, 1);
    discardedHistory++;
    promptTokens = await count();
  }
  // Tool declarations are input tokens, NOT additional model allocations or
  // generation chunks. For an explicit action, page secondary tool schemas out
  // of this request instead of blocking the entire task because every possible
  // tool was advertised at once. The agent offers the next work-set on its next
  // tool turn; at least one real tool remains when tool_choice is required.
  if (request.requireTools) {
    while (tools.length > 1 && promptTokens + MIN_OUTPUT + headroom > contextSize) {
      tools.pop();
      promptTokens = await count();
    }
  } else if (promptTokens + MIN_OUTPUT + headroom > contextSize && tools.length) {
    tools = [];
    promptTokens = await count();
  }
  // A latest real result can itself exceed the remaining input. Retain its
  // identity/status and explicit paging locator, never discard the operation
  // or mutate the saved/original conversation to fit a request.
  for(let index=0;index<messages.length&&promptTokens+MIN_OUTPUT+headroom>contextSize;index++){
    const message=messages[index]!;if(message.role!=='tool'||typeof message.content!=='string'||message.content.length<=900)continue;
    let value:Record<string,unknown>;try{value=JSON.parse(message.content) as Record<string,unknown>;}catch{continue;}
    if(!value||typeof value!=='object'||!(value.archiveId||value.run_id||value.path))continue;
    const metadata=Object.fromEntries(['archiveId','run_id','command_id','command','exit_code','timed_out','cancelled','path','startLine','nextLine','totalLines','hasMore'].filter(key=>key in value).map(key=>[key,value[key]]));
    messages[index]={...message,content:JSON.stringify({...metadata,inputExcerpt:true,excerpt:message.content.slice(0,240),tail:message.content.slice(-100),notice:'Input excerpt only. Full result remains in the archive/log/file. Use recall_context, read_command_output, or ranged read_project_file for omitted text; do not guess a replacement.'})};
    discardedHistory++;promptTokens=await count();
  }
  if (request.requireTools && tools.length === 0) {
    throw new Error('This action requires an actual project tool, but none is available in the current conversation.');
  }
  const outputTokens = Math.min(CHUNK_SIZE, contextSize - promptTokens - headroom);
  if (outputTokens < MIN_OUTPUT) {
    throw new Error(
      `The loaded inference context (${contextSize} tokens) cannot fit the current prompt (~${promptTokens} tokens)` +
      (tools.length ? ` and ${tools.length} currently offered tool schema(s)` : '') +
      '. This is an INPUT context limitation, unrelated to the 2048-token streaming convention or reusable VRAM. ' +
      'Enlarge the model context in Models and restart its server, or shorten the Spark personality/current request. No additional inference/reasoning loops were started.',
    );
  }
  return { messages, outputTokens, promptTokens, contextSize, discardedHistory, tokenCountSource: source, tools };
}

