/** Ported from spica.runtime.record_get; absent fields become null. */
export function getRecordField(record: Readonly<Record<string, unknown>>, key: string): unknown {
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw Error('Unsafe field');
  return Object.hasOwn(record, key) ? record[key] ?? null : null;
}
