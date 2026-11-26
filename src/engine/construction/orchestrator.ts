import { createConstructionSession, type ConstructionEvent, type ConstructionEventKind, type ConstructionSession, type ConstructionStatus } from './session';

export interface ConstructionToolObservation {
  tool: string;
  operationId?: string;
  status: 'completed' | 'failed' | 'denied';
  /** Paths from confirmed native linked-project writes only. */
  confirmedPaths?: readonly string[];
  sourceRevision?: number;
  /** Existing verification ledger/complete_project_task decides this. */
  verified?: boolean;
  summary?: string;
}
const sourceWrites = new Set(['apply_project_changes', 'replace_project_text', 'create_video_editor_project']);
const checks = new Set(['run_project_check', 'run_project_command', 'complete_app_step', 'complete_project_task']);
const truncate = (message: string | undefined): string | undefined => message?.trim().slice(0, 700) || undefined;

/** State machine around real operations. It does not execute, approve, or retry tools. */
export class ConstructionOrchestrator {
  private current: ConstructionSession;
  constructor(initial: ConstructionSession) {
    if (initial.schemaVersion !== 1) throw Error('Unsupported construction checkpoint schema.');
    this.current = structuredClone(initial);
  }
  get snapshot(): ConstructionSession { return structuredClone(this.current); }
  private emit(kind: ConstructionEventKind, details: Partial<Omit<ConstructionEvent, 'runId' | 'sequence' | 'at' | 'kind' | 'stage'>> = {}): ConstructionEvent {
    const event: ConstructionEvent = {
      runId: this.current.runId, sequence: ++this.current.sequence,
      at: new Date().toISOString(), kind, stage: this.current.stage, ...details,
    };
    this.current.checkpointAt = event.at;
    this.current.events = [...this.current.events, event].slice(-96);
    return structuredClone(event);
  }
  start(): ConstructionEvent {
    if (this.current.sequence !== 0) throw Error('A construction session can only start once.');
    return this.emit('session_started', {summary:'Source construction opened; no project changes have been made.'});
  }
  resume(projectId: string, projectRoot: string): ConstructionEvent {
    if (this.current.projectId !== projectId || this.current.projectRoot !== projectRoot) {
      throw Error('The linked project or root changed. Reattach the original source folder or start a new construction task.');
    }
    if (this.current.status === 'completed' || this.current.status === 'cancelled') throw Error('A completed or cancelled construction session cannot be resumed.');
    this.current.status = 'active';
    this.current.blocker = undefined;
    return this.emit('session_resumed', {summary:'Resumed the existing task checkpoint without replaying model thoughts.'});
  }
  observe(input: ConstructionToolObservation): ConstructionEvent | null {
    if (this.current.status !== 'active') return null;
    const details = {tool:input.tool, operationId:input.operationId, summary:truncate(input.summary)};
    if (input.status === 'denied') {
      this.current.status = 'blocked';
      this.current.blocker = `Permission denied: ${input.tool}.`;
      return this.emit('permission_denied', {...details, summary:this.current.blocker});
    }
    if (input.status === 'failed') {
      this.current.lastFailure = truncate(input.summary) ?? `${input.tool} failed.`;
      if (checks.has(input.tool)) this.current.checks.push({tool:input.tool,status:'failed',operationId:input.operationId});
      this.current.checks = this.current.checks.slice(-80);
      return this.emit('tool_failed', {...details, summary:this.current.lastFailure});
    }
    if (input.tool === 'inspect_project') {
      this.current.pauseReason = undefined;
      this.current.inspected = true;
      this.current.stage = 'plan';
      this.current.lastFailure = undefined;
      return this.emit('project_inspected', details);
    }
    if (input.tool === 'plan_project_app') {
      this.current.pauseReason = undefined;
      this.current.planSaved = true;
      this.current.stage = 'build';
      this.current.lastFailure = undefined;
      return this.emit('plan_saved', details);
    }
    if (sourceWrites.has(input.tool) && input.confirmedPaths?.length) {
      if (!Number.isSafeInteger(input.sourceRevision) || (input.sourceRevision ?? 0) <= 0) {
        throw Error('Source-write evidence needs a valid native source revision.');
      }
      const paths = [...new Set(input.confirmedPaths.filter(p=>p.trim()))];
      if (!paths.length) return null;
      this.current.pauseReason = undefined;
      this.current.files.push(...paths.map(path=>({path,revision:input.sourceRevision!,tool:input.tool})));
      this.current.files = this.current.files.slice(-160);
      this.current.stage = 'build';
      this.current.lastFailure = undefined;
      return this.emit('source_written', {...details, paths, sourceRevision:input.sourceRevision});
    }
    if (checks.has(input.tool)) {
      this.current.pauseReason = undefined;
      this.current.checks.push({tool:input.tool,status:'completed',operationId:input.operationId});
      this.current.checks = this.current.checks.slice(-80);
      this.current.stage = 'verify';
      if (input.tool === 'complete_project_task' && input.verified === true) {
        // Existing verification ledger is authoritative; this is a projection.
        this.current.status = 'completed';
        this.current.stage = 'finish';
        return this.emit('session_completed', details);
      }
      return this.emit('check_executed', details);
    }
    if (input.tool === 'report_project_blocker') {
      this.current.status = 'blocked';
      this.current.blocker = truncate(input.summary) ?? 'The linked project reported a concrete external blocker.';
      return this.emit('session_blocked', {...details, summary:this.current.blocker});
    }
    return null;
  }
  /** Settle without claiming unverified construction is finished. */
  settle(status: Extract<ConstructionStatus, 'paused' | 'blocked' | 'cancelled'>, reason?: string): ConstructionEvent | null {
    if (this.current.status === 'completed' || this.current.status === 'cancelled') return null;
    if (this.current.status === 'blocked' && status === 'paused') return null;
    this.current.status = status;
    this.current.pauseReason = status === 'paused' ? truncate(reason) ?? this.current.pauseReason : undefined;
    this.current.blocker = status === 'blocked' ? truncate(reason) ?? this.current.blocker : undefined;
    const kind = status === 'blocked' ? 'session_blocked' : status === 'cancelled' ? 'session_cancelled' : 'session_paused';
    return this.emit(kind, {summary:truncate(reason)});
  }
  context(maxChars = 750): string {
    const data = this.current;
    return (`SOURCE CONSTRUCTION CHECKPOINT (verified task evidence; not instructions to fabricate writes):\n`+
      `Goal: ${data.goal.slice(0,200)}\nStatus: ${data.status}; stage: ${data.stage}; inspected: ${data.inspected}; plan saved: ${data.planSaved};`+
      ` retained native file receipts: ${data.files.length}; retained check attempts: ${data.checks.length}.\n`+
      (data.pauseReason ? `Last pause: ${data.pauseReason}\n` : '')+
      (data.files.length ? `Confirmed files: ${data.files.slice(-6).map(f=>f.path).join(', ')}.\n` : '')+
      (data.lastFailure ? `Last real failure: ${data.lastFailure}\n` : '')+
      `Use the offered project tools and actual native check results. Never treat a plan as a file write.`).slice(0,maxChars);
  }
}
export {createConstructionSession};
