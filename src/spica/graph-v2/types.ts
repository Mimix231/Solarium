/** SPICA Graph V2 is an authoring graph. Execution and target lowering are separate phases. */
export type SpicaPortKind = 'data' | 'event' | 'reference';
export type SpicaValueType =
  | { kind: 'string' | 'number' | 'boolean' | 'null' | 'unknown' | 'void' | 'ui' }
  | { kind: 'record'; fields: Record<string, SpicaValueType>; open?: boolean }
  | { kind: 'array'; element: SpicaValueType }
  | { kind: 'event'; payload: SpicaValueType }
  | { kind: 'async'; result: SpicaValueType }
  | { kind: 'reference'; collection: string }
  | { kind: 'capability'; permission: string }
  | { kind: 'union'; options: SpicaValueType[] };

export interface SpicaTypedPort {
  id: string;
  type: SpicaValueType;
  /** Inputs default to single connection, outputs to unlimited connections. */
  maxConnections?: number;
  required?: boolean;
}
export interface SpicaBlockLock {
  id: string;
  version: string;
  /** A registered lock may be compiled in future phases; placeholders never execute. */
  availability: 'registered' | 'placeholder';
}
export interface SpicaGraphNode {
  id: string;
  block: SpicaBlockLock;
  scope: string;
  inputs: SpicaTypedPort[];
  outputs: SpicaTypedPort[];
  config: Record<string, unknown>;
  metadata?: { label?: string; x?: number; y?: number; readonly?: boolean };
}
export interface SpicaGraphEdge {
  id: string;
  kind: SpicaPortKind;
  from: { node: string; port: string };
  to: { node: string; port: string };
  /** Only explicitly bounded event feedback is allowed to form a cycle. */
  feedback?: { maxIterations: number };
}
export interface SpicaGraphScope { id: string; parent: string | null; label: string }
export interface SpicaGraphV2 {
  schema: 2;
  id: string;
  name: string;
  scopes: SpicaGraphScope[];
  nodes: SpicaGraphNode[];
  edges: SpicaGraphEdge[];
  /** SHA-256 of the original serialized v1 graph. Original v1 data is never overwritten. */
  migration?: { sourceSchema: 1; sourceHash: string; strategy: 'readonly-snapshot'; migratedAt: string };
}
export interface SpicaGraphDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  path: string;
  message: string;
}
export interface SpicaGraphValidation {
  valid: boolean;
  errors: SpicaGraphDiagnostic[];
  warnings: SpicaGraphDiagnostic[];
}
export type SpicaGraphV2Edit =
  | { op: 'rename'; name: string }
  | { op: 'add_scope'; scope: SpicaGraphScope }
  | { op: 'remove_scope'; id: string }
  | { op: 'add_node'; node: SpicaGraphNode }
  | { op: 'remove_node'; id: string }
  | { op: 'set_node_config'; id: string; config: Record<string, unknown> }
  | { op: 'move_node'; id: string; x: number; y: number }
  | { op: 'connect'; edge: SpicaGraphEdge }
  | { op: 'disconnect'; id: string };

export function emptySpicaGraphV2(id: string, name: string): SpicaGraphV2 {
  return { schema: 2, id, name, scopes: [{ id: 'root', parent: null, label: 'Application' }], nodes: [], edges: [] };
}
