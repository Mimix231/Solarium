import type { Collection, Graph, RecordValue } from './graph';
import { compileGameScene, findGameRoute, gameDirections, moveGame, validateGameScene, type GameDirection, type GameScene } from './game';

export const capabilities = ['records.write', 'files.open', 'files.export', 'custom.transform'] as const;
export type Capability = typeof capabilities[number];
export type Target = 'desktop' | 'web';
export interface ScreenButton { id: string; label: string; screen: string }
export type RecordCondition = { field: string; op: 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' } &
  ({ value: RecordValue; compareField?: never } | { compareField: string; value?: never });
export interface RecordSort { field: string; direction: 'asc' | 'desc' }
export interface RecordTable {
  columns: string[];
  sort?: RecordSort;
  badge?: { label: string; when: RecordCondition; yes: string; no: string };
}
export type Screen = { id: string; label: string; intro?: string; buttons?: ScreenButton[] } & (
  { view: 'game'; scene: GameScene; collection?: never } | ({ collection: string } & (
  { view: 'list'; filter?: string; query?: string } |
  { view: 'form'; fields: string[]; submit: string; layout?: 'stack' | 'grid'; submitLabel?: string } |
  { view: 'review'; export?: boolean; mapping?: boolean; layout?: 'stack' | 'split' } |
  { view: 'table'; table: RecordTable } |
  { view: 'models' }))
);
export type Step = { id: string; when?: RecordCondition } & (
  { action: 'validate' } |
  { action: 'set'; field: string; value: RecordValue } |
  { action: 'format'; field: string; template: string } |
  { action: 'save' } |
  { action: 'navigate'; screen: string } |
  { action: 'status'; text: string }
);
export interface Flow { id: string; collection: string; steps: Step[] }
export type ScenarioStep =
  | { action: 'screen'; screen: string }
  | { action: 'fill'; field: string; value: string | boolean | number }
  | { action: 'submit'; twice?: boolean }
  | { action: 'load_csv'; text: string }
  | { action: 'edit_cell'; row: number; field: string; value: string | boolean | number }
  | { action: 'map_column'; column: number; field: string }
  | { action: 'stage_csv' }
  | { action: 'table_query'; text?: string; filter?: boolean; sort?: string; direction?: 'asc' | 'desc' }
  | { action: 'transfer'; operation: 'import' | 'csv' }
  | { action: 'move_player'; direction: GameDirection }
  | { action: 'expect'; screen?: string; alert?: string; field?: string; value?: string | boolean | number; row?: string; count?: number; stored?: number;
      invalidRows?: number; stagedRows?: number; importBlocked?: boolean; exportIncludes?: string; playerAt?: [number, number]; goalReached?: boolean;
      firstRow?: string; badge?: string; layoutClean?: boolean };
export interface Scenario { id: string; label: string; steps: ScenarioStep[]; reopened?: ScenarioStep[] }
export type RecipeId = 'quick_capture' | 'notebooks' | 'model_organizer';
export interface Program {
  schema: 1;
  screens: Screen[];
  flows: Flow[];
  scenarios: Scenario[];
  grants: Capability[];
  recipes: Partial<Record<RecipeId, 1>>;
  csvTransform?: string;
  startScreen?: string;
}
export type ProgramEdit =
  | { op: 'install_recipe'; recipe: RecipeId }
  | { op: 'put_screen'; screen: Screen }
  | { op: 'put_flow'; flow: Flow }
  | { op: 'put_scenario'; scenario: Scenario }
  | { op: 'set_capability'; capability: Capability; enabled: boolean }
  | { op: 'grant_capability' | 'revoke_capability'; capability: Capability }
  | { op: 'set_start_screen'; screen: string }
  | { op: 'set_csv_transform'; name: string | null };

import { listBlocks } from './runtime/blocks/registry';
import type { SpicaLegacyBlockContract } from './runtime/blocks/contracts';

/** Backward-compatible schema-1 view of the canonical per-file block registry.
 * Do not add block definitions here; run `npm run spica:registry` after adding a block file.
 */
export const blockRegistry: readonly SpicaLegacyBlockContract[] = Object.freeze(listBlocks().map(block => ({
  id: block.id,
  version: block.version,
  kind: block.kind,
  label: block.label,
  inputs: block.inputs,
  outputs: block.outputs,
  targets: block.targets,
  ...(block.permissions[0] ? { capability: block.permissions[0] } : {}),
})));

export const workflowId = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(value) &&
  !['constructor', 'prototype', '__proto__'].includes(value);
const workflowText = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 100;
const isProgramObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const programError = (path: string, detail: string): never => { throw Error(`${path} · ${detail}`); };

export function recordDefaults(collection: Collection): Record<string, RecordValue> {
  return Object.fromEntries(collection.fields.map(field => [field.key, field.initial]));
}

export function recordFieldValid(field: Collection['fields'][number], value: unknown, enforceRequired = true): value is RecordValue {
  if (field.type === 'boolean') return typeof value === 'boolean';
  if (field.type === 'reference') return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value) &&
    (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
  if (field.type === 'choice') return typeof value === 'string' && field.choices.includes(value);
  return typeof value === 'string' && value.length <= 16000 && (!enforceRequired || !field.required || !!value.trim());
}

export function validRecordCondition(collection: Collection, condition: unknown): condition is RecordCondition {
  if (!isProgramObject(condition)) return false;
  const field = collection.fields.find(item => item.key === condition.field);
  const op = condition.op;
  if (!field || !['eq', 'ne', 'lt', 'lte', 'gt', 'gte'].includes(String(op)) ||
      (op !== 'eq' && op !== 'ne' && field.type !== 'number')) return false;
  if (condition.compareField !== undefined) {
    return condition.value === undefined && collection.fields.some(item => item.key === condition.compareField &&
      item.type === field.type && (item.type !== 'reference' || field.type === 'reference' && item.collection === field.collection));
  }
  return recordFieldValid(field, condition.value, false);
}

export function matchesRecord(values: Record<string, RecordValue>, condition: RecordCondition) {
  const left = values[condition.field];
  const right = condition.compareField === undefined ? condition.value : values[condition.compareField];
  if (condition.op === 'eq') return left === right;
  if (condition.op === 'ne') return left !== right;
  if (typeof left !== 'number' || typeof right !== 'number') return false;
  switch (condition.op) {
    case 'lt': return left < right;
    case 'lte': return left <= right;
    case 'gt': return left > right;
    case 'gte': return left >= right;
  }
}

export function validRecordSort(collection: Collection, sort: unknown): sort is RecordSort {
  return isProgramObject(sort) && collection.fields.some(field => field.key === sort.field) &&
    (sort.direction === 'asc' || sort.direction === 'desc');
}

const placeholders = /\{([a-z][a-z0-9_]{0,39})\}/g;

export function recordProblem(collection: Collection, values: Record<string, RecordValue>): string | null {
  for (const field of collection.fields) {
    const value = values[field.key];
    if (!recordFieldValid(field, value)) {
      return field.type === 'text' && field.required && !String(value ?? '').trim() ? `${field.label} is required.` : `Invalid ${field.label}.`;
    }
  }
  return Object.keys(values).length === collection.fields.length ? null : 'Unexpected record field.';
}

export function allCollections(design: Pick<Graph, 'collection' | 'collections'>): Collection[] {
  return [...(design.collection ? [design.collection] : []), ...(design.collections ?? [])];
}

function uniqueItems<T extends { id: string }>(items: T[], limit: number, path: string): Map<string, T> {
  if (!Array.isArray(items) || items.length > limit) return programError(path, `Use at most ${limit} entries.`);
  const result = new Map<string, T>();
  for (const item of items) {
    if (!isProgramObject(item) || !workflowId(item.id) || result.has(item.id)) return programError(path, 'IDs must be valid and unique.');
    result.set(item.id, item);
  }
  return result;
}

export function validateProgram(design: Pick<Graph, 'collection' | 'collections'>, value: unknown): asserts value is Program {
  if (!isProgramObject(value) || value.schema !== 1 || !isProgramObject(value.recipes) ||
      !Array.isArray(value.grants) || value.grants.length > capabilities.length || new Set(value.grants).size !== value.grants.length ||
      value.grants.some(grant => !capabilities.includes(grant)) ||
      (value.csvTransform !== undefined && !workflowId(value.csvTransform))) programError('Program', 'Invalid version, capability grants, or custom export name.');
  const program = value as unknown as Program;
  if (Object.keys(program).some(key => !['schema', 'screens', 'flows', 'scenarios', 'grants', 'recipes', 'csvTransform', 'startScreen'].includes(key))) {
    programError('Program', 'Unknown program property.');
  }
  for (const [id, version] of Object.entries(program.recipes)) {
    if (!['quick_capture', 'notebooks', 'model_organizer'].includes(id) || version !== 1) programError(id, 'Recipe version is unavailable.');
  }
  const datasets = new Map(allCollections(design).map(collection => [collection.id, collection]));
  const screens = uniqueItems(program.screens, 64, 'Screens');
  const flows = uniqueItems(program.flows, 64, 'Flows');
  if (program.startScreen !== undefined && !screens.has(program.startScreen)) programError('Startup', 'Choose an existing screen.');
  for (const screen of screens.values()) {
    if (!workflowText(screen.label)) return programError(screen.id, 'Choose a screen label.');
    if (screen.intro !== undefined && (typeof screen.intro !== 'string' || screen.intro.length > 240)) programError(screen.id, 'Use at most 240 characters for the introduction.');
    if (screen.buttons !== undefined) {
      for (const button of uniqueItems(screen.buttons, 8, screen.id).values()) {
        if (!workflowText(button.label) || !screens.has(button.screen)) programError(screen.id, 'A button needs a label and an existing destination screen.');
      }
    }
    if (screen.view === 'game') {
      validateGameScene(screen.scene);
      continue;
    }
    const collection = datasets.get(screen.collection);
    if (!collection) return programError(screen.id, 'Choose a collection.');
    if (screen.view !== 'list' && 'query' in screen) programError(screen.id, 'query is supported only on list screens.');
    switch (screen.view) {
      case 'list':
        if (screen.query !== undefined && (typeof screen.query !== 'string' || screen.query.length > 256)) programError(screen.id, 'List search text must be at most 256 characters.');
        if (screen.filter !== undefined && !collection.fields.some(field => field.key === screen.filter && field.type === 'boolean' && field.filter)) {
          programError(screen.id, 'The list filter must be an enabled Boolean filter.');
        }
        break;
      case 'form': {
        const flow = flows.get(screen.submit);
        if (flow?.collection !== screen.collection || !Array.isArray(screen.fields) || !screen.fields.length ||
            screen.fields.length > 32 || new Set(screen.fields).size !== screen.fields.length ||
            screen.fields.some(key => !collection.fields.some(field => field.key === key))) {
          programError(screen.id, 'Connect the form to a flow in its collection and select its fields.');
        }
        if (screen.layout !== undefined && !['stack', 'grid'].includes(screen.layout)) programError(screen.id, 'Choose stack or grid form layout.');
        if (screen.submitLabel !== undefined && !workflowText(screen.submitLabel)) programError(screen.id, 'Enter a submit button label.');
        break;
      }
      case 'review':
        if (screen.export !== undefined && typeof screen.export !== 'boolean') programError(screen.id, 'Choose whether to include CSV export.');
        if (screen.mapping !== undefined && typeof screen.mapping !== 'boolean') programError(screen.id, 'Choose whether to enable CSV column mapping.');
        if (screen.layout !== undefined && !['stack', 'split'].includes(screen.layout)) programError(screen.id, 'Choose stack or split review layout.');
        break;
      case 'table': {
        const config = screen.table;
        if (!isProgramObject(config) || !Array.isArray(config.columns) || !config.columns.length || config.columns.length > 16 ||
            new Set(config.columns).size !== config.columns.length || config.columns.some(key => !collection.fields.some(field => field.key === key)) ||
            (config.sort !== undefined && !validRecordSort(collection, config.sort))) programError(screen.id, 'Bind table columns and sorting to collection fields.');
        const badge = config.badge;
        if (badge !== undefined && (!isProgramObject(badge) || !workflowText(badge.label) || !workflowText(badge.yes) ||
            !workflowText(badge.no) || !validRecordCondition(collection, badge.when))) programError(screen.id, 'Bind the badge to a typed field comparison and two labels.');
        break;
      }
      case 'models':
        if (collection.fields.length !== 4 || !['title', 'digest', 'tags', 'triangles'].every(key =>
          collection.fields.some(field => field.key === key && field.type === 'text'))) programError(screen.id, 'The STL library needs title, digest, tags, and triangles text fields.');
        break;
      default: programError('Screen', 'Unknown screen block.');
    }
  }
  for (const flow of flows.values()) {
    const collection = datasets.get(flow.collection);
    if (!collection) return programError(flow.id, 'The flow collection does not exist.');
    const steps = uniqueItems(flow.steps, 32, flow.id);
    if (!steps.size) programError(flow.id, 'Add an action to the flow.');
    let saved = false;
    for (const step of steps.values()) {
      const path = `${flow.id}/${step.id}`;
      if (step.when !== undefined && !validRecordCondition(collection, step.when)) programError(path, 'The condition must compare compatible record values.');
      switch (step.action) {
        case 'validate': break;
        case 'set': {
          const field = collection.fields.find(field => field.key === step.field);
          if (!field || !recordFieldValid(field, step.value, false)) programError(path, 'Field assignment has an incompatible value.');
          break;
        }
        case 'format':
          if (!collection.fields.some(field => field.key === step.field && field.type === 'text') ||
              typeof step.template !== 'string' || !step.template.trim() || step.template.length > 1000 ||
              [...step.template.matchAll(placeholders)].some(match => !collection.fields.some(field => field.key === match[1]))) {
            programError(path, 'Format into a text field using a template with existing {field} placeholders.');
          }
          break;
        case 'save':
          if (saved) programError(path, 'A submit flow may persist one record.');
          saved = true;
          break;
        case 'navigate':
          if (!screens.has(step.screen)) programError(path, `Unknown screen ${step.screen}.`);
          break;
        case 'status':
          if (!workflowText(step.text)) programError(path, 'Enter a status message.');
          break;
        default: programError(path, 'Unknown action block.');
      }
    }
  }
  for (const scenario of uniqueItems(program.scenarios, 24, 'Scenarios').values()) {
    if (!workflowText(scenario.label)) programError(scenario.id, 'A scenario needs a label.');
    for (const sequence of [scenario.steps, scenario.reopened ?? []]) {
      if (!Array.isArray(sequence) || sequence.length > 60) programError(scenario.id, 'Use up to 60 steps per scenario phase.');
      for (const step of sequence) {
        if (!isProgramObject(step)) return programError(scenario.id, 'Invalid scenario step.');
        switch (step.action) {
          case 'screen': if (!screens.has(step.screen)) programError(scenario.id, 'A recorded screen no longer exists.'); break;
          case 'fill':
            if (!workflowId(step.field) || !['string', 'boolean', 'number'].includes(typeof step.value) || String(step.value).length > 16000) programError(scenario.id, 'Invalid recorded field value.');
            break;
          case 'submit': if (step.twice !== undefined && typeof step.twice !== 'boolean') programError(scenario.id, 'Invalid submit step.'); break;
          case 'load_csv':
            if (typeof step.text !== 'string' || !step.text.trim() || step.text.length > 16000) programError(scenario.id, 'Use a nonempty CSV fixture of at most 16,000 characters.');
            break;
          case 'edit_cell':
            if (!Number.isSafeInteger(step.row) || step.row < 1 || step.row > 1000 || !workflowId(step.field) ||
                !['string', 'boolean', 'number'].includes(typeof step.value) || String(step.value).length > 16000) programError(scenario.id, 'Invalid CSV fixture cell.');
            break;
          case 'map_column':
            if (!Number.isInteger(step.column) || step.column < 1 || step.column > 32 || !workflowId(step.field)) programError(scenario.id, 'Choose a CSV column and field.');
            break;
          case 'stage_csv': break;
          case 'table_query':
            if ((step.text !== undefined && (typeof step.text !== 'string' || step.text.length > 256)) ||
                (step.filter !== undefined && typeof step.filter !== 'boolean') ||
                (step.sort !== undefined && !workflowId(step.sort)) ||
                (step.direction !== undefined && !['asc', 'desc'].includes(step.direction))) programError(scenario.id, 'Invalid table query.');
            break;
          case 'transfer':
            if (step.operation !== 'import' && step.operation !== 'csv') programError(scenario.id, 'Choose import or csv transfer.');
            break;
          case 'move_player':
            if (!gameDirections.includes(step.direction)) programError(scenario.id, 'Choose a player direction.');
            break;
          case 'expect':
            if (step.screen !== undefined && !screens.has(step.screen)) programError(scenario.id, 'Expected screen does not exist.');
            if (step.field !== undefined && (!workflowId(step.field) || !['string', 'boolean', 'number'].includes(typeof step.value) || String(step.value).length > 16000)) programError(scenario.id, 'Invalid field assertion.');
            if (step.alert !== undefined && !workflowText(step.alert)) programError(scenario.id, 'Invalid alert assertion.');
            if (step.row !== undefined && !workflowText(step.row)) programError(scenario.id, 'Invalid row assertion.');
            for (const count of [step.count, step.stored, step.invalidRows, step.stagedRows]) if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) programError(scenario.id, 'Invalid row count.');
            if (step.importBlocked !== undefined && typeof step.importBlocked !== 'boolean') programError(scenario.id, 'Invalid import guard assertion.');
            if (step.exportIncludes !== undefined && (typeof step.exportIncludes !== 'string' || !step.exportIncludes || step.exportIncludes.length > 1024)) programError(scenario.id, 'Invalid CSV output assertion.');
            if (step.playerAt !== undefined && (!Array.isArray(step.playerAt) || step.playerAt.length !== 2 || step.playerAt.some(value => !Number.isSafeInteger(value) || value < 0))) programError(scenario.id, 'Invalid player position assertion.');
            if (step.goalReached !== undefined && typeof step.goalReached !== 'boolean') programError(scenario.id, 'Invalid game goal assertion.');
            if ([step.firstRow, step.badge].some(value => value !== undefined && !workflowText(value)) ||
                (step.layoutClean !== undefined && typeof step.layoutClean !== 'boolean')) programError(scenario.id, 'Invalid table or layout assertion.');
            if ([step.screen, step.field, step.alert, step.row, step.stored, step.invalidRows, step.stagedRows, step.importBlocked, step.exportIncludes, step.playerAt, step.goalReached, step.firstRow, step.badge, step.layoutClean].every(value => value === undefined)) programError(scenario.id, 'An assertion must check an outcome.');
            break;
          default: programError(scenario.id, 'Unknown scenario operation.');
        }
      }
    }
    if (!scenario.steps.some(step => step.action === 'expect')) programError(scenario.id, 'Record at least one expected outcome.');
  }
}

