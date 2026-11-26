'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const built=path.join(root,'.spica-phase07-test/spica');
const {listSpicaToolchain,inspectSpicaTool,inspectSpicaWiring,spicaToolPrerequisites,nextSpicaAction}=require(path.join(built,'tool-intelligence.js'));
const {listRuntimeBlocks,getRuntimeBlock}=require(path.join(built,'runtime/registry.js'));
const {inspectExecutableBlock,searchExecutableBlocks}=require(path.join(built,'runtime/discovery.js'));
const {previewSpicaComposition}=require(path.join(built,'runtime/composition.js'));
const {executeSpicaGraphV2}=require(path.join(built,'runtime/executor.js'));
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const transpile=name=>ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const validator={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-validation.ts'),{module:validator,exports:validator.exports,require:()=>({}),console});
const argumentDecoder={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-arguments.ts'),{module:argumentDecoder,exports:argumentDecoder.exports,console});
const contract={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-contract-intelligence.ts'),{module:contract,exports:contract.exports,require:id=>{
 if(id==='./tool-validation')return validator.exports;
 if(id==='./tool-arguments')return argumentDecoder.exports;
 throw Error('Unmocked contract dependency: '+id);
},console});
const styleProperties={background:{},text:{}};
const current={data:{revision:12,graph:{pages:[],controls:[],program:{screens:[],flows:[],scenarios:[],grants:[]},collections:[]},graphV2:undefined},title:'Test project'};
const editSchemas={exports:{}};
vm.runInNewContext(transpile('src/spica/edit-schemas.ts'),{module:editSchemas,exports:editSchemas.exports,require:()=>({}),console});
const mock={
  './tool-aliases':require(path.join(built,'tool-aliases.js')),
  './construction-insights':require(path.join(built,'construction-insights.js')),
  './inspect-tool-view':require('./inspect-tool-view-source.cjs'),
  '../engine/creator':{inspectProjectEnvironment:async()=>({rootEntryCount:0})},
  './edit-schemas':editSchemas.exports,
  './graph-v2/transactions':{applySpicaGraphTransaction:()=>({})},
  './graph-v2/edit-adapter':{expandSpicaV2Edits:edits=>edits,assertSpicaRuntimeNodeContracts:()=>{}},
  './runtime/blocks/registry':{getBlock:()=>undefined},
  './inspect-params-v2':{inspectSpicaV2Parameters:()=>({})},

  './repository':{SpicaRepository:class {async read(){return current;}}},
  './graph':{stableGraphJson:JSON.stringify,changeGraph:()=>{throw Error('No mutation allowed');},collectionUpgrade:()=>[],GraphEditError:Error},
  './appearance':{styleChanges:()=>[],styleProperties,styleStates:['base'],styleTargets:()=>[],styleValues:()=>[],supportedProperties:()=>[],supportedStates:()=>[]},
  './program':{capabilities:[],recipeCatalog:[]},
  './graph-v2/validation':{validateSpicaGraphV2:()=>({valid:true,errors:[],warnings:[]})},
  './warehouse':{searchSpicaWarehouse:()=>({}),inspectSpicaComponent:()=>({}),registeredWarehouseCounts:{adapters:26}},
  './runtime/registry':{listRuntimeBlocks,getRuntimeBlock},
  './runtime/discovery':{searchExecutableBlocks,inspectExecutableBlock},
  './runtime/composition':{previewSpicaComposition},
  './runtime/executor':{executeSpicaGraphV2},
  './inspect-params':{inspectSpicaParameters:(_graph,revision,operation)=>({revision,operation,available:true,fieldTypes:['text','boolean']})},
  './catalog/unified':{inspectSpicaCapability:async()=>({}),searchSpicaCapabilities:async()=>({candidates:[]})},
  './catalog/client':{listCatalogCategories:async()=>[]},
  './catalog/categories':{warehouseCategories:[],warehouseCapacity:350000},
  './professionalism':{auditSpicaDesign:()=>({passed:true})},
  './research-tools':{spicaResearchTools:[]},
  './tool-intelligence':{listSpicaToolchain,inspectSpicaTool,inspectSpicaWiring,spicaToolPrerequisites,nextSpicaAction},
  '../engine/intelligence/tool-validation':validator.exports,
  '../engine/intelligence/tool-contract-intelligence':contract.exports,
};
const mod={exports:{}};
vm.runInNewContext(transpile('src/spica/tools.ts'),{module:mod,exports:mod.exports,require:id=>{
 if(Object.hasOwn(mock,id))return mock[id];throw Error('Unmocked dependency: '+id);
},TextEncoder,AbortController,DOMException,structuredClone,console},{filename:'src/spica/tools.ts'});
const api=mod.exports;
mock['../engine/tools']={get toolDefinitions(){return api.spicaTools;},allowedToolDefinitions:()=>api.spicaTools};
const context={spicaProgram:true,webEnabled:false};const project={id:'test',folder:'/tmp/output'};
const call=async(name,args)=>JSON.parse(await api.executeSpicaTool(name,args,project,context));

