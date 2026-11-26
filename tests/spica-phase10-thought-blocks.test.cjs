'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const runtime=path.join(root,'.spica-phase10-test');
const {SparkThoughtJournal,SparkThoughtContextAssembler}=require(path.join(runtime,'engine/intelligence/spark-thought.js'));
const {SpicaTaskOrchestrator,createSpicaPlan}=require(path.join(runtime,'engine/intelligence/spica-task-orchestrator.js'));
const {AgentBudgetScheduler}=require(path.join(runtime,'engine/intelligence/agent-budget.js'));
const {inspectorViewSchema,resolveInspectorView}=require(path.join(runtime,'spica/inspect-tool-view.js'));
const {ToolContractRegistry,ToolCallValidator}=require(path.join(runtime,'engine/intelligence/tool-contract-intelligence.js'));

const model={promptTokens:1800,promptTokenSource:'server',outputTokens:390,
 outputTokenSource:'estimate',finishReason:'tool_calls',reasoning:'Inspect registered blocks, then apply a validated edit.',
 proposedTools:['search_spica_runtime_blocks','read_spica_graph']};

test('each model thought checkpoints before tools execute and settles only after every observed result',()=>{
 const journal=new SparkThoughtJournal();
 journal.begin('discover','Discover compatible blocks',11,4096,['search_spica_runtime_blocks','read_spica_graph']);
 assert.equal(journal.latest.status,'thinking');
 journal.captureModel(model);
 assert.equal(journal.latest.status,'executing');
 assert.deepEqual(journal.latest.proposedTools,model.proposedTools);
 assert.equal(journal.latest.toolResults.length,0);
 journal.recordTool({id:'a',name:'search_spica_runtime_blocks',status:'completed',evidence:'{"registeredIds":["spica.runtime.record_list"]}'});
 assert.throws(()=>journal.settle(),/every proposed tool/);
 journal.recordTool({id:'b',name:'read_spica_graph',status:'completed',evidence:'{"revision":11}'});
 journal.settle();
 assert.equal(journal.latest.status,'finished');
 assert.equal(journal.latest.toolResults.length,2);
 assert.equal(journal.latest.promptTokens,1800);
 assert.equal(journal.latest.outputTokens,390);
 assert.throws(()=>journal.recordTool({id:'c',name:'read_spica_graph',status:'completed',evidence:'replayed'}),/must emit tools/);
});

test('new thought context uses original instructions, the latest user request and observed evidence but no earlier reasoning',()=>{
 const journal=new SparkThoughtJournal();
 journal.begin('discover','Research',12,4096,['inspect_spica_tool']);
 journal.captureModel({...model,reasoning:'DO NOT REPEAT THIS PRIVATE THINKING TEXT',proposedTools:['inspect_spica_tool']});
 journal.recordTool({id:'c',name:'inspect_spica_tool',status:'completed',evidence:'Registered ports: input, output'});
 journal.settle();
 const assembler=new SparkThoughtContextAssembler();
 const base=assembler.base([{role:'system',content:'Use real tools'},
   {role:'user',content:'Outdated old user question'},
   {role:'assistant',content:'Secret preceding assistant history'},
   {role:'user',content:'Build a notes editor'}]);
 const next=assembler.next(base,journal.latest);
 assert.equal(next.at(-1).content,'Build a notes editor');
 const serialized=JSON.stringify(next);
 assert.match(serialized,/Registered ports/);
 assert.doesNotMatch(serialized,/DO NOT REPEAT THIS PRIVATE THINKING TEXT/);
 assert.doesNotMatch(serialized,/Secret preceding assistant history/);
 assert.doesNotMatch(serialized,/Outdated old user question/);
});

test('interrupted thoughts are paused on restore, and never replay pending tool proposals',()=>{
 const journal=new SparkThoughtJournal();
 journal.begin('compose','Apply edits',13,4096,['edit_spica_graph']);
 journal.captureModel({...model,proposedTools:['edit_spica_graph']});
 const restored=new SparkThoughtJournal(JSON.parse(JSON.stringify(journal.history)));
 assert.equal(restored.latest.status,'paused');
 assert.match(restored.latest.diagnostic,/not replayed/);
 const fresh=restored.begin('verify','Check actual saved revision',13,4096,['read_spica_graph']);
 assert.equal(fresh.index,2);
 assert.deepEqual(fresh.proposedTools,[]);
});

