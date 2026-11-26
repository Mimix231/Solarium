const namePart = "[\\p{Lu}\\p{Lt}][\\p{L}\\p{M}’'–-]*";
export const fictionNamePattern = `${namePart}(?:[ \\t]+${namePart}){0,3}`;
const name = new RegExp(`^${fictionNamePattern}$`, 'u');
const separator = '(?:,\\s*(?:and\\s+)?|;\\s*|\\s+and\\s+|\\s*&\\s*|\\s+/\\s+)';
const separate = new RegExp(separator, 'i');
const list = new RegExp(`(?<![\\p{L}\\p{N}])(${fictionNamePattern}(?:\\s*${separator}${fictionNamePattern}){1,11})(?![\\p{L}\\p{N}])`, 'gu');

export const splitFictionNames = (text:string) => text.split(separate).map(part=>part.trim()).filter(Boolean);

export function isFictionNameList(text:string):boolean {
  const entries=splitFictionNames(text);
  return entries.length>1&&entries.every(entry=>name.test(entry));
}

export function namedFictionLists(text:string):string[] {
  return [...text.matchAll(list)].flatMap(match=>splitFictionNames(match[1]!)).map(entry=>
    entry.replace(/^(?:After|Before|With|Only|Include|Introduce|Add|Save|Use|Meet|Both|Keep|Mention|Research|Now)\s+(?=\p{Lu})/u,''));
}
