/** Ported from spica.runtime.array_unique; JSON structural equality. */
export function uniqueArray<T>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter(item => { const key = JSON.stringify(item); if (seen.has(key)) return false; seen.add(key); return true; });
}