test('spica_next_action query accepts text, structured goals, and keyword lists without inventing calls',async()=>{
 const definition=api.spicaTools.find(tool=>tool.function.name==='spica_next_action');
 assert.ok(definition);
 assert.deepEqual(Array.from(definition.function.parameters.properties.query.type),['string','object','array','null']);
 const scenarios=[
  [{stage:'compose',query:'recent notes Markdown'},'recent notes Markdown'],
  [{stage:'compose',query:{goal:'recent notes',keywords:['Markdown','search']}},'recent notes Markdown search'],
  [{stage:'compose',query:{query:'recents',features:['Markdown','navigation']}},'recents Markdown navigation'],
  [{stage:'compose',query:['recent notes','Markdown']},'recent notes Markdown'],
 ];
 for(const [args,expected] of scenarios){
  const checked=await call('check_spica_tool_call',{name:'spica_next_action',arguments:args});
  assert.equal(checked.ok,true,JSON.stringify(checked.errors));
  const result=await call('spica_next_action',args);
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.interpretedQuery,expected);
  assert.ok(api.spicaTools.some(tool=>tool.function.name===result.nextTool),JSON.stringify(result));
 }
 const originalV2=current.data.graphV2;
 try {
  current.data.graphV2={id:'test-graph'};
  const discovered=await call('spica_next_action',{stage:'compose',query:{goal:'recent notes',keywords:['Markdown','search']}});
  assert.equal(discovered.ok,true);
  assert.equal(discovered.nextTool,'resolve_spica_capabilities');
  assert.equal(discovered.nextArguments.queries[0],'recent notes Markdown search');
 } finally {current.data.graphV2=originalV2;}
 const nullQuery=await call('check_spica_tool_call',{name:'spica_next_action',arguments:{query:null}});
 assert.equal(nullQuery.ok,true);
 const bad=await call('spica_next_action',{query:{}});
 assert.equal(bad.ok,false);
 assert.equal(bad.code,'INVALID_NEXT_ACTION_QUERY');
 const invalid=await call('check_spica_tool_call',{name:'spica_next_action',arguments:{query:{unexpected:'anything'}}});
 assert.equal(invalid.ok,false);
});

test('Round F: aliased discovery names preflight, inspect and execute through the same real handler',async()=>{
 const aliased=await call('check_spica_tool_call',{
  name:'discover_compatible_blocks',arguments:{query:'recent notes Markdown',limit:3}
 });
 assert.equal(aliased.ok,true,JSON.stringify(aliased));
 assert.equal(aliased.tool,'resolve_spica_capabilities');
 assert.deepEqual(Array.from(aliased.canonicalArguments.queries),['recent notes Markdown']);
 const inspected=await call('inspect_spica_tool',{name:'discover_compatible_blocks'});
 assert.equal(inspected.ok,true);assert.equal(inspected.name,'resolve_spica_capabilities');
 const executed=await call('discover_compatible_blocks',{query:'recent notes Markdown',limit:3});
 assert.equal(executed.ok,true,JSON.stringify(executed));
 assert.equal(executed.kind,'registered_executable_capabilities');
});

