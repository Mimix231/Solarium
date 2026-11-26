'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const root=path.resolve(__dirname,'../.spica-phase10-roundD-test');
const at=name=>require(path.join(root,name+'.js'));
const {selectSpicaConstructionTools}=at('spica/construction-coordinator');
const {createSpicaPlan,SpicaTaskOrchestrator}=at('engine/intelligence/spica-task-orchestrator');
const {listRuntimeBlocks,getRuntimeBlock}=at('spica/runtime/registry');
const {SpicaMemoryStore}=at('spica/runtime/store');
const {emptySpicaGraphV2}=at('spica/graph-v2/types');
const {previewSpicaComposition}=at('spica/runtime/composition');
const {executeSpicaGraphV2}=at('spica/runtime/executor');
const makeDef=name=>({type:'function',function:{name,description:name,parameters:{type:'object',properties:{},additionalProperties:false}}});
const compose=(nodes,connections=[])=>previewSpicaComposition(emptySpicaGraphV2('roundd.test','Round D'),{nodes,connections}).graph;
const source=(id,blockId,config={})=>({id,blockId:`spica.runtime.${blockId}`,config});
const edge=(from,output,to,input)=>({from,output,to,input});
const run=(graph,extra={})=>executeSpicaGraphV2(graph,{target:'desktop',grants:new Set(),...extra});
const seed=async()=>{const store=new SpicaMemoryStore(),tx=await store.begin();
  await tx.put('notes','old',{title:'Old',status:'active',updatedAt:'2026-01-01'});
  await tx.put('notes','new',{title:'New',status:'active',updatedAt:'2026-11-14'});
  await tx.put('notes','draft',{title:'Draft',status:'draft',updatedAt:'2026-11-01'});
  await tx.commit();return store;};

test('D1: verified graph preflight remains in reach; source editing becomes available after discovery churn',()=>{
 const graph=['validate_spica_edit','check_spica_tool_call','inspect_params'].map(makeDef);
 const source=['read_project_file','apply_project_changes','run_project_check'].map(makeDef);
 const p={stage:'compose',projectLinked:true,needsEdit:true,verified:false,inspections:6,verifiedChanges:0,lastTool:'inspect_params'};
 const offered=selectSpicaConstructionTools(graph,source,p).map(t=>t.function.name);
 assert.ok(offered.includes('apply_project_changes'),offered.join(','));
 assert.ok(offered.some(x=>x==='validate_spica_edit'||x==='check_spica_tool_call'));
 assert.equal(new Set(offered).size,offered.length);
 const noFolder=selectSpicaConstructionTools(graph,source,{...p,projectLinked:false});
 assert.ok(noFolder.every(t=>!source.some(s=>s.function.name===t.function.name)));
 const noEdit=selectSpicaConstructionTools(graph,source,{...p,needsEdit:false});
 assert.ok(noEdit.every(t=>!source.some(s=>s.function.name===t.function.name)));
});

test('D1: following a real file edit, real check tools become reachable rather than restarting discovery',()=>{
 const graph=['inspect_params','validate_spica_edit'].map(makeDef);
 const source=['run_project_check','read_project_file','apply_project_changes'].map(makeDef);
 const offered=selectSpicaConstructionTools(graph,source,{stage:'verify',projectLinked:true,needsEdit:true,verified:false,inspections:3,verifiedChanges:0,lastTool:'apply_project_changes'}).map(t=>t.function.name);
 assert.equal(offered[0],'run_project_check');
});

test('D3: failed native checks offer diagnostics and a source repair tool in the same working set',()=>{
 const graph=['validate_spica_edit','check_spica_tool_call'].map(makeDef);
 const source=['read_command_output','read_project_file','replace_project_text','apply_project_changes'].map(makeDef);
 const offered=selectSpicaConstructionTools(graph,source,{
   stage:'verify',projectLinked:true,needsEdit:true,verified:false,inspections:4,verifiedChanges:0,
   lastTool:'run_project_check',failedChecks:1,
 }).map(t=>t.function.name);
 assert.ok(offered.includes('read_command_output'),offered.join(','));
 assert.ok(offered.includes('replace_project_text')||offered.includes('apply_project_changes'),offered.join(','));
 assert.ok(offered.includes('validate_spica_edit')||offered.includes('check_spica_tool_call'),offered.join(','));
 assert.equal(new Set(offered).size,offered.length);
});

