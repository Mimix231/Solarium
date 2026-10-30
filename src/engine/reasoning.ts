export interface TextSegment { kind: 'answer' | 'reasoning'; text: string }
/** Streaming <think> tag splitter; split delimiters remain buffered until disambiguated. */
export class ReasoningSplitter {
  private inThought = false;
  private pending = '';
  get isReasoning(): boolean { return this.inThought; }
  push(chunk: string): TextSegment[] {
    this.pending += chunk;
    const out: TextSegment[] = [];
    while (this.pending) {
      const marker = this.inThought ? '</think>' : '<think>';
      const at = this.pending.indexOf(marker);
      if (at >= 0) {
        if (at) out.push({ kind: this.inThought ? 'reasoning' : 'answer', text: this.pending.slice(0, at) });
        this.pending = this.pending.slice(at + marker.length);
        this.inThought = !this.inThought;
      } else {
        let hold = 0;
        for (let i = 1; i < marker.length; i++) if (this.pending.endsWith(marker.slice(0, i))) hold = i;
        const text = this.pending.slice(0, this.pending.length - hold);
        if (text) out.push({ kind: this.inThought ? 'reasoning' : 'answer', text });
        this.pending = this.pending.slice(this.pending.length - hold);
        break;
      }
    }
    return out;
  }
  finish(): TextSegment[] {
    if (!this.pending) return [];
    const result: TextSegment = { kind: this.inThought ? 'reasoning' : 'answer', text: this.pending };
    this.pending = '';
    return [result];
  }
}
