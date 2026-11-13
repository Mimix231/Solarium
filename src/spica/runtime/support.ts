/** Small, deterministic helpers shared by independently registered SPICA building blocks. No script evaluation. */
export function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function configKeys(config: Readonly<Record<string, unknown>>, ...allowed: string[]): void {
  if (Object.keys(config).some(key => !allowed.includes(key))) throw Error(`Unexpected config property. Allowed: ${allowed.join(', ') || 'none'}`);
}
export function nonemptyText(value: unknown, field: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`${field} must contain 1–${max} characters.`);
  return value;
}
export function boundedText(value: unknown, field: string, max = 32000): string {
  if (typeof value !== 'string' || value.length > max) throw Error(`${field} must be text (≤${max} characters).`);
  return value;
}
export function finite(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error(`${field} must be a finite number.`);
  return value;
}
export function boundedInteger(value: unknown, field: string, min = 0, max = 10000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw Error(`${field} must be an integer from ${min} to ${max}.`);
  return value;
}
export function safeKey(value: unknown, field = 'key'): string {
  if (typeof value !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(value) || ['__proto__','constructor','prototype'].includes(value))
    throw Error(`${field} must be a safe, simple field name (≤64 characters).`);
  return value;
}
export function asRecord(value: unknown): Record<string, unknown> {
  if (!plain(value)) throw Error('This block requires a plain data record.');
  return value;
}
export function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > 10000) throw Error('This block requires an array with ≤10,000 items.');
  return value;
}
export function ui(renderer: string, props: Record<string, unknown>): Record<string, unknown> {
  return { renderer, ...props };
}