test('D4: inspections cannot checkpoint or advance feature progress; confirmed source changes can',()=>{
 const orchestrator=new SpicaTaskOrchestrator(createSpicaPlan('t','s','p','Build Recents',11));
 orchestrator.beginThought(1,4096,['read_project_file','apply_project_changes']);
 orchestrator.captureThought({promptTokens:100,promptTokenSource:'estimate',outputTokens:20,outputTokenSource:'estimate',finishReason:'tool_calls',reasoning:'',proposedTools:['read_spica_graph']});
 orchestrator.recordThoughtTool({id:'read1',name:'read_spica_graph',status:'completed',evidence:'Read graph'});
 orchestrator.observe('read_spica_graph','completed',{evidence:'Read graph'});
 orchestrator.finishThought();
 assert.equal(orchestrator.onionCheckpoint,null);
 assert.equal(orchestrator.plan.steps.find(x=>x.id==='compose').state,'pending');
 orchestrator.beginThought(2,4096,['apply_project_changes']);
 orchestrator.captureThought({promptTokens:200,promptTokenSource:'estimate',outputTokens:40,outputTokenSource:'estimate',finishReason:'tool_calls',reasoning:'',proposedTools:['apply_project_changes']});
 orchestrator.recordThoughtTool({id:'write1',name:'apply_project_changes',status:'completed',evidence:'Native saved'});
 orchestrator.recordSourceWrite(['src/Recents.tsx'],1);
 orchestrator.finishThought();
 assert.equal(orchestrator.plan.sourceWrites,1);
 assert.deepEqual(orchestrator.plan.sourceFiles,['src/Recents.tsx']);
 assert.equal(orchestrator.plan.steps.find(x=>x.id==='compose').state,'completed');
 const checkpoint=JSON.parse(orchestrator.onionCheckpoint);
 assert.ok(checkpoint.sourceFiles.includes('src/Recents.tsx'));
 assert.equal(orchestrator.plan.status,'verifying');
 orchestrator.observe('complete_project_task','completed',{verified:true});
 assert.equal(orchestrator.plan.status,'completed');
});

test('D4: interruption preserves confirmed file evidence but never replays a pending source write',()=>{
 const original=new SpicaTaskOrchestrator(createSpicaPlan('t','s','p','Build Notes',5));
 original.beginThought(1,4096,['apply_project_changes']);
 original.recordSourceWrite(['src/Notes.tsx'],2);
 const saved=original.plan;
 const restored=new SpicaTaskOrchestrator(saved);
 assert.ok(restored.plan.sourceFiles.includes('src/Notes.tsx'));
 assert.equal(restored.plan.batches.at(-1).status,'paused');
 restored.beginThought(2,4096,['run_project_check']);
 assert.equal(restored.plan.sourceWrites,1);
});

test('D2: all added blocks have source-backed config schemas and executable contracts',()=>{
 const adapters=listRuntimeBlocks();assert.ok(adapters.length>=148);
 const newNames=['state_derive','state_reset','state_subscribe','event_filter','event_dispatch','event_sequence','event_throttle',
  'record_count','record_query','record_pagination','record_upsert','array_join_field','array_aggregate','array_project',
  'logic_switch','logic_guard','logic_sequence','validate_value','validate_schema','validate_form','error_capture','error_map',
  'function_map','function_filter','function_reduce','function_compose','ui_dialog','ui_form','ui_loading_state','ui_validation_error','layout_split','layout_scroll'];
 for(const name of newNames){const item=getRuntimeBlock('spica.runtime.'+name,'1');assert.ok(item,name);
   assert.ok(item.configSchema,`missing config schema ${name}`);
   assert.doesNotThrow(()=>item.validateConfig(item.exampleConfig),name);
   assert.ok(typeof item.execute==='function');}
 assert.equal(new Set(adapters.map(a=>a.id)).size,adapters.length);
});

