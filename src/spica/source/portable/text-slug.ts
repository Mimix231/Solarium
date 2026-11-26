/** Ported from spica.runtime.text_slug. */
export function slugifyText(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'').slice(0,240);
}
