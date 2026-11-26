/** Ported from spica.runtime.record_set; never mutates the input. */
export function setRecordField<T extends Record<string, unknown>>(record: T, key: string, value: unknown): T {
  if (!key || key === '__proto__' || key === 'constructor' || key === 'prototype') throw Error('Unsafe field');
  return {...record, [key]:value};
}
