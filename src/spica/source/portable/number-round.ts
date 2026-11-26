/** Ported from spica.runtime.number_round; decimal precision between 0 and 8. */
export function roundNumber(value: number, places = 2): number {
  if (!Number.isFinite(value) || !Number.isInteger(places) || places < 0 || places > 8) throw Error('Invalid rounding parameters');
  const scale = 10 ** places;
  const result = Math.round(value * scale) / scale;
  if (!Number.isFinite(result)) throw Error('Non-finite rounding result');
  return result;
}
