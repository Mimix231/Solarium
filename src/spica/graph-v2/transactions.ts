import { assertSpicaGraphV2 } from './validation';
import { spicaCanonicalJson } from './serialization';
import type { SpicaGraphV2, SpicaGraphV2Edit } from './types';

export class SpicaGraphV2EditError extends Error { name = 'SpicaGraphV2EditError'; }

/** Apply an atomic batch to a copy. Invalid operations never mutate the original. */
export function applySpicaGraphTransaction(graph: SpicaGraphV2, edits: readonly SpicaGraphV2Edit[], options: {
  resolveBlock?: (id: string, version: string) => boolean;
} = {}): SpicaGraphV2 {
  assertSpicaGraphV2(graph, options);
  if (!Array.isArray(edits) || !edits.length || edits.length > 24) throw new SpicaGraphV2EditError('Provide 1–24 typed graph edits.');
  const next = structuredClone(graph);
  const checkId = (value: unknown): string => {
    if (typeof value !== 'string' || !/^[a-z][a-z0-9_.:-]{0,119}$/.test(value)) throw new SpicaGraphV2EditError('Invalid graph ID.');
    return value;
  };
  for (const edit of edits) {
    if (!edit || typeof edit !== 'object') throw new SpicaGraphV2EditError('Invalid edit entry.');
    switch (edit.op) {
      case 'rename':
        if (typeof edit.name !== 'string' || !edit.name.trim() || edit.name.length > 120) throw new SpicaGraphV2EditError('Invalid graph name.');
        next.name = edit.name; break;
      case 'add_scope':
        if (next.scopes.some(scope => scope.id === edit.scope?.id)) throw new SpicaGraphV2EditError('Scope already exists.');
        next.scopes.push(structuredClone(edit.scope)); break;
      case 'remove_scope':
        if (edit.id === 'root' || next.nodes.some(node => node.scope === edit.id) || next.scopes.some(scope => scope.parent === edit.id)) {
          throw new SpicaGraphV2EditError('Scope is in use or is the root scope.');
        }
        if (!next.scopes.some(scope => scope.id === edit.id)) throw new SpicaGraphV2EditError('Unknown scope.');
        next.scopes = next.scopes.filter(scope => scope.id !== edit.id); break;
      case 'add_node':
        if (next.nodes.some(node => node.id === edit.node?.id)) throw new SpicaGraphV2EditError('Node already exists.');
        next.nodes.push(structuredClone(edit.node)); break;
      case 'remove_node': {
        const node = next.nodes.find(node => node.id === edit.id);
        if (!node) throw new SpicaGraphV2EditError('Unknown node.');
        if (node.metadata?.readonly) throw new SpicaGraphV2EditError('Legacy projection nodes are read-only.');
        next.nodes = next.nodes.filter(node => node.id !== edit.id);
        next.edges = next.edges.filter(edge => edge.from.node !== edit.id && edge.to.node !== edit.id);
        break;
      }
      case 'set_node_config': {
        const node = next.nodes.find(node => node.id === edit.id);
        if (!node || node.metadata?.readonly) throw new SpicaGraphV2EditError('Unknown or read-only node.');
        node.config = structuredClone(edit.config); break;
      }
      case 'move_node': {
        const node = next.nodes.find(node => node.id === edit.id);
        if (!node || node.metadata?.readonly) throw new SpicaGraphV2EditError('Unknown or read-only node.');
        if (!Number.isFinite(edit.x) || !Number.isFinite(edit.y)) throw new SpicaGraphV2EditError('Position must be finite.');
        node.metadata = { ...node.metadata, x: edit.x, y: edit.y }; break;
      }
      case 'connect':
        if (next.edges.some(edge => edge.id === edit.edge?.id)) throw new SpicaGraphV2EditError('Edge already exists.');
        if (next.nodes.some(node => node.metadata?.readonly && [edit.edge?.from?.node, edit.edge?.to?.node].includes(node.id))) {
          throw new SpicaGraphV2EditError('Cannot rewire a read-only legacy projection.');
        }
        next.edges.push(structuredClone(edit.edge)); break;
      case 'disconnect':
        checkId(edit.id);
        if (!next.edges.some(edge => edge.id === edit.id)) throw new SpicaGraphV2EditError('Unknown edge.');
        if (next.edges.some(edge => edge.id === edit.id && next.nodes.some(node => node.metadata?.readonly && (node.id === edge.from.node || node.id === edge.to.node)))) {
          throw new SpicaGraphV2EditError('Cannot disconnect a read-only legacy projection.');
        }
        next.edges = next.edges.filter(edge => edge.id !== edit.id); break;
      default: throw new SpicaGraphV2EditError('Unsupported graph operation.');
    }
  }
  try { assertSpicaGraphV2(next, options); }
  catch (error) { throw new SpicaGraphV2EditError(error instanceof Error ? error.message : String(error)); }
  if (spicaCanonicalJson(next) === spicaCanonicalJson(graph)) throw new SpicaGraphV2EditError('Graph already contains these values.');
  return next;
}
