import type { Graph } from '../graph';
import { validateGraph } from '../graph';
import { spicaGraphDigest } from './serialization';
import { assertSpicaGraphV2 } from './validation';
import { emptySpicaGraphV2, type SpicaGraphNode, type SpicaGraphV2 } from './types';

const unknownType = { kind: 'unknown' as const };
const uiType = { kind: 'ui' as const };
/** Safe, non-executable projection of schema 1. The original schema-1 graph remains authoritative for export. */
export async function migrateLegacyGraph(graph: Graph, id: string, at = new Date().toISOString()): Promise<SpicaGraphV2> {
  validateGraph(graph);
  const v2 = emptySpicaGraphV2(id, graph.name);
  const sourceHash = await spicaGraphDigest(graph);
  v2.migration = { sourceSchema: 1, sourceHash, strategy: 'readonly-snapshot', migratedAt: at };
  const node = (id: string, kind: string, label: string, config: Record<string, unknown>, inputs: SpicaGraphNode['inputs'], outputs: SpicaGraphNode['outputs']): SpicaGraphNode => ({
    id, scope: 'root', block: { id: `spica.legacy.${kind}`, version: '1', availability: 'placeholder' },
    config, inputs, outputs, metadata: { label, readonly: true },
  });
  for (const page of [...graph.pages].sort((a, b) => a.id.localeCompare(b.id))) {
    v2.nodes.push(node(`legacy_page_${page.id}`, 'page', page.label, { ...page }, [{ id: 'elements', type: uiType, maxConnections: 4096 }], [{ id: 'view', type: uiType }]));
  }
  for (const setting of [...graph.preferences].sort((a, b) => a.key.localeCompare(b.key))) {
    v2.nodes.push(node(`legacy_setting_${setting.key}`, 'setting', setting.key, { ...setting }, [], [{ id: 'value', type: unknownType }]));
  }
  for (const control of [...graph.controls].sort((a, b) => a.id.localeCompare(b.id))) {
    v2.nodes.push(node(`legacy_control_${control.id}`, 'control', control.label, { ...control }, [{ id: 'value', type: unknownType }], [{ id: 'element', type: uiType }]));
    v2.edges.push({ id: `legacy_bind_${control.id}`, kind: 'data', from: { node: `legacy_setting_${control.preference}`, port: 'value' }, to: { node: `legacy_control_${control.id}`, port: 'value' } });
    v2.edges.push({ id: `legacy_place_${control.id}`, kind: 'data', from: { node: `legacy_control_${control.id}`, port: 'element' }, to: { node: `legacy_page_${control.page}`, port: 'elements' } });
  }
  const collections = [graph.collection, ...(graph.collections ?? [])].filter((value): value is NonNullable<typeof graph.collection> => Boolean(value));
  for (const collection of collections.sort((a, b) => a.id.localeCompare(b.id))) {
    v2.nodes.push(node(`legacy_collection_${collection.id}`, 'collection', collection.label, structuredClone(collection) as unknown as Record<string, unknown>, [], [{ id: 'records', type: { kind: 'array', element: unknownType } }]));
  }
  if (graph.program) {
    v2.nodes.push(node('legacy_program', 'program', 'Legacy application workflow', structuredClone(graph.program) as unknown as Record<string, unknown>, [], []));
  }
  if (graph.appearance) {
    v2.nodes.push(node('legacy_appearance', 'appearance', 'Legacy application appearance', structuredClone(graph.appearance) as unknown as Record<string, unknown>, [], []));
  }
  assertSpicaGraphV2(v2);
  return v2;
}

/** Refuse to treat a changed v1 graph as the same migration origin. */
export async function legacyOriginMatches(graph: Graph, v2: SpicaGraphV2): Promise<boolean> {
  return v2.migration?.sourceSchema === 1 && v2.migration.sourceHash === await spicaGraphDigest(graph);
}
