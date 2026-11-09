import type { AgentToolDefinition } from '../engine/tools';
import type { CreatorProject } from '../domain/types';
import type { CommandResult } from '../engine/intelligence/commands';
import { SpicaRepository, type SpicaRecord } from './repository';
import { changeGraph, collectionUpgrade, GraphEditError, type Graph, type GraphEdit } from './graph';
import { styleChanges, styleProperties, styleStates, styleTargets, styleValues, supportedProperties, supportedStates } from './appearance';
import { recipeCatalog } from './program';
import { inspectSpicaComponent, searchSpicaWarehouse } from './warehouse';

const define = (name: string, description: string, properties: Record<string, unknown> = {},
  required: string[] = []): AgentToolDefinition => ({
  type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
});
const revision = { type: 'integer', minimum: 1 };
const short = { type: 'string', minLength: 1, maxLength: 80 };
const warehouseId = { type: 'string', minLength: 1, maxLength: 120 };
export const spicaTools = [
  define('search_spica_warehouse', 'Search the bounded local index of implemented SPICA primitives and recipes. Results come from registered adapters only; draft documentation is never executable.', {
    query: { type: 'string', minLength: 1, maxLength: 200 },
    target: { type: 'string', enum: ['desktop', 'web'] },
    executableOnly: { type: 'boolean' },
    limit: { type: 'integer', minimum: 1, maximum: 12 },
  }, ['query']),
  define('inspect_spica_component', 'Inspect one exact ID and version returned by search_spica_warehouse, including real implementation, target, permission and graph-installation status.', {
    id: warehouseId,
    version: { type: 'string', minLength: 1, maxLength: 20 },
    target: { type: 'string', enum: ['desktop', 'web'] },
  }, ['id', 'version']),
  define('read_spica_graph', 'Read the authoritative graph revision and stable IDs. For appearance, use an optional target ID to read that block’s supported properties and saved styles.', { target: short }),
  define('edit_spica_graph', 'Apply an atomic graph edit at the current revision. set_style needs target, property and value. Use target app for theme or a block ID from the graph. add_record_toggle uses key, label, Boolean initial and optional filter:true. add_setting needs page, key, label and initial.', {
    revision,
    edits: { type: 'array', minItems: 1, maxItems: 12, items: {
      type: 'object', additionalProperties: false,
      properties: {
        op: { type: 'string', enum: ['set_style', 'add_record_toggle', 'add_setting', 'label_setting', 'remove_setting', 'add_page', 'rename'] },
        target: short,
        property: { type: 'string', enum: Object.keys(styleProperties) },
        state: { type: 'string', enum: styleStates, description: 'Optional. Defaults to base.' },
        value: { type: ['string', 'integer', 'null'], maxLength: 24, description: 'Use #rrggbb colors, integer pixels, a supported option, or null to inherit.' },
        page: short, id: short, key: { ...short, maxLength: 40 }, label: short, name: short,
        type: { type: 'string', enum: ['boolean', 'text', 'choice'] },
        initial: { type: ['string', 'boolean'], maxLength: 16000, description: 'Required for add_setting. Use false or true for a toggle.' },
        choices: { type: 'array', maxItems: 24, items: short },
        multiline: { type: 'boolean' },
        filter: { type: 'boolean', description: 'Show a list filter for this record toggle.' },
      },
      required: ['op'],
    } },
  }, ['revision', 'edits']),
  define('export_spica_app', 'Compile this graph revision and apply its managed files to the linked folder. Stops on drift and preserves custom source.', { revision }, ['revision']),
  define('verify_spica_app', 'Run the frontend build, native SQLite tests and standalone Tauri executable build for this exported revision. Check the actual result and report any blocker.', { revision }, ['revision']),
];
export const spicaToolNames = new Set(spicaTools.map(tool => tool.function.name));