export const recipeCatalog = [
  { id: 'quick_capture', label: 'Quick Capture', description: 'Validate, save a pinned note, and open the Pinned view.' },
  { id: 'notebooks', label: 'Notebooks', description: 'Organize records by a related Notebook record.' },
  { id: 'model_organizer', label: 'Model Organizer', description: 'Preview actual STL files and persist searchable tags.' },
] as const;

export function programFor(graph: Pick<Graph, 'collection'>): Program {
  return { schema: 1, screens: graph.collection ? [{ id: 'records', view: 'list', label: graph.collection.label, collection: graph.collection.id }] : [],
    flows: [], scenarios: [], recipes: {}, grants: ['records.write'] };
}

export function quickCaptureScenario(): Scenario {
  const title = 'Runtime fixture · 水';
  return { id: 'quick_capture', label: 'Quick Capture validation and persistence', steps: [
    { action: 'screen', screen: 'quick_capture' }, { action: 'fill', field: 'body', value: 'Keep this draft.' },
    { action: 'submit' }, { action: 'expect', screen: 'quick_capture', alert: 'Title is required.', field: 'body', value: 'Keep this draft.', stored: 0 },
    { action: 'fill', field: 'title', value: title }, { action: 'submit', twice: true },
    { action: 'expect', screen: 'pinned', row: title, count: 1, stored: 1 },
  ], reopened: [{ action: 'screen', screen: 'pinned' }, { action: 'expect', screen: 'pinned', row: title, count: 1, stored: 1 }] };
}

