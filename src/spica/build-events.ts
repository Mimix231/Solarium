/**
 * Evidence-only UI protocol for Spica's existing exporter and native verifier.
 * A notice is emitted at the real operation boundary, never inferred from Spark prose.
 * The bounded journal is session-local; persisted verification and command pages remain
 * the authoritative source for completed runs and complete native output.
 */
export type SpicaBuildStage =
  | 'discover' | 'register' | 'compose' | 'validate' | 'generate'
  | 'prepare' | 'compile' | 'web-assets' | 'native-test' | 'desktop-build'
  | 'scenario-test' | 'preview' | 'launch';
export type SpicaBuildStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped';
export type SpicaBuildSeverity = 'debug' | 'info' | 'warning' | 'error';
export interface SpicaBuildNotice {
  stage: SpicaBuildStage;
  status: SpicaBuildStatus;
  message: string;
  severity?: SpicaBuildSeverity;
  blockId?: string;
  filePath?: string;
  commandRunId?: string;
  evidenceRef?: string;
}
export interface SpicaBuildEvent extends SpicaBuildNotice {
  eventId: string;
  runId: string;
  graphRevision: number;
  timestamp: number;
  severity: SpicaBuildSeverity;
}
export type SpicaBuildEventSink = (notice: SpicaBuildNotice) => void;
export const SPICA_EVENT_LIMIT = 240;
export const SPICA_OUTPUT_LIMIT = 96_000;

export const stageForCommand = (commandId: string): SpicaBuildStage => {
  if (commandId === 'script:build:desktop') return 'desktop-build';
  if (commandId === 'script:test:native') return 'native-test';
  if (commandId === 'script:build' || commandId === 'script:build:web') return 'compile';
  if (commandId === 'script:test:web') return 'web-assets';
  if (commandId.startsWith('install:') || commandId === 'script:setup:native') return 'prepare';
  return 'validate';
};

export function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted || (error instanceof Error &&
    (error.name === 'AbortError' || error.message.toLowerCase().includes('cancelled'))));
}

/** Append-only, capped UI history. Stable per-run IDs make React row identity reliable. */
export class SpicaBuildJournal {
  readonly runId: string;
  readonly revision: number;
  private sequence = 0;
  private history: SpicaBuildEvent[] = [];
  private readonly subscribers = new Set<(events: readonly SpicaBuildEvent[]) => void>();

  constructor(runId: string, revision: number) {
    if (!runId.trim() || !Number.isSafeInteger(revision) || revision < 0) throw Error('Invalid SPICA build run identity.');
    this.runId = runId;
    this.revision = revision;
  }
  get events(): readonly SpicaBuildEvent[] { return this.history; }
  subscribe(listener: (events: readonly SpicaBuildEvent[]) => void): () => void {
    this.subscribers.add(listener);
    listener(this.history);
    return () => this.subscribers.delete(listener);
  }
  record: SpicaBuildEventSink = notice => {
    const event: SpicaBuildEvent = {
      ...notice, eventId: `${this.runId}:${++this.sequence}`,
      runId: this.runId, graphRevision: this.revision, timestamp: Date.now(),
      severity: notice.severity ?? (notice.status === 'failed' ? 'error' : notice.status === 'cancelled' ? 'warning' : 'info'),
    };
    this.history = [...this.history.slice(-(SPICA_EVENT_LIMIT - 1)), event];
    for (const notify of this.subscribers) notify(this.history);
  };
  clear(): void { this.history = []; for (const notify of this.subscribers) notify(this.history); }
}

/** Last *actual* recorded state, never an extrapolated progress percentage. */
export function stageStatus(events: readonly SpicaBuildEvent[], stage: SpicaBuildStage): SpicaBuildStatus {
  for (let index = events.length - 1; index >= 0; index--) {
    if (events[index]?.stage === stage) return events[index]!.status;
  }
  return 'queued';
}

/** Avoid leaking ANSI control characters and unbounded output into the DOM. */
export function terminalText(current: string, chunk: string): string {
  // Strip CSI/OSC/other escape sequences, including clipboard OSC 52 payloads.
  const clean = chunk.replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\u001b[@-_]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return (current + clean).slice(-SPICA_OUTPUT_LIMIT);
}
