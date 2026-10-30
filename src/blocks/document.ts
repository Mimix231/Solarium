export interface DocumentHeading { line: number; level: number; label: string }
export function documentHeadings(markdown: string): DocumentHeading[] {
  return markdown.split(/\r?\n/).flatMap((line, index) => {
    const match = /^(#{1,6})\s+(.+)\s*$/.exec(line);
    return match ? [{ line: index + 1, level: match[1]!.length, label: match[2]!.replace(/[*_`]/g, '').trim().slice(0, 160) }] : [];
  }).slice(0, 150);
}
export function documentWordCount(markdown: string): number {
  return (markdown.trim().match(/\S+/g) ?? []).length;
}
