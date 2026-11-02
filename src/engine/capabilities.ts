import type { Capabilities } from '../domain/types';
const unknown: Capabilities = { reasoning: 'unknown', tools: 'unknown', vision: 'unknown', contextSize: null, source: 'unavailable' };
export function detectCapabilities(props: unknown): Capabilities {
  if (!props || typeof props !== 'object') return unknown;
  const p = props as Record<string, unknown>;
  const settings = (p.default_generation_settings ?? {}) as Record<string, unknown>;
  const chat = (p.chat_template ?? {}) as Record<string, unknown>;
  const templ = typeof p.chat_template === 'string' ? p.chat_template : typeof chat.content === 'string' ? chat.content : '';
  const metadata = (p.model_metadata ?? {}) as Record<string, unknown>;
  const ctx = typeof settings.n_ctx === 'number' ? settings.n_ctx : null;
  const toolFlag = p.chat_template_tool_use === true || p.supports_tools === true || /tools|tool_calls|function_call/.test(templ);
  const visionFlag = p.mmproj_loaded === true || p.vision === true || metadata['vision.enabled'] === 'true';
  const shift=p.context_shift??settings.context_shift;
  return { reasoning: 'unknown', tools: toolFlag ? 'supported' : 'unknown', vision: visionFlag ? 'supported' : 'unknown', contextSize: ctx, source: 'server-properties',contextShift:shift===true?'supported':shift===false?'unsupported':'unknown' };
}
