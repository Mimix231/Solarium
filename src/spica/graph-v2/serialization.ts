import type { SpicaGraphV2 } from './types';

/** Canonical JSON sorts every object key, rejects cycles and unsafe values, and preserves array order. */
export function spicaCanonicalJson(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (item: unknown, depth: number): unknown => {
    if (depth > 40) throw Error('SPICA document nesting exceeds the serialization limit.');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (!item || typeof item !== 'object') throw Error('SPICA data must be finite JSON values.');
    if (seen.has(item)) throw Error('SPICA data contains cyclic references.');
    seen.add(item);
    if (Array.isArray(item)) {
      const output = item.map(value => walk(value, depth + 1));
      seen.delete(item);
      return output;
    }
    if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw Error('SPICA data must contain plain objects.');
    }
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(item).sort()) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('Unsafe SPICA object property.');
      result[key] = walk((item as Record<string, unknown>)[key], depth + 1);
    }
    seen.delete(item);
    return result;
  };
  return JSON.stringify(walk(value, 0));
}

/** Browser-compatible SHA-256; never use a non-cryptographic hash for migration provenance. */
export async function spicaGraphDigest(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(spicaCanonicalJson(value)));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}
export function serializeSpicaGraphV2(graph: SpicaGraphV2): string { return spicaCanonicalJson(graph); }
