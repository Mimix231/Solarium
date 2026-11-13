import type { AgentToolDefinition } from '../engine/tools';
import type { CreatorProject } from '../domain/types';
import type { CommandResult } from '../engine/intelligence/commands';
import { inspectProjectEnvironment } from '../engine/creator';
import { SpicaRepository, type SpicaRecord } from './repository';
import { changeGraph, collectionUpgrade, GraphEditError, stableGraphJson, type Graph, type GraphEdit } from './graph';
import { styleChanges, styleProperties, styleTargets, styleValues, supportedProperties, supportedStates } from './appearance';
import { recipeCatalog } from './program';
import type { Recipe } from './graph';
import { validateSpicaGraphV2 } from './graph-v2/validation';
import { applySpicaGraphTransaction } from './graph-v2/transactions';
import { expandSpicaV2Edits } from './graph-v2/edit-adapter';
import { getRuntimeBlock } from './runtime/registry';
import { getBlock } from './runtime/blocks/registry';
import { unifiedSpicaEditParameters, spicaScopedEditParameters, v1EditOperations, v2EditOperations, validEditOperations, type SpicaEditScope } from './edit-schemas';
import { validateToolArguments } from '../engine/intelligence/tool-validation';
import { inspectSpicaComponent, searchSpicaWarehouse, registeredWarehouseCounts } from './warehouse';
import { listRuntimeBlocks } from './runtime/registry';
import { searchExecutableBlocks, inspectExecutableBlock } from './runtime/discovery';
import { previewSpicaComposition, type SpicaComposition } from './runtime/composition';
import { executeSpicaGraphV2 } from './runtime/executor';
import type { SpicaRuntimePermission } from './runtime/adapter';
import { inspectSpicaParameters } from './inspect-params';
import { inspectSpicaV2Parameters } from './inspect-params-v2';
import type { SpicaToolEnvironment } from './tool-intelligence';
import { ToolContractRegistry, ToolCallValidator } from '../engine/intelligence/tool-contract-intelligence';
import { inspectSpicaCapability, searchSpicaCapabilities } from './catalog/unified';
import { listCatalogCategories } from './catalog/client';
import { warehouseCategories, warehouseCapacity } from './catalog/categories';
import { auditSpicaDesign } from './professionalism';
import { spicaResearchTools } from './research-tools';

