/** A block is an actual segment of the streamed assistant text, not a fabricated tool result. */
export const BLOCK_KINDS = ['writing', 'code', 'table', 'chart', 'research', 'image', 'equation', 'workflow', 'terminal', 'file', 'preview'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];
export interface ContentBlock {
  id: string;
  kind: BlockKind;
  title: string;
  language: string;
  content: string;
  status: 'streaming' | 'complete' | 'incomplete';
  /** Terminal output and generated file manifests are proposals unless backed by an actual tool record. */
  provenance: 'model' | 'tool';
}
export type MessagePart = { type: 'markdown'; text: string } | { type: 'block'; block: ContentBlock };

/** Stable IDs use the opening fence's character offset, so streamed updates never recreate blocks. */
function classify(info: string, offset: number, complete: boolean, content: string): ContentBlock {
  const marker = info.trim().match(/^(\S*)(?:\s+(.*))?$/);
  const token = (marker?.[1] ?? '').toLowerCase();
  const suffix = marker?.[2] ?? '';
  const alias = token.startsWith('solarium-') ? token.slice(9) : token.startsWith('solarium:') ? token.slice(9) : '';
  const kind: BlockKind = token === 'mermaid' ? 'workflow' : BLOCK_KINDS.includes(alias as BlockKind) ? alias as BlockKind : 'code';
  const titleMatch = suffix.match(/(?:^|\s)title=(?:"([^"]{1,150})"|'([^']{1,150})'|([^\s]{1,150}))/);
  const fileMatch = suffix.match(/(?:^|\s)file=(?:"([^"]{1,150})"|'([^']{1,150})'|([^\s]{1,150}))/);
  const language = kind === 'code' ? (token.includes(':') && !token.startsWith('solarium:') ? token.split(':')[0]! : token || 'text') : kind;
  const title = titleMatch?.[1] ?? titleMatch?.[2] ?? titleMatch?.[3] ?? fileMatch?.[1] ?? fileMatch?.[2] ?? fileMatch?.[3] ?? (token.includes(':') && kind === 'code' ? token.slice(token.indexOf(':') + 1) : '');
  return { id: `block-${offset}`, kind, title: title || defaultTitle(kind, language), language,
    content, status: complete ? 'complete' : 'streaming', provenance: 'model' };
}
function defaultTitle(kind: BlockKind, language: string): string {
  return kind === 'code' ? `${language.toUpperCase()} code` : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}

/**
 * Parse complete or partial Markdown. A trailing incomplete fence remains an open block
 * across any number of 2048-token backend continuations. Never infer closing from a segment boundary.
 * During streaming, a partial ``` prefix stays in Markdown until its newline arrives.
 */
export function parseMessageParts(text: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let cursor = 0;
  const opener = /^```([^\r\n]*)\r?\n/gm;
  while (cursor < text.length) {
    opener.lastIndex = cursor;
    const start = opener.exec(text);
    if (!start) break;
    if (start.index > cursor) parts.push({ type: 'markdown', text: text.slice(cursor, start.index) });
    const bodyStart = opener.lastIndex;
    const closer = /^```\s*$/gm;
    closer.lastIndex = bodyStart;
    const end = closer.exec(text);
    const content = text.slice(bodyStart, end?.index ?? text.length);
    parts.push({ type: 'block', block: classify(start[1] ?? '', start.index, Boolean(end), content) });
    cursor = end ? closer.lastIndex : text.length;
    if (!end) break;
  }
  if (cursor < text.length) parts.push({ type: 'markdown', text: text.slice(cursor) });
  if (!parts.length) return [{ type: 'markdown', text }];
  return parts;
}

/** Hints are intentionally simple: capable models may opt into structured fences; basic GGUFs can use normal Markdown. */
export const BLOCK_FORMAT_GUIDE = `SOLARIUM CONTENT PRESENTATION (formatting only; preserve your personality):
- Normal explanations use clean Markdown. Tables use ordinary Markdown tables; equations use inline $...$ or display $$...$$ LaTeX. Never wrap tables or equations in special Solarium blocks.
- Fenced source code (\`\`\`tsx, \`\`\`python, etc.) becomes an editable code block. Set title="filename" when producing a file.
- Substantial standalone chapters, documents, or articles can use \`\`\`solarium-writing title="Document title" followed by Markdown content and a closing fence.
- Charts are inline visual formatting: use \`\`\`solarium-chart with a compact JSON object {"type":"bar|line|area|pie","title":"...","data":[{"label":"...","value":3}]}, not a separate document.
- For visual flowcharts use \`\`\`mermaid with a small flowchart LR/TB (simple named nodes and --> edges). This is illustrative content, NOT proof any tool ran.
- Use \`\`\`solarium-preview for complete HTML/CSS or standalone HTML with inline JavaScript. Generated JavaScript runs only in an isolated, network-disabled preview frame.
- Do NOT pretend a preview worked, commands executed, or files were saved unless a real tool result confirms it. Close fences when complete.`;

