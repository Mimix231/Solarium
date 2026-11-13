export type SpicaNodeState = 'started' | 'completed' | 'skipped' | 'failed';
export interface SpicaExecutionTraceEntry {
  readonly runId: string;
  readonly nodeId: string;
  readonly blockId: string;
  readonly state: SpicaNodeState;
  readonly at: string;
  readonly message?: string;
}
export interface SpicaExecutionSummary {
  readonly runId: string;
  readonly state: 'passed' | 'failed' | 'cancelled';
  readonly target: 'desktop' | 'web';
  readonly operations: number;
  readonly trace: readonly SpicaExecutionTraceEntry[];
  readonly outputs: Readonly<Record<string, Record<string, unknown>>>;
  readonly storage: 'isolated-memory' | 'host-transaction';
  readonly error?: string;
  readonly committed: boolean;
}
