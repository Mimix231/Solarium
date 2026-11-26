const test=require('node:test');
const assert=require('node:assert/strict');
const {SparkThoughtJournal,SparkThoughtContextAssembler}=require('../.test-dist/engine/intelligence/spark-thought.js');
const {selectSpicaConstructionTools}=require('../.test-dist/spica/construction-coordinator.js');
const {SpicaTaskOrchestrator,createSpicaPlan}=require('../.test-dist/engine/intelligence/spica-task-orchestrator.js');
const {previewSpicaComposition}=require('../.test-dist/spica/runtime/composition.js');
const {emptySpicaGraphV2}=require('../.test-dist/spica/graph-v2/types.js');
const {executeSpicaGraphV2}=require('../.test-dist/spica/runtime/executor.js');
const {SpicaMemoryStore}=require('../.test-dist/spica/runtime/store.js');
const {getRuntimeBlock}=require('../.test-dist/spica/runtime/registry.js');

const definition=name=>({type:'function',function:{name,parameters:{type:'object',properties:{},additionalProperties:false}}});
const node=(id,blockId,config={})=>({id,blockId:'spica.runtime.'+blockId,config});
const connection=(from,output,to,input)=>({from,output,to,input});
const compose=(nodes,connections=[])=>previewSpicaComposition(emptySpicaGraphV2('progress.test','Progress test'),{nodes,connections}).graph;
const run=(graph,options={})=>executeSpicaGraphV2(graph,{target:'desktop',grants:new Set(),...options});

test('the next independent thought retains an exact preflight proposal and inspected port contracts',()=>{
  const journal=new SparkThoughtJournal();
  journal.begin('compose','Add the requested function',7,4096,['validate_spica_composition']);
  journal.captureModel({reasoning:'LOCAL_PRIVATE_REASONING',proposedTools:['validate_spica_composition'],
    promptTokens:800,promptTokenSource:'server',outputTokens:90,outputTokenSource:'server',finishReason:'tool_calls'});
  const args={revision:7,view:'v2',edits:[{op:'compose_blocks',
    nodes:[node('sorted','array_sort',{field:'count',direction:'desc'})],connections:[]}]};
  journal.recordTool({id:'real-call',name:'validate_spica_composition',status:'completed',
    evidence:'{"ok":true}',checkedAction:{name:'edit_spica_graph',arguments:args}});
  const prior=journal.settle();
  const messages=new SparkThoughtContextAssembler().next(
    [{role:'system',content:'Original Spark instructions'},{role:'user',content:'Add quantity sorting'}],prior,null,journal.history);
  const handoff=messages.find(item=>item.content.startsWith('LAST OBSERVED ACTION'));
  assert.ok(handoff);
  assert.ok(handoff.content.includes(JSON.stringify(args)));
  assert.equal(messages.at(-1).content,'Add quantity sorting');
  assert.ok(!JSON.stringify(messages).includes('LOCAL_PRIVATE_REASONING'));
  const restored=new SparkThoughtJournal(journal.history).latest;
  assert.deepEqual(restored.toolResults[0].checkedAction.arguments,args);
  const intervening={...prior,toolResults:[{id:'read',name:'read_spica_graph',status:'completed',evidence:'{"revision":7}'}]};
  const afterRead=new SparkThoughtContextAssembler().next(
    [{role:'user',content:'Add quantity sorting'}],intervening,null,journal.history,undefined,restored.toolResults[0].checkedAction);
  assert.ok(afterRead.some(item=>item.content.includes(JSON.stringify(args))),'A still-approved proposal survives intervening reads');
  const editor=definition('edit_spica_graph');
  assert.equal(selectSpicaConstructionTools([editor],[definition('apply_project_changes')],{
    stage:'compose',projectLinked:true,needsEdit:true,verified:false,inspections:9,verifiedChanges:2,
    validatedAction:'edit_spica_graph',sourcePlan:true,lastTool:'inspect_spica_runtime_block',
  })[0],editor);
});