const define = (name: string, description: string, properties: Record<string, unknown> = {},
  required: string[] = []): AgentToolDefinition => ({
  type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } },
});
const revision = { type: 'integer', minimum: 1 };
const short = { type: 'string', minLength: 1, maxLength: 80 };
const warehouseId = { type: 'string', minLength: 1, maxLength: 120 };
export const spicaTools = [
  ...spicaResearchTools,
  define('list_solarium_tools', 'READ ONLY: page through ALL actual registered Solarium callable tool definitions. Returns exact tool names, required arguments and availability. Block IDs are never callable tools.', {
    offset:{type:'integer',minimum:0,maximum:100000},limit:{type:'integer',minimum:1,maximum:150},query:{type:'string',maxLength:100},
  }),
  define('inspect_solarium_tool', 'READ ONLY: inspect the exact registered JSON schema for a named Solarium tool, including non-SPICA coding, source and web tools.', {name:{type:'string',minLength:1,maxLength:100}}, ['name']),
  define('inspect_spica_identifier', 'READ ONLY: determine whether an exact ID is a CALLABLE tool or an executable block. Returns the correct inspector and its required arguments; never treats a block ID as a tool.', { id:warehouseId }, ['id']),
  define('list_spica_toolchain', 'READ ONLY: discover CALLABLE tools and exact accepted parameters in one paginated response. Filter by stage, and set includeSchemas:true to receive the same strict JSON contracts used by dispatch. Block IDs are data, not callable functions.', {
    query:{type:'string',maxLength:100},
    stage:{type:'string',enum:['discover','inspect','validate','edit','execute','export','verify']},
    offset:{type:'integer',minimum:0,maximum:1000},limit:{type:'integer',minimum:1,maximum:60},
    includeSchemas:{type:'boolean',description:'Include exact parameter schemas for returned registered tools, including required and optional fields.'},
  }),
  define('spica_next_action', 'READ ONLY: inspect the saved graph and return a concrete next registered tool and exact arguments for the selected stage. No generated feature plans or hidden execution.', {stage:{type:'string',enum:['compose','edit','export','verify','general']},target:{type:'string',enum:['desktop','web']}}),
  define('inspect_spica_tool', 'READ ONLY: inspect a registered tool OR executable spica.runtime.* block by identifier. For blocks this returns actual typed ports and exampleConfig; blocks are NEVER callable tools. For graph edits supply operation for exact contracts.', {
    name: {type:'string',minLength:1,maxLength:100}, operation:{type:'string',minLength:1,maxLength:80},
    view:{type:'string',enum:['schema1','v2'],description:'Graph format when inspecting an editing operation.'},
    arguments:{type:'object',description:'Optional proposed arguments to inspect against the same registered schema; this does not execute or save.'},
  }, ['name']),
  define('check_spica_tool_call', 'READ ONLY: check a proposed SPICA tool call against the SAME registered schema used at execution, current graph revision, and graph/port validation. Returns actionable violations without writing. You must inspect the contract first.', {
    name: {type:'string',minLength:1,maxLength:100},
    arguments: {type:'object',description:'Exact JSON arguments to submit to the named tool, preserving its key names and types.'},
  }, ['name','arguments']),
  define('inspect_spica_wiring', 'READ ONLY: show exact typed ports and compatible output-to-input pairs for chosen executable V2 blocks. No graph edits are performed.', {
    blockIds:{type:'array',minItems:1,maxItems:12,items:warehouseId}, target:{type:'string',enum:['desktop','web']},
  }, ['blockIds']),
  define('create_spica_app', 'Create a real schema-1 SPICA application in the linked empty project folder. For notes, tasks, settings or models, choose that exact supported recipe; choose blank only for a custom empty foundation. The result supplies a revision for export/verification.', { name: short, recipe: { type: 'string', enum: ['blank', 'notes', 'tasks', 'settings', 'models'], description: 'Choose notes, tasks, settings or models when the user requests a known app; blank only when the user requests a custom empty foundation.' } }, ['name']),
  define('search_spica_warehouse', 'Search the bounded local index of implemented SPICA primitives and recipes. Results come from registered adapters only; draft documentation is never executable.', {
    query: { type: 'string', minLength: 1, maxLength: 200 },
    target: { type: 'string', enum: ['desktop', 'web'] },
    executableOnly: { type: 'boolean' },
    limit: { type: 'integer', minimum: 1, maximum: 12 },
  }, ['query']),
  define('search_spica_catalog', 'Search disk-indexed SPICA warehouse metadata alongside registered capabilities; drafts are never executable. Supports category filtering, paginated results and small result limits. For executable source building, select actual registered adapters only.', {
    query: { type: 'string', maxLength: 200 }, category: { type: 'integer', minimum: 1, maximum: 1000000 },
    offset: { type: 'integer', minimum: 0, maximum: 350000 }, limit: { type: 'integer', minimum: 1, maximum: 12 },
    includeDrafts: { type: 'boolean' }, target: { type: 'string', enum: ['desktop', 'web'] },
  }),
  define('list_spica_categories', 'Inspect stable built-in and user-defined SPICA category IDs, honest capacity/count metrics, and the metadata-only nature of draft catalogs.', {}),
  define('inspect_spica_catalog', 'Inspect exact versioned warehouse metadata. Draft and synthetic descriptors cannot execute or install until backed by a real registered adapter.', {
    id: warehouseId, version: { type: 'string', minLength: 1, maxLength: 20 },
    target: { type: 'string', enum: ['desktop','web'] },
  }, ['id','version']),
  define('inspect_spica_component', 'Inspect one exact ID and version returned by search_spica_warehouse, including real implementation, target, permission and graph-installation status.', {
    id: warehouseId,
    version: { type: 'string', minLength: 1, maxLength: 20 },
    target: { type: 'string', enum: ['desktop', 'web'] },
  }, ['id', 'version']),
  define('inspect_params', 'READ ONLY: inspect exact allowed SPICA graph-edit operations, current collection/field/screen/flow IDs, supported types, constraints and a revision-correct example BEFORE editing. Pass operation for a small exact contract. Call validate_spica_edit before saving.', {
    view: {type:'string',enum:['schema1','v2'],description:'Select graph format. Schema1 is the default.'},
    operation: { type: 'string', enum: [...new Set([...v1EditOperations,...v2EditOperations])] },
  }),
  define('validate_spica_edit', 'READ ONLY: validate the EXACT edit_spica_graph request for schema1 or v2 without saving. Include view:"v2" for universal graph edits. Returns revision-correct validation evidence.', unifiedSpicaEditParameters.properties, ['revision','edits']),
  define('audit_spica_ui', 'Run real design-time checks for labels, duplicate navigation names, and contrast on the current SPICA graph. Read the findings before export; UI-mounted focus and overflow remain separate runtime checks.', {}),
  define('read_spica_graph', 'Read the authoritative graph revision and stable IDs. Use view:schema1, v2, or both to inspect the same saved graph (default schema1). For appearance optionally pass target for style properties.', { target: short, view:{type:'string',enum:['schema1','v2','both'],description:'Use v2 for the complete typed universal graph or both for both schemas. Default schema1 (small response).'} }),
  define('edit_spica_graph', 'ONE canonical graph editor. Use view:"schema1" (default) or view:"v2"; choose the desired edit operation and inspect its exact required parameters using inspect_params. V2 add_block derives actual ports from a registered block; no separate edit_spica_v2_graph tool exists.',
    unifiedSpicaEditParameters.properties,['revision','edits']),
  define('inspect_spica_target', 'Read-only standalone export compatibility report. Reveal which schema-1 blocks support desktop/web and why unsupported V2 nodes cannot yet be lowered.', { target: { type: 'string', enum: ['desktop', 'web'] } }, ['target']),
  define('export_spica_app', 'Compile this graph revision for desktop (default) or a standalone browser web app. Ownership and lock versions are target-specific; never overwrite another target.', { revision, target: { type: 'string', enum: ['desktop', 'web'] } }, ['revision']),
  define('prepare_spica_app', 'Prepare target-specific dependencies. Web only needs a package lock; desktop also needs native Cargo locks.', { revision, target: { type: 'string', enum: ['desktop', 'web'] } }, ['revision']),
  define('verify_spica_app', 'Verify real target-specific builds: desktop compiles and tests Tauri, web builds and checks static browser assets. Neither target claims arbitrary V2 compilation.', { revision, target: { type: 'string', enum: ['desktop', 'web'] } }, ['revision']),
  define('inspect_spica_build', 'Read the latest real SPICA export/build evidence, including revision, status and failing command IDs. Never invent test results.', {}),
  define('migrate_spica_v2_graph', 'Create a non-destructive read-only V2 projection of this schema-1 graph. Existing apps still export from schema 1.', { revision }, ['revision']),
  define('history_spica_v2_graph', 'Undo, redo or roll back the V2 graph, preserving schema-1 source and app exports.', {
    revision, action: { type: 'string', enum: ['undo', 'redo', 'rollback'] },
  }, ['revision','action']),
  define('search_spica_runtime_blocks', 'Search only registered, executable SPICA V2 blocks by intended behavior, category and target. Inspect returned IDs before composing. This is the preferred entry point for building arbitrary new features.', {
    query: {type:'string',minLength:1,maxLength:200},category:{type:'string',maxLength:60},
    target:{type:'string',enum:['desktop','web']},limit:{type:'integer',minimum:1,maximum:20},
  },['query']),
  define('validate_spica_composition', 'READ-ONLY: dry-run an arbitrary selection of 1–48 registered executable blocks and 0–96 typed connections. Returns all port contracts, errors, missing input warnings, and a runnable readiness flag. No feature names or application templates are hardcoded.', {
    revision,
    nodes:{type:'array',minItems:1,maxItems:48,items:{type:'object',additionalProperties:false,properties:{
      id:short,blockId:warehouseId,version:{type:'string',enum:['1']},config:{type:'object'},label:short,
    },required:['id','blockId']}},
    connections:{type:'array',maxItems:96,items:{type:'object',additionalProperties:false,properties:{
      from:short,output:short,to:short,input:short,
    },required:['from','output','to','input']}},
  },['revision','nodes','connections']),
  define('compose_spica_v2_graph', 'Atomically add only the registered blocks and typed connections that passed validate_spica_composition. Preserve the existing project, graph, source and history. This authors a V2 graph; it does not automatically export arbitrary V2 nodes as a native app.', {
    revision,
    nodes:{type:'array',minItems:1,maxItems:48,items:{type:'object',additionalProperties:false,properties:{
      id:short,blockId:warehouseId,version:{type:'string',enum:['1']},config:{type:'object'},label:short,
    },required:['id','blockId']}},
    connections:{type:'array',maxItems:96,items:{type:'object',additionalProperties:false,properties:{
      from:short,output:short,to:short,input:short,
    },required:['from','output','to','input']}},
  },['revision','nodes','connections']),
  define('list_spica_runtime_blocks', 'List the exact built-in executable V2 adapters and their typed ports, without including placeholder or legacy source-only blocks.', {}),
  define('inspect_spica_runtime_block', 'Inspect a registered runtime adapter and its typed ports, configuration, supported targets and required permissions before adding a V2 node.', {
    id: warehouseId, version: { type:'string', enum:['1'] },
  }, ['id','version']),
  define('inspect_spica_runtime_blocks', 'READ ONLY: inspect up to 12 actual registered executable V2 blocks in one call, including typed input/output ports and valid example configurations. Pass IDs from search_spica_runtime_blocks; never submit block IDs as tool names.', {
    blocks:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,
      properties:{id:warehouseId,version:{type:'string',enum:['1']}},required:['id']}},
  }, ['blocks']),
  define('run_spica_v2_graph', 'Execute the current revision of the V2 graph using only verified built-in adapters. Isolated legacy projection nodes are ignored; no standalone app is exported. Storage uses isolated in-memory transaction and never claims durable writes.', {
    revision, target: { type:'string', enum:['desktop','web'] },
  }, ['revision']),
];
export const spicaToolNames = new Set(spicaTools.map(tool => tool.function.name));
if(spicaTools.length!==spicaToolNames.size)throw Error('Duplicate SPICA tool name in registry.');

