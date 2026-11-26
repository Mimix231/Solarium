import type { Capabilities, LocalModel } from '../domain/types';
import type { InferenceAdapter } from './backends';
import type { GenerationRequestOptions, LlamaMessage } from './llama';

/** Legacy 2048 estimate for finite-backend prompt fitting; never splits llama.cpp streams or forces a new request. */
export const CHUNK_SIZE = 2048;
export const CONTEXT_HEADROOM = 96;
export const MIN_OUTPUT = 64;
/** Headroom for a genuine model decision before the first context shift. A 64-token
 * window is too small for a reasoning model to finish a structured tool call.
 * This is prompt-fitting slack, NOT a per-request generation cap. */
export function streamingDecisionHeadroom(contextSize: number, contextShift: Capabilities['contextShift'] = 'supported'): number {
  // Without KV shifting, a 4K prompt using 3.4K tokens gives a reasoning model
  // scarcely enough space to emit a complete native tool call. Reserve a
  // meaningful decision runway at INPUT assembly, before inference begins.
  // This is NOT a time, output, or reasoning cap and never restarts a stream.
  if (contextShift === 'unsupported') {
    return Math.max(768, Math.min(3072, Math.floor(contextSize * 0.4)));
  }
  if (contextShift === 'unknown') {
    return Math.max(512, Math.min(2048, Math.floor(contextSize * 0.25)));
  }
  return Math.max(128, Math.min(1024, Math.floor(contextSize / 8)));
}