test('real Spark tools enumerate their exact registered argument contracts',async()=>{
 const list=await call('list_spica_toolchain',{});
 const entry=list.actions.find(x=>x.name==='edit_spica_graph');
 assert.deepEqual(Array.from(entry.required),['revision']);
 assert.equal(list.revision,12);
 assert.ok(list.actions.find(x=>x.name==='inspect_spica_wiring'));
 const details=await call('inspect_spica_tool',{name:'edit_spica_graph',operation:'add_page'});
 assert.equal(details.ok,true);
 assert.equal(details.schema.additionalProperties,false);
 assert.equal(details.operationContract.operation,'add_page');
 assert.ok(details.schema.properties.edits);
});

test('toolchain supplies exact paginated schemas with stage filters instead of requiring repeat inspections',async()=>{
 const page=await call('list_spica_toolchain',{stage:'edit',limit:2,offset:0,includeSchemas:true});
 assert.equal(page.actions.length,2);
 assert.ok(page.total>=2);
 assert.ok(page.actions.every(action=>action.stage==='edit'));
 for(const action of page.actions){
   assert.equal(action.schema.additionalProperties,false);
   assert.deepEqual(Array.from(action.schema.required||[]),Array.from(action.required));
   assert.deepEqual(Object.keys(action.schema.properties),Array.from(action.parameters));
 }
 if(page.nextOffset!==null){
   const next=await call('list_spica_toolchain',{stage:'edit',limit:2,offset:page.nextOffset,includeSchemas:true});
   assert.ok(!next.actions.some(action=>page.actions.some(previous=>previous.name===action.name)));
 } else assert.equal(page.actions.length,page.total,'no next page means all canonical edit tools were returned');
 const discovery=await call('list_spica_toolchain',{query:'edit_spica_graph',includeSchemas:true});
 assert.equal(discovery.total,1);
 assert.equal(discovery.actions[0].name,'edit_spica_graph');
 assert.ok(discovery.actions[0].schema.properties.edits);
 const noSchema=await call('list_spica_toolchain',{stage:'inspect',limit:2});
 assert.ok(noSchema.actions.every(action=>!Object.hasOwn(action,'schema')));
});

test('exact preflight accepts valid registered arguments but rejects guessed parameters',async()=>{
 const passed=await call('check_spica_tool_call',{name:'search_spica_runtime_blocks',arguments:{query:'markdown',limit:5}});
 assert.equal(passed.ok,true,JSON.stringify(passed.errors));
 assert.equal(passed.canSubmit,true);
 assert.equal(passed.next,'search_spica_runtime_blocks');
 const failed=await call('check_spica_tool_call',{name:'search_spica_runtime_blocks',arguments:{query:'markdown',unregistered:true}});
 assert.equal(failed.ok,false);
 assert.equal(failed.canSubmit,false);
 assert.ok(failed.errors.length);
});

test('tool preflight checks live edit prerequisites and revision instead of silently rewriting arguments',async()=>{
 const stale=await call('check_spica_tool_call',{name:'edit_spica_graph',arguments:{revision:10,edits:[{op:'rename',name:'Example'}]}});
 assert.equal(stale.ok,false);
 assert.ok(stale.errors.some(x=>/revision/i.test(x)));
 const malformed=await call('check_spica_tool_call',{name:'edit_spica_graph',arguments:{revision:12,edits:[{op:'put_screen',screen:{id:'invalid',view:'settings'}}]}});
 assert.equal(malformed.ok,false);
 assert.ok(malformed.errors.length);
});

test('Spark wiring inspection resolves real block ports without changing graph state',async()=>{
 const before=JSON.stringify(current);
 const wired=await call('inspect_spica_wiring',{blockIds:['spica.runtime.note_record','spica.runtime.note_card','spica.runtime.glass_surface']});
 assert.ok(wired.compatible.some(edge=>edge.from==='spica.runtime.note_record'&&edge.to==='spica.runtime.note_card'));
 assert.equal(JSON.stringify(current),before);
});