const programEdit = define('edit_spica_graph', 'Apply a revision-checked behavior edit. install_recipe quick_capture installs Quick Capture, Pinned, and a protected runtime test. put_flow replaces a flow using its exact ID and ordered steps. put_screen connects a list or form. set_capability changes a named grant.', {
  revision,
  edits: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'object', additionalProperties: false,
    properties: {
      op: { type: 'string', enum: ['install_recipe', 'put_screen', 'put_flow', 'set_capability'] },
      recipe: { type: 'string', enum: recipeCatalog.map(recipe => recipe.id) },
      screen: { type: 'object' }, flow: { type: 'object' }, capability: short, enabled: { type: 'boolean' },
    }, required: ['op'] } },
}, ['revision', 'edits']);

export function isSpicaProgramRequest(message: string) {
  return /^(?:please\s+)?(?:add|build|connect|create|develop|edit|fix|install|make|repair|restore|run|test|verify|change)\b/i.test(message.trim()) &&
    /\b(?:quick capture|notebooks?|model organizer|spica (?:flow|screen|scenario|recipe)|save (?:connection|flow)|runtime scenario|reusable (?:spica )?(?:blocks?|components?)|(?:build|create|make|develop) (?:a|an) (?:records?|notes?|tasks?|model|stl) app)\b/i.test(message);
}

export function isSpicaStyleRequest(message: string): boolean {
  const request = message.trim().replace(/^(?:(?:can|could|would) you\s+)?(?:please[, ]+)?/i, '');
  if (/^(?:give|show) me\b.*\b(?:ideas|suggestions|examples|recommendations)\b/i.test(request)) return false;
  if (/^(?:style|restyle|recolou?r|theme)\b/i.test(request)) return true;
  return /^(?:give|make|set|use|apply|change|edit|update|adjust|tweak|round|colou?r)\b/i.test(request) &&
    (/\b(?:theme|palette|accent|typography|font|radius|padding|border|spacing|hover|keyboard focus|style|styling)\b/i.test(request) ||
    (/\b(?:app|notes|tasks|button|sidebar|field|input|panel|editor)\b/i.test(request) && /\b(?:background|colou?r|charcoal|dark|light|round(?:ed)?|red|green|blue|amber|gold|purple|pink|teal|black|white)\b/i.test(request)));
}

function appearanceSummary(graph: Graph, id?: string) {
  const targets = styleTargets(graph);
  const selected = id ? targets.find(part => part.id === id) : undefined;
  if (id && !selected) return { diagnostic: `Unknown style target ${id}. Call read_spica_graph without target for the IDs.` };
  if (selected) return { target: selected.id, label: selected.label, states: Object.fromEntries(supportedStates(selected).map(state => [state, {
    values: styleValues(graph.appearance, selected.id, state),
    properties: Object.fromEntries(supportedProperties(selected, state).map(key => [key, styleProperties[key]])),
  }])) };
  return {
    theme: graph.appearance?.theme ?? {},
    themeProperties: supportedProperties(targets[0]!, 'base').join(', '),
    targets: targets.filter(part => !/^(?:record-(?:field|input)-|setting-(?:field|input)-|settings-tab-)/.test(part.id)).map(part => part.id).join(', '),
    ...(graph.collection ? { fields: 'Use record-field-KEY for a label/group and record-input-KEY for its control.' } : {}),
    ...(!graph.collection || graph.controls.length ? { settings: 'Use settings-tab-PAGE, setting-field-ID or setting-input-ID.' } : {}),
    guide: 'Use set_style, target, property and value. For app: scheme=system/light/dark, layout=responsive/stacked. Colors are #rrggbb. Use font=system/sans/serif/mono and integer pixel values for sizes. Block defaults use background, text, border, radius and padding. For interactive states use hover, focus or selected if supported. Read a target for details.',
  };
}

/** Stable across JSON field order. The revision is part of the precondition. */
export function spicaEditSignature(args: Record<string, unknown>): string {
  const edits = (args.edits as Record<string, unknown>[]).map(edit =>
    Object.fromEntries(Object.entries(edit).sort(([left], [right]) => left.localeCompare(right))));
  return JSON.stringify([args.revision, edits]);
}

