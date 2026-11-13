export interface ProseIssue { kind: 'document_marker' | 'repeated_passage'; message: string; passage: string }
export const sceneSpacerStyles = ['rule', 'dots', 'space'] as const;
export type SceneSpacerStyle = typeof sceneSpacerStyles[number];
export const sceneBreak = '\n\n***\n\n';

export function withoutSceneHeadings(text: string) {
  return text.replace(/^[ \t]*(?:#{1,6}[ \t]+(?:scene|part)[ \t]+\d+\b[^\r\n]*|(?:\*\*|__)?(?:scene|part)[ \t]+\d+\b(?:[ \t]*[:.\u2013\u2014-][^\r\n]*)?(?:\*\*|__)?[ \t]*)(?:\r?\n|$)/gim, '');
}
/** Presentation recovery never mutates the original message or a saved revision. */
export function readableProse(original: string): { text: string; issues: ProseIssue[] } {
  const issues: ProseIssue[] = [];
  const text = original.replace(/^```(?:solarium-writing|solarium:writing)\b[^\r\n]*\r?\n/gm, marker => {
    issues.push({ kind: 'document_marker', message: 'A repeated document opening was kept out of the prose. The original response remains available.', passage: marker.trim() });
    return '\n';
  });
  return { text, issues };
}
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
function shingles(text: string): Set<string> {
  const tokens = words(text); return new Set(tokens.slice(0, -3).map((_, i) => tokens.slice(i, i + 4).join(' ')));
}
/** Local overlap evidence, not an assertion of literary/semantic perfection. */
export function repeatedPassages(candidate: string, accepted = ''): ProseIssue[] {
  const previous = accepted.split(/\n\s*\n/).filter(p => words(p).length >= 28);
  const issues: ProseIssue[] = [];
  for (const paragraph of candidate.split(/\n\s*\n/).filter(p => words(p).length >= 28)) {
    const tokens = shingles(paragraph);
    if (previous.some(p => { const other = shingles(p); let common = 0; for (const token of tokens) if (other.has(token)) common++; return common / Math.max(1, Math.min(tokens.size, other.size)) > .86; })) issues.push({ kind: 'repeated_passage', message: 'This passage closely repeats an earlier passage; the proposed text remains recoverable.', passage: paragraph });
    previous.push(paragraph);
  }
  return issues;
}
