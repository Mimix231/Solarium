import { uid } from '../domain/types';
import { foundationStore, newRecord } from '../foundation/store';
import type { LibraryScope, RecordStore, StoredRecord } from '../foundation/types';
import { changeGraph, starterGraph, validateGraph, type Graph, type GraphEdit, type Recipe } from './graph';

export interface SpicaProject {
  appId: string;
  revision: number;
  graph: Graph;
  undo: Graph[];
  redo: Graph[];
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
    while (new TextEncoder().encode(JSON.stringify(data)).length > 2_000_000) {
      (data.undo.length ? data.undo : data.redo).shift();
    }
    validateSpicaProject(data);
    const record = { ...current, title: data.graph.name, version: current.version + 1, updatedAt: new Date().toISOString(), data };
    await this.store.batch([{ record, expected: current.version }]);
    notifySpicaChange(this.scope.id);
    return record;
  }
}
