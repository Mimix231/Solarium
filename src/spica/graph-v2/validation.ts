import type { SpicaGraphDiagnostic, SpicaGraphEdge, SpicaGraphNode, SpicaGraphV2, SpicaGraphValidation, SpicaPortKind, SpicaValueType } from './types';
import { spicaCanonicalJson } from './serialization';

const ID = /^[a-z][a-z0-9_.:-]{0,119}$/;
const RESERVED = new Set(['__proto__', 'prototype', 'constructor']);
const validId = (value: unknown): value is string => typeof value === 'string' && ID.test(value) && !RESERVED.has(value);
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

function wellFormedType(type: SpicaValueType, depth = 0): boolean {
  if (depth > 10 || !plain(type)) return false;
  switch (type.kind) {
    case 'string': case 'number': case 'boolean': case 'null': case 'unknown': case 'void': case 'ui': return Object.keys(type).length === 1;
    case 'array': return wellFormedType(type.element, depth + 1);
    case 'event': return wellFormedType(type.payload, depth + 1);
    case 'async': return wellFormedType(type.result, depth + 1);
    case 'reference': return validId(type.collection);
    case 'capability': return validId(type.permission);
    case 'record': return plain(type.fields) && Object.keys(type.fields).length <= 64 && Object.entries(type.fields).every(([key, child]) => validId(key) && wellFormedType(child, depth + 1)) && (type.open === undefined || typeof type.open === 'boolean');
    case 'union': return Array.isArray(type.options) && type.options.length >= 2 && type.options.length <= 12 && type.options.every(child => wellFormedType(child, depth + 1));
    default: return false;
  }
}

/** Strict structural assignability. No implicit strings/numbers, unwraps, or capability casts. */
export function spicaTypeAssignable(from: SpicaValueType, to: SpicaValueType): boolean {
  if (!wellFormedType(from) || !wellFormedType(to)) return false;
  if (to.kind === 'unknown') return true;
  if (from.kind === 'unknown') return false;
  if (from.kind === 'union') return from.options.every(option => spicaTypeAssignable(option, to));
  if (to.kind === 'union') return to.options.some(option => spicaTypeAssignable(from, option));
  if (from.kind !== to.kind) return false;
  switch (from.kind) {
    case 'array': return to.kind === 'array' && spicaTypeAssignable(from.element, to.element);
    case 'event': return to.kind === 'event' && spicaTypeAssignable(from.payload, to.payload);
    case 'async': return to.kind === 'async' && spicaTypeAssignable(from.result, to.result);
    case 'reference': return to.kind === 'reference' && from.collection === to.collection;
    case 'capability': return to.kind === 'capability' && from.permission === to.permission;
    case 'record': return to.kind === 'record' && Object.entries(to.fields).every(([key, value]) =>
      from.fields[key] !== undefined && spicaTypeAssignable(from.fields[key], value)) &&
      (to.open === true || Object.keys(from.fields).every(key => Object.hasOwn(to.fields, key)));
    default: return true;
  }
}

const edgeType = (kind: SpicaPortKind, type: SpicaValueType): boolean =>
  kind === 'event' ? type.kind === 'event' : kind === 'reference' ? type.kind === 'reference' : type.kind !== 'event' && type.kind !== 'reference';