/** Each standard review collection carries a real import, correction, and reopen check into the compiled app. */
export function runtimeScenarios(program: Program, collections: readonly Collection[]): Scenario[] {
  const scenarios = [...program.scenarios];
  const uniqueId = (prefix: string) => {
    let id = prefix;
    while (scenarios.some(scenario => scenario.id === id)) id += '_';
    return id;
  };
  const covered = new Set<string>();
  for (const [index, screen] of program.screens.entries()) {
    if (screen.view === 'game') {
      const scene = compileGameScene(screen.scene);
      const steps: ScenarioStep[] = [{ action: 'screen', screen: screen.id },
        { action: 'expect', playerAt: [scene.start.x, scene.start.y], goalReached: false }];
      const blocked = gameDirections.find(direction => moveGame(scene, scene.start, direction) === scene.start);
      if (blocked) steps.push({ action: 'move_player', direction: blocked },
        { action: 'expect', playerAt: [scene.start.x, scene.start.y], goalReached: false });
      steps.push(...findGameRoute(scene)!.map(direction => ({ action: 'move_player' as const, direction })),
        { action: 'expect', playerAt: [scene.goal.x, scene.goal.y], goalReached: true });
      scenarios.push({ id: uniqueId(`spica_game_${index + 1}`), label: `Playable scene · ${screen.label}`.slice(0, 100), steps });
      continue;
    }
    if (screen.view !== 'review' || program.csvTransform || covered.has(screen.collection)) continue;
    const collection = collections.find(item => item.id === screen.collection);
    if (!collection) continue;
    covered.add(screen.collection);
    const id = uniqueId(`spica_csv_${covered.size}`);
    const title = 'Corrected CSV row · 水';
    const required = collection.fields.filter(field => field.type === 'text' && field.required && field.key !== 'title');
    const suffix = required.map(() => ',Fixture value').join('');
    const text = [(screen.mapping ? 'Name' : 'title') + required.map(field => ',' + field.key).join(''), suffix || '""', 'Valid CSV row' + suffix].join('\r\n');
    const steps: ScenarioStep[] = [
      { action: 'screen', screen: screen.id },
      { action: 'load_csv', text },
      ...(screen.mapping ? [{ action: 'map_column', column: 1, field: 'title' }, { action: 'stage_csv' }] as const : []),
      { action: 'expect', stagedRows: 2, invalidRows: 1, importBlocked: true, stored: 0 },
      { action: 'edit_cell', row: 1, field: 'title', value: title },
      { action: 'expect', stagedRows: 2, invalidRows: 0, importBlocked: false },
      { action: 'transfer', operation: 'import' },
      { action: 'expect', row: title, stored: 2 },
    ];
    if (screen.export !== false) steps.push(
      { action: 'transfer', operation: 'csv' },
      { action: 'expect', exportIncludes: `"${title}"` },
    );
    scenarios.push({ id, label: `CSV review · ${screen.label}`.slice(0, 100), steps,
      reopened: [{ action: 'screen', screen: screen.id }, { action: 'expect', row: title, stored: 2 }] });
  }
  return scenarios;
}

