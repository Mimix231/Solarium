/** Incremental application metadata on the same native answer stream. */
export class MetadataStream<T> {
  private pending = ''; private body = ''; private inside = false; private ended = false; private found = false;
  constructor(private name: string, private output: (delta: string) => void) {}
  get raw(): string { return this.body; }
  push(delta: string): void {
    if (this.ended) { this.output(delta); return; }
    const open = `<${this.name}>`, close = `</${this.name}>`;
    if (this.inside) this.body += delta;
    else {
      this.pending += delta; const at = this.pending.indexOf(open);
      if (at < 0) {
        let held = 0; for (let n = 1; n < open.length; n++) if (this.pending.endsWith(open.slice(0, n))) held = n;
        this.output(this.pending.slice(0, this.pending.length - held)); this.pending = this.pending.slice(this.pending.length - held); return;
      }
      this.output(this.pending.slice(0, at)); this.body = this.pending.slice(at + open.length); this.pending = ''; this.inside = true; this.found = true;
    }
    const end = this.body.indexOf(close);
    if (end >= 0) { const tail = this.body.slice(end + close.length); this.body = this.body.slice(0, end); this.ended = true; this.inside = false; if (tail) this.output(tail); }
  }
  finish(atCapacity = false): T | null {
    if (this.pending && !atCapacity) this.output(this.pending);
    this.pending = '';
    if (!this.found) return null;
    if (!this.ended && atCapacity) return null;
    if (!this.ended) throw Error(`${this.name} metadata was incomplete. The prose remains recoverable.`);
    return JSON.parse(this.body.trim()) as T;
  }
}
