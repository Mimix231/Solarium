import { changeGraph, type Graph } from './graph';
import { allCollections, programFor, recipeCatalog, type Capability, type RecipeId, type Target } from './program';
import { getBlock, listBlocks } from './runtime/blocks/registry';

export type WarehouseKind = 'primitive' | 'composition' | 'profile' | 'recipe';
export type WarehouseMaturity = 'draft' | 'prototype' | 'beta' | 'stable' | 'deprecated' | 'blocked';

export interface WarehouseEntry {
  id: string;
  version: string;
  primaryCategoryId: number;
  facets: string[];
  kind: WarehouseKind;
  maturity: WarehouseMaturity;
  title: string;
  summary: string;
  tags: string[];
  targets: readonly Target[];
  permissions: Capability[];
  dependencies: { id: string; version: string }[];
  inputs: string[];
  outputs: string[];
  implementationRef?: string;
  compositionRef?: string;
  docsRef: string;
}

export interface WarehouseCandidate {
  id: string;
  version: string;
  title: string;
  summary: string;
  kind: WarehouseKind;
  maturity: WarehouseMaturity;
  primaryCategoryId: number;
  executableNow: boolean;
  installableNow: boolean;
  blockedReasons: string[];
  relevanceReason: string;
}


const recipeTags: Record<RecipeId, string[]> = {
  quick_capture: ['notes', 'capture', 'pinned', 'form', 'records', 'validation'],
  notebooks: ['notes', 'notebooks', 'related records', 'organization', 'collections'],
  model_organizer: ['3d', 'stl', 'models', 'mesh', 'files', 'library'],
};

const recipeDependencies: Record<RecipeId, string[]> = {
  quick_capture: ['validate', 'set', 'save', 'navigate', 'status', 'form', 'list'],
  notebooks: ['form', 'list', 'save', 'navigate', 'status'],
  model_organizer: ['models', 'save', 'status'],
};

const recipePermissions: Record<RecipeId, Capability[]> = {
  quick_capture: ['records.write'],
  notebooks: ['records.write'],
  model_organizer: ['records.write', 'files.open'],
};

const blockEntries: WarehouseEntry[] = listBlocks().map(block => ({
  id: `spica.block.${block.id}`,
  version: String(block.version),
  primaryCategoryId: block.categoryId,
  facets: [block.kind, 'runtime'],
  kind: 'primitive',
  maturity: block.maturity,
  title: block.label,
  summary: `${block.label}: accepts ${block.inputs} and produces ${block.outputs}.`,
  tags: [block.id, ...block.tags],
  targets: block.targets,
  permissions: [...block.permissions],
  dependencies: [...block.dependencies],
  inputs: [block.inputs],
  outputs: [block.outputs],
  implementationRef: `registered-block:${block.id}`,
  docsRef: block.sourcePath,
}));

const recipeEntries: WarehouseEntry[] = recipeCatalog.map(recipe => ({
  id: `spica.recipe.${recipe.id}`,
  version: '1',
  primaryCategoryId: 33,
  facets: ['application', 'recipe', 'records'],
  kind: 'recipe',
  maturity: 'prototype',
  title: recipe.label,
  summary: recipe.description,
  tags: [recipe.id, ...recipeTags[recipe.id]],
  targets: ['desktop', 'web'],
  permissions: recipePermissions[recipe.id],
  dependencies: recipeDependencies[recipe.id].map(id => ({ id: `spica.block.${id}`, version: '1' })),
  inputs: ['SPICA graph'],
  outputs: ['Validated graph changes'],
  compositionRef: `registered-recipe:${recipe.id}`,
  docsRef: 'src/spica/program.ts',
}));

const entries = [...blockEntries, ...recipeEntries];
const entryById = new Map(entries.map(entry => [entry.id, entry]));
const tokenize = (value: string) => value.toLowerCase().match(/[a-z0-9_]+/g) ?? [];

export const registeredWarehouseCounts = { adapters: blockEntries.length, recipes: recipeEntries.length };

interface Eligibility {
  executableNow: boolean;
  installableNow: boolean;
  blockedReasons: string[];
}

function eligibility(entry: WarehouseEntry, graph: Graph, target?: Target): Eligibility {
  const blockedReasons: string[] = [];
  if (target && !entry.targets.includes(target)) blockedReasons.push(`Unsupported target: ${target}.`);
  const grants = new Set((graph.program ?? programFor(graph)).grants);
  const missing = entry.permissions.filter(permission => !grants.has(permission));
  if (missing.length) blockedReasons.push(`Missing graph capability grant: ${missing.join(', ')}.`);

  if (entry.kind !== 'recipe') {
    if (['list', 'form', 'review', 'form_grid', 'validate', 'set', 'save', 'export_file', 'csv_transform',
      'csv_mapping', 'table', 'record_query', 'record_number', 'record_choice', 'record_badge', 'when', 'format'].some(id => entry.id === `spica.block.${id}`) &&
        !allCollections(graph).length) blockedReasons.push('Add a record collection to use this block.');
    return {
      executableNow: !blockedReasons.length && !!getBlock(entry.id.replace(/^spica\.block\./, ''), entry.version),
      installableNow: false,
      blockedReasons,
    };
  }

  const recipe = entry.id.slice('spica.recipe.'.length) as RecipeId;
  const installed = graph.program?.recipes[recipe] === 1;
  if (installed) {
    return {
      executableNow: !blockedReasons.length && recipeCatalog.some(item => item.id === recipe),
      installableNow: false,
      blockedReasons,
    };
  }

  try {
    changeGraph(graph, [{ op: 'install_recipe', recipe }]);
    blockedReasons.push('Recipe is available to install but has not been installed in this graph.');
    return {
      executableNow: false,
      installableNow: !target || entry.targets.includes(target),
      blockedReasons,
    };
  } catch (error) {
    blockedReasons.push(error instanceof Error ? error.message : String(error));
    return { executableNow: false, installableNow: false, blockedReasons };
  }
}