test('selection hides all writing tools until matching preflight',()=>{
 const selected=(last,action)=>api.selectSpicaTools(api.spicaTools,last,true,false,false,true,{hasGraph:true,hasV2:true,v2Intent:true,validatedAction:action}).map(x=>x.function.name);
 assert.ok(!selected(null).includes('compose_spica_v2_graph'));
 assert.ok(!selected('inspect_spica_tool').includes('compose_spica_v2_graph'));
 assert.ok(selected('check_spica_tool_call','compose_spica_v2_graph').includes('compose_spica_v2_graph'));
 assert.ok(!selected('check_spica_tool_call','compose_spica_v2_graph').includes('edit_spica_graph'));
});


test('block ID offered to tool inspector returns correct executable-block tool and does not block the next action',async()=>{
 const result=await call('inspect_spica_tool',{name:'spica.runtime.ui_markdown_editor'});
 assert.equal(result.ok,true);
 assert.equal(result.kind,'executable_block');
 assert.equal(result.callable,false);
 assert.equal(result.id,'spica.runtime.ui_markdown_editor');
 assert.equal(result.nextTool,'inspect_spica_wiring');
 const options=api.selectSpicaTools(api.spicaTools,'invalid_spica_tool',true,false,false,true,{hasGraph:true,hasV2:true,v2Intent:true}).map(t=>t.function.name);
 assert.ok(options.includes('check_spica_tool_call'),options.join(','));
 assert.ok(options.includes('validate_spica_edit'),options.join(','));
 assert.ok(!options.includes('compose_spica_v2_graph'),'a rejected inspector cannot authorize writes');
 const block=await call('inspect_spica_runtime_block',{id:'spica.runtime.ui_markdown_editor',version:'1'});
 assert.equal(block.id,'spica.runtime.ui_markdown_editor');
 assert.equal(block.kind,'renderer');
 assert.equal(block.runtimeOnly,true);
});

test('inspector accepts candidate arguments under the declared contract, without executing the target',async()=>{
 const before=JSON.stringify(current);
 const inspected=await call('inspect_spica_tool',{name:'search_spica_runtime_blocks',arguments:{query:'markdown',limit:5}});
 assert.equal(inspected.ok,true);
 assert.equal(inspected.candidateValidation.ok,true);
 const bad=await call('inspect_spica_tool',{name:'search_spica_runtime_blocks',arguments:{query:'markdown',inventedParameter:true}});
 assert.equal(bad.ok,true);
 assert.equal(bad.candidateValidation.ok,false);
 assert.match(bad.candidateValidation.error.message,/inventedParameter Unexpected property/);
 assert.equal(JSON.stringify(current),before);
});

test('every registered SPICA operation has a non-ambiguous contract in the shared registry',()=>{
 const registry=new contract.exports.ToolContractRegistry(api.spicaTools);
 assert.equal(registry.names().length,api.spicaTools.length);
 for(const name of registry.names()){
   const details=registry.inspect(name);
   assert.equal(details.ok,true);
   assert.equal(details.parameters.additionalProperties,false);
   assert.ok(details.required.every(key=>details.acceptedKeys.includes(key)),name);
 }
});


test('natural-language capability lookup returns real block IDs and data contracts without inventing tools',async()=>{
 const result=await call('resolve_spica_capabilities',{queries:['recent notes','markdown editor','records'],limitPerQuery:5});
 assert.equal(result.ok,true);
 assert.equal(result.matches.length,3);
 const ids=result.matches.flatMap(entry=>entry.blocks.map(block=>block.id));
 assert.ok(ids.includes('spica.runtime.record_list'),ids.join(','));
 assert.ok(ids.includes('spica.runtime.ui_markdown_editor'),ids.join(','));
 assert.ok(ids.every(id=>Boolean(getRuntimeBlock(id,'1'))));
 assert.ok(result.matches.every(match=>match.blocks.every(block=>block.registered&&Array.isArray(block.inputs))));
 assert.equal(api.spicaToolNames.has('spica.runtime.record_list'),false,'IDs are data, not callable tools');
});

