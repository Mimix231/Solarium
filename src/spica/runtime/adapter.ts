import type { SpicaTypedPort } from '../graph-v2/types';

/** Runtime adapters are different from the 26 schema-1 source-generating adapters.
 * A catalogue entry or legacy source adapter is never assumed to be a runnable V2 node.
 */
export type SpicaRuntimeTarget = 'desktop' | 'web';
export type SpicaRuntimePermission = 'records.write' | 'records.read' | 'network.fetch' | 'filesystem.read' | 'filesystem.write' | 'process.run';
export type SpicaRuntimeKind = 'pure' | 'effect' | 'renderer' | 'event-source';

/** Transactional host bridge: no filesystem/network APIs are directly exposed to blocks. */
export interface SpicaStorageTransaction {
  read(collection: string, key: string): Promise<unknown>;
  put(collection: string, key: string, value: unknown): Promise<void>;
  /** Optional host extension; list and delete never bypass transaction permissions. */
  list?(collection: string, limit: number): Promise<Array<{key:string;value:unknown}>>;
  delete?(collection: string, key: string): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
export interface SpicaRuntimeStore {
  begin(): Promise<SpicaStorageTransaction>;
}
export interface SpicaRuntimeBlockContext {
  readonly runId: string;
  readonly nodeId: string;
  readonly target: SpicaRuntimeTarget;
  readonly signal: AbortSignal;
  readonly storage: Pick<SpicaStorageTransaction, 'read' | 'put' | 'list' | 'delete'>;
  requirePermission(permission: SpicaRuntimePermission): void;
  /** Run-scoped interaction events and transactional session-only text state.
   * Neither store writes nor external effects are authorized by this API. */
  readonly interaction: {
    read(key: string): string | undefined;
    write(key: string, value: string): void;
    event(id: string): string | undefined;
  };
}
export interface SpicaBlockAdapter {
  readonly id: string;
  readonly version: string;
  readonly kind: SpicaRuntimeKind;
  readonly trust: 'built-in';
  readonly targets: readonly SpicaRuntimeTarget[];
  readonly permissions: readonly SpicaRuntimePermission[];
  /** Searchable human-readable purpose and non-executable example configuration. */
  readonly category?: string;
  readonly description?: string;
  readonly exampleConfig?: Readonly<Record<string, unknown>>;
  /** Inspectable config contract. Runtime validateConfig remains authoritative. */
  readonly configSchema?: Readonly<{type:'object';properties:Readonly<Record<string,unknown>>;required?:readonly string[];additionalProperties:false}>;
  readonly inputs: readonly SpicaTypedPort[];
  readonly outputs: readonly SpicaTypedPort[];
  /** These functions must not execute arbitrary generated code or install dependencies. */
  validateConfig(config: Readonly<Record<string, unknown>>): void;
  execute(context: SpicaRuntimeBlockContext, inputs: Readonly<Record<string, unknown>>,
    config: Readonly<Record<string, unknown>>): Promise<Record<string, unknown>> | Record<string, unknown>;
  cleanup?(context: SpicaRuntimeBlockContext): Promise<void> | void;
}

export function defineRuntimeBlock<T extends SpicaBlockAdapter>(adapter: T): T {
  if (!/^spica\.runtime\.[a-z][a-z0-9_]*$/.test(adapter.id) || adapter.version !== '1' || adapter.trust !== 'built-in' ||
      !['pure','effect','renderer','event-source'].includes(adapter.kind) ||
      !adapter.targets.length || new Set(adapter.targets).size !== adapter.targets.length ||
      adapter.permissions.length !== new Set(adapter.permissions).size) throw Error(`Invalid executable runtime adapter: ${adapter.id}`);
  for (const ports of [adapter.inputs, adapter.outputs]) {
    if (ports.length > 64 || ports.some(p => !/^[a-z][a-z0-9_]*$/.test(p.id)) || new Set(ports.map(p => p.id)).size !== ports.length) {
      throw Error(`Invalid runtime ports: ${adapter.id}`);
    }
  }
  if(adapter.configSchema) {
    if(adapter.configSchema.type!=='object'||adapter.configSchema.additionalProperties!==false ||
      !adapter.configSchema.properties || (adapter.configSchema.required??[]).some(k=>!Object.hasOwn(adapter.configSchema!.properties,k)))
      throw Error(`Invalid inspectable config schema: ${adapter.id}`);
  }
  if (adapter.kind === 'pure' && adapter.permissions.length) throw Error('Pure blocks must have no effects or permission grants.');
  return Object.freeze(adapter);
}
