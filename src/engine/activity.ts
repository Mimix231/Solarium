import { now, uid, type ActivityEvent, type ActivityPhase } from '../domain/types';
export class AgentEventEmitter {
  private sequence = 0;
  readonly runId = uid();
  constructor(private readonly sink: (event: ActivityEvent) => void, private readonly sessionId?: string) {}
  emit(kind: ActivityEvent['kind'], text?: string, options: Partial<ActivityEvent> = {}): void {
    this.sink({ id: uid(), runId: this.runId, sequence: ++this.sequence, at: now(), kind, text, ...(this.sessionId ? { sessionId: this.sessionId } : {}), ...options });
  }
  operation(action: import('../domain/types').WorkAction, status: 'started' | 'completed' | 'failed' | 'denied', subject: string, text?: string): void {
    this.emit('operation', text, { action, subject, status });
  }
  phase(phase: ActivityPhase, status: 'started' | 'completed' | 'failed', text?: string): void {
    this.emit('phase', text, { phase, status });
  }
}