test('inspection tools support queries and reject guessed IDs with actionable registered suggestions',async()=>{
 const searched=await call('inspect_spica_tool',{query:'graph edit'});
 assert.equal(searched.ok,true);
 assert.ok(searched.tools.some(t=>t.name==='edit_spica_graph'));
 const blocks=await call('inspect_spica_runtime_block',{query:'markdown editor'});
 assert.equal(blocks.ok,true);
 assert.ok(blocks.results.some(item=>item.id==='spica.runtime.ui_markdown_editor'));
 const aliased=await call('inspect_spica_runtime_block',{id:'notes_list'});
 assert.equal(aliased.ok,true);
 assert.equal(aliased.id,'spica.runtime.record_list');
 assert.equal(aliased.resolvedAlias,true);
 const missing=await call('inspect_spica_runtime_block',{id:'not_a_real_block'});
 assert.equal(missing.ok,false);
 assert.equal(missing.code,'UNKNOWN_BLOCK');
 assert.equal(missing.nextTool,'resolve_spica_capabilities');
 const invalid=await call('inspect_spica_wiring',{blockIds:['search_spica_runtime_blocks']});
 assert.equal(invalid.ok,false);
 assert.equal(invalid.code,'UNKNOWN_BLOCK_IDS');
 const wiring=await call('inspect_spica_wiring',{query:'markdown editor'});
 assert.equal(wiring.ok,true);
 assert.ok(wiring.registeredIds.every(id=>Boolean(getRuntimeBlock(id,'1'))));
});

test('Compose stage does not return to repeated inspection after an already-read graph',()=>{
 const current=api.selectSpicaTools(api.spicaTools,'read_spica_graph',true,false,false,true,
   {hasGraph:true,hasV2:true,v2Intent:true,taskStage:'compose'}).map(tool=>tool.function.name);
 assert.ok(current.includes('validate_spica_composition'),current.join(','));
 assert.ok(current.includes('resolve_spica_capabilities'),current.join(','));
 assert.ok(!current.includes('read_spica_graph'),current.join(','));
 assert.ok(!current.includes('inspect_spica_tool'),current.join(','));
});


test('global tool inspector accepts operation and proposed parameters without executing a write',async()=>{
 const before=JSON.stringify(current);
 const inspected=await call('inspect_solarium_tool',{name:'edit_spica_graph',view:'schema1',operation:'add_page',
   parameters:{revision:12,view:'schema1',edits:[{op:'add_page',id:'recents',label:'Recents'}]}});
 assert.equal(inspected.ok,true);
 assert.equal(inspected.name,'edit_spica_graph');
 assert.equal(inspected.candidateValidation.ok,true,JSON.stringify(inspected.candidateValidation));
 const invalid=await call('inspect_solarium_tool',{name:'edit_spica_graph',view:'schema1',operation:'add_page',
   parameters:{revision:12,view:'schema1',edits:[{op:'add_page',id:'recents',label:'Recents',invented:true}]}});
 assert.equal(invalid.candidateValidation.ok,false);
 assert.equal(JSON.stringify(current),before,'Inspecting arguments cannot persist a graph edit');
 const searched=await call('inspect_solarium_tool',{query:'graph'});
 assert.equal(searched.ok,true);
 assert.ok(searched.tools.some(tool=>tool.name==='edit_spica_graph'));
});

test('identifier inspector exposes only explicit verified runtime aliases and real callable tools',async()=>{
 const data=await call('inspect_spica_identifier',{query:'markdown'});
 assert.equal(data.ok,true);
 assert.ok(data.registeredBlockIds.includes('spica.runtime.ui_markdown'));
 const resolved=await call('inspect_spica_identifier',{id:'MarkdownEditorBlock'});
 assert.equal(resolved.ok,true);
 assert.equal(resolved.id,'spica.runtime.ui_markdown_editor');
 assert.equal(resolved.resolvedAlias,true);
 assert.equal(resolved.callable,false);
 const invalid=await call('inspect_spica_identifier',{id:'random_unknown_block'});
 assert.equal(invalid.ok,false);
});