test('an app plan and explicit source selection keep construction reachable without a working graph editor',()=>{
  const source=['plan_project_app','apply_project_changes','read_project_file','choose_project_tools'].map(definition);
  const graph=['inspect_params','check_spica_tool_call'].map(definition);
  const state={stage:'inspect',projectLinked:true,needsEdit:true,verified:false,inspections:0,verifiedChanges:0,lastTool:null};
  assert.equal(selectSpicaConstructionTools(graph,source,{...state,appStage:'plan'})[0].function.name,'plan_project_app');
  assert.deepEqual(selectSpicaConstructionTools(graph,source,{...state,sourcePlan:true,lastTool:'invalid_spica_edit'}),source);
  assert.deepEqual(selectSpicaConstructionTools(graph,source,{...state,selectedSourceTools:true}),source);
  assert.deepEqual(selectSpicaConstructionTools(graph,source,{...state,sourceRoute:true,lastTool:'search_project_code'}),source,
    'Reading source must not send the Spark back to graph discovery or tool selection');
  assert.ok(selectSpicaConstructionTools(graph,source,{...state,projectLinked:false,sourcePlan:true}).every(item=>graph.includes(item)));
});

test('unrelated successful reads retain a real failure until its contract or project state changes',()=>{
  const tasks=new SpicaTaskOrchestrator(createSpicaPlan('task','chat','project','Add a new feature',3));
  tasks.observe('edit_spica_graph','failed',{evidence:'INVALID_BLOCK_CONFIG'});
  tasks.observe('read_spica_graph','completed');
  assert.equal(tasks.plan.lastError,'INVALID_BLOCK_CONFIG');
  tasks.observe('inspect_params','completed');
  assert.equal(tasks.plan.lastError,undefined);
  tasks.observe('edit_spica_graph','completed',{graphRevision:4});
  assert.equal(tasks.plan.inspections,0);
  assert.equal(tasks.plan.verifiedChanges,1);
});

test('verified source inspection advances to construction without claiming a feature or check passed',()=>{
  const tasks=new SpicaTaskOrchestrator(createSpicaPlan('source','chat','project','Extend the current app',3));
  tasks.recordSourceInspection('src/main.tsx');
  assert.equal(tasks.nextStep,'compose');
  assert.equal(tasks.plan.verifiedChanges,0);
  assert.equal(tasks.plan.sourceWrites,0);
  assert.notEqual(tasks.plan.steps.find(s=>s.id==='compose').state,'completed');
  assert.notEqual(tasks.plan.steps.find(s=>s.id==='verify').state,'completed');
  tasks.observe('complete_project_task','completed',{verified:true});
  assert.notEqual(tasks.plan.status,'completed');
});

test('generic data blocks sort numerically, preserve ties, group typed values and reject invalid dates',async()=>{
  const graph=compose([
    node('rows','array_value',{items:[{group:'b',amount:10},{group:'a',amount:2},{group:'a',amount:2},{group:'c'}]}),
    node('sorted','array_sort',{field:'amount',direction:'asc'}),node('groups','array_group_by',{field:'group'}),
  ],[connection('rows','items','sorted','items'),connection('sorted','items','groups','items')]);
  const result=await run(graph);
  assert.equal(result.state,'passed',result.error);
  assert.deepEqual(result.outputs.sorted.items.map(row=>row.amount),[2,2,10,undefined]);
  assert.deepEqual(result.outputs.groups.groups.map(group=>[group.key,group.count]),[['a',2],['b',1],['c',1]]);
  const formatter=getRuntimeBlock('spica.runtime.date_localize','1');
  formatter.validateConfig({locale:'en-GB',timeZone:'UTC'});
  assert.match(formatter.execute({}, {value:'2026-11-17'},{}).text,/2026/);
  assert.throws(()=>formatter.execute({}, {value:'2026-02-30'},{}),/Invalid calendar date/);
  assert.throws(()=>formatter.execute({}, {value:'2026-02-30T12:00:00Z'},{}),/Invalid calendar date/);
});

test('working source pages preserve exact lines and pagination across a large module',()=>{
  const {projectSourcePage}=require('../.test-dist/engine/tools.js');
  const original=Array.from({length:180},(_,i)=>'line '+i+' 水 '+'.'.repeat(i%19*20)).join('\n');
  let cursor=1;const seen=[];
  for(let pageIndex=0;pageIndex<100;pageIndex++){
    const page=projectSourcePage(original,{start_line:cursor},3200);
    assert.equal(page.startLine,cursor);assert.ok(page.nextLine>cursor);
    assert.ok(page.content.length<=3200);
    seen.push(page.content);cursor=page.nextLine;if(!page.hasMore)break;
  }
  assert.equal(seen.join('\n'),original,'Paging neither repeats nor skips actual source lines');
  const offset=projectSourcePage(original,{offset:3200},3200);
  assert.equal(offset.content,original.slice(3200,6400));assert.equal(offset.nextOffset,6400);
});

