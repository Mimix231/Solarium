import type { Expression } from './types';
/** UI-only response reactions. Rules are deliberately conservative and can be disabled. */
export function suggestExpression(text: string): Expression {
  const sample = text.slice(0, 350).toLowerCase();
  if (/\b(i'm sorry|i am sorry|sad|unfortunate|condolences)\b/.test(sample)) return 'sad';
  if (/\b(congratulations|wonderful|great news|well done|fantastic)\b/.test(sample)) return 'happy';
  if (/\b(surprising|unexpected|unbelievable|astonishing)\b/.test(sample)) return 'surprised';
  if (/\b(let me examine|step by step|investigate|debugging)\b/.test(sample)) return 'focused';
  if (/\b(how curious|interesting question|fascinating)\b/.test(sample)) return 'curious';
  return 'neutral';
}
