import { uid } from '../domain/types';
import { foundationStore, newRecord } from '../foundation/store';
import type { LibraryScope, RecordStore, StoredRecord } from '../foundation/types';
import { changeGraph, starterGraph, validateGraph, type Graph, type GraphEdit, type Recipe } from './graph';
import { assertSpicaGraphV2 } from './graph-v2/validation';
import { applySpicaGraphTransaction } from './graph-v2/transactions';
import { assertSpicaRuntimeNodeContracts } from './graph-v2/edit-adapter';
import { migrateLegacyGraph, legacyOriginMatches } from './graph-v2/migration';
import type { SpicaGraphV2, SpicaGraphV2Edit } from './graph-v2/types';
import { getBlock } from './runtime/blocks/registry';
import { getRuntimeBlock } from './runtime/registry';

export interface SpicaProject {
  appId: string;
  revision: number;
  graph: Graph;
  undo: Graph[];
  redo: Graph[];
  /** Additive v2 document; schema-1 graph remains the canonical standalone export. */
  graphV2?: SpicaGraphV2;
  v2Undo?: SpicaGraphV2[];
  v2Redo?: SpicaGraphV2[];
}
export type SpicaRecord = StoredRecord<SpicaProject>;

const changes = new EventTarget();
export function notifySpicaChange(projectId: string) {
  changes.dispatchEvent(new Event(projectId));
}
export function onSpicaChange(projectId: string, listener: () => void) {
  changes.addEventListener(projectId, listener);
  return () => changes.removeEventListener(projectId, listener);
}

export function validateSpicaProject(value: unknown): asserts value is SpicaProject {
  const data = value as SpicaProject;
  if (!data || typeof data.appId !== 'string' || !/^[a-z0-9]{12,48}$/.test(data.appId) ||
      !Number.isSafeInteger(data.revision) || data.revision < 1 ||
      !Array.isArray(data.undo) || data.undo.length > 20 || !Array.isArray(data.redo) || data.redo.length > 20) {
    throw Error('Invalid SPICA project or revision history.');
  }
  [data.graph, ...data.undo, ...data.redo].forEach(validateGraph);
  if (data.graphV2 !== undefined) {
    assertSpicaGraphV2(data.graphV2, { resolveBlock: (id, version) => Boolean(getBlock(id, version) || getRuntimeBlock(id, version)) });
    if (!Array.isArray(data.v2Undo) || !Array.isArray(data.v2Redo) || data.v2Undo.length > 20 || data.v2Redo.length > 20) {
      throw Error('Invalid V2 revision history.');
    }
    [...data.v2Undo, ...data.v2Redo].forEach(graph => assertSpicaGraphV2(graph, { resolveBlock: (id, version) => Boolean(getBlock(id, version) || getRuntimeBlock(id, version)) }));
  } else if (data.v2Undo?.length || data.v2Redo?.length) {
    throw Error('V2 history exists without a graph.');
  }
}

export class SpicaRepository {
  private readonly scope: LibraryScope;
  private readonly id: string;
  constructor(projectId: string, private readonly store: RecordStore = foundationStore) {
    if (!projectId) throw Error('Select a Solarium project first.');
    this.scope = { kind: 'project', id: projectId };
    this.id = 'spica:' + projectId;
  }

  async read(): Promise<SpicaRecord | null> {
    const record = (await this.store.list<SpicaProject>({ collection: 'spica_project', scopes: [this.scope] }))
      .find(record => record.id === this.id);
    if (record) validateSpicaProject(record.data);
    return record ?? null;
  }

  async create(name: string, recipe: Recipe): Promise<SpicaRecord> {
    const graph = starterGraph(name, recipe);
    const record = newRecord('spica_project', this.id, this.scope, graph.name, {
      appId: uid().replaceAll('-', ''), revision: 1, graph, undo: [], redo: [],
    });
    validateSpicaProject(record.data);
    await this.store.batch([{ record, expected: null }]);
    notifySpicaChange(this.scope.id);
    return record;
  }

  async update(expectedRevision: number, operation: readonly GraphEdit[] | 'undo' | 'redo'): Promise<SpicaRecord> {
    const current = await this.read();
    if (!current || current.data.revision !== expectedRevision) throw Error('Graph revision changed. Read the current graph before editing.');
    const data = structuredClone(current.data);
    if (operation === 'undo' || operation === 'redo') {
      const graph = data[operation].pop();
      if (!graph) throw Error('There is no graph change to ' + operation);
      data[operation === 'undo' ? 'redo' : 'undo'].push(data.graph);
      data.graph = graph;
    } else {
      const graph = changeGraph(data.graph, operation);
      data.undo = [...data.undo.slice(-19), data.graph];
      data.redo = [];
      data.graph = graph;
    }
    data.revision++;
    while (new TextEncoder().encode(JSON.stringify(data)).length > (data.graphV2 ? 16_000_000 : 2_000_000)) {
      if (data.undo.length) data.undo.shift();
      else if (data.redo.length) data.redo.shift();
      else throw Error('SPICA project exceeds the supported serialized size.');
    }
    validateSpicaProject(data);
    const record = { ...current, title: data.graph.name, version: current.version + 1, updatedAt: new Date().toISOString(), data };
    await this.store.batch([{ record, expected: current.version }]);
    notifySpicaChange(this.scope.id);
    return record;
  }