test('Round A: invalid scoped edit never crashes tool advertisement or becomes a callable operation',async()=>{
  const proposed={view:'v2',operations:['a_new_feature_that_is_not_an_edit_op']};
  const safe=api.selectSpicaTools(api.spicaTools,'check_spica_tool_call',true,false,false,true,
    {hasGraph:true,hasV2:true,v2Intent:true,validatedAction:'edit_spica_graph',editScope:proposed});
  const editor=safe.find(t=>t.function.name==='edit_spica_graph');
  assert.ok(editor,'a corrected edit call must remain reachable');
  assert.deepEqual(Array.from(editor.function.parameters.required),['revision','view']);
  assert.ok(JSON.stringify(editor.function.parameters).length<4000,'invalid scope must not expose the massive unscoped union');
  const inspected=await call('inspect_spica_tool',{name:'edit_spica_graph',view:'v2',operation:'made_up_graph_operation'});
  assert.equal(inspected.ok,false);
  assert.equal(inspected.code,'UNSUPPORTED_EDIT_OPERATION');
  assert.ok(inspected.allowedOperations.includes('add_block'));
  const result=await call('inspect_params',{view:'v2',operation:'made_up_graph_operation'});
  assert.equal(result.ok,false);
  assert.equal(result.code,'UNSUPPORTED_EDIT_OPERATION');
  assert.equal(result.nextTool,'inspect_params');
  const global=await call('inspect_solarium_tool',{name:'edit_spica_graph',view:'v2',operation:'made_up_graph_operation'});
  assert.equal(global.ok,false);
  assert.equal(global.code,'UNSUPPORTED_EDIT_OPERATION');
});

test('Round A: missing V2 offers a reachable migration prerequisite, not composition validation',()=>{
  for(const last of [null,'read_spica_graph','spica_next_action','inspect_spica_tool','inspect_params']){
    const tools=api.selectSpicaTools(api.spicaTools,last,true,false,false,true,
      {hasGraph:true,hasV2:false,v2Intent:true,taskStage:'compose',canEdit:true}).map(t=>t.function.name);
    assert.ok(tools.includes('validate_spica_edit'),`missing reachable canonical migration preflight after ${last}: ${tools}`);
    assert.ok(tools.includes('check_spica_tool_call'),`missing exact preflight after ${last}: ${tools}`);
    assert.ok(!tools.includes('validate_spica_composition'),`composition not ready after ${last}: ${tools}`);
  }
  const afterCheck=api.selectSpicaTools(api.spicaTools,'check_spica_tool_call',true,false,false,true,
    {hasGraph:true,hasV2:false,v2Intent:true,validatedAction:'migrate_spica_v2_graph'}).map(t=>t.function.name);
  assert.ok(afterCheck.includes('migrate_spica_v2_graph'));
  assert.ok(!afterCheck.includes('compose_spica_v2_graph'));
});

test('Round A: rejected graph-edit parameters return a compact operation contract, never the entire union',async()=>{
  const wrong=await call('check_spica_tool_call',{name:'edit_spica_graph',arguments:{
    collection_id:'notes',edit_type:'set_property',field_key:'body',new_value:'markdown'
  }});
  assert.equal(wrong.ok,false);
  assert.equal(wrong.canSubmit,false);
  assert.ok(wrong.errors.some(e=>e.includes('revision')));
  assert.ok(wrong.schema.acceptedKeys.includes('edits'));
  assert.ok(wrong.schema.acceptedKeys.includes('edit_type'));
  assert.deepEqual(Array.from(wrong.schema.required),['revision']);
  assert.ok(wrong.schema.acceptedKeys.includes('view'));
  assert.ok(!JSON.stringify(wrong.schema).includes('"oneOf"'));
  assert.ok(JSON.stringify(wrong).length<3800,'small context must not receive massive unfiltered schema');
});

test('Round A: corrected calls remain available even when the same tool name previously stalled',()=>{
  const names=api.selectSpicaTools(api.spicaTools,'check_spica_tool_call',true,false,false,true,
    {hasGraph:true,hasV2:true,v2Intent:true,validatedAction:'edit_spica_graph',suppressedTool:'edit_spica_graph',
      editScope:{view:'v2',operations:['add_block']}}).map(t=>t.function.name);
  assert.ok(names.includes('edit_spica_graph'),'block exact bad arguments, not every future valid call by name');
});