function installProgramRecipe(graph: Graph, program: Program, recipe: RecipeId) {
  if (!recipeCatalog.some(item => item.id === recipe)) programError('Recipe', 'Unknown recipe.');
  if (program.recipes[recipe]) programError(recipe, 'This recipe version is already installed.');
  const collection = graph.collection;
  const addScreen = (screen: Screen) => {
    if (program.screens.some(existing => existing.id === screen.id)) programError(screen.id, 'A screen already uses this ID.');
    program.screens.push(screen);
  };
  if (recipe === 'model_organizer') {
    const models: Collection = { id: 'models', label: 'Models', singular: 'model', recipeVersion: 1, fields: [
      { key: 'title', label: 'File name', type: 'text', required: true, initial: '' },
      ...(['digest', 'tags', 'triangles'] as const).map(key => ({ key, label: key, type: 'text' as const, initial: '' })),
    ] };
    if (!collection) graph.collection = models;
    else graph.collections = [...graph.collections ?? [], models];
    addScreen({ id: 'models', view: 'models', label: 'Model Library', collection: 'models' });
    if (!program.grants.includes('files.open')) program.grants.push('files.open');
  } else {
    if (!collection) return programError(recipe, 'Start with a record collection.');
    if (recipe === 'notebooks') {
      graph.collections = [...graph.collections ?? [], { id: 'notebooks', label: 'Notebooks', singular: 'notebook', recipeVersion: 1,
        fields: [{ key: 'title', label: 'Title', type: 'text', initial: '', required: true }] }];
      if (collection.fields.some(field => field.key === 'notebook')) programError('notebook', 'A field already uses this key.');
      collection.fields.push({ key: 'notebook', label: 'Notebook', type: 'reference', initial: null, collection: 'notebooks' });
      addScreen({ id: 'notebooks', view: 'list', label: 'Notebooks', collection: 'notebooks' });
    } else {
      const pin = collection.fields.find(field => field.key === 'pinned');
      if (pin && pin.type !== 'boolean') return programError('pinned', 'Quick Capture needs a Boolean Pinned field.');
      if (pin) pin.filter = true;
      else collection.fields.push({ key: 'pinned', label: 'Pinned', type: 'boolean', initial: false, filter: true });
      if (!collection.fields.some(field => field.key === 'body' && field.type === 'text')) return programError(recipe, 'Quick Capture needs a text body field.');
      addScreen({ id: 'quick_capture', view: 'form', label: 'Quick Capture', collection: collection.id, fields: ['title', 'body'], submit: 'capture' });
      addScreen({ id: 'pinned', view: 'list', label: 'Pinned', collection: collection.id, filter: 'pinned' });
      if (program.flows.some(flow => flow.id === 'capture') || program.scenarios.some(scenario => scenario.id === 'quick_capture')) {
        programError(recipe, 'The capture flow or scenario ID is already in use.');
      }
      program.flows.push({ id: 'capture', collection: collection.id, steps: [
        { id: 'validate', action: 'validate' }, { id: 'pin', action: 'set', field: 'pinned', value: true },
        { id: 'save', action: 'save' }, { id: 'open_pinned', action: 'navigate', screen: 'pinned' },
      ] });
      program.scenarios.push(quickCaptureScenario());
    }
  }
  program.recipes[recipe] = 1;
}

