/** Incremental Server Sent Events reader. Handles CRLF, split UTF-8, multi-line data and [DONE]. */
export class SSEDecoder {
  private remainder = '';
  private data: string[] = [];
  push(text: string): string[] {
    this.remainder += text.replace(/\r\n/g, '\n');
    const out: string[] = [];
    let at: number;
    while ((at = this.remainder.indexOf('\n')) !== -1) {
      const line = this.remainder.slice(0, at).replace(/\r$/, '');
      this.remainder = this.remainder.slice(at + 1);
      if (!line) {
        if (this.data.length) out.push(this.data.join('\n'));
        this.data = [];
      } else if (line.startsWith('data:')) {
        this.data.push(line.slice(5).replace(/^ /, ''));
      }
    }
    return out;
  }
  flush(): string[] {
    // Treat a final incomplete event as one message if a network stream ends abruptly.
    const out = this.push('\n\n');
    this.remainder = '';
    return out;
  }
}
