/** Ported from spica.runtime.number_clamp; pure and host-independent. */
export function clampNumber(value: number, min: number, max: number): number {
  if (![value,min,max].every(Number.isFinite) || min > max) throw Error('Invalid clamp bounds or value');
  return Math.max(min, Math.min(max, value));
}