/** The actual registered declaration is authoritative. There is no second
 * appearance/program/V2-specific editing tool schema. */
const programEdit = spicaTools.find(item => item.function.name === 'edit_spica_graph')!;
export function spicaToolContract(tool: AgentToolDefinition, _program: boolean, scope?:SpicaEditScope|null): AgentToolDefinition {
  if (!scope || !['edit_spica_graph','validate_spica_edit'].includes(tool.function.name))return tool;
  return {...tool,function:{...tool.function,parameters:spicaScopedEditParameters(scope)}};
}

export function spicaEditHint(edits: unknown): string {
  const operations = Array.isArray(edits) ? new Set(edits.map(edit => edit?.op)) : new Set();
  return [
    operations.has('add_record_field') ? 'add_record_field: use {op:"add_record_field",collection:"notes",field:{key:"body",label:"Body",type:"text"}} only for fields that do not already exist.' : '',
    operations.has('add_collection') ? 'add_collection: put id, label, singular and fields inside collection. Omit initial for typed defaults.' : '',
    operations.has('put_screen') ? 'put_screen: supply screen:{id,label,view,collection}. A form uses fields:["title","body"] (field keys), submit:<existing flow ID>. A list can use query:<initial search text>. Define new fields in add_collection first. Never duplicate existing collection fields.' : '',
    operations.has('add_block') ? 'add_block: {op:"add_block",id:<nodeId>,blockId:<registered runtime ID>,config:<block config>}. All ports are derived from the registered block.' : '',
    operations.has('add_node') || operations.has('connect') ? 'For V2 graph edits inspect_params({view:"v2",operation:<op>}) and inspect_spica_runtime_block for exact registered port IDs.' : '',
    operations.has('grant_capability') || operations.has('set_capability') ? 'Use grant_capability with capability as an exact ID.' : '',
  ].filter(Boolean).join(' ');
}