test('Round A: SPICA understands instructions addressed to different Sparks without a hardcoded persona',()=>{
  for(const name of ['Dona','Astra','Orion']){
    assert.equal(api.isSpicaProgramRequest(`${name}, build a notes app with SPICA`),true,name);
    assert.equal(api.isSpicaCreationRequest(`${name}, build a notes app with SPICA`),true,name);
  }
  assert.equal(api.isSpicaProgramRequest('Please explain how the SPICA graph works'),false);
});

test('context guard: SPICA never advertises the 18KB unscoped edit union to a small model',()=>{
 const full=api.spicaTools.find(t=>t.function.name==='validate_spica_edit');
 assert.ok(JSON.stringify(full.function.parameters).length>15000,'baseline unified schema is too large for 8K context');
 const offered=api.selectSpicaTools(api.spicaTools,'read_spica_graph',true,false,false,true,
  {v2Intent:true,hasGraph:true,hasV2:false,canEdit:true});
 const migration=offered.find(t=>t.function.name==='validate_spica_edit');
 assert.ok(migration,'migrate preflight must be offered');
 assert.ok(JSON.stringify(migration.function.parameters).length<2500);
 assert.deepEqual(Array.from(migration.function.parameters.properties.edits.items.oneOf[0].properties.op.enum),['migrate_graph']);
 const active=api.selectSpicaTools(api.spicaTools,'validate_spica_composition',true,false,false,true,
  {v2Intent:true,hasGraph:true,hasV2:true,canEdit:true});
 const editor=active.find(t=>t.function.name==='edit_spica_graph');
 assert.ok(editor,'validated composition must lead to an executable editor');
 assert.ok(JSON.stringify(editor.function.parameters).length<2500);
 assert.deepEqual(Array.from(editor.function.parameters.properties.edits.items.oneOf[0].properties.op.enum),['compose_blocks']);
 const legacy=api.selectSpicaTools(api.spicaTools,'read_spica_graph',true,false,false,true,
  {v2Intent:false,hasGraph:true,hasV2:false,canEdit:true});
 assert.ok(JSON.stringify(legacy.find(t=>t.function.name==='validate_spica_edit').function.parameters).length<4500);
});

test('Loop repair: malformed preflight is followed by registered discovery, not identical preflight',()=>{
  const choices=api.selectSpicaTools(api.spicaTools,'invalid_spica_tool',true,false,false,true,{
    hasGraph:true,hasV2:true,v2Intent:true,taskStage:'compose',
    invalidTool:'check_spica_tool_call',invalidDiagnostic:'check_spica_tool_call.name is required'
  }).map(tool=>tool.function.name);
  assert.ok(choices.includes('spica_next_action'),choices.join(','));
  assert.ok(choices.includes('list_spica_toolchain'),choices.join(','));
  assert.ok(!choices.includes('check_spica_tool_call'),choices.join(','));
  assert.ok(choices.every(name=>api.spicaToolNames.has(name)));
});

test('Loop repair: canonical preflight accepts reviewed tool/params aliases but not guessed names',async()=>{
  const result=await call('check_spica_tool_call',{
    tool:'spica_next_action',params:{stage:'compose',query:'Markdown notes'}
  });
  assert.equal(result.ok,true,JSON.stringify(result));
  assert.equal(result.tool,'spica_next_action');
  const failed=await call('check_spica_tool_call',{name:'unregistered_new_thing',arguments:{}});
  assert.equal(failed.ok,false);
  assert.equal(failed.code,'UNKNOWN_CHECK_TARGET');
  assert.equal(failed.nextTool,'list_spica_toolchain');
  assert.equal(failed.nextArguments.stage,'validate');
});

