import type { ToolValidationDefinition as AgentToolDefinition } from '../engine/intelligence/tool-validation';

/** Select actual registered construction tools; the executor continues to own
 * authorization, argument validation, source-scoping and graph preflight. */
export interface SpicaConstructionAccess {
  stage: 'inspect'|'discover'|'compose'|'verify'|null;
  projectLinked: boolean;
  needsEdit: boolean;
  verified: boolean;
  /** Read-only tool calls never establish construction progress. */
  inspections: number;
  verifiedChanges: number;
  lastTool: string|null;
  /** Current failed native checks, not prior failures repaired at this revision. */
  failedChecks?: number;
  /** The existing application planner owns feature/file work; no recipe implementation is injected. */
  appStage?: 'plan'|'implement'|'verify';
  sourcePlan?: boolean;
  sourceRoute?: boolean;
  selectedSourceTools?: boolean;
  validatedAction?: string;
}
const SOURCE_TOOLS = new Set(['list_project_files','read_project_file','search_project_code',
  'apply_project_changes','replace_project_text','run_project_check','run_project_command',
  'read_command_output','register_project_command','complete_project_task','report_project_blocker',
  'get_project_map','query_project_intelligence','read_project_symbol','read_dependency_api','inspect_code_position',
  'plan_project_app','read_app_plan','complete_app_step']);
export const isSourceConstructionTool=(name:string):boolean=>SOURCE_TOOLS.has(name);
const SOURCE_WRITES = new Set(['apply_project_changes','replace_project_text']);
const CHECKS = new Set(['run_project_check','run_project_command']);
const PREFLIGHT = new Set(['validate_spica_edit','check_spica_tool_call','validate_spica_composition']);

/** Keep source edits and corrections reachable within a four-tool working set.
 * Never manufacture a tool: every returned definition came from the native or
 * SPICA tool registry, with its original parameters and handler. */
export function selectSpicaConstructionTools(
  graph: readonly AgentToolDefinition[], source: readonly AgentToolDefinition[], state: SpicaConstructionAccess,
): AgentToolDefinition[] {
  if (state.validatedAction) {
    const approved=graph.find(tool=>tool.function.name===state.validatedAction);
    if(approved)return [approved,...graph.filter(tool=>tool!==approved)].slice(0,4);
  }
  // A model-authored source plan or explicit tool selection owns the next page.
  // Native validation/authorization remain in the ordinary executor.
  if(state.projectLinked&&!state.verified&&(state.sourcePlan||state.sourceRoute||state.selectedSourceTools))return source.slice(0,4);
  if(state.projectLinked&&!state.verified&&state.appStage==='plan'){
    const planning=source.find(tool=>tool.function.name==='plan_project_app');
    const chooser=source.find(tool=>tool.function.name==='choose_project_tools');
    if(planning)return [planning,...graph.filter(tool=>tool.function.name!=='plan_project_app').slice(0,2),...(chooser?[chooser]:[])];
  }
  if(state.projectLinked&&!state.verified&&state.needsEdit&&state.stage==='inspect'){
    const chooser=source.find(tool=>tool.function.name==='choose_project_tools');
    if(chooser)return [...graph.slice(0,3),chooser];
  }
  if (!state.needsEdit || state.verified || !state.projectLinked || state.stage==='inspect' ||
      state.lastTool==='invalid_spica_tool') return graph.slice(0,5);
  // A valid preflight is a one-turn capability grant to *offer* the exact
  // registered action. Do not let the source-tool pager hide that action before
  // the model can submit the matching arguments to the permissioned executor.
  if (['check_spica_tool_call','validate_spica_edit','validate_spica_composition'].includes(state.lastTool??'') &&
      graph.some(t=>t.function.name==='edit_spica_graph' ||
        !PREFLIGHT.has(t.function.name) && t.function.name!=='inspect_spica_tool' && t.function.name!=='inspect_params')) {
    return graph.slice(0,4);
  }
  const allowedSource=source.filter(t=>SOURCE_TOOLS.has(t.function.name));
  if (!allowedSource.length) return graph.slice(0,5);
  const byName=(tools:readonly AgentToolDefinition[],order:readonly string[])=>
    order.flatMap(name=>tools.filter(t=>t.function.name===name));
  const graphActions=graph.filter(t=>PREFLIGHT.has(t.function.name)||t.function.name==='edit_spica_graph');
  const last=state.lastTool??'';
  const afterCheck=CHECKS.has(last);
  const repairing=afterCheck&&(state.failedChecks??0)>0;
  const afterSourceWrite=SOURCE_WRITES.has(last);
  // Inspecting a registered block three times without a write is not progress.
  // The construction route remains available even if the plan is stuck in Discover.
  const inspectionStall=(state.stage==='discover'||state.stage==='compose')&&state.inspections>=3;
  let desired:AgentToolDefinition[];
  if (repairing) {
    // A failed check requires evidence AND a possible fix in the same turn.
    desired=[...byName(allowedSource,['read_command_output','replace_project_text','apply_project_changes','read_project_file']).slice(0,3),
      ...graphActions,...allowedSource,...graph];
  } else if (afterCheck) {
    // If checks passed, permit the real completion/check workflow; don't
    // restart block discovery unless a new prerequisite requires it.
    desired=[...byName(allowedSource,['complete_project_task','run_project_check','run_project_command','read_project_file']).slice(0,2),
      ...graphActions,...allowedSource,...graph];
  } else if (afterSourceWrite) {
    desired=[...byName(allowedSource,['run_project_check','run_project_command','read_project_file','apply_project_changes']).slice(0,2),
      ...graphActions,...allowedSource,...graph];
  } else if (inspectionStall) {
    desired=[...byName(allowedSource,['apply_project_changes','replace_project_text','read_project_file','search_project_code']).slice(0,2),
      ...graphActions,...allowedSource,...graph];
  } else {
    // Offer an authorized read and a write alongside graph preflight: once
    // a Spark has enough evidence it need not earn access via more inspectors.
    const discovery=graph.filter(t=>!graphActions.includes(t));
    desired=[...discovery.slice(0,1),...graphActions.slice(0,2),
      ...byName(allowedSource,['read_project_file','apply_project_changes','replace_project_text']).slice(0,1),
      ...graph,...allowedSource];
  }
  const unique=new Set<string>();
  return desired.filter(t=>!unique.has(t.function.name)&&Boolean(unique.add(t.function.name))).slice(0,4);
}