export function validateSpicaGraphV2(value: unknown, options: {
  requireComplete?: boolean;
  /** Caller supplies the authoritative registry; unrecognized locks are rejected, not invented. */
  resolveBlock?: (id: string, version: string) => boolean;
} = {}): SpicaGraphValidation {
  const errors: SpicaGraphDiagnostic[] = [];
  const warnings: SpicaGraphDiagnostic[] = [];
  const issue = (severity: 'error' | 'warning', code: string, path: string, message: string) =>
    (severity === 'error' ? errors : warnings).push({ severity, code, path, message });
  if (!plain(value) || value.schema !== 2 || !validId(value.id) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 120 ||
      !Array.isArray(value.nodes) || !Array.isArray(value.edges) || !Array.isArray(value.scopes)) {
    issue('error', 'INVALID_ROOT', '$', 'Expected a schema-2 graph with ID, name, scopes, nodes and edges.');
    return { valid: false, errors, warnings };
  }
  // Avoid unbounded JSON traversal, memory usage and graph analysis.
  if (value.nodes.length > 20_000 || value.edges.length > 80_000 || value.scopes.length > 500) {
    issue('error', 'GRAPH_LIMIT', '$', 'Graph exceeds the configured node, edge or scope limit.');
    return { valid: false, errors, warnings };
  }
  try {
    if (new TextEncoder().encode(spicaCanonicalJson(value)).length > 16_000_000) {
      issue('error', 'GRAPH_SIZE', '$', 'Graph exceeds 16 MB of serialized graph data.');
      return { valid: false, errors, warnings };
    }
  } catch (error) {
    issue('error', 'INVALID_JSON', '$', error instanceof Error ? error.message : String(error));
    return { valid: false, errors, warnings };
  }
  if (value.migration !== undefined) {
    const m = value.migration;
    if (!plain(m) || m.sourceSchema !== 1 || m.strategy !== 'readonly-snapshot' || typeof m.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(m.sourceHash) ||
        typeof m.migratedAt !== 'string' || Number.isNaN(Date.parse(m.migratedAt))) {
      issue('error', 'INVALID_MIGRATION', '$.migration', 'Migration must identify a canonical v1 SHA-256 snapshot.');
    }
  }
  const scopes = new Map<string, string | null>();
  for (const [i, scope] of value.scopes.entries()) {
    const path = `$.scopes[${i}]`;
    if (!plain(scope) || !validId(scope.id) || (scope.parent !== null && !validId(scope.parent)) ||
        typeof scope.label !== 'string' || !scope.label.trim() || scope.label.length > 100) {
      issue('error', 'INVALID_SCOPE', path, 'Scope needs an ID, parent and label.'); continue;
    }
    if (scopes.has(scope.id)) issue('error', 'DUPLICATE_SCOPE', path, `Duplicate scope ${scope.id}.`);
    scopes.set(scope.id, scope.parent);
  }
  if (scopes.get('root') !== null) issue('error', 'MISSING_ROOT_SCOPE', '$.scopes', 'The root scope must exist and have a null parent.');
  for (const [id, parent] of scopes) {
    if (id !== 'root' && (parent === null || !scopes.has(parent))) issue('error', 'ORPHAN_SCOPE', `$.scopes.${id}`, 'Scope parent does not exist.');
    let pointer: string | null | undefined = parent;
    const visited = new Set([id]);
    while (pointer) {
      if (visited.has(pointer)) { issue('error', 'SCOPE_CYCLE', `$.scopes.${id}`, 'Scope parents form a cycle.'); break; }
      visited.add(pointer); pointer = scopes.get(pointer);
    }
  }
  const nodes = new Map<string, SpicaGraphNode>();
  for (const [i, raw] of value.nodes.entries()) {
    const path = `$.nodes[${i}]`;
    if (!plain(raw) || !validId(raw.id) || !plain(raw.block) || !validId(raw.block.id) || typeof raw.block.version !== 'string' ||
        !/^[0-9]+(?:\.[0-9]+){0,2}(?:-[a-z0-9.-]+)?$/.test(raw.block.version) ||
        !['registered', 'placeholder'].includes(String(raw.block.availability)) || !validId(raw.scope) || !plain(raw.config) ||
        !Array.isArray(raw.inputs) || !Array.isArray(raw.outputs) || raw.inputs.length > 64 || raw.outputs.length > 64) {
      issue('error', 'INVALID_NODE', path, 'Node needs an exact block lock, scope, configuration and typed ports.'); continue;
    }
    if (nodes.has(raw.id)) issue('error', 'DUPLICATE_NODE', path, `Duplicate node ${raw.id}.`);
    nodes.set(raw.id, raw as unknown as SpicaGraphNode);
    if (!scopes.has(raw.scope)) issue('error', 'UNKNOWN_SCOPE', path, 'Node references a missing scope.');
    if (raw.block.availability === 'registered' && options.resolveBlock && !options.resolveBlock(raw.block.id, raw.block.version)) {
      issue('error', 'UNREGISTERED_BLOCK', `${path}.block`, `Unknown executable block ${raw.block.id}@${raw.block.version}.`);
    }
    if (raw.block.availability === 'placeholder') issue('warning', 'NON_EXECUTABLE_NODE', `${path}.block`, 'This is a design-time placeholder and cannot execute.');
    if (raw.metadata !== undefined && (!plain(raw.metadata) || (raw.metadata.label !== undefined && (typeof raw.metadata.label !== 'string' || raw.metadata.label.length > 120)) ||
        (raw.metadata.x !== undefined && (typeof raw.metadata.x !== 'number' || !Number.isFinite(raw.metadata.x))) ||
        (raw.metadata.y !== undefined && (typeof raw.metadata.y !== 'number' || !Number.isFinite(raw.metadata.y))) ||
        (raw.metadata.readonly !== undefined && typeof raw.metadata.readonly !== 'boolean'))) {
      issue('error', 'INVALID_NODE_METADATA', `${path}.metadata`, 'Metadata may only contain label, finite coordinates and readonly flag.');
    }
    for (const direction of ['inputs', 'outputs'] as const) {
      const ids = new Set<string>();
      for (const [j, rawPort] of (raw[direction] as unknown[]).entries()) {
        const port = rawPort as Record<string, unknown>;
        if (!plain(port) || !validId(port.id) || !wellFormedType(port.type as SpicaValueType) ||
            (port.maxConnections !== undefined && (typeof port.maxConnections !== 'number' || !Number.isSafeInteger(port.maxConnections) || port.maxConnections < 1 || port.maxConnections > 4096)) ||
            (port.required !== undefined && typeof port.required !== 'boolean')) {
          issue('error', 'INVALID_PORT', `${path}.${direction}[${j}]`, 'Port needs an ID, valid value type and connection constraints.'); continue;
        }
        if (ids.has(port.id)) issue('error', 'DUPLICATE_PORT', `${path}.${direction}[${j}]`, 'Duplicate port in direction.');
        ids.add(port.id);
      }
    }
  }
  const edgeIds = new Set<string>();
  const inputCounts = new Map<string, number>();
  const outputCounts = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const [i, raw] of value.edges.entries()) {
    const path = `$.edges[${i}]`;
    if (!plain(raw) || !validId(raw.id) || !['data', 'event', 'reference'].includes(String(raw.kind)) ||
        !plain(raw.from) || !plain(raw.to) || !validId(raw.from.node) || !validId(raw.from.port) || !validId(raw.to.node) || !validId(raw.to.port)) {
      issue('error', 'INVALID_EDGE', path, 'Edge needs a unique ID, kind, source and destination.'); continue;
    }
    const edge = raw as unknown as SpicaGraphEdge;
    if (edgeIds.has(edge.id)) issue('error', 'DUPLICATE_EDGE', path, `Duplicate edge ${edge.id}.`);
    edgeIds.add(edge.id);
    const fromNode = nodes.get(edge.from.node);
    const toNode = nodes.get(edge.to.node);
    if (!fromNode || !toNode) { issue('error', 'DANGLING_EDGE', path, 'Connection references a missing node.'); continue; }
    if (fromNode.scope !== toNode.scope) issue('error', 'CROSS_SCOPE_EDGE', path, 'Use an explicit subgraph interface to connect different scopes.');
    const output = fromNode.outputs.find(port => port.id === edge.from.port);
    const input = toNode.inputs.find(port => port.id === edge.to.port);
    if (!output || !input) { issue('error', 'UNKNOWN_PORT', path, 'Connection references a missing input or output port.'); continue; }
    if (!edgeType(edge.kind, output.type) || !edgeType(edge.kind, input.type)) issue('error', 'EDGE_KIND', path, `Expected compatible ${edge.kind} ports.`);
    if (!spicaTypeAssignable(output.type, input.type)) issue('error', 'TYPE_MISMATCH', path, `Incompatible types on ${edge.from.node}.${edge.from.port} → ${edge.to.node}.${edge.to.port}.`);
    if (edge.feedback !== undefined && (edge.kind !== 'event' || !plain(edge.feedback) || !Number.isSafeInteger(edge.feedback.maxIterations) || edge.feedback.maxIterations < 1 || edge.feedback.maxIterations > 100)) {
      issue('error', 'INVALID_FEEDBACK', path, 'Feedback is only allowed for event edges with maxIterations 1–100.');
    }
    const inKey = `${edge.to.node}.${edge.to.port}`; const outKey = `${edge.from.node}.${edge.from.port}`;
    inputCounts.set(inKey, (inputCounts.get(inKey) ?? 0) + 1);
    outputCounts.set(outKey, (outputCounts.get(outKey) ?? 0) + 1);
    if (!edge.feedback) adjacency.set(edge.from.node, [...(adjacency.get(edge.from.node) ?? []), edge.to.node]);
  }
  for (const node of nodes.values()) {
    for (const input of node.inputs) {
      const count = inputCounts.get(`${node.id}.${input.id}`) ?? 0;
      if (count > (input.maxConnections ?? 1)) issue('error', 'FAN_IN', `$.nodes.${node.id}.inputs.${input.id}`, 'Too many incoming connections.');
      if (input.required && !count) issue(options.requireComplete ? 'error' : 'warning', 'UNCONNECTED_REQUIRED_PORT', `$.nodes.${node.id}.inputs.${input.id}`, 'Required input is not connected.');
    }
    for (const output of node.outputs) {
      if (output.maxConnections && (outputCounts.get(`${node.id}.${output.id}`) ?? 0) > output.maxConnections) {
        issue('error', 'FAN_OUT', `$.nodes.${node.id}.outputs.${output.id}`, 'Too many outgoing connections.');
      }
    }
  }
  // Kahn's algorithm operates on distinct node edges. Self loops count as cycles.
  const indegree = new Map([...nodes.keys()].map(id => [id, 0]));
  for (const targets of adjacency.values()) for (const target of targets) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  const queue = [...indegree].filter(([,degree]) => degree === 0).map(([id]) => id);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    for (const target of adjacency.get(id) ?? []) {
      const degree = (indegree.get(target) ?? 0) - 1; indegree.set(target, degree);
      if (degree === 0) queue.push(target);
    }
  }
  if (queue.length !== nodes.size) issue('error', 'UNBOUNDED_CYCLE', '$.edges', 'Data and reference cycles are forbidden; event feedback must be explicitly bounded.');
  return { valid: !errors.length, errors, warnings };
}

export function assertSpicaGraphV2(graph: unknown, options?: Parameters<typeof validateSpicaGraphV2>[1]): asserts graph is SpicaGraphV2 {
  const result = validateSpicaGraphV2(graph, options);
  if (!result.valid) throw Error(result.errors.slice(0, 5).map(item => `${item.code} at ${item.path}: ${item.message}`).join('; '));
}