test('D2: approved record query reads a real store and composes a real Recents list',async()=>{
 const store=await seed();
 const graph=compose([source('read','record_query',{collection:'notes',field:'status',equals:'active',orderBy:'updatedAt',limit:20}),source('list','ui_list',{labelField:'title'})],
  [edge('read','items','list','items')]);
 const denied=await run(graph,{store});assert.equal(denied.state,'failed');
 const granted=await run(graph,{store,grants:new Set(['records.read'])});
 assert.equal(granted.state,'passed',granted.error);
 assert.deepEqual(granted.outputs.list.view.items.map(row=>row.title),['New','Old']);
});

test('D2: record count/page never overfetch and honor read permission',async()=>{
 const store=await seed();
 const count=await run(compose([source('count','record_count',{collection:'notes'})]),{store,grants:new Set(['records.read'])});
 assert.equal(count.state,'passed',count.error);assert.equal(count.outputs.count.count,3);
 const paginated=await run(compose([source('skip','number_value',{value:1}),source('page','record_pagination',{collection:'notes',limit:1})],
  [edge('skip','value','page','offset')]),{store,grants:new Set(['records.read'])});
 assert.equal(paginated.state,'passed',paginated.error);assert.equal(paginated.outputs.page.items.length,1);
 assert.equal(paginated.outputs.page.has_more,true);
});

test('D2: record upsert requires both read and write permission and persists atomically',async()=>{
 const store=await seed();
 const graph=compose([source('key','text_value',{value:'new'}),source('item','record_value',{record:{body:'**Markdown**'}}),source('save','record_upsert',{collection:'notes'})],
  [edge('key','value','save','key'),edge('item','record','save','value')]);
 const denied=await run(graph,{store,grants:new Set(['records.write'])});assert.equal(denied.state,'failed');
 assert.equal(store.read('notes','new').body,undefined);
 const saved=await run(graph,{store,grants:new Set(['records.read','records.write'])});
 assert.equal(saved.state,'passed',saved.error);
 assert.equal(store.read('notes','new').title,'New');
 assert.equal(store.read('notes','new').body,'**Markdown**');
});

test('D2: safe combinators and validation actually execute with connected ports',async()=>{
 const graph=compose([source('records','array_value',{items:[{name:'A',cost:2},{name:'B',cost:4}]}),
 source('calc','array_aggregate',{field:'cost',operation:'average'}),source('guard','validate_value',{type:'number'})],
 [edge('records','items','calc','items'),edge('calc','value','guard','value')]);
 const result=await run(graph);assert.equal(result.state,'passed',result.error);
 assert.equal(result.outputs.calc.value,3);assert.equal(result.outputs.guard.valid,true);
});

test('D2: real UI blocks produce descriptors supported by live renderer',async()=>{
 const dialog=await run(compose([source('text','ui_text',{}),source('dialog','ui_dialog',{title:'Edit Note',eventId:'close_dialog',open:true})],
  [edge('text','view','dialog','content')]));
 // A missing text input legitimately causes the dialog node to be skipped; use a real string.
 const graph=compose([source('body','text_value',{value:'A note'}),source('text','ui_text',{}),
 source('dialog','ui_dialog',{title:'Edit Note',eventId:'close_dialog',open:true}),
 source('form','ui_form',{title:'New Note',fields:['title','body'],eventId:'submit_note'})],
 [edge('body','value','text','text'),edge('text','view','dialog','content')]);
 const result=await run(graph);assert.equal(result.state,'passed',result.error);
 assert.equal(result.outputs.dialog.view.renderer,'spica.ui.ui_dialog');
 assert.equal(result.outputs.form.view.renderer,'spica.ui.ui_form');
 assert.notEqual(dialog.state,'passed','Required text input must not produce a fabricated dialog');
});
