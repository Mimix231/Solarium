/** Small, offline BM25 index built over the accessible records only. */
export const searchTerms = (text: string): string[] => [...new Set((text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).filter(t => t.length > 1 && !new Set(['the','and','for','with','this','that','from','what','next','write','chapter','please','into','have','does','about']).has(t)))];
export function rankedEvidence<T>(items: readonly T[], query: string, text: (item: T) => string, boost: (item: T) => number = () => 0): { item: T; score: number }[] {
  const terms = searchTerms(query); const docs = items.map(item => ({ item, terms: Array.from(text(item).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []) }));
  const average = docs.reduce((n, d) => n + d.terms.length, 0) / Math.max(1, docs.length);
  const frequencies = new Map(terms.map(term => [term, docs.filter(d => d.terms.includes(term)).length]));
  return docs.map(doc => ({ item: doc.item, score: boost(doc.item) + terms.reduce((sum, term) => {
    const frequency = doc.terms.filter(t => t === term).length;
    const idf = Math.log(1 + (docs.length - (frequencies.get(term) ?? 0) + .5) / ((frequencies.get(term) ?? 0) + .5));
    return sum + idf * frequency * 2.2 / (frequency + 1.2 * (.25 + .75 * doc.terms.length / Math.max(1, average)));
  }, 0) })).sort((a, b) => b.score - a.score);
}
