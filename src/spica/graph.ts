import { applyStyleEdit, styleTargets, validateAppearance, type Appearance, type StyleEdit } from './appearance';
import { allCollections, editProgram, usedBlockLocks, validateProgram, type Program, type ProgramEdit } from './program';

export type Value = string | boolean;
export type RecordValue = Value | number | null;
export type Preference =
  | { key: string; type: 'boolean'; initial: boolean }
  | { key: string; type: 'text'; initial: string }
  | { key: string; type: 'choice'; initial: string; choices: string[] };
export interface Page { id: string; label: string }
export interface Control {
  id: string;
  page: string;
  label: string;
  widget: 'toggle' | 'input' | 'select' | 'textarea';
  preference: string;
}
export type CollectionField =
  | { key: string; label: string; type: 'text'; initial: string; required?: boolean; multiline?: boolean }
  | { key: string; label: string; type: 'boolean'; initial: boolean; filter?: boolean }
  | { key: string; label: string; type: 'reference'; initial: null; collection: string };
export interface Collection {
  id: string;
  label: string;
  singular: string;
  recipeVersion: 1;
  fields: CollectionField[];
}
export type Recipe = 'blank' | 'settings' | 'notes' | 'tasks' | 'models';
export interface Graph {
  schema: 1;
  name: string;
  pages: Page[];
  preferences: Preference[];
  controls: Control[];
  collection?: Collection;
  collections?: Collection[];
  program?: Program;
  appearance?: Appearance;
}
export type GraphEdit =
  | { op: 'rename'; name: string }
  | { op: 'add_page'; id: string; label: string }
  | { op: 'add_setting'; page: string; key: string; label: string; type?: Preference['type']; initial: Value; choices?: string[]; multiline?: boolean }
  | { op: 'label_setting'; key: string; label: string }
  | { op: 'add_record_toggle'; key: string; label: string; initial: boolean; filter?: boolean }
  | { op: 'remove_setting'; key: string }
  | StyleEdit
  | ProgramEdit;

const widgetTypes = { toggle: 'boolean', input: 'text', textarea: 'text', select: 'choice' } as const;
const reserved = new Set(['__proto__', 'constructor', 'prototype']);
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(id) && !reserved.has(id);
const validLabel = (label: unknown): label is string => typeof label === 'string' && label.trim().length > 0 && label.length <= 80;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export class GraphEditError extends Error {}

function validateCollection(value: unknown): asserts value is Collection {
  if (!object(value) || !validId(value.id) || !validLabel(value.label) || !validLabel(value.singular) ||
      value.recipeVersion !== 1 || !Array.isArray(value.fields) || value.fields.length > 32) {
    throw Error('Invalid record collection.');
  }
  const keys = new Set<string>();
  for (const field of value.fields) {
    if (!object(field) || !validId(field.key) || keys.has(field.key) || !validLabel(field.label)) throw Error('Invalid or duplicate record field.');
    if (field.type === 'boolean') {
      if (typeof field.initial !== 'boolean' || (field.filter !== undefined && typeof field.filter !== 'boolean')) throw Error('A toggle needs a Boolean default and filter flag.');
    } else if (field.type === 'reference') {
      if (field.initial !== null || !validId(field.collection)) throw Error('A record reference needs a collection and a null default.');
    } else if (field.type !== 'text' || typeof field.initial !== 'string' || field.initial.length > 16000 ||
        (field.required !== undefined && typeof field.required !== 'boolean') ||
        (field.multiline !== undefined && typeof field.multiline !== 'boolean')) {
      throw Error('Invalid text field.');
    }
    keys.add(field.key);
  }
  if (!value.fields.some(field => field.key === 'title' && field.type === 'text' && field.required === true)) {
    throw Error('A collection needs a required text title.');
  }
}