/** Classify actionable SPICA requests, including natural Spark-addressed sentences. */
function spicaActionText(message: string): string {
  return message.trim().replace(/^(?:(?:hey|hi|hello)\s+)?(?:dona|spark|assistant)[,!:\s]+/i, '')
    .replace(/^(?:(?:can|could|would|will) you|i(?:'d| would) like you to|i want you to|please)\s+/i, '').trim();
}
const spicaConceptual = /^(?:what if|imagine|how (?:would|could|do)|why|explain|describe|plan|brainstorm|suggest|tell me about|show me ideas)\b/i;
export function isSpicaProgramRequest(message: string) {
  const text = spicaActionText(message);
  if (spicaConceptual.test(text)) return false;
  return /\b(?:build|create|make|develop|implement|connect|edit|fix|install|repair|run|test|verify|change)\b/i.test(text) &&
    /\b(?:spica|block warehouse|notes? (?:app|organizer)|tasks? (?:app|manager)|model organizer|quick capture|csv (?:review|validation|import|export)|runtime scenario|reusable blocks?)\b/i.test(text);
}
export function isSpicaCreationRequest(message: string) {
  const text = spicaActionText(message);
  if (spicaConceptual.test(text) || /^build\s+(?:the\s+)?(?:current|existing|exported)\b/i.test(text)) return false;
  const actualBuild = /\b(?:build|create|make|develop|implement|assemble)\b/i.test(text);
  const spicaReference = /\b(?:spica|block warehouse)\b/i.test(text);
  const application = /\b(?:app|application|notes? organizer|tasks? manager|desktop (?:notes|program)|program)\b/i.test(text);
  const directBuild = /^(?:use\s+spica\s+to\s+)?(?:build|create|make|develop|implement|assemble)\b/i.test(text);
  return actualBuild && application && spicaReference && (directBuild || /\b(?:i want you to|using|with|through|via|in)\b/i.test(message));
}

/** The deterministic recipes can be selected without inventing unsupported app features. */
export function spicaRequestedRecipe(message: string): Exclude<Recipe, 'blank'> | null {
  const text = spicaActionText(message);
  if (!isSpicaCreationRequest(message)) return null;
  if (/\bnotes?\b/i.test(text)) return 'notes';
  if (/\btasks?\b/i.test(text)) return 'tasks';
  if (/\bsettings|preferences\b/i.test(text)) return 'settings';
  if (/\bmodel organizer|3d model\b/i.test(text)) return 'models';
  return null;
}

export function spicaAllowsEdit(message: string) {
  return !/^\s*(?:please\s+)?(?:run|check|test|verify|inspect|read|export|rebuild)\b/i.test(message) ||
    /\b(?:and|then)\s+(?:fix|repair)\b/i.test(message);
}

export function isSpicaVerificationOnly(message: string) {
  return !spicaAllowsEdit(message) && !/^\s*(?:please\s+)?export\b/i.test(message);
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
  return stableGraphJson([args.revision, args.view ?? 'schema1', args.edits]);
}

export type SpicaEditResult =
  | { saved: true; revision: number; next: 'export_spica_app' | 'run_spica_v2_graph'; view?:'schema1'|'v2' }
  | { saved: false; revision: number; code: 'STALE_GRAPH' | 'INVALID_GRAPH_EDIT'; message: string };

export function reviewSpicaEdit(current: SpicaRecord | null, args: Record<string, unknown>):
  { ok: true; args: Record<string, unknown> } | { ok: false; result: Extract<SpicaEditResult, { saved: false }> } {
  const revision = current?.data.revision ?? 0;
  if (!current || revision !== args.revision) return { ok: false, result: {
    saved: false, revision, code: 'STALE_GRAPH', message: 'Graph revision changed. Call read_spica_graph before editing.',
  } };
  const view = args.view === 'v2' ? 'v2' : args.view === undefined || args.view === 'schema1' ? 'schema1' : null;
  if (!view || !validEditOperations(view,args.edits)) return {ok:false,result:{saved:false,revision,code:'INVALID_GRAPH_EDIT',
    message:`Unknown graph view or edit operation. Use inspect_params with view schema1/v2 for supported operations.`}};
  const checked = validateToolArguments('edit_spica_graph',args,[{type:'function',function:{
    name:'edit_spica_graph',description:'Canonical edit contract',parameters:unifiedSpicaEditParameters,
  }}]);
  if (!checked.ok) return {ok:false,result:{saved:false,revision,code:'INVALID_GRAPH_EDIT',message:checked.error.message}};
  if (view === 'v2') {
    if (!current.data.graphV2) return {ok:false,result:{saved:false,revision,code:'INVALID_GRAPH_EDIT',
      message:'Graph V2 has not been created. Call migrate_spica_v2_graph with the current revision.'}};
    try {
      const edits=expandSpicaV2Edits(args.edits as Record<string,unknown>[]);
      const next=applySpicaGraphTransaction(current.data.graphV2,edits,{resolveBlock:(id,version)=>
        Boolean(getRuntimeBlock(id,version)||getBlock(id,version))});
      return {ok:true,args:{...args,review:{view:'v2',fromRevision:revision,toRevision:revision+1,
        nodeCount:next.nodes.length,connectionCount:next.edges.length,operations:edits.map(edit=>edit.op),
        note:'Schema-1 source remains unchanged. This is not native export evidence.'}}};
    } catch(error) {return {ok:false,result:{saved:false,revision,code:'INVALID_GRAPH_EDIT',
      message:error instanceof Error?error.message:String(error)}};}
  }
  try {
    protectScenarios(current, args.edits as GraphEdit[]);
    const next = changeGraph(current.data.graph, args.edits as GraphEdit[]);
    const fields = collectionUpgrade(current.data.graph.collection, next.collection);
    const appearance = styleChanges(current.data.graph, next);
    const behavior = (args.edits as GraphEdit[]).some(edit => ['install_recipe', 'add_collection', 'add_record_field', 'put_screen', 'put_flow', 'put_scenario',
      'set_start_screen', 'set_capability', 'grant_capability', 'revoke_capability'].includes(edit.op));
    if (!fields.length && !appearance.length && !behavior) return { ok: true, args };
    return { ok: true, args: { ...args, review: {
      graph: { fromRevision: current.data.revision, toRevision: current.data.revision + 1, collection: next.collection?.id, addedFields: fields },
      ...(appearance.length ? { appearance } : {}),
      ...(behavior ? { behavior: {
        collections: [next.collection, ...(next.collections ?? [])].filter(Boolean),
        screens: next.program?.screens, flows: next.program?.flows, grants: next.program?.grants,
      } } : {}),
      ...(fields.length ? { database: 'On first launch of the new standalone build, backfill the listed defaults on existing records in one SQLite transaction.' } : {}),
    } } };
  } catch (error) {
    return { ok: false, result: { saved: false, revision, code: 'INVALID_GRAPH_EDIT', message: error instanceof Error ? error.message : String(error) } };
  }
}

function protectScenarios(current: SpicaRecord, edits: readonly GraphEdit[]) {
  for (const edit of edits) {
    if (edit.op === 'put_scenario' && current.data.graph.program?.scenarios.some(scenario => scenario.id === edit.scenario?.id)) {
      throw new GraphEditError('Existing behavioral scenarios are protected during repair. Change the graph behavior or add a new scenario ID.');
    }
  }
}

export function selectSpicaTools(allowed: readonly AgentToolDefinition[], last: string | null, needsEdit: boolean, verified: boolean, appearance = false, program = false,
  state: { hasGraph?: boolean; hasV2?: boolean; researchIntent?: boolean; v2Intent?: boolean; needsSetup?: boolean; failed?: boolean; verifyOnly?: boolean; refreshGraph?: boolean; canEdit?: boolean; validatedAction?: string; suppressedTool?: string; editScope?:SpicaEditScope|null } = {}) {
  const names = last === 'check_spica_tool_call' && state.validatedAction ? [state.validatedAction] :
    last === 'invalid_spica_tool' ? ['inspect_solarium_tool','spica_next_action', 'inspect_spica_runtime_block', 'inspect_spica_identifier', 'list_solarium_tools'] :
    last === 'inspect_spica_identifier' ? ['inspect_spica_runtime_block','spica_next_action','search_spica_runtime_blocks','inspect_spica_tool'] :
    last === 'inspect_spica_tool' ? ['spica_next_action','inspect_spica_wiring','check_spica_tool_call','read_spica_graph'] :
    last === 'list_spica_toolchain' ? ['spica_next_action','read_spica_graph','search_spica_runtime_blocks'] :
    last === 'spica_next_action' ? (!state.hasGraph ? ['create_spica_app','check_spica_tool_call'] : state.v2Intent && !state.hasV2 ? ['inspect_spica_tool','check_spica_tool_call','read_spica_graph'] : ['search_spica_runtime_blocks','inspect_spica_runtime_block','read_spica_graph','check_spica_tool_call']) :
    state.researchIntent ? (last === 'spica_research_search' ? ['spica_research_read','spica_research_next','spica_research_status'] :
    last === 'spica_research_read' || last === 'spica_research_follow' ? ['spica_research_next','spica_research_links','spica_research_claim','spica_research_save'] :
    last === 'spica_research_next' ? ['spica_research_search','spica_research_read','spica_research_follow','spica_research_compare','spica_research_save'] :
    ['spica_research_status','spica_research_search','spica_research_next']) :
    last === 'inspect_spica_wiring' ? ['validate_spica_composition', 'inspect_params', 'check_spica_tool_call'] :
    state.v2Intent && last === 'inspect_params' ? ['validate_spica_edit', 'read_spica_graph', 'inspect_spica_runtime_block'] :
    state.v2Intent && last === 'validate_spica_edit' ? ['edit_spica_graph', 'read_spica_graph'] :
    state.v2Intent ? (verified ? [] : state.hasGraph === false ? ['spica_next_action','check_spica_tool_call'] : !state.hasV2 ? ['spica_next_action','inspect_spica_tool','check_spica_tool_call','read_spica_graph'] :
    last === 'search_spica_runtime_blocks' ? ['inspect_spica_runtime_blocks', 'inspect_spica_runtime_block', 'read_spica_graph'] :
    last === 'inspect_spica_runtime_block' || last === 'inspect_spica_runtime_blocks' ? ['inspect_params','inspect_spica_wiring', 'validate_spica_composition', 'read_spica_graph'] :
    last === 'validate_spica_composition' ? ['compose_spica_v2_graph', 'inspect_spica_runtime_block'] :
    last === 'compose_spica_v2_graph' ? ['run_spica_v2_graph', 'read_spica_graph'] :
    last === 'run_spica_v2_graph' ? ['read_spica_graph', 'search_spica_runtime_blocks'] :
    last === 'list_spica_runtime_blocks' ? ['search_spica_runtime_blocks', 'inspect_spica_runtime_block', 'inspect_params'] :
    last === 'edit_spica_graph' || last === 'history_spica_v2_graph' ? ['read_spica_graph', 'run_spica_v2_graph'] :
    ['search_spica_runtime_blocks', 'read_spica_graph', 'inspect_spica_runtime_block', 'validate_spica_composition']) : verified ? [] : state.hasGraph === false ? ['create_spica_app'] :
    state.refreshGraph ? ['read_spica_graph'] :
    last === 'invalid_spica_edit' ? ['inspect_params', 'read_spica_graph'] :
    !last || last === 'create_spica_app' ? program ? ['search_spica_warehouse'] : ['read_spica_graph'] :
    last === 'search_spica_warehouse' ? ['inspect_spica_component', 'search_spica_catalog', 'read_spica_graph'] :
    last === 'search_spica_catalog' ? ['inspect_spica_catalog', 'search_spica_catalog', 'read_spica_graph'] :
    last === 'inspect_spica_catalog' ? ['read_spica_graph', 'search_spica_warehouse'] :
    last === 'inspect_spica_component' ? ['read_spica_graph'] :
    last === 'read_spica_graph' ? (needsEdit ? ['inspect_params', 'read_spica_graph'] :
      state.failed ? ['read_command_output', 'report_project_blocker'] : state.verifyOnly ? ['verify_spica_app'] :
      state.canEdit ? ['inspect_params', 'inspect_spica_target', 'export_spica_app', 'verify_spica_app'] : ['inspect_spica_target', 'export_spica_app', 'verify_spica_app']) :
    last === 'inspect_params' ? ['inspect_params', 'validate_spica_edit', 'read_spica_graph'] :
    last === 'validate_spica_edit' ? ['edit_spica_graph', 'inspect_params', 'read_spica_graph'] :
    last === 'edit_spica_graph' ? ['audit_spica_ui', 'export_spica_app', 'read_spica_graph', ...(state.canEdit ? ['inspect_params'] : [])] :
    last === 'audit_spica_ui' ? ['inspect_spica_target', 'export_spica_app', 'read_spica_graph', 'inspect_params'] :
    last === 'inspect_spica_target' ? ['export_spica_app', 'read_spica_graph'] :
    last === 'export_spica_app' ? state.needsSetup ? ['prepare_spica_app'] : ['verify_spica_app', 'read_spica_graph'] :
    last === 'prepare_spica_app' ? state.failed ? ['read_command_output', 'report_project_blocker'] : ['verify_spica_app'] :
    last === 'verify_spica_app' && state.failed && needsEdit ? ['read_spica_graph'] :
    last === 'read_command_output' && state.failed ? ['report_project_blocker'] :
    ['read_command_output', 'read_spica_graph', 'report_project_blocker'];
  const guidance = ['spica_next_action','inspect_spica_tool','check_spica_tool_call','inspect_spica_identifier'];
  // A mutating tool is NOT advertised until its exact arguments have passed a
  // current preflight. No direct-write shortcut and no retry after failure.
  const writes = new Set(['spica_research_save','create_spica_app','edit_spica_graph','migrate_spica_v2_graph',
    'history_spica_v2_graph','compose_spica_v2_graph','run_spica_v2_graph','export_spica_app',
    'prepare_spica_app','verify_spica_app']);
  const checkedWrite = last === 'check_spica_tool_call' ? state.validatedAction :
    last === 'validate_spica_edit' ? 'edit_spica_graph' :
    last === 'validate_spica_composition' ? 'compose_spica_v2_graph' : null;
  const safeNames = names.filter(name => name !== state.suppressedTool && (!writes.has(name) || name === checkedWrite));
  const candidates = [...safeNames, ...guidance.filter(name => name !== state.suppressedTool && !safeNames.includes(name))].slice(0, 5);
  return candidates.flatMap(name => allowed.filter(tool => tool.function.name === name)
    .map(tool => spicaToolContract(tool, program && !appearance, state.editScope)));
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
  const state: SpicaToolEnvironment = {hasGraph:Boolean(current),hasV2:Boolean(current?.data.graphV2),
    revision:current?.data.revision??null,linkedFolder:Boolean(project.folder)};
  if(name === 'list_solarium_tools' || name === 'inspect_solarium_tool') {
    const {toolDefinitions,allowedToolDefinitions}=await import('../engine/tools');
    const available=new Set(allowedToolDefinitions(execution.webEnabled,Boolean(project.folder)).map(t=>t.function.name));
    const contracts=new ToolContractRegistry(toolDefinitions.map(t=>spicaToolContract(t,execution.spicaProgram===true)));
    if(name === 'list_solarium_tools'){
      const query=typeof args.query==='string'?args.query.trim().toLowerCase():'';
      const filtered=query?toolDefinitions.filter(t=>t.function.name.toLowerCase().includes(query)||t.function.description.toLowerCase().includes(query)):toolDefinitions;
      const offset=typeof args.offset==='number'?args.offset:0;
      const limit=typeof args.limit==='number'?args.limit:60;
      return JSON.stringify({totalRegistered:contracts.names().length,totalMatching:filtered.length,offset,limit,
        hasMore:offset+limit<filtered.length,nextOffset:Math.min(offset+limit,filtered.length),
        tools:filtered.slice(offset,offset+limit).map(t=>({name:t.function.name,callable:available.has(t.function.name),
          required:(t as AgentToolDefinition).function.parameters.required??[],description:t.function.description.slice(0,140)})),
        note:'Only function.name values are callable. spica.runtime.* IDs are block arguments; page with nextOffset for every registered tool.'});
    }
    const named=String(args.name);const tool=contracts.get(named);
    return JSON.stringify(tool?{ok:true,name:named,callable:available.has(named),schema:spicaToolContract(tool,execution.spicaProgram===true).function.parameters,description:tool.function.description}:
      {ok:false,code:named.startsWith('spica.runtime.')?'BLOCK_ID_NOT_TOOL':'UNKNOWN_TOOL',name:named,
       next:named.startsWith('spica.runtime.')?'inspect_spica_runtime_block':'list_solarium_tools'});
  }
  if(name === 'inspect_spica_identifier') {
    const id=String(args.id);const tool=spicaTools.find(t=>t.function.name===id);
    if(tool)return JSON.stringify({kind:'tool',id,callable:true,next:'inspect_spica_tool',arguments:{name:id}});
    if(id.startsWith('spica.runtime.')){const block=listRuntimeBlocks().find(b=>b.id===id);return JSON.stringify(block?
      {kind:'executable_block',id,callable:false,category:block.category,version:block.version,next:'inspect_spica_runtime_block',arguments:{id,version:block.version}}:
      {kind:'unknown_block',id,callable:false,next:'search_spica_runtime_blocks'});}
    return JSON.stringify({kind:'unknown_identifier',id,callable:false,next:'list_spica_toolchain'});
  }
  if (name === 'list_spica_toolchain') { const { listSpicaToolchain } = await import('./tool-intelligence');
    const response = listSpicaToolchain(spicaTools,state);
    const query=typeof args.query==='string'?args.query.toLowerCase().trim():'';
    const stage=typeof args.stage==='string'?args.stage:'';
    const offset=typeof args.offset==='number'?args.offset:0;
    const limit=typeof args.limit==='number'?args.limit:30;
    const matching=response.actions.filter(action=>(!query||action.name.includes(query))&&(!stage||action.stage===stage));
    const contracts=new ToolContractRegistry(spicaTools.map(tool=>spicaToolContract(tool,execution.spicaProgram===true)));
    const actions=matching.slice(offset,offset+limit).map(action=>({ ...action,
      ...(args.includeSchemas===true?{schema:contracts.get(action.name)?.function.parameters}:{}),
    }));
    return JSON.stringify({...response,actions,total:matching.length,offset,limit,
      nextOffset:offset+actions.length<matching.length?offset+actions.length:null,
      nextTool:'spica_next_action',nextArguments:{stage:state.hasV2?'compose':state.hasGraph?'compose':'general'}});
  }
  if (name === 'spica_next_action') {
    const { nextSpicaAction } = await import('./tool-intelligence');
    return JSON.stringify(nextSpicaAction(spicaTools,state,args.stage,args.target));
  }
  if (name === 'inspect_spica_tool') {
    const toolName=String(args.name);
    const tool=spicaTools.find(item=>item.function.name===toolName);
    const { inspectSpicaTool } = await import('./tool-intelligence');
    const details=toolName.startsWith('spica.runtime.') ? (()=>{
      const block=listRuntimeBlocks().find(item=>item.id===toolName);
      return block ? {ok:true,kind:'executable_block',callable:false,id:block.id,version:block.version,
        category:block.category,targets:block.targets,inputs:block.inputs,outputs:block.outputs,
        exampleConfig:block.exampleConfig??{},permissions:block.permissions,
        nextTool:'inspect_spica_wiring',nextArguments:{blockIds:[block.id]}} :
        {ok:false,code:'UNKNOWN_BLOCK',id:toolName,nextTool:'search_spica_runtime_blocks'};
    })() : inspectSpicaTool(tool ? [spicaToolContract(tool,execution.spicaProgram===true)] : spicaTools,toolName,state);
    const operation=typeof args.operation==='string'?args.operation:undefined;
    const editView=args.view==='v2'?'v2':'schema1';
    const selectedScope=operation && ['edit_spica_graph','validate_spica_edit'].includes(toolName) &&
      validEditOperations(editView,[{op:operation}]) ? {view:editView,operations:[operation]} as SpicaEditScope : null;
    const contract = tool ? spicaToolContract(tool,execution.spicaProgram===true,selectedScope) : undefined;
    const candidate = Object.hasOwn(args,'arguments') && contract
      ? new ToolCallValidator(new ToolContractRegistry([contract])).check(toolName,args.arguments) : null;
    const inspected = current && operation && ['edit_spica_graph','validate_spica_edit'].includes(toolName)
      ? {...details,operationContract:args.view === 'v2' ? inspectSpicaV2Parameters(current.data.graphV2,current.data.revision,operation)
        : inspectSpicaParameters(current.data.graph,current.data.revision,operation,programEdit.function.parameters)}
      : details;
    const scoped = selectedScope && contract ? {...inspected,schema:contract.function.parameters,scopedTo:selectedScope} : inspected;
    return JSON.stringify(candidate ? {...scoped,candidateValidation:candidate,
      note:'Candidate arguments were inspected only. No tool executed. For writes, run check_spica_tool_call before submitting.'} : scoped);
  }
  if (name === 'inspect_spica_wiring') { const { inspectSpicaWiring } = await import('./tool-intelligence');
    return JSON.stringify(inspectSpicaWiring(args.blockIds as string[], args.target==='web'?'web':'desktop')); }
  if (name === 'check_spica_tool_call') {
    const toolName=String(args.name);
    const definition=spicaTools.find(item=>item.function.name===toolName);
    if (!definition || ['check_spica_tool_call','list_spica_toolchain','inspect_spica_tool'].includes(toolName))
      return JSON.stringify({ok:false,code:'UNKNOWN_CHECK_TARGET',tool:toolName});
    const input=args.arguments as Record<string,unknown>;
    const contract=spicaToolContract(definition,execution.spicaProgram===true);
    const { spicaToolPrerequisites } = await import('./tool-intelligence');
    const checked=new ToolCallValidator(new ToolContractRegistry([contract])).check(toolName,input);
    const prerequisites=spicaToolPrerequisites(toolName,state);
    const errors=[...(checked.ok?[]:checked.error.issues.map(issue=>`${issue.field}: ${issue.message}`)), ...prerequisites];
    if (checked.ok && current && ['edit_spica_graph','validate_spica_edit'].includes(toolName)) {
      const review=reviewSpicaEdit(current,input);
      if (!review.ok) errors.push(review.result.message);
    }
    if (checked.ok && current && ['compose_spica_v2_graph','validate_spica_composition'].includes(toolName)) {
      if (input.revision!==current.data.revision) errors.push(`Expected current graph revision ${current.data.revision}.`);
      if (!current.data.graphV2) errors.push('Graph V2 has not been created.');
      else if (!errors.length) {
        try { previewSpicaComposition(current.data.graphV2,{nodes:input.nodes as SpicaComposition['nodes'],connections:input.connections as SpicaComposition['connections']}); }
        catch(error){errors.push(error instanceof Error?error.message:String(error));}
      }
    }
    if (checked.ok && current && 'revision' in input && typeof input.revision==='number' &&
        input.revision!==current.data.revision) errors.push(`Graph revision is ${current.data.revision}, not ${input.revision}.`);
    if (toolName==='create_spica_app' && current) errors.push('A graph already exists; do not create a second graph.');
    const missingV2=errors.some(error=>error.includes('Graph V2'));
    return JSON.stringify({ok:errors.length===0,tool:toolName,revision:state.revision,errors,
      canSubmit:errors.length===0, next:errors.length===0?toolName:null,
      ...(!missingV2?{}:{nextTool:'migrate_spica_v2_graph',nextArguments:{revision:state.revision},
        explanation:'Create Graph V2 before validating or composing V2 blocks; no composition was saved.'}),
      schema:errors.length?contract.function.parameters:undefined,
      note:'Preflight did not execute, edit, export or verify anything.'});
  }
  if (name === 'create_spica_app') {
    if (current) throw Error('This project already has a SPICA graph. Read its current revision.');
    if (!project.folder || (await inspectProjectEnvironment(project.folder)).rootEntryCount !== 0) {
      throw Error('Choose an empty linked folder for a new SPICA app.');
    }
    if (execution.signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    const recipe = (args.recipe ?? 'blank') as Recipe;
    if (!['blank', 'notes', 'tasks', 'settings', 'models'].includes(recipe)) throw Error('Unknown SPICA starter recipe.');
    const created = await repo.create(String(args.name ?? '').trim(), recipe);
    return JSON.stringify({ saved: true, name: created.title, recipe, revision: created.data.revision, next: 'read_spica_graph' });
  }
  if (!current) throw Error('This project has no saved SPICA graph.');
  if (name === 'inspect_spica_target') {
    const { inspectSpicaTarget } = await import('./target-lowering');
    const review = inspectSpicaTarget(current.data, args.target === 'web' ? 'web' : 'desktop');
    return JSON.stringify({ target: review.target, supported: review.supported, diagnostics: review.diagnostics,
      revision: review.ir.revision, schema: review.ir.version, blockLocks: review.ir.lockedBlocks,
      note: 'This preflight does not export files. Browser output is independent of Solarium and Tauri. Non-lowered V2 nodes are refused.' });
  }
  if (name === 'audit_spica_ui') return JSON.stringify({ revision:current.data.revision,...auditSpicaDesign(current.data.graph),
    note:'Design-time evidence only; interactive focus, rendering and native behavior require the application preview and verification.' });
  if (name === 'inspect_spica_build') {
    const build = await (await import('./export')).latestSpicaBuild(project.id);
    return JSON.stringify(build ? {
      found: true, revision: build.revision, root: build.root, state: build.state, target: build.platform ?? 'desktop',
      diagnostic: build.diagnostic, checks: build.checks.map(item => ({ id: item.command_id, exitCode: item.exit_code, runId: item.run_id })),
      scenarios: build.runtime?.flatMap(run => run.reports.map(report => ({ id: run.id, phase: report.phase, state: report.state, diagnostic: report.diagnostic }))),
      matchesCurrentRevision: build.revision === current.data.revision,
    } : { found: false, message: 'No recorded standalone build for this SPICA project.' });
  }
  if (name === 'migrate_spica_v2_graph') {
    const saved = await repo.migrateV2(Number(args.revision));
    return JSON.stringify({ saved: true, revision: saved.data.revision, nodes: saved.data.graphV2?.nodes.length, edges: saved.data.graphV2?.edges.length, schema1Preserved: true });
  }
  if (name === 'history_spica_v2_graph') {
    if (!['undo','redo','rollback'].includes(String(args.action))) throw Error('Invalid V2 history action.');
    const saved = await repo.updateV2(Number(args.revision), args.action as 'undo'|'redo'|'rollback');
    return JSON.stringify({ saved: true, revision: saved.data.revision, hasV2: Boolean(saved.data.graphV2), schema1Preserved: true });
  }
  if (name === 'search_spica_runtime_blocks') {
    const query=String(args.query??'').trim();
    if(!query || query.length>200)throw Error('Search query must have 1–200 characters.');
    return JSON.stringify(searchExecutableBlocks({query,
      ...(typeof args.category==='string'?{category:args.category}:{}),
      ...(args.target==='web'?{target:'web' as const}:{}),
      ...(typeof args.limit==='number'?{limit:args.limit}:{})}));
  }
  if (name === 'validate_spica_composition' || name === 'compose_spica_v2_graph') {
    if(current.data.revision!==args.revision)return JSON.stringify({ok:false,code:'STALE_GRAPH',revision:current.data.revision,next:'read_spica_graph'});
    if(!current.data.graphV2)return JSON.stringify({ok:false,code:'MISSING_V2',revision:current.data.revision,next:'migrate_spica_v2_graph'});
    if(!await repo.v2OriginIsCurrent(current))return JSON.stringify({ok:false,code:'STALE_V2_ORIGIN',next:'read_spica_graph'});
    try {
      const plan:SpicaComposition={nodes:args.nodes as SpicaComposition['nodes'],connections:args.connections as SpicaComposition['connections']};
      const reviewed=previewSpicaComposition(current.data.graphV2,plan);
      if(name==='validate_spica_composition')return JSON.stringify({ok:true,revision:current.data.revision,
        newNodes:reviewed.newNodes,newConnections:reviewed.newConnections,complete:reviewed.complete,
        warnings:reviewed.diagnostics.warnings,next:'compose_spica_v2_graph',
        note:'Preflight only: no graph has been saved.'});
      const saved=await repo.composeV2(current.data.revision,plan);
      return JSON.stringify({ok:true,saved:true,revision:saved.data.revision,
        nodes:reviewed.graph.nodes.length,connections:reviewed.graph.edges.length,complete:reviewed.complete,
        warnings:reviewed.diagnostics.warnings,next:'run_spica_v2_graph',
        standaloneExported:false,note:'The graph is saved, but application export from arbitrary V2 blocks is not yet available.'});
    }catch(error){return JSON.stringify({ok:false,code:'INVALID_BLOCK_COMPOSITION',revision:current.data.revision,
      diagnostic:error instanceof Error?error.message:String(error),next:'inspect_spica_runtime_block'});}
  }
  if (name === 'list_spica_runtime_blocks') {
    return JSON.stringify({ supported: listRuntimeBlocks().slice(0,100).map(block => ({
      id:block.id,version:block.version,kind:block.kind,targets:block.targets,permissions:block.permissions,
      inputs:block.inputs,outputs:block.outputs,
    })), excludedLegacyAdapters:26, registeredTotal:listRuntimeBlocks().length, note:'Only registered adapters are executable. Prefer search_spica_runtime_blocks for task-specific results; list is capped at 100. Schema-1 export remains separate.' });
  }
  if (name === 'inspect_spica_runtime_block') {
    return JSON.stringify(inspectExecutableBlock(String(args.id),String(args.version)));
  }
  if (name === 'inspect_spica_runtime_blocks') {
    const requested=args.blocks as {id:string;version?:string}[];
    if(!Array.isArray(requested)||requested.length<1||requested.length>12)throw Error('Provide 1–12 registered block identifiers.');
    const unique=new Set(requested.map(item=>`${item.id}@${item.version??'1'}`));
    if(unique.size!==requested.length)throw Error('Duplicate block identifier in inspection request.');
    const details=requested.map(item=>inspectExecutableBlock(item.id,item.version??'1'));
    return JSON.stringify({ok:true,kind:'registered_executable_blocks',count:details.length,blocks:details,
      next:'inspect_params',nextArguments:{view:'v2',operation:'add_block'},
      note:'Use the registered IDs as add_block.blockId and its exampleConfig as the starting config. Inspect exact parameters before validation and saving.'});
  }
  if (name === 'run_spica_v2_graph') {
    if (current.data.revision !== args.revision) return JSON.stringify({ok:false,code:'STALE_GRAPH',revision:current.data.revision,
      message:'Read the current graph before running a stale revision.'});
    if (!current.data.graphV2) return JSON.stringify({ok:false,code:'MISSING_V2',next:'migrate_spica_v2_graph'});
    if (!await repo.v2OriginIsCurrent(current)) return JSON.stringify({ok:false,code:'STALE_V2_ORIGIN',message:'The schema-1 source changed. Refresh or roll back the outdated projection.'});
    const grants=new Set<SpicaRuntimePermission>((current.data.graph.program?.grants??[]) as SpicaRuntimePermission[]);
    const output=await executeSpicaGraphV2(current.data.graphV2,{target:args.target==='web'?'web':'desktop',grants,
      excludeIsolatedLegacy:true,signal:execution.signal,onTrace:event=>{
        const detail=`[${event.state}] ${event.nodeId} · ${event.blockId}${event.message ? ` — ${event.message}` : ''}\n`;
        onOutput?.(event.state==='failed'?'stderr':'stdout',detail);
      }});
    const limitedOutputs=Object.fromEntries(Object.entries(output.outputs).slice(-8));
    return JSON.stringify({ok:output.state==='passed',revision:current.data.revision,...output,
      trace:output.trace.slice(-60),outputs:limitedOutputs,
      durableStorage:false,standaloneExported:false,
      note:'Runtime uses isolated memory; Phase 9 handles standalone target generation. The response includes the last 60 trace events and at most eight output nodes.'});
  }
  if (name === 'list_spica_categories') {
    try {
      const categories = await listCatalogCategories();
      return JSON.stringify({ categories, plannedCapacity: categories.reduce((sum, c) => sum + c.capacity, 0),
        legacySourceAdapterCount: registeredWarehouseCounts.adapters, runtimeAdapterCount: listRuntimeBlocks().length, executableCatalogEntries: 0, note: 'Category capacities and draft metadata are not executable blocks; runtime adapters are separate tested source modules.' });
    } catch (error) {
      return JSON.stringify({ categories: warehouseCategories, plannedCapacity: warehouseCapacity,
        nativeCatalogUnavailable: String(error), legacySourceAdapterCount: registeredWarehouseCounts.adapters, runtimeAdapterCount: listRuntimeBlocks().length });
    }
  }
  if (name === 'search_spica_catalog') {
    if (typeof args.query !== 'string' && args.query !== undefined) throw Error('Query must be text.');
    const page = await searchSpicaCapabilities(current.data.graph, {
      query: typeof args.query === 'string' ? args.query : '',
      ...(args.target === 'desktop' || args.target === 'web' ? { target: args.target } : {}),
      ...(typeof args.category === 'number' ? { category: args.category } : {}),
      ...(typeof args.offset === 'number' ? { offset: args.offset } : {}),
      ...(typeof args.limit === 'number' ? { limit: args.limit } : {}),
      includeDrafts: args.includeDrafts !== false,
    });
    return JSON.stringify({ ...page, note: 'Draft entries are metadata-only and cannot be used as executable graph blocks.' });
  }
  if (name === 'inspect_spica_catalog') {
    return JSON.stringify(await inspectSpicaCapability(current.data.graph, String(args.id), String(args.version),
      args.target === 'web' ? 'web' : args.target === 'desktop' ? 'desktop' : undefined));
  }
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
  if (name === 'inspect_params') {
    const operation=typeof args.operation === 'string' ? args.operation : undefined;
    return JSON.stringify(args.view === 'v2'
      ? inspectSpicaV2Parameters(current.data.graphV2,current.data.revision,operation)
      : inspectSpicaParameters(current.data.graph,current.data.revision,operation,programEdit.function.parameters));
  }
  if (name === 'validate_spica_edit') {
    const candidate = args;
    const preflight = reviewSpicaEdit(current, candidate);
    if (!preflight.ok) return JSON.stringify({ ok: false, revision: current.data.revision, code: preflight.result.code,
      message: preflight.result.message, guidance: spicaEditHint(candidate.edits), next: 'inspect_params' });
    return JSON.stringify({ ok: true, revision: current.data.revision,
      signature: spicaEditSignature(candidate), view:candidate.view??'schema1', review: preflight.args.review ?? null, next: 'edit_spica_graph',
      note: 'Preflight is read-only. Save requires a separate permissioned edit at the same revision.' });
  }
  if (name === 'read_spica_graph') {
    const graph = current.data.graph;
    const v2 = current.data.graphV2;
    const view = args.view === 'v2' ? 'v2' : args.view === 'both' ? 'both' : 'schema1';
    const v2Info = v2 ? { available:true, revision: current.data.revision, name:v2.name, graph:v2,
      originCurrent:await repo.v2OriginIsCurrent(current), diagnostics:validateSpicaGraphV2(v2),
      exported:false, runnableAdapters:listRuntimeBlocks().length } :
      { available:false, revision:current.data.revision, next:'migrate_spica_v2_graph', exported:false };
    const latest = execution.spicaProgram ? await (await import('./export')).latestSpicaBuild(project.id) : null;
    const failed = latest?.revision === current.data.revision && latest.root === project.folder
      ? latest.runtime?.flatMap(run => run.reports).find(report => report.state === 'failed') : undefined;
    return JSON.stringify({
    revision: current.data.revision, name: current.title, v2Available:Boolean(v2),
    ...(view === 'v2' || view === 'both' ? { v2: v2Info } : {}),
    ...(view !== 'v2' ? { pages: current.data.graph.pages,
    collection: current.data.graph.collection,
    settings: current.data.graph.controls.map(c => ({ id: c.id, label: c.label, page: c.page, key: c.preference, widget: c.widget })),
    ...(execution.spicaStyle ? { appearance: appearanceSummary(graph, args.target as string | undefined) } : {}),
    ...(execution.spicaProgram ? { behavior: {
      recipes: graph.program?.recipes ?? {}, availableRecipes: recipeCatalog.map(recipe => recipe.id),
      screens: graph.program?.screens.slice(0, 12), flows: args.target ? graph.program?.flows.filter(flow => flow.id === args.target) : graph.program?.flows.slice(0, 3),
      collections: graph.collections, grants: graph.program?.grants ?? ['records.write'], startScreen: graph.program?.startScreen,
      scenarios: graph.program?.scenarios.map(scenario => ({ id: scenario.id, label: scenario.label })),
      failed: failed ? { id: failed.id, phase: failed.phase, step: failed.completed + 1,
        failedStep: failed.failedStep?.action === 'load_csv' ? { action: 'load_csv', fixtureLength: failed.failedStep.text.length } : failed.failedStep,
        diagnostic: failed.diagnostic } : undefined,
    } } : {}),
    } : {}),
  }); }
  if (name === 'edit_spica_graph') {
    const revision = current.data.revision;
    if (args.revision !== revision) return JSON.stringify({
      saved: false, revision, code: 'STALE_GRAPH', message: 'Graph revision changed. Call read_spica_graph before editing.',
    } satisfies SpicaEditResult);
    const preview=reviewSpicaEdit(current,args);
    if (!preview.ok) return JSON.stringify({...preview.result,next:'inspect_params'});
    try {
      if (args.view === 'v2') {
        const saved=await repo.updateV2(revision,expandSpicaV2Edits(args.edits as Record<string,unknown>[]));
        return JSON.stringify({saved:true,revision:saved.data.revision,view:'v2',
          validation:validateSpicaGraphV2(saved.data.graphV2),next:'run_spica_v2_graph',exported:false});
      }
      const saved=await repo.update(revision,args.edits as GraphEdit[]);
      return JSON.stringify({saved:true,revision:saved.data.revision,view:'schema1',next:'export_spica_app'});
    } catch(error) {
      return JSON.stringify({saved:false,revision,code:'INVALID_GRAPH_EDIT',message:error instanceof Error?error.message:String(error),
        next:'inspect_params',view:args.view==='v2'?'v2':'schema1'});
    }
  }
  if (args.revision !== current.data.revision) throw Error('Graph revision changed. Read the current graph.');
  if (!project.folder) throw Error('Link a standalone output folder first.');
  if (execution.spicaNeedsEdit) throw Error('Apply the requested graph edit first.');
  const { exportSpica, prepareSpica, spicaDependenciesReady, verifySpica } = await import('./export');
  const exportTarget = args.target === 'web' ? 'web' : 'desktop';
  if (name === 'export_spica_app') {
    const files = await exportSpica(project.folder, current, undefined, exportTarget);
    return JSON.stringify({ revision: current.data.revision, target: exportTarget, files,
      next: await spicaDependenciesReady(project.folder, exportTarget) ? 'verify_spica_app' : 'prepare_spica_app' });
  }
  const signal = execution.signal ?? new AbortController().signal;
  const output = ({ stream, chunk }: Parameters<NonNullable<Parameters<typeof verifySpica>[4]>>[0]) => onOutput?.(stream, chunk);
  if (name === 'prepare_spica_app') {
    const result = await prepareSpica(project.folder, current, false, signal, output, execution.onCommandResult, undefined, exportTarget);
    return JSON.stringify({ ok: result.ok, revision: current.data.revision, checks: result.results.map(command => ({
      id: command.command_id, exitCode: command.exit_code, runId: command.run_id, diagnostic: command.exit_code === 0 ? undefined : command.stderr.slice(-800),
    })) });
  }
  if (name !== 'verify_spica_app') throw Error('Unknown SPICA operation.');
  const evidence = await verifySpica(project.folder, current, execution.webEnabled, signal, output, execution.onCommandResult, undefined, exportTarget);
  const repairable = evidence.runtime?.some(run => run.reports.some(report => report.state === 'failed')) ?? false;
  return JSON.stringify({
    ok: evidence.state === 'passed', state: evidence.state, revision: evidence.revision, target: evidence.platform, artifactSha: evidence.executableSha, source: evidence.source,
    diagnostic: evidence.diagnostic, repairable, runtime: evidence.runtime?.map(run => ({
      id: run.id, reports: run.reports.map(report => ({ phase: report.phase, state: report.state, completed: report.completed, diagnostic: report.diagnostic })),
    })), checks: evidence.checks.map(result => ({
      id: result.command_id, exitCode: result.exit_code, runId: result.run_id,
      ...(result.exit_code === 0 ? {} : { diagnostic: (result.stderr.slice(-500) + '\n' + result.stdout.slice(-1000)).trim() }),
    })),
  });
}