export type SpicaEditResult =
  | { saved: true; revision: number; next: 'export_spica_app' }
  | { saved: false; revision: number; code: 'STALE_GRAPH' | 'INVALID_GRAPH_EDIT'; message: string };

export function reviewSpicaEdit(current: SpicaRecord | null, args: Record<string, unknown>):
  { ok: true; args: Record<string, unknown> } | { ok: false; result: Extract<SpicaEditResult, { saved: false }> } {
  const revision = current?.data.revision ?? 0;
  if (!current || revision !== args.revision) return { ok: false, result: {
    saved: false, revision, code: 'STALE_GRAPH', message: 'Graph revision changed. Call read_spica_graph before editing.',
  } };
  try {
    const next = changeGraph(current.data.graph, args.edits as GraphEdit[]);
    const fields = collectionUpgrade(current.data.graph.collection, next.collection);
    const appearance = styleChanges(current.data.graph, next);
    const behavior = args.edits && (args.edits as GraphEdit[]).some(edit => ['install_recipe', 'put_screen', 'put_flow', 'set_capability'].includes(edit.op));
    if (!fields.length && !appearance.length && !behavior) return { ok: true, args };
    return { ok: true, args: { ...args, review: {
      graph: { fromRevision: current.data.revision, toRevision: current.data.revision + 1, collection: next.collection?.id, addedFields: fields },
      ...(appearance.length ? { appearance } : {}),
      ...(behavior ? { behavior: { screens: next.program?.screens, flows: next.program?.flows, grants: next.program?.grants } } : {}),
      ...(fields.length ? { database: 'On first launch of the new standalone build, backfill the listed defaults on existing records in one SQLite transaction.' } : {}),
    } } };
  } catch (error) {
    return { ok: false, result: { saved: false, revision, code: 'INVALID_GRAPH_EDIT', message: error instanceof Error ? error.message : String(error) } };
  }
}

export function selectSpicaTools(allowed: readonly AgentToolDefinition[], last: string | null, needsEdit: boolean, verified: boolean, appearance = false, program = false) {
  const names = verified ? [] : !last ? program ? ['search_spica_warehouse'] : ['read_spica_graph'] :
    last === 'search_spica_warehouse' ? ['inspect_spica_component', 'read_spica_graph'] :
    last === 'inspect_spica_component' ? ['read_spica_graph'] :
    last === 'read_spica_graph' ? (needsEdit ? appearance || program ? ['edit_spica_graph', 'read_spica_graph'] : ['edit_spica_graph'] : ['export_spica_app', 'verify_spica_app']) :
    last === 'edit_spica_graph' ? ['export_spica_app', 'read_spica_graph'] :
    last === 'export_spica_app' ? ['verify_spica_app', 'read_spica_graph'] :
    ['read_command_output', 'read_spica_graph', 'report_project_blocker'];
  return names.flatMap(name => allowed.filter(tool => tool.function.name === name)
    .map(tool => program && !appearance && name === 'edit_spica_graph' ? programEdit : tool));
}