function settingPreference(edit: Extract<GraphEdit, { op: 'add_setting' }>): Preference {
  const { key, initial, choices } = edit;
  const type = edit.type ?? (choices !== undefined ? 'choice' : typeof initial === 'boolean' ? 'boolean' : 'text');
  if (choices !== undefined && type !== 'choice') throw new GraphEditError('choices are only valid for a choice setting.');
  if (edit.multiline && type !== 'text') throw new GraphEditError('multiline is only valid for a text setting.');
  if (type === 'boolean') {
    if (typeof initial !== 'boolean') throw new GraphEditError('initial must be a JSON boolean for a toggle. Use true or false.');
    return { key, type, initial };
  }
  if (typeof initial !== 'string') throw new GraphEditError('initial must be a string for a text or choice setting.');
  if (type === 'text') {
    if (initial.length > 16000) throw new GraphEditError('initial text must contain at most 16,000 characters.');
    return { key, type, initial };
  }
  if (type !== 'choice' || !Array.isArray(choices) || choices.length < 2 || choices.length > 24 ||
      choices.some(choice => !validLabel(choice)) || new Set(choices).size !== choices.length) {
    throw new GraphEditError('A choice setting needs 2–24 distinct, nonempty choices.');
  }
  if (!choices.includes(initial)) throw new GraphEditError('initial must match one of the supplied choices.');
  return { key, type, initial, choices: [...choices] };
}

export function validPreferenceValue(preference: Preference, value: unknown): value is Value {
  switch (preference.type) {
    case 'boolean': return typeof value === 'boolean';
    case 'text': return typeof value === 'string' && value.length <= 16000;
    case 'choice': return typeof value === 'string' && preference.choices.includes(value);
  }
}

export function validateGraph(value: unknown): asserts value is Graph {
  if (!object(value) || value.schema !== 1 || !validLabel(value.name) ||
      !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 24 ||
      !Array.isArray(value.preferences) || value.preferences.length > 100 ||
      !Array.isArray(value.controls) || value.controls.length !== value.preferences.length) {
    throw Error('Invalid SPICA graph. Provide a name, one or more pages and up to 100 bound settings.');
  }
  const pages = new Set<string>();
  if (value.collection !== undefined) validateCollection(value.collection);
  if (value.collections !== undefined) {
    if (!value.collection || !Array.isArray(value.collections) || value.collections.length > 12) throw Error('Use at most 12 related collections.');
    value.collections.forEach(validateCollection);
  }
  const datasets = allCollections(value as unknown as Graph);
  const ids = new Set(datasets.map(collection => collection.id));
  if (ids.size !== datasets.length) throw Error('Collection IDs must be unique.');
  if (datasets.some(collection => collection.fields.some(field => field.type === 'reference' && !ids.has(field.collection)))) throw Error('A record reference targets a missing collection.');
  for (const page of value.pages) {
    if (!object(page) || !validId(page.id) || !validLabel(page.label) || pages.has(page.id)) throw Error('Invalid or duplicate page.');
    pages.add(page.id);
  }
  const preferences = new Map<string, Preference>();
  for (const p of value.preferences) {
    if (!object(p) || !validId(p.key) || preferences.has(p.key) || !['boolean', 'text', 'choice'].includes(String(p.type))) {
      throw Error('Invalid or duplicate preference.');
    }
    if (p.type === 'choice' && (!Array.isArray(p.choices) || p.choices.length < 2 || p.choices.length > 24 ||
        p.choices.some(c => !validLabel(c)) || new Set(p.choices).size !== p.choices.length)) {
      throw Error('A choice preference needs distinct options.');
    }
    const preference = p as unknown as Preference;
    if (!validPreferenceValue(preference, preference.initial)) throw Error('Invalid initial value for ' + p.key);
    preferences.set(p.key, preference);
  }
  const controls = new Set<string>();
  const bindings = new Set<string>();
  for (const control of value.controls) {
    if (!object(control) || !validId(control.id) || controls.has(control.id) || !validLabel(control.label) ||
        !validId(control.page) || !pages.has(control.page) || !validId(control.preference) || bindings.has(control.preference) ||
        typeof control.widget !== 'string' || !Object.hasOwn(widgetTypes, control.widget) ||
        preferences.get(control.preference)?.type !== widgetTypes[control.widget as Control['widget']]) {
      throw Error('A control must bind to a compatible, unique preference on an existing page.');
    }
    controls.add(control.id);
    bindings.add(control.preference);
  }
  if (value.program !== undefined) validateProgram(value as unknown as Graph, value.program);
  if (value.appearance !== undefined) validateAppearance(value as unknown as Graph, value.appearance);
  if (new TextEncoder().encode(JSON.stringify(value)).length > 512_000) throw Error('The graph exceeds 512 KB.');
}

