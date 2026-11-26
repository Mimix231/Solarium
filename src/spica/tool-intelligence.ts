/** Structural view of the registered agent tool declaration; no separate source of schemas. */
export interface SpicaInspectableTool {
  type: 'function'; function: { name: string; description: string;
    parameters: { type: 'object'; properties: Record<string,unknown>; required?: readonly string[]; additionalProperties?: boolean } };
}
import { getRuntimeBlock } from './runtime/registry';
import { aliasNamesForTool, resolveSpicaToolName } from './tool-aliases';
import { ToolContractRegistry, ToolDependencyGraph, type ToolPrerequisite } from '../engine/intelligence/tool-contract-intelligence';
import { spicaTypeAssignable } from './graph-v2/validation';

/** One inspectable registry: schemas are sourced from the SAME advertised tool definitions.
 * Capability entries never grant permissions or execute work. */
export type SpicaToolStage = 'discover' | 'inspect' | 'validate' | 'edit' | 'execute' | 'export' | 'verify';
const stageByTool: Readonly<Record<string, SpicaToolStage>> = {
  list_solarium_tools:'discover',inspect_solarium_tool:'inspect',inspect_spica_identifier:'inspect', spica_next_action:'inspect', list_spica_toolchain: 'discover', inspect_spica_tool: 'inspect', check_spica_tool_call: 'validate', inspect_spica_wiring: 'inspect',
  create_spica_app: 'edit', read_spica_graph: 'inspect', edit_spica_graph: 'edit', inspect_params: 'inspect',
  validate_spica_edit: 'validate', search_spica_warehouse: 'discover', inspect_spica_component: 'inspect',
  search_spica_catalog: 'discover', inspect_spica_catalog: 'inspect', list_spica_categories: 'discover',
  resolve_spica_capabilities:'discover', search_spica_runtime_blocks: 'discover', inspect_spica_runtime_block: 'inspect', inspect_spica_runtime_blocks: 'inspect', list_spica_runtime_blocks: 'discover',
  validate_spica_composition: 'validate', compose_spica_v2_graph: 'edit', run_spica_v2_graph: 'execute',run_spica_graph:'execute',
migrate_spica_v2_graph: 'edit', history_spica_v2_graph: 'edit',
  inspect_spica_target: 'inspect', export_spica_app: 'export', prepare_spica_app: 'verify', verify_spica_app: 'verify', inspect_spica_build: 'inspect',
  audit_spica_ui: 'validate',inspect_spica_graph_impact:'inspect',run_spica_behavior_checks:'verify',inspect_spica_registry_health:'validate',
  spica_research_status:'inspect',spica_research_search:'discover',spica_research_read:'inspect',
  spica_research_links:'inspect',spica_research_follow:'inspect',spica_research_compare:'validate',
  spica_research_claim:'validate',spica_research_next:'inspect',spica_research_save:'edit',spica_research_stop:'inspect',
};
const dependencyTable: readonly ToolPrerequisite[] = [
  {tool:'edit_spica_graph',requires:['inspect_params','validate_spica_edit'],stage:'edit'},
  {tool:'migrate_spica_v2_graph',requires:['read_spica_graph'],stage:'edit'},
  {tool:'compose_spica_v2_graph',requires:['inspect_spica_wiring','validate_spica_composition'],stage:'edit'},
  {tool:'run_spica_v2_graph',requires:['compose_spica_v2_graph'],stage:'execute'},
  {tool:'run_spica_graph',requires:['edit_spica_graph'],stage:'execute'},
  {tool:'export_spica_app',requires:['inspect_spica_target'],stage:'export'},
  {tool:'verify_spica_app',requires:['export_spica_app','prepare_spica_app'],stage:'verify'},
];
function dependencies(definitions: readonly SpicaInspectableTool[]) {
  const registry=new ToolContractRegistry(definitions);
  const present=dependencyTable.filter(entry=>registry.get(entry.tool)&&entry.requires.every(name=>registry.get(name)));
  return new ToolDependencyGraph(present,registry);
}
const needsGraph = new Set(['read_spica_graph','edit_spica_graph','inspect_params','validate_spica_edit',
'migrate_spica_v2_graph','history_spica_v2_graph',
  'validate_spica_composition','compose_spica_v2_graph','run_spica_v2_graph','run_spica_graph','inspect_spica_graph_impact','run_spica_behavior_checks',
  'export_spica_app','prepare_spica_app','verify_spica_app','inspect_spica_build','audit_spica_ui']);
