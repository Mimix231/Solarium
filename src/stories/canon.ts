export interface CanonPoint { arc?: number; chapter?: number; continuity?: string }

const digits: Record<string, number> = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
  '〇':0, '零':0, '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 };
const numberWord = '(\\d{1,5}|one|two|three|four|five|six|seven|eight|nine|ten)';
function ordinal(raw?: string): number | undefined {
  if (!raw) return undefined;
  const number = Number(raw);
  if (Number.isSafeInteger(number) && number >= 1) return number;
  const word = raw.toLowerCase();
  if (word.includes('十')) {
    const [tens, ones] = word.split('十');
    return (tens ? digits[tens] ?? 0 : 1) * 10 + (ones ? digits[ones] ?? 0 : 0);
  }
  return digits[word] || undefined;
}

export function canonEdition(value: string): string | undefined {
  return /\b(web novel|light novel|anime|manga)\b/i.exec(value.normalize('NFKC'))?.[1]?.toLowerCase();
}

/** Resolve only explicit source coordinates. The new fanfic chapter number is independent. */
export function requestedCanonPoint(request: string, base: CanonPoint = {}): CanonPoint {
  const text = request.replace(/https:\/\/\S+/g, '').normalize('NFKC');
  const pair = new RegExp(`\\barc\\s*${numberWord}(?:\\s*[,;:/–-]\\s*|\\s+(?:and\\s+)?)(?:canon(?:ical)?\\s+)?(?:chapter|ch\\.?)\\s*${numberWord}\\b`, 'i').exec(text);
  const reversed = new RegExp(`\\bchapter\\s*${numberWord}\\s+(?:of|in)\\s+(?:the\\s+)?arc\\s*${numberWord}\\b`, 'i').exec(text);
  const loneArc = new RegExp(`\\barc\\s*${numberWord}\\b`, 'i').exec(text);
  const canonicalChapter = new RegExp(`\\b(?:canon(?:ical)?|source|original)\\s+chapter\\s*${numberWord}\\b`, 'i').exec(text);
  const arc = ordinal(pair?.[1] ?? reversed?.[2] ?? loneArc?.[1]);
  const chapter = ordinal(pair?.[2] ?? reversed?.[1] ?? canonicalChapter?.[1]);
  return { arc: arc ?? base.arc, chapter: chapter ?? (arc !== undefined && arc !== base.arc ? undefined : base.chapter),
    continuity: canonEdition(text) ?? base.continuity };
}

/** Inspect real chapter labels, including localized episode/section labels. */
export function pageCanonPoint(title: string, locator = '', url = ''): CanonPoint {
  let path = url;
  try { path = decodeURIComponent(new URL(url).pathname); } catch { /* A locator can be plain text. */ }
  const label = `${title} ${locator} ${path}`.normalize('NFKC').replace(/[-_]/g, ' ');
  const local = /第([一二三四五六七八九十〇零\d]+)章(?:\s*(?:第)?([一二三四五六七八九十〇零\d]+)(?:話)?)?/u.exec(label);
  const arc = new RegExp(`\\barc\\s*${numberWord}\\b`, 'i').exec(label);
  const chapter = new RegExp(`\\b(?:chapter|ch\\.?)\\s*${numberWord}\\b`, 'i').exec(label);
  return { arc: ordinal(arc?.[1] ?? local?.[1]), chapter: ordinal(chapter?.[1] ?? local?.[2]), continuity: canonEdition(label) };
}

export function editionMatches(expected?: string, observed?: string): boolean {
  if (!expected || !observed) return true;
  return (canonEdition(expected) ?? expected.trim().toLowerCase()) === (canonEdition(observed) ?? observed.trim().toLowerCase());
}

export function pointMatches(expected: CanonPoint, observed: CanonPoint): boolean {
  return editionMatches(expected.continuity, observed.continuity) &&
    (expected.arc === undefined || observed.arc === expected.arc) &&
    (expected.chapter === undefined || observed.chapter === expected.chapter);
}

export function pointIsAvailable(boundary: CanonPoint, observed: CanonPoint): boolean {
  if (!editionMatches(boundary.continuity, observed.continuity)) return false;
  if (boundary.arc !== undefined && observed.arc !== undefined && observed.arc !== boundary.arc) return observed.arc < boundary.arc;
  return boundary.chapter === undefined || observed.chapter === undefined || observed.chapter <= boundary.chapter;
}

/** An unlocated AU draft cannot establish events at a specified canon opening. */
export function authoredPointIsAvailable(boundary:CanonPoint, observed:CanonPoint):boolean {
  return pointIsAvailable(boundary,observed) &&
    (boundary.arc===undefined||observed.arc!==undefined) &&
    (boundary.chapter===undefined||observed.chapter!==undefined||
      boundary.arc!==undefined&&observed.arc!==undefined&&observed.arc<boundary.arc);
}

export function canonPointLabel(point: CanonPoint): string {
  return [point.continuity, point.arc && `Arc ${point.arc}`, point.chapter && `Chapter ${point.chapter}`].filter(Boolean).join(' · ');
}
