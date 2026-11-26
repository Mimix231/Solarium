/** Ported from spica.runtime.array_sort_field; returns a new array. */
export function sortRecordsByField<T extends Record<string, unknown>>(items: readonly T[], field: keyof T & string, descending = false): T[] {
  if (field === '__proto__' || field === 'constructor' || field === 'prototype') throw Error('Unsafe field');
  const output = [...items];
  output.sort((a,b)=>{const x = a[field], y = b[field];const compare = typeof x === 'number' && typeof y === 'number' ? x-y : String(x ?? '').localeCompare(String(y ?? ''));return descending ? -compare : compare;});
  return output;
}