const needsV2 = new Set(['inspect_spica_graph_impact','run_spica_behavior_checks','history_spica_v2_graph','validate_spica_composition',
  'compose_spica_v2_graph','run_spica_v2_graph','run_spica_graph']);
const needsFolder = new Set(['create_spica_app','export_spica_app','prepare_spica_app','verify_spica_app']);
const requiresRevision = new Set(['inspect_spica_graph_impact','run_spica_behavior_checks','edit_spica_graph','validate_spica_edit','migrate_spica_v2_graph',
  'history_spica_v2_graph','validate_spica_composition',
  'compose_spica_v2_graph','run_spica_v2_graph','run_spica_graph','export_spica_app','prepare_spica_app','verify_spica_app']);
const mutating = new Set(['spica_research_save','create_spica_app','edit_spica_graph','migrate_spica_v2_graph',
  'history_spica_v2_graph','compose_spica_v2_graph','run_spica_v2_graph','run_spica_graph',
  'export_spica_app','prepare_spica_app','verify_spica_app']);
export interface SpicaToolEnvironment {
  hasGraph: boolean; hasV2: boolean; revision: number | null; linkedFolder: boolean;
}
export function spicaToolPrerequisites(name: string, state: SpicaToolEnvironment): string[] {
  const missing: string[] = [];
  name=resolveSpicaToolName(name);
  if (name === 'create_spica_app' && state.hasGraph) missing.push('Project already has a graph: use read_spica_graph.');
  if (needsGraph.has(name) && !state.hasGraph) missing.push('A project graph is required: create_spica_app.');
  if (needsV2.has(name) && !state.hasV2) missing.push('Graph migration required: edit_spica_graph with view:v2, edits:[{op:migrate_graph}].');
  if (needsFolder.has(name) && !state.linkedFolder) missing.push('Link a real project output folder first.');
  return missing;
}
/** Legacy callable names remain executable for archived tasks, but new Sparks
 * discover a single canonical graph-edit/read/execute API. This is an API
 * compatibility mapping, not a second implementation or block alias. */
export const legacySpicaToolAliases: Readonly<Record<string,string>> = {
  migrate_spica_v2_graph:'edit_spica_graph',
  compose_spica_v2_graph:'edit_spica_graph',
  history_spica_v2_graph:'edit_spica_graph',
  run_spica_v2_graph:'run_spica_graph',
};
export function listSpicaToolchain(definitions: readonly SpicaInspectableTool[], state: SpicaToolEnvironment) {
  const graph=dependencies(definitions);
  return { revision: state.revision, hasGraph: state.hasGraph, hasV2: state.hasV2,
    actions: definitions.filter(d=>!legacySpicaToolAliases[d.function.name]).map(d => ({ name: d.function.name, stage: stageByTool[d.function.name] ?? 'inspect',
      required: d.function.parameters.required ?? [], parameters: Object.keys(d.function.parameters.properties),aliases:aliasNamesForTool(d.function.name),
      mutatesOrExecutes: mutating.has(d.function.name), missingPrerequisites: spicaToolPrerequisites(d.function.name, state),
      toolDependencies:graph.inspect(d.function.name)?.requires ?? [] })),
    workflow: ['spica_next_action','resolve_spica_capabilities','list_spica_toolchain', 'inspect_spica_tool', 'search_spica_runtime_blocks',
      'inspect_spica_runtime_block', 'inspect_spica_wiring', 'check_spica_tool_call',
      'validate_spica_composition', 'edit_spica_graph', 'run_spica_graph'],
    compatibilityAliases:legacySpicaToolAliases,
    namespaces: {tools:'Callable function names only (e.g. inspect_spica_runtime_block)',blocks:'Data IDs spica.runtime.* passed as the id ARGUMENT, never as the tool name'},
    instruction: 'Discovery is not execution. Read each tool schema and prerequisites BEFORE sending its arguments. Do not guess unsupported IDs or types.' };
}
export function inspectSpicaTool(definitions: readonly SpicaInspectableTool[], name: string, state: SpicaToolEnvironment) {
  const requestedName=name;
  name=resolveSpicaToolName(name);
  const definition = definitions.find(d => d.function.name === name);
  if (!definition) return name.startsWith('spica.runtime.') ? {
    ok:false, code:'BLOCK_ID_NOT_TOOL', name,
    message:'A block identifier is data, not a callable tool name.',
    nextTool:'inspect_spica_runtime_block', nextArguments:{id:name,version:'1'},
  } : {ok:false,code:'UNKNOWN_TOOL',name,availableNames:definitions.map(d=>d.function.name)};
  return { ok: true, name,requestedName,aliases:aliasNamesForTool(name), description: definition.function.description,
    toolDependencies: dependencies(definitions).inspect(name)?.requires ?? [],
    stage: stageByTool[name] ?? 'inspect', schema: definition.function.parameters,
    required: definition.function.parameters.required ?? [],
    mutatesOrExecutes: mutating.has(name), missingPrerequisites: spicaToolPrerequisites(name, state),
    revision: requiresRevision.has(name) ? state.revision : undefined,
    preflight: name === 'check_spica_tool_call' ? null : 'check_spica_tool_call',
    note: 'Use only the documented parameters; verified alternate tool spellings normalize to this canonical contract; no automatic retries are performed.' };
}