export function changeGraph(graph: Graph, edits: readonly GraphEdit[]): Graph {
  if (!Array.isArray(edits) || !edits.length || edits.length > 24) throw new GraphEditError('Provide between 1 and 24 graph operations.');
  const next = structuredClone(graph);
  for (const edit of edits) {
    switch (edit.op) {
      case 'rename': next.name = edit.name; break;
      case 'install_recipe': case 'put_screen': case 'put_flow': case 'put_scenario': case 'set_capability': case 'set_csv_transform':
        try { editProgram(next, edit); }
        catch (error) { throw new GraphEditError(error instanceof Error ? error.message : String(error)); }
        break;
      case 'set_style':
        try { applyStyleEdit(next, edit); }
        catch (error) { throw new GraphEditError(error instanceof Error ? error.message : String(error)); }
        break;
      case 'add_page': next.pages.push({ id: edit.id, label: edit.label }); break;
      case 'add_setting': {
        const { key, page, label } = edit;
        if (!validId(key)) throw new GraphEditError('key must start with a lowercase letter and use up to 40 lowercase letters, digits or underscores.');
        if (next.preferences.some(preference => preference.key === key)) throw new GraphEditError('Preference key "' + key + '" already exists.');
        if (!next.pages.some(item => item.id === page)) throw new GraphEditError('page must be a saved page ID. Available IDs are ' + next.pages.map(item => item.id).join(', ') + '.');
        if (!validLabel(label)) throw new GraphEditError('label must be nonempty and contain at most 80 characters.');
        const preference = settingPreference(edit);
        next.preferences.push(preference);
        next.controls.push({
          id: key, page, label, preference: key,
          widget: preference.type === 'boolean' ? 'toggle' : preference.type === 'choice' ? 'select' : edit.multiline ? 'textarea' : 'input',
        });
        break;
      }
      case 'label_setting': {
        const control = next.controls.find(control => control.preference === edit.key);
        if (!control) throw new GraphEditError('No bound setting named ' + edit.key);
        control.label = edit.label;
        break;
      }
      case 'add_record_toggle': {
        if (!next.collection) throw new GraphEditError('This app has no record collection.');
        if (!validId(edit.key) || !validLabel(edit.label)) throw new GraphEditError('Use a lowercase field key and a nonempty label.');
        if (next.collection.fields.some(field => field.key === edit.key)) throw new GraphEditError('Record field "' + edit.key + '" already exists.');
        if (typeof edit.initial !== 'boolean') throw new GraphEditError('A record toggle needs a Boolean initial value.');
        next.collection.fields.push({ key: edit.key, label: edit.label, type: 'boolean', initial: edit.initial, ...(edit.filter ? { filter: true } : {}) });
        break;
      }
      case 'remove_setting': {
        if (!next.preferences.some(p => p.key === edit.key)) throw new GraphEditError('No preference named ' + edit.key);
        next.preferences = next.preferences.filter(p => p.key !== edit.key);
        next.controls = next.controls.filter(c => c.preference !== edit.key);
        const blocks = next.appearance?.blocks;
        if (blocks) {
          const ids = new Set(styleTargets(next).map(part => part.id));
          for (const id of Object.keys(blocks)) if (!ids.has(id)) delete blocks[id];
          if (!Object.keys(blocks).length) delete next.appearance!.blocks;
          if (!Object.keys(next.appearance!).length) delete next.appearance;
        }
        break;
      }
      default: throw new GraphEditError('Unsupported graph operation.');
    }
  }
  try { validateGraph(next); }
  catch (error) { throw new GraphEditError(error instanceof Error ? error.message : String(error)); }
  if (stableGraphJson(next) === stableGraphJson(graph)) throw new GraphEditError('The graph already has those values.');
  return next;
}