test('failed tool results are saved without marking construction successful, next thought can inspect a corrected contract',()=>{
 const p=new SpicaTaskOrchestrator(createSpicaPlan('t','s','p','Build app',14));
 p.beginThought(1,4096,['edit_spica_graph']);
 p.captureThought({...model,proposedTools:['edit_spica_graph']});
 p.recordThoughtTool({id:'bad',name:'edit_spica_graph',status:'failed',evidence:'revision is required'});
 p.finishThought();
 p.observe('edit_spica_graph','failed',{evidence:'revision is required'});
 assert.equal(p.plan.verifiedChanges,0);
 assert.equal(p.plan.thoughts[0].status,'finished');
 p.beginThought(2,4096,['inspect_spica_tool','check_spica_tool_call']);
 assert.equal(p.plan.thoughts[1].objective,'Inspect project');
 assert.equal(p.plan.thoughts[1].graphRevision,14);
});

test('the thought journal rejects duplicate observations and permission-denied tool results block the thought',()=>{
 const journal=new SparkThoughtJournal();
 journal.begin('compose','Save notes',20,4096,['edit_spica_graph']);
 journal.captureModel({...model,proposedTools:['edit_spica_graph']});
 journal.recordTool({id:'x',name:'edit_spica_graph',status:'denied',evidence:'Permission denied'});
 assert.throws(()=>journal.recordTool({id:'x',name:'edit_spica_graph',status:'completed',evidence:'fake'}),/Duplicate/);
 assert.equal(journal.settle().status,'blocked');
});

test('no-call model response pauses the thought rather than completing an unfinished task',()=>{
 const journal=new SparkThoughtJournal();
 journal.begin('compose','Construct graph',10,4096,['edit_spica_graph']);
 journal.captureModel({...model,proposedTools:[],finishReason:'stop'});
 assert.equal(journal.latest.status,'paused');
 assert.equal(journal.latest.toolResults.length,0);
 assert.match(journal.latest.diagnostic,/No callable tool/);
});

