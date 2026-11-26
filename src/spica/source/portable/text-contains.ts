/** Ported from spica.runtime.text_contains; literal, case-sensitive matching. */
export function textContains(value: string, query: string): boolean { return value.includes(query); }
