import type { ContentBlock } from './protocol';
import { parseDataTable, toCSV } from './data';

export function fileExtension(block: ContentBlock): string {
  if (block.kind === 'table') return 'csv';
  if (block.kind === 'preview') return 'html';
  if (block.kind === 'chart' || block.kind === 'research') return 'json';
  if (block.kind === 'equation') return 'tex';
  if (block.kind === 'workflow') return 'mmd';
  if (block.kind === 'writing') return 'md';
  const aliases:Record<string,string>={javascript:'js',typescript:'ts',python:'py',rust:'rs',bash:'sh',shell:'sh',powershell:'ps1',xml:'xml'};
  return (aliases[block.language.toLowerCase()]??block.language.replace(/[^a-z0-9]/gi, '').slice(0, 10)) || 'txt';
}
export function suggestedFileName(block: ContentBlock): string {
  const basename = [...(block.fileName??block.title).split(/[\\/]/).at(-1)!].map(char=>char.charCodeAt(0)<32?'-':char).join('').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 90) || block.kind;
  const ext = fileExtension(block);
  return new RegExp(`\\.${ext}$`, 'i').test(basename) ? basename : `${basename}.${ext}`;
}
export function exportedText(block: ContentBlock): string {
  if (block.kind === 'table') { const table = parseDataTable(block.content); return table ? toCSV(table) : block.content; }
  return block.content;
}
export function downloadBytes(content: BlobPart, mime: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportBlock(block: ContentBlock): void {
  const filename = suggestedFileName(block);
  downloadBytes(exportedText(block), block.kind === 'table' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8', filename);
}
function escapeXml(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function uint16(n: number): number[] { return [n & 255, (n >>> 8) & 255]; }
function uint32(n: number): number[] { return [...uint16(n), ...uint16(n >>> 16)]; }
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** A minimal valid OOXML DOCX with ZIP-store entries; no extra dependency or network required. */
export function makeDocx(markdown: string): Uint8Array {
  const paragraphs = markdown.split(/\r?\n/).map((line) => {
    const heading = /^(#{1,6})\s+/.exec(line);
    const value = heading ? line.slice(heading[0].length) : line;
    const style = heading ? `<w:pPr><w:pStyle w:val="Heading${Math.min(3, heading[1]!.length)}"/></w:pPr>` : '';
    return `<w:p>${style}<w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
  }).join('');
  const files: Array<[string, string]> = [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ['word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`],
  ];
  const encoder = new TextEncoder(); const local: number[] = []; const central: number[] = [];
  for (const [name, content] of files) {
    const key = encoder.encode(name), bytes = encoder.encode(content), checksum = crc32(bytes), offset = local.length;
    local.push(...uint32(0x04034b50), ...uint16(20), ...uint16(0x0800), ...uint16(0), ...uint16(0), ...uint16(0), ...uint32(checksum), ...uint32(bytes.length), ...uint32(bytes.length), ...uint16(key.length), ...uint16(0));
    for(const byte of key)local.push(byte);
    for(const byte of bytes)local.push(byte);
    central.push(...uint32(0x02014b50), ...uint16(20), ...uint16(20), ...uint16(0x0800), ...uint16(0), ...uint16(0), ...uint16(0), ...uint32(checksum), ...uint32(bytes.length), ...uint32(bytes.length), ...uint16(key.length), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0), ...uint32(offset), ...key);
  }
  return new Uint8Array([...local, ...central, ...uint32(0x06054b50), ...uint16(0), ...uint16(0), ...uint16(files.length), ...uint16(files.length), ...uint32(central.length), ...uint32(local.length), ...uint16(0)]);
}
export function exportDocx(markdown: string, filename: string): void {
  const bytes = makeDocx(markdown);
  downloadBytes(new Uint8Array(bytes).buffer as ArrayBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename.replace(/\.(md|txt)$/i, '') + '.docx');
}
/** Portable, safe HTML from simple Markdown; model HTML is always escaped. */
export function renderDocumentHtml(markdown: string): string {
  const inline = (input: string) => escapeXml(input)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const parts: string[] = []; let list = false;
  for (const line of markdown.split(/\r?\n/)) {
    const header = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) { if (!list) { parts.push('<ul>'); list = true; } parts.push(`<li>${inline(bullet[1]!)}</li>`); continue; }
    if (list) { parts.push('</ul>'); list = false; }
    if (header) { parts.push(`<h${header[1]!.length}>${inline(header[2]!)}</h${header[1]!.length}>`); continue; }
    if (!line.trim()) { parts.push('<br>'); continue; }
    parts.push(`<p>${inline(line)}</p>`);
  }
  if (list) parts.push('</ul>');
  return parts.join('\n');
}
export function exportHtmlDocument(markdown: string, title: string): void {
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeXml(title)}</title><style>body{font:16px/1.7 Georgia,serif;max-width:750px;margin:3rem auto;padding:1rem;color:#222}code{font:13px monospace;background:#eee}li{margin:.3em 0}</style><h1>${escapeXml(title)}</h1>${renderDocumentHtml(markdown)}</html>`;
  downloadBytes(html, 'text/html;charset=utf-8', title.replace(/[^a-z0-9 ._-]/gi, '_').slice(0, 70) + '.html');
}
export function printDocument(markdown: string, title: string): void {
  const frame = document.createElement('iframe'); frame.style.cssText = 'position:fixed;left:-9999px;width:800px;height:1000px';
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeXml(title)}</title><style>body{font:16px/1.7 Georgia,serif;padding:35px}code{font:13px monospace;background:#eee}</style><h2>${escapeXml(title)}</h2>${renderDocumentHtml(markdown)}`;
  document.body.append(frame);
  frame.onload = () => { frame.contentWindow?.print(); setTimeout(() => frame.remove(), 2000); };
}