function upsertProgramItem<T extends { id: string }>(items: T[], item: T) {
  if (!isProgramObject(item) || !workflowId(item.id)) return programError('Program', 'The edited block needs a valid ID.');
  const index = items.findIndex(existing => existing.id === item.id);
  if (index < 0) items.push(structuredClone(item));
  else items[index] = structuredClone(item);
}

export function editProgram(graph: Graph, edit: ProgramEdit) {
  const program = graph.program ??= programFor(graph);
  switch (edit.op) {
    case 'install_recipe': installProgramRecipe(graph, program, edit.recipe); break;
    case 'put_screen': upsertProgramItem(program.screens, edit.screen); break;
    case 'put_flow': upsertProgramItem(program.flows, edit.flow); break;
    case 'put_scenario': upsertProgramItem(program.scenarios, edit.scenario); break;
    case 'set_start_screen': program.startScreen = edit.screen; break;
    case 'set_capability': case 'grant_capability': case 'revoke_capability': {
      const enabled = edit.op === 'set_capability' ? edit.enabled : edit.op === 'grant_capability';
      if (!capabilities.includes(edit.capability) || typeof enabled !== 'boolean') {
        programError('Capability', 'Use grant_capability or revoke_capability with an exact capability ID.');
      }
      program.grants = program.grants.filter(grant => grant !== edit.capability);
      if (enabled) program.grants.push(edit.capability);
      break;
    }
    case 'set_csv_transform':
      if (edit.name === null) delete program.csvTransform;
      else program.csvTransform = edit.name;
      break;
  }
}

