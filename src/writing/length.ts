export interface LengthTarget { unit: 'characters' | 'words'; minimum: number }
export function lengthTarget(request: string): LengthTarget | null {
  const matches = [...request.matchAll(/\b(\d[\d,.]*(?:\s*[kK])?)\s*[- ]?\s*(characters?|chars?|words?)\b/gi)];
  const match = matches.at(-1); if (!match) return null;
  const raw = match[1]!.replace(/[\s,]/g, '');
  const minimum = Math.round(Number(raw.replace(/[kK]$/, '')) * (/[kK]$/.test(raw) ? 1000 : 1));
  return Number.isFinite(minimum) && minimum > 0 ? { unit: /^word/i.test(match[2]!) ? 'words' : 'characters', minimum } : null;
}
