/** Phase 05: small, state-aware SPICA tool contracts. No writes, no guessed capabilities. */
import type { Graph } from './graph';
import { allCollections } from './program';
import { capabilities, recipeCatalog } from './program';
import { styleProperties, styleStates } from './appearance';
import { spicaEditOperationSchema } from './edit-schemas';

const editOperations = ['install_recipe', 'add_collection', 'add_record_field', 'put_screen', 'put_flow',
  'put_scenario', 'set_start_screen', 'grant_capability', 'revoke_capability', 'set_style',
  'add_page', 'add_setting', 'label_setting', 'remove_setting', 'add_record_toggle', 'rename'] as const;
export type SpicaInspectableOperation = typeof editOperations[number];
const screenViews = ['list', 'form', 'review', 'table', 'models', 'game'] as const;
const fieldTypes = ['text', 'boolean', 'reference', 'number', 'choice'] as const;
const flowActions = ['validate', 'set', 'format', 'save', 'navigate', 'status'] as const;
const idRule = 'Start with a lowercase letter; then 0–39 lowercase letters, digits or underscores. Never use an existing ID for a new entity.';

export function inspectSpicaParameters(graph: Graph, revision: number, operation?: string, schema?: unknown) {
  const collections = allCollections(graph).map(collection => ({
    id: collection.id, label: collection.label,
    fields: collection.fields.map(field => ({ key: field.key, type: field.type, initial: field.initial,
      ...(field.type === 'reference' ? { collection: field.collection } : {}),
      ...(field.type === 'choice' ? { choices: field.choices } : {}) })),
  }));
  const screens = graph.program?.screens.map(screen => ({ id: screen.id, view: screen.view,
    ...('collection' in screen ? { collection: screen.collection } : {}) })) ?? [];
  const flows = graph.program?.flows.map(flow => ({ id: flow.id, collection: flow.collection })) ?? [];
  const identifiers = new Set([...collections.map(item => item.id), ...screens.map(item => item.id), ...flows.map(item => item.id)]);
  const fresh = (base: string) => {
    let id = base; let n = 2;
    while (identifiers.has(id)) id = `${base}_${n++}`;
    return id;
  };
  const record = collections[0];
  const collectionId = record?.id ?? 'notes';
  const availableFields = record?.fields.map(field => field.key) ?? ['title', 'body'];
  const flowId = flows.find(flow => flow.collection === collectionId)?.id ?? 'capture';
  const screenId = screens[0]?.id ?? 'records';
  const currentFields = new Set(record?.fields.map(field => field.key) ?? []);
  const preferences = new Set(graph.preferences.map(item => item.key));
  const freshKey = (base: string, known: ReadonlySet<string>) => {
    let key = base; let index = 2;
    while (known.has(key)) key = `${base}_${index++}`;
    return key;
  };
  const nextRecipe = recipeCatalog.find(item => !graph.program?.recipes[item.id]);
  const nextGrant = capabilities.find(item => !(graph.program?.grants ?? []).includes(item));
  const granted = graph.program?.grants[0];
  const examples: Record<SpicaInspectableOperation, Record<string, unknown>> = {
    install_recipe: { op: 'install_recipe', recipe: nextRecipe?.id ?? 'quick_capture' },
    add_collection: { op: 'add_collection', collection: { id: fresh('journal'), label: 'Journal', singular: 'Entry',
      fields: [{ key: 'title', label: 'Title', type: 'text', required: true }, { key: 'body', label: 'Body', type: 'text', multiline: true }] } },
    add_record_field: { op: 'add_record_field', collection: collectionId, field: { key: freshKey('archived', currentFields), label: 'Archived', type: 'boolean', initial: false } },
    put_screen: { op: 'put_screen', screen: { id: fresh('notes_search'), label: 'Search notes', view: 'list', collection: collectionId, query: '' } },
    put_flow: { op: 'put_flow', flow: { id: fresh('save_note'), collection: collectionId,
      steps: [{ id: 'validate_note', action: 'validate' }, { id: 'save_note_step', action: 'save' }, ...(screens.length ? [{ id: 'open_notes', action: 'navigate', screen: screenId }] : [])] } },
    put_scenario: { op: 'put_scenario', scenario: { id: fresh('smoke_notes'), label: 'Notes smoke test', steps: [{ action: 'screen', screen: screenId }, { action: 'expect', screen: screenId }] } },
    set_start_screen: { op: 'set_start_screen', screen: screenId },
    grant_capability: { op: 'grant_capability', capability: nextGrant ?? 'records.write' },
    revoke_capability: { op: 'revoke_capability', capability: granted ?? 'records.write' },
    set_style: { op: 'set_style', target: 'app', property: 'scheme', value: 'dark' },
    add_page: { op: 'add_page', id: fresh('preferences'), label: 'Preferences' },
    add_setting: { op: 'add_setting', page: graph.pages[0]?.id ?? 'general', key: freshKey('show_tips', preferences), label: 'Show tips', type: 'boolean', initial: true },
    label_setting: { op: 'label_setting', key: graph.preferences[0]?.key ?? 'theme', label: 'Updated label' },
    remove_setting: { op: 'remove_setting', key: graph.preferences[0]?.key ?? 'theme' },
    add_record_toggle: { op: 'add_record_toggle', key: freshKey('starred', currentFields), label: 'Starred', initial: false, filter: true },
    rename: { op: 'rename', name: 'Notes Organizer' },
  };
  const constraints: Record<SpicaInspectableOperation, string[]> = {
    install_recipe: ['Only registered recipes are installable.', 'Do not reinstall an already installed recipe.'],
    add_collection: ['collection must be an OBJECT, not a string.', 'Requires id, label, singular and fields.',
      'fields must include a required title field of type text.', `Supported field types: ${fieldTypes.join(', ')}. No date or string_array type.`,
      'Each field has unique key, label, type; initial defaults by type. Use add_record_field for existing collections.',
      'No more than 12 related collections, and no more than 32 fields per collection.'],
    add_record_field: ['collection must be an EXISTING collection ID string.', 'field must be an object with key,label,type.',
      'Do not add an existing field; duplicates are errors.', `Allowed types: ${fieldTypes.join(', ')}; choice needs 2–24 distinct choices.`,
      'Reference types require an existing target collection ID; number can have min and max.'],
    put_screen: [`Supported views: ${screenViews.join(', ')}. No settings view.`, 'screen is an OBJECT with id,label,view and (except game) an existing collection ID.',
      'For list: optional query (up to 256 chars), optional filter referencing a Boolean filter field.',
      'For form: fields must be collection FIELD KEY STRINGS and submit must name an existing flow in the same collection.',
      'For table: provide table.columns of existing keys. For game: provide a real scene.',
      'A settings page is made using add_page/add_setting in the preferences graph; do not invent screen.view="settings".'],
    put_flow: [`Each step.action must be one of: ${flowActions.join(', ')}.`,
      'flow uses an existing collection ID and an array of typed steps with unique step IDs.',
      'A navigate step requires an existing destination screen. A save step needs records.write grant.'],
    put_scenario: ['scenario needs id, label, and an array of supported actions.',
      'Protect existing scenarios; use a new ID rather than overwriting a verification scenario.'],
    set_start_screen: ['screen is an EXISTING screen ID string; do not pass a screen object.'],
    grant_capability: [`Only these capability IDs exist: ${capabilities.join(', ')}.`],
    revoke_capability: [`Only these capability IDs exist: ${capabilities.join(', ')}.`],
    set_style: [`Supported style states: ${styleStates.join(', ')}.`,
      `Supported property IDs: ${Object.keys(styleProperties).join(', ')}.`, 'Inspect the style target with read_spica_graph for exact properties and values.'],
    add_page: ['id must be new, label nonempty. A settings page is NOT a put_screen view.'],
    add_setting: ['page must be an existing page ID; key must be new.', 'type is boolean, text or choice; initial must match its type.', 'Choice types require a distinct list of choices and an initial that matches one.'],
    label_setting: ['key must already exist. Use label for the new user-visible text.'],
    remove_setting: ['key must already exist; removal may invalidate references.'],
    add_record_toggle: ['Only applies to the primary collection; key must not already exist.', 'initial must be a JSON boolean; optional filter is a Boolean.'],
    rename: ['name is the new nonempty application name.'],
  };
  const context = { revision, collectionIds: collections.map(x => x.id), collections, screens, flows,
    grants: graph.program?.grants ?? [], recipes: graph.program?.recipes ?? {}, availableRecipes: recipeCatalog.map(x => x.id),
    validIdRule: idRule, fieldTypes, screenViews, flowActions, capabilities };
  if (!operation) return { tool: 'edit_spica_graph', revision, operations: editOperations,
    workflow: ['read_spica_graph', 'inspect_params with operation', 'validate_spica_edit (dry run)', 'edit_spica_graph (save)', 'export_spica_app', 'verify_spica_app'],
    context, notes: 'Ask for one operation to receive its exact example, constraints and schema. No changes occur during inspection.' };
  if (!editOperations.includes(operation as SpicaInspectableOperation)) return { error: 'UNKNOWN_OPERATION',
    supported: editOperations, revision, message: 'Choose an operation returned by inspect_params.' };
  const op = operation as SpicaInspectableOperation;
  const allSchema = schema as { properties?: { edits?: { items?: { properties?: Record<string, unknown> } } } } | undefined;
  const allowed = allSchema?.properties?.edits?.items?.properties;
  const keys: Record<SpicaInspectableOperation, readonly string[]> = {
    install_recipe: ['recipe'], add_collection: ['collection'], add_record_field: ['collection', 'field'],
    put_screen: ['screen'], put_flow: ['flow'], put_scenario: ['scenario'], set_start_screen: ['screen'],
    grant_capability: ['capability'], revoke_capability: ['capability'], set_style: ['target','property','state','value'],
    add_page: ['id','label'], add_setting: ['page','key','label','type','initial','choices','multiline'],
    label_setting: ['key','label'], remove_setting: ['key'], add_record_toggle: ['key','label','initial','filter'], rename: ['name'],
  };
  const blockers: string[] = [];
  if (!record && ['add_record_field','put_screen','put_flow','add_record_toggle'].includes(op)) blockers.push('Create a collection first with add_collection or install a supported starter recipe.');
  if (!screens.length && ['put_scenario','set_start_screen'].includes(op)) blockers.push('Create a valid screen first with put_screen.');
  if (!graph.preferences.length && ['label_setting','remove_setting'].includes(op)) blockers.push('Add a setting before modifying or removing one.');
  if (!graph.pages.length && op === 'add_setting') blockers.push('Create a settings page first using add_page.');
  if (!nextRecipe && op === 'install_recipe') blockers.push('Every registered recipe is already installed.');
  if (!nextGrant && op === 'grant_capability') blockers.push('All supported capabilities are already granted.');
  if (!granted && op === 'revoke_capability') blockers.push('There are no granted capabilities to revoke.');
  if (graph.pages.length >= 24 && op === 'add_page') blockers.push('Settings page limit reached (24).');
  if (graph.preferences.length >= 100 && op === 'add_setting') blockers.push('Settings limit reached (100).');
  const sample = { revision, edits: [examples[op]] };
  return { tool: 'edit_spica_graph', operation: op, revision, available: blockers.length === 0,
    ...(blockers.length ? { blockers, example: null } : { example: sample }), constraints: constraints[op],
    schema: spicaEditOperationSchema('schema1',op) ?? Object.fromEntries(keys[op].map(key => [key, allowed?.[key] ?? { type: 'unknown' }])),
    context: { ...context, suggestedCollection: collectionId, suggestedFields: availableFields, suggestedFlow: flowId },
    next: 'validate_spica_edit', note: 'Example identifiers are illustrative, not proof an edit is necessary. Read context for existing IDs before saving.' };
}