test('Loop repair: actual offered tool schemas produce bounded, registered-only guidance',()=>{
  const guide={exports:{}};
  vm.runInNewContext(transpile('src/spica/tool-call-guidance.ts'),{module:guide,exports:guide.exports,require:()=>{throw Error('Guidance is hook-free and has no runtime dependencies');},console});
  const offered=api.spicaTools.filter(tool=>['check_spica_tool_call','spica_next_action'].includes(tool.function.name));
  const read=guide.exports.spicaOfferedToolGuide(offered,api.spicaTools,{
    revision:12,hasGraph:true,hasV2:false,lastInvalidTool:'check_spica_tool_call',
    lastInvalidDiagnostic:'check_spica_tool_call.name is required'
  });
  assert.match(read,/check_spica_tool_call\(name, arguments\)/);
  assert.match(read,/spica_next_action\(/);
  assert.match(read,/"name":"edit_spica_graph"/);
  assert.match(read,/"revision":12/);
  assert.ok(read.length<=1000,read.length);
  assert.doesNotMatch(read,/unregistered_new_thing/);
  const message=guide.exports.spicaInvalidCallGuidance('check_spica_tool_call',
    'check_spica_tool_call.name is required',api.spicaTools,{revision:12,hasGraph:true,hasV2:false});
  assert.match(message,/required top-level arguments: name, arguments/);
  assert.match(message,/literal|ACTUAL registered target tool/);
});

test('Loop repair: Work Log result uses a full-width grid row instead of squeezing names vertically',()=>{
  const style=fs.readFileSync(path.join(root,'src/themes/foundation.css'),'utf8');
  const component=fs.readFileSync(path.join(root,'src/components/WorkLog.tsx'),'utf8');
  assert.match(style,/\.spica-work-tool\{display:grid;grid-template-columns:16px minmax\(0,1fr\) auto;/);
  assert.match(style,/\.spica-work-tool-result\[open\]\{grid-column:2 \/ -1;width:100%\}/);
  assert.match(style,/\.spica-work-tool-label\{min-width:0;overflow-wrap:break-word;word-break:normal/);
  assert.match(component,/className="spica-work-tool-label"/);
  assert.match(component,/className="spica-work-tool-result"/);
  assert.match(component,/collapseRepeatedWorkResults/);
  assert.match(component,/result\.name===result\.name|last\.result\.name===result\.name/);
});

test('regression: Round F alias preflight resolves a registered target without requiring an inspector call',async()=>{
 const result=await call('check_spica_tool_call',{name:'read_graph',arguments:{view:'schema1'}});
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.tool,'read_spica_graph');
 assert.equal(result.requestedAlias,'read_graph');
 assert.equal(result.canonicalName,'read_spica_graph');
 assert.deepEqual(JSON.parse(JSON.stringify(result.canonicalArguments)),{view:'schema1'});
 // No permissioned mutation occurred; a checked alias is only a canonical call proposal.
 assert.equal(current.data.revision,12);
});

test('regression: graph inspection and valid preflight form a reachable edit path',()=>{
 const base={hasGraph:true,hasV2:true,v2Intent:true,taskStage:'compose'};
 const discovery=api.selectSpicaTools(api.spicaTools,'read_spica_graph',true,false,false,true,base).map(t=>t.function.name);
 assert.ok(discovery.includes('resolve_spica_capabilities'),discovery.join(','));
 assert.ok(discovery.includes('check_spica_tool_call'),discovery.join(','));
 const accepted=api.selectSpicaTools(api.spicaTools,'check_spica_tool_call',true,false,false,true,
   {...base,validatedAction:'edit_spica_graph'}).map(t=>t.function.name);
 assert.ok(accepted.includes('edit_spica_graph'),accepted.join(','));
 assert.ok(!accepted.includes('check_spica_tool_call'),'Do not re-preflight an accepted operation');
 const rejected=api.selectSpicaTools(api.spicaTools,'invalid_spica_tool',true,false,false,true,
   {...base,invalidTool:'check_spica_tool_call',invalidDiagnostic:'UNKNOWN_CHECK_TARGET'}).map(t=>t.function.name);
 assert.ok(rejected.includes('inspect_spica_tool'),rejected.join(','));
 assert.ok(rejected.includes('list_spica_toolchain'),rejected.join(','));
 assert.ok(!rejected.includes('check_spica_tool_call'),'An unknown target must be discovered before preflight');
});