export function checkCapability(program: Program | undefined, capability: Capability) {
  if (program && !program.grants.includes(capability)) throw Error(`Capability denied · ${capability}`);
}

export function usedBlockLocks(program: Program | undefined, collections: readonly Collection[] = []) {
  if (!program) return {};
  const used = new Set<string>([...program.screens.map(screen => screen.view), ...program.flows.flatMap(flow => flow.steps.map(step => step.action))]);
  if (program.screens.some(screen => screen.view === 'form' && screen.layout === 'grid')) used.add('form_grid');
  if (program.screens.some(screen => screen.buttons?.length)) used.add('screen_button');
  if (program.screens.some(screen => screen.view === 'review' && screen.mapping)) used.add('csv_mapping');
  if (program.screens.some(screen => screen.view === 'review' && screen.layout === 'split')) used.add('layout_split');
  if (program.screens.some(screen => screen.view === 'table')) used.add('record_query');
  if (program.screens.some(screen => screen.view === 'table' && screen.table.badge)) used.add('record_badge');
  if (program.flows.some(flow => flow.steps.some(step => step.when))) used.add('when');
  if (program.scenarios.some(scenario => [...scenario.steps, ...(scenario.reopened ?? [])].some(step => step.action === 'expect' && step.layoutClean !== undefined))) used.add('layout_audit');
  for (const type of ['number', 'choice']) if (collections.some(collection => collection.fields.some(field => field.type === type))) used.add('record_' + type);
  if (program.grants.includes('files.open')) used.add('open_file');
  if (program.grants.includes('files.export')) used.add('export_file');
  if (program.csvTransform) used.add('csv_transform');
  return Object.fromEntries(blockRegistry.filter(block => used.has(block.id)).map(block => [block.id, block.version]));
}