test('application plan ID restrictions are declared before execution and errors name the exact constraint',()=>{
  const {AppBuilder}=require('../.test-dist/engine/intelligence/app-builder.js');
  const {allowedToolDefinitions}=require('../.test-dist/engine/tools.js');
  const {validateToolArguments}=require('../.test-dist/engine/intelligence/tool-validation.js');
  const args={architecture:'Keep the current application',steps:[{id:'new_feature',title:'New feature',files:['src/main.tsx'],depends_on:[],acceptance:['Actual interaction works']} ]};
  assert.equal(validateToolArguments('plan_project_app',args,allowedToolDefinitions(false)).ok,false);
  assert.throws(()=>new AppBuilder('Add a feature',true).plan(args.architecture,args.steps),/lowercase letters, digits and hyphens/);
  args.steps[0].id='new-feature';
  assert.equal(validateToolArguments('plan_project_app',args,allowedToolDefinitions(false)).ok,true);
});

test('event patches and deletes preserve fields and execute only on the delivered event, rolling back on failure',async()=>{
  const store=new SpicaMemoryStore(),tx=await store.begin();
  await tx.put('gear','radio',{title:'Radio',count:3,owner:'crew'});await tx.commit();
  const graph=compose([
    node('key','text_value',{value:'radio'}),node('patch','record_value',{record:{count:8}}),
    node('changed','ui_event_binding',{eventId:'save_gear'}),node('saved','record_patch_on_event',{collection:'gear'}),
  ],[connection('key','value','saved','key'),connection('patch','record','saved','patch'),connection('changed','trigger','saved','trigger')]);
  const options={store,grants:new Set(['records.read','records.write'])};
  assert.equal((await run(graph,options)).state,'passed');
  assert.equal(store.read('gear','radio').count,3);
  const denied=await run(graph,{store,grants:new Set(['records.read']),events:{save_gear:'true'}});
  assert.equal(denied.state,'failed');
  assert.equal(store.read('gear','radio').count,3);
  assert.equal((await run(graph,{...options,events:{save_gear:'true'}})).state,'passed');
  assert.deepEqual(store.read('gear','radio'),{title:'Radio',count:8,owner:'crew'});
  const failing=compose([
    node('key','text_value',{value:'radio'}),node('patch','record_value',{record:{count:99}}),
    node('changed','ui_event_binding',{eventId:'save_gear'}),node('saved','record_patch_on_event',{collection:'gear'}),
    node('negative','boolean_not'),node('assert','validate_assertion',{message:'Downstream failure'}),
  ],[connection('key','value','saved','key'),connection('patch','record','saved','patch'),connection('changed','trigger','saved','trigger'),
    connection('saved','saved','negative','value'),connection('negative','result','assert','condition')]);
  const rejected=await run(failing,{...options,events:{save_gear:'true'}});
  assert.equal(rejected.state,'failed');
  assert.equal(store.read('gear','radio').count,8,'A downstream error rolls back the completed patch transaction');
  const deletion=compose([node('key','text_value',{value:'radio'}),node('remove','ui_event_binding',{eventId:'remove_gear'}),
    node('deleted','record_delete_on_event',{collection:'gear'})],
    [connection('key','value','deleted','key'),connection('remove','trigger','deleted','trigger')]);
  assert.equal((await run(deletion,options)).state,'passed');
  assert.ok(store.read('gear','radio'));
  assert.equal((await run(deletion,{...options,events:{remove_gear:'true'}})).outputs.deleted.deleted,true);
  assert.equal(store.read('gear','radio'),undefined);
});

test('typed forms and style wrappers expose usable contracts and reject injected properties',()=>{
  const form=getRuntimeBlock('spica.runtime.ui_typed_form','1');
  form.validateConfig(form.exampleConfig);
  assert.throws(()=>form.validateConfig({...form.exampleConfig,fields:[{key:'count',label:'Count',type:'number',min:10,max:1}]}),/min exceeds max/);
  const surface=getRuntimeBlock('spica.runtime.styled_surface','1');
  surface.validateConfig(surface.exampleConfig);
  assert.throws(()=>surface.validateConfig({background:'url(https://untrusted.test/a)'}),/RRGGBB/);
  assert.throws(()=>surface.validateConfig({javascript:'alert(1)'}),/Unexpected config/);
});