test('Round B uses the existing 4096 input target, not synthetic per-token model restarts',()=>{
 const allocation=new AgentBudgetScheduler(4096,8192).allocate();
 assert.equal(allocation.workingLimit,4096);
 const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 assert.match(agent,/spicaOrchestrator\.beginThought/);
 assert.match(agent,/spicaOrchestrator\.captureThought/);
 assert.match(agent,/spicaOrchestrator\.recordThoughtTool/);
 assert.match(agent,/spicaOrchestrator\.finishThought/);
 assert.match(agent,/messages:thoughtMessages/);
 assert.match(agent,/reasoningArchiveId/);
 assert.match(agent,/Math\.max\(spicaOrchestrator\.plan\.cycles/);
 assert.doesNotMatch(agent,/continue\s+thinking.*setTimeout/);
 const runtime=fs.readFileSync(path.join(root,'src/engine/continuous-generation.ts'),'utf8');
 assert.match(runtime,/one server-side inference request/);
 assert.match(runtime,/outputTokens\s*=\s*-1|adapter\.kind === 'llama\.cpp'/);
});

test('inspect_spica_tool.view accepts string, explicit object formats and null without an Expected string failure',()=>{
 const contract={type:'function',function:{name:'inspect_spica_tool',description:'Test real inspector view schema',parameters:{
   type:'object',properties:{view:inspectorViewSchema},additionalProperties:false}}};
 const validator=new ToolCallValidator(new ToolContractRegistry([contract]));
 for(const value of ['schema1','v2','both',{format:'v2'},{view:'schema1'},{type:'v2'},['schema1','v2'],null]){
   const validation=validator.check('inspect_spica_tool',{view:value});
   assert.equal(validation.ok,true,JSON.stringify(value)+': '+JSON.stringify(validation));
   assert.equal(resolveInspectorView(value).ok,true);
 }
 for(const value of [42,[],{format:'unknown'},{random:'v2'}]){
   const validation=validator.check('inspect_spica_tool',{view:value});
   assert.equal(validation.ok,false,JSON.stringify(value));
   assert.equal(resolveInspectorView(value).ok,false);
 }
 assert.deepEqual(resolveInspectorView({view:'v2'}),{ok:true,view:'v2'});
 assert.deepEqual(resolveInspectorView(['schema1','v2']),{ok:true,view:'both'});
 const source=fs.readFileSync(path.join(root,'src/spica/tools.ts'),'utf8');
 assert.match(source,/define\('inspect_spica_tool'[\s\S]*?view:inspectorViewSchema/);
 assert.match(source,/resolveInspectorView\(args\.view\)/);
});

test('compact Plan delegates thought evidence to Work Log and stays above composer',()=>{
 const component=fs.readFileSync(path.join(root,'src/components/SpicaTaskPlanView.tsx'),'utf8');
 const log=fs.readFileSync(path.join(root,'src/components/WorkLog.tsx'),'utf8');
 assert.doesNotMatch(component,/Independent Thought Blocks/);
 assert.match(log,/ThoughtActivities/);
 assert.match(log,/batch.checkpoint/);
 assert.match(component,/data-spica-plan-collapsed/);
});

test('durable TaskExecution persists the completed thought and starts the next independently after explicit resume',async()=>{
 const ts=require('typescript');
 const source=fs.readFileSync(path.join(root,'src/engine/intelligence/task.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const records=new Map();let sequence=0;
 const store={
   async list(filter){return [...records.values()].filter(r=>r.collection===filter.collection&&filter.scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)).map(r=>structuredClone(r));},
   async batch(puts){for(const {record,expected} of puts){const previous=records.get(record.id);assert.equal(previous?.version??null,expected);records.set(record.id,structuredClone(record));}},
 };
 const newRecord=(collection,id,scope,title,data)=>({collection,id,scope,title,data,version:1,updatedAt:new Date().toISOString()});
 const dependencies=name=>name==='../../domain/types'?{uid:()=>`uid-${++sequence}`}:
   name==='../../foundation/store'?{newRecord,foundationStore:store}:{};
 const module={exports:{}};new Function('require','module','exports',compiled)(dependencies,module,module.exports);
 const {TaskExecution}=module.exports;
 const session={id:'sparkA-chat',messages:[{role:'user',content:'Build task app'}]};
 const project={id:'projA'};
 const task=new TaskExecution(session,project,[],store);
 const orchestrator=new SpicaTaskOrchestrator(createSpicaPlan(task.id,session.id,project.id,'Build task app',8));
 orchestrator.beginThought(4,4096,['inspect_spica_tool']);
 task.setSpicaPlan(orchestrator.plan);await task.persist();
 let checkpoint=await TaskExecution.latestSpicaPlan(session.id,project.id,store);
 assert.equal(checkpoint.thoughts[0].index,4);
 assert.equal(checkpoint.thoughts[0].status,'thinking');
 orchestrator.captureThought({...model,proposedTools:['inspect_spica_tool']});
 orchestrator.recordThoughtTool({id:'result-1',name:'inspect_spica_tool',status:'failed',evidence:'view was invalid'});
 orchestrator.finishThought();
 task.setSpicaPlan(orchestrator.plan);await task.persist();
 const resumed=new TaskExecution({id:session.id,messages:[{role:'user',content:'Resume the task'}]},project,[],store);
 assert.equal(await resumed.resume({id:session.id,messages:[{role:'user',content:'Resume the task'}]}),true);
 const live=new SpicaTaskOrchestrator(resumed.data.spicaPlan);
 assert.equal(live.plan.thoughts[0].status,'finished');
 live.beginThought(5,4096,['inspect_spica_tool']);
 assert.equal(live.plan.thoughts[1].index,5);
 assert.equal(live.plan.thoughts[1].toolResults.length,0);
 resumed.setSpicaPlan(live.plan);await resumed.persist();
 checkpoint=await TaskExecution.latestSpicaPlan(session.id,project.id,store);
 assert.equal(checkpoint.thoughts.length,2);
 assert.equal(checkpoint.thoughts[1].status,'thinking');
});