/** Inspect wiring from actual immutable runtime block ports and strict graph type assignability. */
export function inspectSpicaWiring(ids: readonly string[], target: 'desktop'|'web' = 'desktop') {
  if (!ids.length || ids.length > 12 || new Set(ids).size !== ids.length) {
    throw Error('Provide 1–12 unique executable block IDs.');
  }
  const blocks = ids.map(id => {
    const block = getRuntimeBlock(id, '1');
    if (!block) throw Error(`Unknown executable block ${id}. Search the runtime registry first.`);
    if (!block.targets.includes(target)) throw Error(`${id} does not support ${target}.`);
    return block;
  });
  const compatible: Array<{ from: string; output: string; to: string; input: string }> = [];
  const missing: Array<{ blockId: string; input: string; expected: unknown }> = [];
  for (const dest of blocks) for (const input of dest.inputs.filter(p => p.required)) {
    let found = false;
    for (const source of blocks) if (source !== dest) for (const output of source.outputs) {
      if (!spicaTypeAssignable(output.type, input.type)) continue;
      found = true;
      if (compatible.length < 72) compatible.push({ from: source.id, output: output.id, to: dest.id, input: input.id });
    }
    if (!found) missing.push({ blockId: dest.id, input: input.id, expected: input.type });
  }
  return { target, blocks: blocks.map(block => ({ id: block.id, version: block.version,
    category: block.category, inputs: block.inputs, outputs: block.outputs,
    exampleConfig: block.exampleConfig ?? {}, permissions: block.permissions })),
    compatible, missingRequiredInputs: missing,
    note: 'These are type-compatible CANDIDATES, not a completed graph. Choose node IDs, inspect configurations, and validate_spica_composition before saving.' };
}

/** State-derived tool guidance; never executes or guesses feature implementation. */
export function nextSpicaAction(definitions: readonly SpicaInspectableTool[], state: SpicaToolEnvironment,
  stage: unknown = 'general', target: unknown = 'desktop') {
  const selected = target === 'web' ? 'web' : 'desktop';
  let name:string, args:Record<string,unknown>;
  if (!state.hasGraph) { name='create_spica_app';args={name:'New application',recipe:'blank'}; }
  else if (stage === 'compose' || stage === 'general') {
    if (!state.hasV2) {name='edit_spica_graph';args={revision:state.revision,view:'v2',edits:[{op:'migrate_graph'}]};}
    else {name='resolve_spica_capabilities';args={queries:['UI components','data records','formatting'],target:selected,limitPerQuery:3};}
  } else if (stage === 'edit') {name='inspect_params';args={view:state.hasV2?'v2':'schema1'};}
  else if (stage === 'export') {name='inspect_spica_target';args={target:selected};}
  else if (stage === 'verify') {name='inspect_spica_build';args={};}
  else {name='read_spica_graph';args={view:'both'};}
  const tool=definitions.find(item=>item.function.name===name);
  const needsApproval=mutating.has(name);
  return {ok:Boolean(tool),kind:'tool-guidance',graph:state,
    nextTool:name,nextArguments:args,registered:Boolean(tool),
    ...(tool?{required:tool.function.parameters.required??[],schema:tool.function.parameters}:{}),
    ...(needsApproval?{preflightTool:'check_spica_tool_call',
      preflightArguments:{name,arguments:args},mustInspectToolFirst:true}:{}),
    explanation:needsApproval?'Call inspect_spica_tool for the named callable tool, then preflight its final arguments. Do not pass a block ID as a tool name.':
      'Call the listed tool with these exact argument keys; choose the useful query and block IDs from real registered results.'};
}
