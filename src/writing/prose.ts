export interface ProseIssue { kind: 'document_marker' | 'repeated_passage'; message: string; passage: string }
export const sceneSpacerStyles = ['rule', 'dots', 'space'] as const;
export type SceneSpacerStyle = typeof sceneSpacerStyles[number];
export const sceneBreak = '\n\n***\n\n';

const speechVerb='(?:said|asked|replied|answered|whispered|murmured|muttered|drawled|called|shouted|yelled|warned|snapped|added|continued|growled|stammered|sneered)';
const person=String.raw`(?:[Tt]he (?:[\p{L}]+[ \t]+){0,2}(?:man|woman|boy|girl|guard|stranger|leader|merchant|soldier|speaker|child)|[\p{Lu}][\p{L}\p{M}'’.-]*(?:[ \t]+[\p{Lu}][\p{L}\p{M}'’.-]*){0,2}|[Hh]e|[Ss]he|[Tt]hey)`;
const afterSpeech=new RegExp(`^[, ]*(${person})[ \t]+(?:quietly |softly |finally )?${speechVerb}\\b`,'u');
const beforeSpeech=new RegExp(`(?:^|[.!?]\\s+)(${person})[ \t]+(?:quietly |softly |finally )?${speechVerb}[ \t]*[:,]?\\s*$`,'u');
const narrationQuote=/\b(?:sign|letter|note|words?|headline|inscription|label|engraved|written|titled|read)\b[^.!?]*$/i;

function quotedSpeech(line:string,names:ReadonlyMap<string,string>,label?:string,labels=true):string[] {
  const quotes=[...line.matchAll(/“([^”\r\n]+)”|"([^"\r\n]+)"/gu)];
  if(!quotes.length||/^[ \t]*(?:[>#]|[-*+] |\d+[.)] )/.test(line))return [line];
  const paragraphs:string[]=[];
  let cursor=0, speaker=label;
  for(const [index,quote] of quotes.entries()){
    const start=quote.index,end=start+quote[0].length;
    const before=line.slice(cursor,start);
    const after=line.slice(end,quotes[index+1]?.index??line.length);
    const following=afterSpeech.exec(after)?.[1];
    const preceding=beforeSpeech.exec(before)?.[1];
    const words=quote[1]??quote[2]??'';
    const dialogue=Boolean(preceding||following||label&&start===0)||
      !narrationQuote.test(before)&&/[.!?…]$/.test(words)&&(/\s/.test(words)||start===0||paragraphs.length>0);
    if(!dialogue)continue;
    const subject=following??preceding;
    if(subject&&!/^(?:he|she|they)$/i.test(subject))speaker=names.get(subject.toLowerCase())??subject[0]!.toUpperCase()+subject.slice(1);
    if(!speaker&&(!subject||/^(?:he|she|they)$/i.test(subject))){
      const first=before.split(/[.!?]/).map(part=>part.trim()).filter(Boolean).at(-1);
      speaker=[...names.values()].find(name=>first?.toLowerCase().startsWith(name.toLowerCase()+' '));
    }
    let narration=before.trim().replace(/^,\s*/, '');
    if(cursor&&narration)narration=narration[0]!.toUpperCase()+narration.slice(1);
    if(narration)paragraphs.push(narration);
    paragraphs.push(labels&&speaker?`${speaker}: ${quote[0]}`:quote[0]);
    cursor=end;
    if(!label&&!preceding&&!following&&!/[,;]\s*$/.test(after))speaker=undefined;
  }
  if(!paragraphs.length)return [line];
  const remaining=line.slice(cursor).trim().replace(/^,\s*/, '');
  if(remaining)paragraphs.push(remaining[0]!.toUpperCase()+remaining.slice(1));
  return paragraphs;
}

/** Keep dialogue apart from narrative and use names only when the text identifies the speaker. */
export function formatSpeakerDialogue(text: string, names: readonly string[] = [], presentation = false, labels = true): string {
  const known = new Map(names.map(name => [name.normalize('NFKC').toLowerCase(), name]));
  let fence: string | undefined;
  let previousDialogue = false;
  const lines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) fence = fence ? (marker[0] === fence[0] && marker.length >= fence.length ? undefined : fence) : marker;
    const match = !fence && !marker ? /^(?:\*\*)?([\p{L}][\p{L}\p{M}'’ .-]{0,44}?)(?:\*\*)?\s*(:|\s+[—–-])(?:\*\*)?[ \t]+(\S.*)$/u.exec(line) : null;
    const label = match?.[1]?.trim() ?? '';
    const named = known.get(label.normalize('NFKC').toLowerCase());
    const plausible = /^(?:\p{Lu}\p{L}*|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+)(?:[ .'-][\p{Lu}\p{M}][\p{L}\p{M}]*){0,3}$/u.test(label) &&
      !/^(?:scene|chapter|part|note|narrator|summary|outcome|continuity)$/i.test(label);
    const dialogue = labels&&Boolean(match && (named || plausible && match[2] === ':' || /^The (?:[a-z]+ ){0,2}(?:man|woman|guard|stranger|leader|merchant|soldier|speaker|child)$/i.test(label)));
    const spoken=dialogue ? quotedSpeech(match![3]!,known,named??label) : !fence&&!marker ? quotedSpeech(line,known,undefined,labels) : [line];
    if ((dialogue || previousDialogue || spoken.length>1) && lines.at(-1)?.trim() && line.trim()) lines.push('');
    if(dialogue&&spoken.length===1&&!spoken[0]!.startsWith((named??label)+':'))spoken[0]=`${named??label}: ${spoken[0]}`;
    for(const [index,part] of spoken.entries()){
      if(index)lines.push('');
      const speakerLabel=part.slice(0,part.indexOf(':'));
      const attributed=part.includes(': ')&&(dialogue&&speakerLabel===(named??label)||spoken.length>1&&/^[^.!?]{1,45}: [“"]/.test(part));
      lines.push(presentation&&attributed?`**${speakerLabel}:**${part.slice(speakerLabel.length+1)}`:part);
    }
    previousDialogue = dialogue||spoken.length>1;
  }
  return lines.join('\n');
}

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
  const index = new Map<string, number[]>();
  const sizes: number[] = [];
  const add = (tokens: Set<string>) => {
    const id = sizes.push(tokens.size) - 1;
    for (const token of tokens) {
      const matches = index.get(token);
      if (matches) matches.push(id);
      else index.set(token, [id]);
    }
  };
  for (const paragraph of accepted.split(/\n\s*\n/)) if (words(paragraph).length >= 28) add(shingles(paragraph));
  const issues: ProseIssue[] = [];
  for (const paragraph of candidate.split(/\n\s*\n/).filter(p => words(p).length >= 28)) {
    const tokens = shingles(paragraph);
    const counts = new Map<number, number>();
    for (const token of tokens) for (const id of index.get(token) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    if ([...counts].some(([id, common]) => common / Math.max(1, Math.min(tokens.size, sizes[id]!)) > .86)) {
      issues.push({ kind: 'repeated_passage', message: 'This passage closely repeats an earlier passage; the proposed text remains recoverable.', passage: paragraph });
    }
    add(tokens);
  }
  return issues;
}
