/** Ported from spica.runtime.number_add. */
export function addNumbers(a: number, b: number): number {
  const result = a + b;
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(result)) throw Error('Non-finite arithmetic result.');
  return result;
}
