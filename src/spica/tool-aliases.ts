/** Phase 10 Round F: reviewed, non-executable alternate spellings of REAL
 * registered callable tools. An alias never registers a new handler or grants
 * a permission. The model is offered canonical names, not duplicate schemas.
 * Tool and executable block aliases occupy different namespaces. */
export const explicitSpicaToolAliases: Readonly<Record<string,string>> = Object.freeze({
  discover_compatible_blocks:'resolve_spica_capabilities',
  discover_blocks:'resolve_spica_capabilities',
  find_compatible_blocks:'resolve_spica_capabilities',
  resolve_blocks_for_task:'resolve_spica_capabilities',
  search_compatible_blocks:'resolve_spica_capabilities',
  find_block_capabilities:'resolve_spica_capabilities',
  find_spica_capabilities:'resolve_spica_capabilities',
  get_compatible_blocks:'resolve_spica_capabilities',
  discover_runtime_blocks:'search_spica_runtime_blocks',
  search_blocks:'search_spica_runtime_blocks',
  search_spica_blocks:'search_spica_runtime_blocks',
  find_runtime_blocks:'search_spica_runtime_blocks',
  find_spica_blocks:'search_spica_runtime_blocks',
  lookup_runtime_blocks:'search_spica_runtime_blocks',
  list_blocks:'list_spica_runtime_blocks',
  list_runtime_blocks:'list_spica_runtime_blocks',
  browse_spica_blocks:'list_spica_runtime_blocks',
  inspect_block:'inspect_spica_runtime_block',
  inspect_runtime_block:'inspect_spica_runtime_block',
  inspect_block_contract:'inspect_spica_runtime_block',
  describe_spica_block:'inspect_spica_runtime_block',
  get_runtime_block:'inspect_spica_runtime_block',
  inspect_blocks:'inspect_spica_runtime_blocks',
  inspect_block_ports:'inspect_spica_wiring',
  inspect_block_connections:'inspect_spica_wiring',
  check_block_wiring:'inspect_spica_wiring',
  inspect_tool:'inspect_spica_tool',
  inspect_tool_contract:'inspect_spica_tool',
  describe_spica_tool:'inspect_spica_tool',
  lookup_spica_tool:'inspect_spica_tool',
  list_tools:'list_solarium_tools',
  list_available_tools:'list_solarium_tools',
  find_tool_calls:'list_spica_toolchain',
  inspect_edit_parameters:'inspect_params',
  inspect_edit_schema:'inspect_params',
  get_edit_contract:'inspect_params',
  check_tool_call:'check_spica_tool_call',
  validate_tool_call:'check_spica_tool_call',
  preflight_tool_call:'check_spica_tool_call',
  validate_graph_edit:'validate_spica_edit',
  preflight_graph_edit:'validate_spica_edit',
  check_spica_edit:'validate_spica_edit',
  validate_spica_graph_edit:'validate_spica_edit',
  read_graph:'read_spica_graph',
  inspect_graph:'read_spica_graph',
  load_spica_graph:'read_spica_graph',
  get_spica_graph:'read_spica_graph',
  edit_graph:'edit_spica_graph',
  apply_graph_edit:'edit_spica_graph',
  spica_graph_edit:'edit_spica_graph',
  update_spica_graph:'edit_spica_graph',
  apply_spica_changes:'edit_spica_graph',
  modify_spica_graph:'edit_spica_graph',
  validate_block_composition:'validate_spica_composition',
  validate_graph_composition:'validate_spica_composition',
  check_spica_composition:'validate_spica_composition',
  run_graph:'run_spica_graph',
  execute_spica_graph:'run_spica_graph',
  run_runtime_graph:'run_spica_graph',
  inspect_build:'inspect_spica_build',
  inspect_spica_build_status:'inspect_spica_build',
  get_spica_build_status:'inspect_spica_build',
  verify_app_build:'verify_spica_app',
  verify_spica_build:'verify_spica_app',
  export_app:'export_spica_app',
  export_spica_project:'export_spica_app',
  prepare_app_build:'prepare_spica_app',
  inspect_spica_export:'inspect_spica_target',
  next_spica_action:'spica_next_action',
  suggest_spica_next_action:'spica_next_action',
  inspect_spica_next_action:'spica_next_action',
  create_spica_project:'create_spica_app',
  audit_spica_design:'audit_spica_ui',
});