const collectionRecipes = {
  notes: { label: 'Notes', singular: 'note', body: 'Note' },
  tasks: { label: 'Tasks', singular: 'task', body: 'Details' },
} as const;

export function starterGraph(name: string, recipe: Recipe = 'blank'): Graph {
  const graph: Graph = { schema: 1, name, pages: [{ id: 'general', label: 'General' }], preferences: [], controls: [] };
  if (recipe === 'models') return changeGraph(graph, [{ op: 'install_recipe', recipe: 'model_organizer' }]);
  if (recipe === 'notes' || recipe === 'tasks') {
    const { label, singular, body } = collectionRecipes[recipe];
    graph.collection = { id: recipe, label, singular, recipeVersion: 1, fields: [
      { key: 'title', label: 'Title', type: 'text', initial: '', required: true },
      { key: 'body', label: body, type: 'text', initial: '', multiline: true },
      ...(recipe === 'tasks' ? [{ key: 'done', label: 'Completed', type: 'boolean', initial: false, filter: true } as const] : []),
    ] };
  }
  validateGraph(graph);
  return recipe !== 'settings' ? graph : changeGraph(graph, [
    { op: 'add_page', id: 'appearance', label: 'Appearance' },
    { op: 'add_setting', page: 'general', key: 'display_name', label: 'Display name', type: 'text', initial: '' },
    { op: 'add_setting', page: 'general', key: 'notifications', label: 'Enable notifications', type: 'boolean', initial: true },
    { op: 'add_setting', page: 'appearance', key: 'theme', label: 'Theme', type: 'choice', choices: ['System', 'Light', 'Dark'], initial: 'System' },
  ]);
}

/** Lower the validated authoring graph to the versioned, ordered runtime interface. */
export function compileGraph(graph: Graph) {
  validateGraph(graph);
  const definitions = new Map(graph.preferences.map(p => [p.key, p]));
  return {
    schema: graph.schema,
    name: graph.name,
    ...(graph.collection ? { collection: structuredClone(graph.collection) } : {}),
    ...(graph.collections ? { collections: structuredClone(graph.collections) } : {}),
    ...(graph.program ? { program: structuredClone(graph.program), blocks: usedBlockLocks(graph.program) } : {}),
    ...(graph.appearance ? { appearance: structuredClone(graph.appearance) } : {}),
    pages: graph.pages.map(page => ({
      ...page,
      controls: graph.controls.filter(c => c.page === page.id).map(c => ({
        id: c.id, label: c.label, widget: c.widget, definition: definitions.get(c.preference)!,
      })),
    })),
  };
}
export type AppPlan = ReturnType<typeof compileGraph>;

/** Native storage can reorder JSON object keys. Arrays keep their authored order. */
export function stableGraphJson(value: unknown, indent?: number): string {
  return JSON.stringify(value, (_key, item: unknown) => object(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item, indent);
}

export function collectionUpgrade(previous: Collection | undefined, next: Collection | undefined): CollectionField[] {
  if (!previous) return next?.fields ?? [];
  if (!next || previous.id !== next.id) throw Error('An exported collection must keep its storage identity.');
  for (const field of previous.fields) {
    const updated = next.fields.find(item => item.key === field.key);
    if (!updated || updated.type !== field.type || updated.initial !== field.initial ||
        (field.type === 'text' && updated.type === 'text' && Boolean(updated.required) !== Boolean(field.required)) ||
        (field.type === 'reference' && updated.type === 'reference' && updated.collection !== field.collection)) {
      throw Error('Collection field "' + field.key + '" must keep its storage contract.');
    }
  }
  const added = next.fields.filter(field => !previous.fields.some(item => item.key === field.key));
  if (added.some(field => field.type === 'text' && field.required && !field.initial.trim())) {
    throw Error('New required fields need a valid default for existing records.');
  }
  return added;
}
