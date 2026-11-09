export interface SourceText { path: string; content: string }
export interface DuplicateCode { first: { path: string; line: number }; second: { path: string; line: number }; tokens: number }
interface Token { value: string; line: number }

function tokenize(source: SourceText): Token[] {
  const result: Token[] = [];
  const pattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[\p{L}_$][\p{L}\p{N}_$]*|\d+(?:\.\d+)?|[^\s]/gu;
  const text = /\.py$/i.test(source.path) ? source.content.replace(/^[ \t]*#[^\n]*/gm, '') : source.content;
  let line = 1, previous = 0;
  for (const match of text.matchAll(pattern)) {
    line += (text.slice(previous, match.index).match(/\n/g) ?? []).length;
    const value = match[0];
    if (!value.startsWith('//') && !value.startsWith('/*')) result.push({ value, line });
    line += (value.match(/\n/g) ?? []).length;
    previous = match.index + value.length;
  }
  return result;
}

/** Exact substantial source overlap, with locations; comments/whitespace alone never establish duplication. */
export function duplicatedCode(sources: SourceText[]): DuplicateCode[] {
  const code = sources.filter(s => /\.(?:[cm]?[jt]sx?|py|rs|go|cs|cpp|c|java|vue|svelte)$/i.test(s.path));
  const entries = code.map(source => ({ source, tokens: tokenize(source) }));
  const seen = new Map<string, { file: number; offset: number }>();
  const issues: DuplicateCode[] = [], window = 48, minimum = 120;
  for (let file = 0; file < entries.length; file++) {
    const current = entries[file]!;
    for (let offset = 0; offset + window <= current.tokens.length; offset++) {
      const key = JSON.stringify(current.tokens.slice(offset, offset + window).map(t => t.value));
      const prior = seen.get(key);
      if (!prior) { seen.set(key, { file, offset }); continue; }
      if (prior.file === file && offset - prior.offset < minimum) continue;
      const old = entries[prior.file]!;
      let length = window;
      while (old.tokens[prior.offset + length] && current.tokens[offset + length] && old.tokens[prior.offset + length]!.value === current.tokens[offset + length]!.value && (prior.file !== file || prior.offset + length < offset)) length++;
      if (length < minimum) continue;
      issues.push({ first: { path: old.source.path, line: old.tokens[prior.offset]!.line }, second: { path: current.source.path, line: current.tokens[offset]!.line }, tokens: length });
      offset += length - 1;
      if (issues.length >= 8) return issues;
    }
  }
  return issues;
}