function candidate(entry: WarehouseEntry, graph: Graph, target: Target | undefined, query: string, score: number): WarehouseCandidate {
  const status = eligibility(entry, graph, target);
  const phrase = query.trim().toLowerCase();
  return {
    id: entry.id,
    version: entry.version,
    title: entry.title,
    summary: entry.summary,
    kind: entry.kind,
    maturity: entry.maturity,
    primaryCategoryId: entry.primaryCategoryId,
    ...status,
    relevanceReason: !phrase ? 'Registered in the local warehouse.' : `${entry.title} ${entry.summary}`.toLowerCase().includes(phrase)
      ? 'Direct title or summary match.'
      : `Matched ${score} query term${score === 1 ? '' : 's'} in the registered component metadata.`,
  };
}

export function searchSpicaWarehouse(
  graph: Graph,
  request: { query: string; target?: Target; executableOnly?: boolean; limit?: number },
) {
  if (typeof request.query !== 'string' || !request.query.trim() || request.query.length > 200) {
    throw Error('Warehouse search needs a nonempty query of at most 200 characters.');
  }
  if (request.target !== undefined && request.target !== 'desktop' && request.target !== 'web') {
    throw Error('Warehouse target must be desktop or web.');
  }
  if (request.executableOnly !== undefined && typeof request.executableOnly !== 'boolean') {
    throw Error('executableOnly must be a Boolean.');
  }
  if (request.limit !== undefined && !Number.isInteger(request.limit)) throw Error('Warehouse limit must be an integer.');

  const limit = Math.max(1, Math.min(12, request.limit ?? 8));
  const terms = [...new Set(tokenize(request.query))];
  if (!terms.length) throw Error('Warehouse search needs at least one searchable letter or number.');
  return browseSpicaWarehouse(graph, { ...request, limit });
}

export function browseSpicaWarehouse(graph: Graph, request: {
  query: string; target?: Target; executableOnly?: boolean; category?: number; kind?: WarehouseKind; offset?: number; limit?: number;
}) {
  const terms = [...new Set(tokenize(request.query))];
  const matches = entries.flatMap(entry => {
    if (request.target && !entry.targets.includes(request.target)) return [];
    if (request.category && request.category !== entry.primaryCategoryId) return [];
    if (request.kind && request.kind !== entry.kind) return [];
    const text = tokenize([
      entry.id, entry.title, entry.summary, ...entry.tags, ...entry.facets,
      ...entry.inputs, ...entry.outputs,
    ].join(' '));
    const searchable = new Set(text);
    const score = terms.reduce((total, term) => total + (searchable.has(term) ? 2 : text.some(word => word.startsWith(term)) ? 1 : 0), 0);
    if (request.query.trim() && !score) return [];
    const result = candidate(entry, graph, request.target, request.query, score);
    if (request.executableOnly && !result.executableNow) return [];
    return [{ result, score }];
  }).sort((a, b) => b.score - a.score || a.result.id.localeCompare(b.result.id));

  const offset = request.offset ?? 0;
  const limit = Math.max(1, Math.min(12, request.limit ?? 8));
  return {
    candidates: matches.slice(offset, offset + limit).map(match => match.result),
    totalMatches: matches.length,
    registryRevision: 'spica-runtime-1',
  };
}

export function inspectSpicaComponent(graph: Graph, id: string, version: string, target?: Target) {
  if (typeof id !== 'string' || typeof version !== 'string') throw Error('Provide an exact component ID and version from warehouse search.');
  if (target !== undefined && target !== 'desktop' && target !== 'web') throw Error('Warehouse target must be desktop or web.');
  const entry = entryById.get(id);
  if (!entry || entry.version !== version) throw Error(`Unknown SPICA component ${id}@${version}. Search the local warehouse for available versions.`);
  return {
    ...entry,
    ...eligibility(entry, graph, target),
    ...(entry.id === 'spica.block.review' ? { configure: {
      op: 'put_screen', screen: { id: 'review', label: 'CSV Review', view: 'review', collection: 'existing_collection_id' },
      importGrants: ['files.open', 'records.write'], exportGrant: 'files.export',
      verification: 'The standard CSV review adapter compiles a correction and persistence scenario for its collection.',
    } } : {}),
    ...(entry.id === 'spica.block.game' ? { configure: {
      op: 'put_screen', screen: { id: 'play', label: 'Play', view: 'game', scene: { tiles: ['#####', '#P.G#', '#####'] } },
      verification: 'The scene uses ShadowiumUI polygon collision and compiles a keyboard play scenario.',
    } } : {}),
    recipeId: entry.kind === 'recipe' ? entry.id.slice('spica.recipe.'.length) as RecipeId : undefined,
    registryRevision: 'spica-runtime-1',
    notice: entry.kind === 'recipe'
      ? 'This recipe is backed by the local graph adapter. Install it through edit_spica_graph at the current graph revision; inspect its capability changes before approval.'
      : 'This primitive is backed by a registered local adapter. Maturity is prototype; it is not a claim of broad production certification.',
  };
}
