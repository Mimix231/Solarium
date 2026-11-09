import type { Collection, Graph, RecordValue } from './graph';

export const capabilities = ['records.write', 'files.open', 'files.export', 'custom.transform'] as const;
export type Capability = typeof capabilities[number];
export type Target = 'desktop' | 'web';
export type Screen = { id: string; label: string; collection: string } & (
  { view: 'list'; filter?: string } |
  { view: 'form'; fields: string[]; submit: string } |
  { view: 'models' }
);
export type Step = { id: string } & (
  { action: 'validate' } |
  { action: 'set'; field: string; value: RecordValue } |
  { action: 'save' } |
  { action: 'navigate'; screen: string } |
  { action: 'status'; text: string }
);
export interface Flow { id: string; collection: string; steps: Step[] }
export type ScenarioStep =
  | { action: 'screen'; screen: string }
  | { action: 'fill'; field: string; value: string | boolean }
  | { action: 'submit'; twice?: boolean }
  | { action: 'expect'; screen?: string; alert?: string; field?: string; value?: string | boolean; row?: string; count?: number; stored?: number };
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
}
export type ProgramEdit =
  | { op: 'install_recipe'; recipe: RecipeId }
  | { op: 'put_screen'; screen: Screen }
  | { op: 'put_flow'; flow: Flow }
  | { op: 'put_scenario'; scenario: Scenario }
  | { op: 'set_capability'; capability: Capability; enabled: boolean }
  | { op: 'set_csv_transform'; name: string | null };

interface BlockContract {
  id: string; version: 1; kind: 'screen' | 'action'; label: string;
  inputs: string; outputs: string; targets: readonly Target[]; capability?: Capability;
}
const both: readonly Target[] = ['desktop', 'web'];
export const blockRegistry: readonly BlockContract[] = [
  { id: 'list', version: 1, kind: 'screen', label: 'Record list', inputs: 'Collection', outputs: 'Record selection', targets: both },
  { id: 'form', version: 1, kind: 'screen', label: 'Record form', inputs: 'Collection', outputs: 'Submit record', targets: both },
  { id: 'models', version: 1, kind: 'screen', label: 'STL library', inputs: 'Selected STL file', outputs: 'Mesh and record', targets: both, capability: 'files.open' },
  { id: 'validate', version: 1, kind: 'action', label: 'Validate fields', inputs: 'Record values', outputs: 'Valid record or field error', targets: both },
  { id: 'set', version: 1, kind: 'action', label: 'Set field', inputs: 'Record values', outputs: 'Record values', targets: both },
  { id: 'save', version: 1, kind: 'action', label: 'Save record', inputs: 'Record values', outputs: 'Saved revision or storage error', targets: both, capability: 'records.write' },
  { id: 'navigate', version: 1, kind: 'action', label: 'Open screen', inputs: 'Screen ID', outputs: 'Active screen', targets: both },
  { id: 'status', version: 1, kind: 'action', label: 'Show status', inputs: 'Text', outputs: 'Accessible status', targets: both },
  { id: 'open_file', version: 1, kind: 'action', label: 'Read chosen file', inputs: 'File picker', outputs: 'Bytes or text', targets: both, capability: 'files.open' },
  { id: 'export_file', version: 1, kind: 'action', label: 'Save export', inputs: 'Records', outputs: 'CSV or JSON file', targets: both, capability: 'files.export' },
  { id: 'csv_transform', version: 1, kind: 'action', label: 'Custom CSV transform', inputs: 'CSV cells', outputs: 'CSV cells', targets: both, capability: 'custom.transform' },
];

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
  return typeof value === 'string' && value.length <= 16000 && (!enforceRequired || !field.required || !!value.trim());
}

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
  if (Object.keys(program).some(key => !['schema', 'screens', 'flows', 'scenarios', 'grants', 'recipes', 'csvTransform'].includes(key))) {
    programError('Program', 'Unknown program property.');
  }
  for (const [id, version] of Object.entries(program.recipes)) {
    if (!['quick_capture', 'notebooks', 'model_organizer'].includes(id) || version !== 1) programError(id, 'Recipe version is unavailable.');
  }
  const datasets = new Map(allCollections(design).map(collection => [collection.id, collection]));
  const screens = uniqueItems(program.screens, 64, 'Screens');
  const flows = uniqueItems(program.flows, 64, 'Flows');
  for (const screen of screens.values()) {
    const collection = datasets.get(screen.collection);
    if (!collection || !workflowText(screen.label)) return programError(screen.id, 'Choose a collection and a screen label.');
    switch (screen.view) {
      case 'list':
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
      switch (step.action) {
        case 'validate': break;
        case 'set': {
          const field = collection.fields.find(field => field.key === step.field);
          if (!field || !recordFieldValid(field, step.value, false)) programError(path, 'Field assignment has an incompatible value.');
          break;
        }
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
            if (!workflowId(step.field) || !['string', 'boolean'].includes(typeof step.value) || String(step.value).length > 16000) programError(scenario.id, 'Invalid recorded field value.');
            break;
          case 'submit': if (step.twice !== undefined && typeof step.twice !== 'boolean') programError(scenario.id, 'Invalid submit step.'); break;
          case 'expect':
            if (step.screen !== undefined && !screens.has(step.screen)) programError(scenario.id, 'Expected screen does not exist.');
            if (step.field !== undefined && (!workflowId(step.field) || !['string', 'boolean'].includes(typeof step.value) || String(step.value).length > 16000)) programError(scenario.id, 'Invalid field assertion.');
            if (step.alert !== undefined && !workflowText(step.alert)) programError(scenario.id, 'Invalid alert assertion.');
            if (step.row !== undefined && !workflowText(step.row)) programError(scenario.id, 'Invalid row assertion.');
            for (const count of [step.count, step.stored]) if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) programError(scenario.id, 'Invalid row count.');
            if ([step.screen, step.field, step.alert, step.row, step.stored].every(value => value === undefined)) programError(scenario.id, 'An assertion must check an outcome.');
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
    case 'set_capability':
      if (!capabilities.includes(edit.capability) || typeof edit.enabled !== 'boolean') programError('Capability', 'Choose a capability and Boolean grant.');
      program.grants = program.grants.filter(grant => grant !== edit.capability);
      if (edit.enabled) program.grants.push(edit.capability);
      break;
    case 'set_csv_transform':
      if (edit.name === null) delete program.csvTransform;
      else program.csvTransform = edit.name;
      break;
  }
}

export function checkCapability(program: Program | undefined, capability: Capability) {
  if (program && !program.grants.includes(capability)) throw Error(`Capability denied · ${capability}`);
}

export function usedBlockLocks(program: Program | undefined) {
  if (!program) return {};
  const used = new Set<string>([...program.screens.map(screen => screen.view), ...program.flows.flatMap(flow => flow.steps.map(step => step.action))]);
  if (program.grants.includes('files.open')) used.add('open_file');
  if (program.grants.includes('files.export')) used.add('export_file');
  if (program.csvTransform) used.add('csv_transform');
  return Object.fromEntries(blockRegistry.filter(block => used.has(block.id)).map(block => [block.id, block.version]));
}

export interface FlowTrace {
  flow: string; step: string; action: Step['action']; outcome: 'passed' | 'failed' | 'cancelled';
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
      if (step.action === 'validate' || step.action === 'save') {
        const problem = recordProblem(collection, values);
        if (problem) throw Error(problem);
      }
      switch (step.action) {
        case 'validate': break;
        case 'set': values[step.field] = step.value; break;
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