export interface SpicaCallableDefinition {function:{name:string}};
const generatedAliases=new Map<string,string>();
function pascal(source:string){return source.split('_').map(word=>word.slice(0,1).toUpperCase()+word.slice(1)).join('');}
/** Derived spellings are installed only for unique registered tool names. */
export function installVerifiedSpicaToolAliases(tools:readonly SpicaCallableDefinition[]):void {
  generatedAliases.clear();
  const actual=new Set(tools.map(tool=>tool.function.name));
  for(const [alias,target] of Object.entries(explicitSpicaToolAliases)) {
    if(actual.has(alias)||!actual.has(target))throw Error(`Invalid SPICA tool alias ${alias} → ${target}`);
  }
  const claims=new Map<string,Set<string>>();
  for(const tool of tools){
    const name=tool.function.name;
    const variants=[name.replace(/_/g,'-'),pascal(name),pascal(name).replace(/^./,c=>c.toLowerCase())];
    for(const spelling of variants){
      if(actual.has(spelling)||Object.hasOwn(explicitSpicaToolAliases,spelling))continue;
      const claim=claims.get(spelling)??new Set<string>();claim.add(name);claims.set(spelling,claim);
    }
  }
  for(const [spelling,targets] of claims)if(targets.size===1)generatedAliases.set(spelling,[...targets][0]!);
}
export function resolveSpicaToolName(name:string):string {
  return explicitSpicaToolAliases[name]??generatedAliases.get(name)??name;
}
export function aliasNamesForTool(canonical:string):string[] {
  return [...Object.entries(explicitSpicaToolAliases).filter(([,value])=>value===canonical).map(([name])=>name),
    ...[...generatedAliases.entries()].filter(([,value])=>value===canonical).map(([name])=>name)];
}
/** Alias-specific argument translation happens BEFORE the canonical schema
 * validator. Unknown properties remain intact and are rejected normally. */
export function normalizeSpicaToolAliasArguments(name:string, input:Record<string,unknown>):Record<string,unknown> {
  const canonical=resolveSpicaToolName(name);
  const args={...input};
  // Reviewed parameter aliases work for the canonical callable too. They are
  // translated before the same authoritative validator; the target must be a
  // literal registered name. No missing target is guessed or executed.
  if(canonical==='check_spica_tool_call'){
    if(args.name===undefined&&typeof args.tool==='string')args.name=args.tool;
    if(args.arguments===undefined&&args.params&&typeof args.params==='object'&&!Array.isArray(args.params))
      args.arguments=args.params;
    delete args.tool;delete args.params;
  }
  if(canonical===name)return args;
  if(canonical==='resolve_spica_capabilities'){
    if(args.queries===undefined){
      if(Array.isArray(args.requirements))args.queries=args.requirements;
      else if(typeof args.query==='string'&&args.query.trim())args.queries=[args.query];
      else if(typeof args.goal==='string'&&args.goal.trim())args.queries=[args.goal];
      else if(Array.isArray(args.keywords))args.queries=args.keywords;
    }
    if(args.limitPerQuery===undefined&&args.limit!==undefined)args.limitPerQuery=args.limit;
    delete args.query;delete args.goal;delete args.requirements;delete args.keywords;delete args.limit;
  }else if(canonical==='search_spica_runtime_blocks'){
    if(args.query===undefined&&typeof args.search==='string')args.query=args.search;
    delete args.search;
  }else if(canonical==='inspect_spica_runtime_block'){
    if(args.id===undefined&&typeof args.block_id==='string')args.id=args.block_id;
    if(args.id===undefined&&typeof args.blockId==='string')args.id=args.blockId;
    delete args.block_id;delete args.blockId;
  }else if(canonical==='inspect_spica_tool'||canonical==='check_spica_tool_call'){
    if(args.name===undefined&&typeof args.tool==='string')args.name=args.tool;
    delete args.tool;
  }
  return args;
}