export interface PreparedGeneration {
  messages: LlamaMessage[];
  outputTokens: number;
  promptTokens: number;
  contextSize: number;
  discardedHistory: number;
  tokenCountSource: 'server' | 'estimate';
  tools: NonNullable<GenerationRequestOptions['tools']>;
  /** The preferred first-response runway was reduced ONLY after optional
   * evidence and secondary tools were paged out. Does not truncate output. */
  reducedDecisionHeadroom?: boolean;
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
  return message.role === 'system' && typeof message.content === 'string' && /^(?:WEB RESEARCH MATERIAL|SAVED REFERENCE MATERIAL|PROJECT FILE SNAPSHOT|OPTIONAL RECIPE CONTEXT|OPTIONAL TASK HISTORY|OPTIONAL SPARK REFERENCE|OPTIONAL CONSTRUCTION PROJECT|OPTIONAL CONSTRUCTION RECOVERY|OPTIONAL CONSTRUCTION CHECKPOINT|OPTIONAL CONSTRUCTION VERIFICATION|OPTIONAL CONSTRUCTION OBSERVATION)(?:[ (:]|$)/.test(message.content);
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
  workingContextLimit?: number,
): Promise<PreparedGeneration> {
  if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
  if (!original.some((m) => m.role === 'user')) throw new Error('A user message is required for inference.');
  const actualCapacity = effectiveContextSize(model, capabilities);
  const contextSize = workingContextLimit && Number.isFinite(workingContextLimit)
    ? Math.min(actualCapacity, Math.max(512, Math.floor(workingContextLimit))) : actualCapacity;
  const headroom = CONTEXT_HEADROOM + Math.max(0, Math.floor(extraHeadroom));
  const requiredOutputSpace = adapter.kind === 'llama.cpp'
    ? streamingDecisionHeadroom(contextSize, capabilities.contextShift)
    : MIN_OUTPUT;
  const messages = original.filter(message => !(message.role==='system' && message.content===''));
  let discardedHistory = original.length - messages.length;
  let tools = [...(request.tools ?? [])];
  let source: 'server' | 'estimate' = 'estimate';
  const count = async (): Promise<number> => {
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
    try {
      // Use the template's REAL tool-aware token count when offered by the
      // server. A separate approximate schema addition would double count it.
      if (adapter.countChatTokens) {
        const exact = await adapter.countChatTokens(model, messages, tools, signal, request.toolChoice);
        if (exact !== null && Number.isSafeInteger(exact) && exact > 0) {
          source = 'server';
          return exact;
        }
      }
      const tokens = await adapter.countTokens(model, messages, signal);
      if (tokens !== null && Number.isSafeInteger(tokens) && tokens > 0) {
        source = 'server';
        // Older template/tokenizer endpoints may count only messages, not tool
        // schemas. Charge for the currently advertised real contracts.
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
  while (promptTokens + requiredOutputSpace + headroom > contextSize) {
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
  while(promptTokens+requiredOutputSpace+headroom>contextSize){
    const groups=messages.flatMap((m,i)=>m.role==='assistant'&&m.tool_calls?.length?[i]:[]);
    if(groups.length<2)break;
    const first=groups[0]!,end=groups[1]!;
    const remove=messages.slice(first,end).filter(m=>m.role!=='system'&&m.role!=='user');
    for(const item of remove){messages.splice(messages.indexOf(item),1);discardedHistory++;}
    if(!remove.length)break;promptTokens=await count();
  }
  while (promptTokens + requiredOutputSpace + headroom > contextSize) {
    const latestUser = latestUserIndex(messages);
    const oldest = messages.findIndex((message, index) => index < latestUser && message.role !== 'system');
    if (oldest < 0) break;
    messages.splice(oldest, 1);
    discardedHistory++;
    promptTokens = await count();
  }
  // Relevance ghosts are optional evidence, NOT the authoritative task. If a
  // model has an unusually long mandatory persona/user instruction, prefer
  // dropping the ghost packet before blocking its real construction action.
  while (promptTokens + requiredOutputSpace + headroom > contextSize) {
    const index=messages.findIndex(m=>m.role==='system'&&typeof m.content==='string'&&m.content.startsWith('SAVED ACTION EVIDENCE ('));
    if(index<0)break;
    messages.splice(index,1);discardedHistory++;promptTokens=await count();
  }
  // Tool declarations are input tokens, NOT additional model allocations or
  // generation chunks. For an explicit action, page secondary tool schemas out
  // of this request instead of blocking the entire task because every possible
  // tool was advertised at once. The agent offers the next work-set on its next
  // tool turn; at least one real tool remains when tool_choice is required.
  if (request.requireTools) {
    // Keep the agent's preferred tool while it fits; removing secondary tools
    // must not turn a real edit into repeated inspection. But an individual
    // schema may be larger than the entire loaded model context. In that case
    // try a *different already-registered and currently offered* tool instead
    // of retaining the oversized first declaration and blocking inference.
    const offered = [...tools];
    while (tools.length > 1 && promptTokens + requiredOutputSpace + headroom > contextSize) {
      tools.pop();
      promptTokens = await count();
    }
    if (tools.length === 1 && promptTokens + requiredOutputSpace + headroom > contextSize) {
      const alternatives = offered.slice(1).sort((a,b)=>
        JSON.stringify(a).length-JSON.stringify(b).length);
      let smallest = tools[0]!;
      let smallestTokens = promptTokens;
      for (const candidate of alternatives) {
        tools = [candidate];
        const measured = await count();
        if (measured < smallestTokens) { smallest = candidate; smallestTokens = measured; }
        if (measured + requiredOutputSpace + headroom <= contextSize) break;
      }
      // Never invent or weaken a tool schema. If all candidates are too large,
      // keep the smallest real offered contract for an accurate diagnostic.
      tools = [smallest];
      promptTokens = smallestTokens;
    }
  } else if (promptTokens + requiredOutputSpace + headroom > contextSize && tools.length) {
    tools = [];
    promptTokens = await count();
  }
  // A latest real result can itself exceed the remaining input. Retain its
  // identity/status and explicit paging locator, never discard the operation
  // or mutate the saved/original conversation to fit a request.
  for(let index=0;index<messages.length&&promptTokens+requiredOutputSpace+headroom>contextSize;index++){
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
  if (outputTokens < requiredOutputSpace) {
    // Try the actual loaded capacity before changing the preferred response
    // runway. This is input preparation only; NO extra model generation.
    if (workingContextLimit && contextSize < actualCapacity) {
      return prepareGeneration(adapter,model,capabilities,original,signal,request,extraHeadroom);
    }
    // Some 4K Sparks have mandatory user-authored instructions that cannot
    // coexist with the desirable 40% output reserve. Once ALL optional inputs
    // and secondary tools are removed, preserve the user goal, identity and
    // one real callable tool rather than erroneously declaring the task
    // blocked. Still require meaningful room for a complete tool decision.
    // This reserve is NOT a generation cutoff; non-shifting servers already
    // have a finite KV limit and must use their actual remaining capacity.
    const smallestUsableDecision = adapter.kind === 'llama.cpp' && capabilities.contextShift === 'unsupported'
      ? Math.min(512, Math.max(256, Math.floor(contextSize / 8)))
      : requiredOutputSpace;
    if (outputTokens >= smallestUsableDecision) {
      return { messages, outputTokens, promptTokens, contextSize, discardedHistory,
        tokenCountSource:source, tools, reducedDecisionHeadroom:true };
    }
    throw new Error(
      `The loaded inference context (${contextSize} tokens) cannot fit the current prompt (~${promptTokens} tokens)` +
      (tools.length ? ` and ${tools.length} currently offered tool schema(s)` : '') +
      `. Only ${Math.max(0,outputTokens)} tokens remain for a complete decision; at least ${smallestUsableDecision} are required. ` +
      'This is an INPUT context limitation, unrelated to the 2048-token streaming convention or reusable VRAM. ' +
      'Enlarge the model context in Models and restart its server, or shorten the Spark personality/current request. No additional inference/reasoning loops were started.',
    );
  }
  return { messages, outputTokens, promptTokens, contextSize, discardedHistory, tokenCountSource: source, tools };
}