/** Visual data belongs in the message flow. Only work products have document toolbars. */
export const EDITABLE_BLOCK_KINDS: ReadonlySet<BlockKind> = new Set(['writing', 'code', 'preview']);
export const INLINE_FORMAT_KINDS: ReadonlySet<BlockKind> = new Set(['table', 'chart', 'equation', 'image', 'research', 'workflow']);

export type RenderPart = MessagePart | { type: 'collection'; id: string; blocks: ContentBlock[] };
/** Adjacent code fences are one file collection; unrelated prose never gets swallowed. */
export function groupCodeFiles(parts: MessagePart[]): RenderPart[] {
  const rendered: RenderPart[] = [];
  for (let i = 0; i < parts.length;) {
    const part = parts[i]!;
    if (part.type !== 'block' || part.block.kind !== 'code') { rendered.push(part); i++; continue; }
    const blocks = [part.block];
    let cursor = i + 1;
    while (cursor < parts.length) {
      const next = parts[cursor]!;
      if (next.type === 'markdown' && /^\s*$/.test(next.text)) { cursor++; continue; }
      if (next.type === 'block' && next.block.kind === 'code') { blocks.push(next.block); cursor++; continue; }
      break;
    }
    if (blocks.length < 2) { rendered.push(part); i++; continue; }
    rendered.push({ type: 'collection', id: part.block.id, blocks });
    i = cursor;
  }
  return rendered;
}

/**
 * Incremental fence scanner used for live model output. Each character is scanned once;
 * the backend's 2048-token request boundaries have no special meaning to this parser.
 * Snapshotting yields immutable views safe to pass to React.
 */
export class BlockStreamAssembler {
  private source = '';
  private lineBuffer = '';
  private offset = 0;
  private markdown = '';
  private emitted: MessagePart[] = [];
  private open: ContentBlock | null = null;
  private pendingCloseNewline = false;

  get text(): string { return this.source; }
  reset(): void { this.source = ''; this.lineBuffer = ''; this.offset = 0; this.markdown = ''; this.emitted = []; this.open = null; this.pendingCloseNewline = false; }
  push(delta: string): void {
    if (!delta) return;
    this.source += delta;
    this.lineBuffer += delta;
    let end: number;
    while ((end = this.lineBuffer.indexOf('\n')) !== -1) {
      const line = this.lineBuffer.slice(0, end + 1);
      this.lineBuffer = this.lineBuffer.slice(end + 1);
      if (this.pendingCloseNewline) { if (line.trim()) this.markdown += '\n'; this.pendingCloseNewline = false; }
      const start = this.offset;
      this.offset += line.length;
      const opening = /^```([^\r\n]*)\r?\n$/.exec(line);
      if (this.open) {
        if (/^```[ \t]*\r?\n$/.test(line)) {
          this.open.status = 'complete';
          this.emitted.push({ type: 'block', block: this.open });
          this.open = null;
          this.pendingCloseNewline = true;
        } else this.open.content += line;
      } else if (opening) {
        if (this.markdown) { this.emitted.push({ type: 'markdown', text: this.markdown }); this.markdown = ''; }
        this.open = classify(opening[1] ?? '', start, false, '');
      } else this.markdown += line;
    }
  }
  snapshot(): MessagePart[] {
    const result = [...this.emitted];
    if (this.open) {
      const endMarker = /^```[ \t]*$/.test(this.lineBuffer);
      result.push({ type: 'block', block: { ...this.open, content: this.open.content + (endMarker ? '' : this.lineBuffer), status: endMarker ? 'complete' : 'streaming' } });
    } else if (this.markdown || this.lineBuffer) result.push({ type: 'markdown', text: this.markdown + (this.pendingCloseNewline && this.lineBuffer.trim() ? '\n' : '') + this.lineBuffer });
    return result.length ? result : [{ type: 'markdown', text: '' }];
  }
}