export interface FlowTrace {
  flow: string; step: string; action: Step['action']; outcome: 'passed' | 'failed' | 'cancelled' | 'skipped';
  durationMs: number; detail?: string;
}
export interface FlowResult {
  trace: FlowTrace[]; saved: boolean; screen?: string; status?: string; error?: string; cancelled?: boolean;
}

export async function executeFlow(flow: Flow, collection: Collection, program: Program, input: Record<string, RecordValue>,
  save: (values: Record<string, RecordValue>) => Promise<{ id: number; revision: number }>, signal?: AbortSignal): Promise<FlowResult> {
  const values = { ...input };
  const result: FlowResult = { trace: [], saved: false };
  for (const step of flow.steps) {
    const start = performance.now();
    let detail: string | undefined;
    try {
      if (signal?.aborted) throw new DOMException('Stopped.', 'AbortError');
      if (step.when && !matchesRecord(values, step.when)) {
        result.trace.push({ flow: flow.id, step: step.id, action: step.action, outcome: 'skipped', durationMs: performance.now() - start });
        continue;
      }
      if (step.action === 'validate' || step.action === 'save') {
        const problem = recordProblem(collection, values);
        if (problem) throw Error(problem);
      }
      switch (step.action) {
        case 'validate': break;
        case 'set': values[step.field] = step.value; break;
        case 'format': values[step.field] = step.template.replace(placeholders, (_, key: string) => String(values[key] ?? '')); break;
        case 'save': {
          checkCapability(program, 'records.write');
          const record = await save({ ...values });
          result.saved = true;
          detail = `Record ${record.id} · revision ${record.revision}`;
          break;
        }
        case 'navigate': result.screen = step.screen; detail = step.screen; break;
        case 'status': result.status = step.text; break;
      }
      result.trace.push({ flow: flow.id, step: step.id, action: step.action, outcome: 'passed', durationMs: performance.now() - start, detail });
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.cancelled = error instanceof DOMException && error.name === 'AbortError';
      result.trace.push({ flow: flow.id, step: step.id, action: step.action, outcome: result.cancelled ? 'cancelled' : 'failed',
        durationMs: performance.now() - start, detail: result.error });
      return result;
    }
  }
  return result;
}
