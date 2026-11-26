/** Phase 01 construction records contain evidence, never model reasoning or
 * fabricated file states. The existing TaskExecution record is their owner. */
export type ConstructionStatus = 'active' | 'paused' | 'blocked' | 'completed' | 'cancelled';
export type ConstructionStage = 'inspect' | 'plan' | 'build' | 'verify' | 'finish';
export type ConstructionEventKind = 'session_started' | 'session_resumed' | 'project_inspected' | 'plan_saved' |
  'source_written' | 'check_executed' | 'tool_failed' | 'permission_denied' |
  'session_paused' | 'session_blocked' | 'session_cancelled' | 'session_completed';
export interface ConstructionEvent {
  runId: string;
  sequence: number;
  at: string;
  kind: ConstructionEventKind;
  stage: ConstructionStage;
  tool?: string;
  operationId?: string;
  paths?: string[];
  sourceRevision?: number;
  summary?: string;
}
export interface ConstructionSession {
  schemaVersion: 1;
  runId: string;
  taskId: string;
  sessionId: string;
  projectId: string;
  /** Binds a resumed task to the same authorized linked root. */
  projectRoot: string;
  goal: string;
  status: ConstructionStatus;
  stage: ConstructionStage;
  startedAt: string;
  checkpointAt: string;
  sequence: number;
  inspected: boolean;
  planSaved: boolean;
  /** Only actual native source-write callbacks may populate this array. */
  files: {path: string; revision: number; tool: string}[];
  /** Check executions are evidence of a check, not automatically a pass. */
  checks: {tool: string; status: 'completed' | 'failed'; operationId?: string}[];
  events: ConstructionEvent[];
  lastFailure?: string;
  /** Latest natural pause cause; retained for Resume even when no tool failed. */
  pauseReason?: string;
  blocker?: string;
}
export function createConstructionSession(input: {
  taskId: string; sessionId: string; projectId: string; projectRoot: string; goal: string;
}): ConstructionSession {
  if (!input.taskId || !input.sessionId || !input.projectId || !input.projectRoot.trim() || !input.goal.trim()) {
    throw Error('Construction requires a persisted task, project, linked root and goal.');
  }
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, runId: input.taskId, taskId: input.taskId,
    sessionId: input.sessionId, projectId: input.projectId, projectRoot: input.projectRoot,
    goal: input.goal, status: 'active', stage: 'inspect', startedAt: now,
    checkpointAt: now, sequence: 0, inspected: false, planSaved: false,
    files: [], checks: [], events: [],
  };
}