  /** Non-destructive: v1 stays unchanged and is still used by existing exporters. */
  async migrateV2(expectedRevision: number): Promise<SpicaRecord> {
    const current = await this.read();
    if (!current || current.data.revision !== expectedRevision) throw Error('STALE_GRAPH: Read the current SPICA revision before migrating.');
    if (current.data.graphV2) throw Error('A V2 graph already exists. Use updateV2 instead.');
    const graphV2 = await migrateLegacyGraph(current.data.graph, `spica.${current.data.appId}`);
    const data = { ...structuredClone(current.data), graphV2, v2Undo: [], v2Redo: [], revision: expectedRevision + 1 };
    return this.saveV2(current, data);
  }

  async updateV2(expectedRevision: number, operation: readonly SpicaGraphV2Edit[] | 'undo' | 'redo' | 'rollback'): Promise<SpicaRecord> {
    const current = await this.read();
    if (!current || current.data.revision !== expectedRevision) throw Error('STALE_GRAPH: Read the current SPICA revision before editing.');
    if (!current.data.graphV2) throw Error('No V2 graph exists. Migrate the schema-1 graph first.');
    if (operation !== 'rollback' && !(await legacyOriginMatches(current.data.graph, current.data.graphV2))) {
      throw Error('STALE_V2_ORIGIN: Schema-1 changed after V2 migration. Roll back the outdated projection before migrating again.');
    }
    const data = structuredClone(current.data);
    const graphV2 = data.graphV2!;
    if (operation === 'rollback') {
      delete data.graphV2; delete data.v2Undo; delete data.v2Redo;
    } else if (operation === 'undo' || operation === 'redo') {
      const from = operation === 'undo' ? data.v2Undo! : data.v2Redo!;
      const to = operation === 'undo' ? data.v2Redo! : data.v2Undo!;
      const graph = from.pop();
      if (!graph) throw Error('No V2 history entry to ' + operation + '.');
      to.push(graphV2);
      data.graphV2 = graph;
    } else {
      const graph = applySpicaGraphTransaction(graphV2, operation, {
        resolveBlock: (id, version) => Boolean(getBlock(id, version) || getRuntimeBlock(id, version)),
      });
      // The same executable-node contract validation runs during dry-run and
      // immediately before durable storage. A direct repository caller must
      // never persist configurations the runtime would inevitably reject.
      assertSpicaRuntimeNodeContracts(graph);
      data.v2Undo = [...data.v2Undo!.slice(-19), graphV2];
      data.v2Redo = [];
      data.graphV2 = graph;
    }
    data.revision = expectedRevision + 1;
    return this.saveV2(current, data);
  }

  /** Atomically persist a registered block composition, including >24 node/edge changes.
   * Legacy schema-1 source and native export remain untouched.
   */
  async composeV2(expectedRevision: number, plan: import('./runtime/composition').SpicaComposition): Promise<SpicaRecord> {
    const current=await this.read();
    if(!current || current.data.revision!==expectedRevision)throw Error('STALE_GRAPH: Read current graph revision before composing.');
    if(!current.data.graphV2)throw Error('MISSING_V2: Migrate this project before composing blocks.');
    if(!(await legacyOriginMatches(current.data.graph,current.data.graphV2)))throw Error('STALE_V2_ORIGIN: Schema-1 graph changed; do not overwrite it.');
    const { previewSpicaComposition }=await import('./runtime/composition');
    const reviewed=previewSpicaComposition(current.data.graphV2,plan);
    // The bulk composer is still a graph-writing API, so it must enforce the
    // same executable-node invariants as the canonical edit_spica_graph tool.
    assertSpicaRuntimeNodeContracts(reviewed.graph);
    const data=structuredClone(current.data);
    data.v2Undo=[...(data.v2Undo??[]).slice(-19),current.data.graphV2];
    data.v2Redo=[];
    data.graphV2=reviewed.graph;
    data.revision=expectedRevision+1;
    return this.saveV2(current,data);
  }

  /** Detect stale projection rather than silently reconciling v1 and v2. */
  async v2OriginIsCurrent(record: SpicaRecord): Promise<boolean> {
    return Boolean(record.data.graphV2 && await legacyOriginMatches(record.data.graph, record.data.graphV2));
  }

  private async saveV2(current: SpicaRecord, data: SpicaProject): Promise<SpicaRecord> {
    const size = () => new TextEncoder().encode(JSON.stringify(data)).length;
    while (size() > 16_000_000) {
      if (data.v2Undo?.length) data.v2Undo.shift();
      else if (data.v2Redo?.length) data.v2Redo.shift();
      else throw Error('V2 project exceeds 16 MB. Split large graphs into subgraphs.');
    }
    validateSpicaProject(data);
    const record: SpicaRecord = { ...current, version: current.version + 1, updatedAt: new Date().toISOString(), data };
    await this.store.batch([{ record, expected: current.version }]);
    notifySpicaChange(this.scope.id);
    return record;
  }

}