export async function executeSpicaTool(name: string, args: Record<string, unknown>, project: CreatorProject,
  execution: {
    signal?: AbortSignal; webEnabled: boolean; spicaNeedsEdit?: boolean; spicaStyle?: boolean; spicaProgram?: boolean;
    onCommandResult?: (result: CommandResult) => void;
  },
  onOutput?: (stream: 'stdout' | 'stderr', chunk: string) => void): Promise<string> {
  if (execution.signal?.aborted) throw new DOMException('Stopped', 'AbortError');
  const repo = new SpicaRepository(project.id);
  const current = await repo.read();
  if (!current) throw Error('This project has no saved SPICA graph.');
  if (name === 'search_spica_warehouse') {
    if (typeof args.query !== 'string') throw Error('Warehouse search query must be text.');
    if (args.target !== undefined && args.target !== 'desktop' && args.target !== 'web') throw Error('Warehouse target must be desktop or web.');
    if (args.executableOnly !== undefined && typeof args.executableOnly !== 'boolean') throw Error('executableOnly must be a Boolean.');
    if (args.limit !== undefined && typeof args.limit !== 'number') throw Error('Warehouse limit must be a number.');
    return JSON.stringify(searchSpicaWarehouse(current.data.graph, {
      query: args.query,
      ...(args.target ? { target: args.target } : {}),
      ...(args.executableOnly !== undefined ? { executableOnly: args.executableOnly } : {}),
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
    }));
  }
  if (name === 'inspect_spica_component') {
    if (typeof args.id !== 'string' || typeof args.version !== 'string') throw Error('Provide an exact component ID and version from warehouse search.');
    if (args.target !== undefined && args.target !== 'desktop' && args.target !== 'web') throw Error('Warehouse target must be desktop or web.');
    return JSON.stringify(inspectSpicaComponent(current.data.graph, args.id, args.version, args.target));
  }
  if (name === 'read_spica_graph') {
    const graph = current.data.graph;
    const latest = execution.spicaProgram ? await (await import('./export')).latestSpicaBuild(project.id) : null;
    const failed = latest?.revision === current.data.revision && latest.root === project.folder
      ? latest.runtime?.flatMap(run => run.reports).find(report => report.state === 'failed') : undefined;
    return JSON.stringify({
    revision: current.data.revision, name: current.title, pages: current.data.graph.pages,
    collection: current.data.graph.collection,
    settings: current.data.graph.controls.map(c => ({ id: c.id, label: c.label, page: c.page, key: c.preference, widget: c.widget })),
    ...(execution.spicaStyle ? { appearance: appearanceSummary(graph, args.target as string | undefined) } : {}),
    ...(execution.spicaProgram ? { behavior: {
      recipes: graph.program?.recipes ?? {}, availableRecipes: recipeCatalog.map(recipe => recipe.id),
      screens: graph.program?.screens.slice(0, 12), flows: args.target ? graph.program?.flows.filter(flow => flow.id === args.target) : graph.program?.flows.slice(0, 3),
      grants: graph.program?.grants, failed,
    } } : {}),
  }); }
  if (name === 'edit_spica_graph') {
    const revision = current.data.revision;
    if (args.revision !== revision) return JSON.stringify({
      saved: false, revision, code: 'STALE_GRAPH', message: 'Graph revision changed. Call read_spica_graph before editing.',
    } satisfies SpicaEditResult);
    try {
      const saved = await repo.update(revision, args.edits as GraphEdit[]);
      return JSON.stringify({ saved: true, revision: saved.data.revision, next: 'export_spica_app' } satisfies SpicaEditResult);
    } catch (error) {
      if (!(error instanceof GraphEditError)) throw error;
      return JSON.stringify({ saved: false, revision, code: 'INVALID_GRAPH_EDIT', message: error.message } satisfies SpicaEditResult);
    }
  }
  if (args.revision !== current.data.revision) throw Error('Graph revision changed. Read the current graph.');
  if (!project.folder) throw Error('Link a standalone output folder first.');
  if (execution.spicaNeedsEdit) throw Error('Apply the requested graph edit first.');
  const { exportSpica, verifySpica } = await import('./export');
  if (name === 'export_spica_app') return JSON.stringify({
    revision: current.data.revision, files: await exportSpica(project.folder, current), next: 'verify_spica_app',
  });
  if (name !== 'verify_spica_app') throw Error('Unknown SPICA operation.');
  const evidence = await verifySpica(project.folder, current, execution.webEnabled,
    execution.signal ?? new AbortController().signal, ({ stream, chunk }) => onOutput?.(stream, chunk), execution.onCommandResult);
  return JSON.stringify({
    ok: evidence.state === 'passed', state: evidence.state, revision: evidence.revision, source: evidence.source,
    diagnostic: evidence.diagnostic, runtime: evidence.runtime, checks: evidence.checks.map(result => ({
      id: result.command_id, exitCode: result.exit_code, runId: result.run_id,
      ...(result.exit_code === 0 ? {} : { diagnostic: (result.stderr.slice(-500) + '\n' + result.stdout.slice(-1000)).trim() }),
    })),
  });
}
