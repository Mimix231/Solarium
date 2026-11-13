'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {createSpicaPlan,SpicaTaskOrchestrator}=require('../.spica-phase10-test/engine/intelligence/spica-task-orchestrator.js');
const {AgentBudgetScheduler,AgentContextAssembler}=require('../.spica-phase10-test/engine/intelligence/agent-budget.js');
const {prepareGeneration}=require('../.spica-phase10-test/engine/context-window.js');
const plan=()=>new SpicaTaskOrchestrator(createSpicaPlan('task-1','session-1','project-1','Extend Notes Organizer',10));

test('inspection and repeated discovery never count as an application change',()=>{
 const p=plan();
 for(let i=0;i<12;i++)p.observe('inspect_spica_tool','completed');
 assert.equal(p.plan.verifiedChanges,0);
 assert.equal(p.plan.steps[2].state,'pending');
 p.observe('read_spica_graph','completed');
 p.observe('search_spica_runtime_blocks','completed');
 assert.equal(p.nextStep,'compose');
 assert.equal(p.plan.verifiedChanges,0);
});
test('only an actual advancing graph revision marks the compose step',()=>{
 const p=plan();
 p.observe('edit_spica_graph','completed',{graphRevision:10});
 assert.equal(p.plan.verifiedChanges,0);
 p.observe('edit_spica_graph','completed',{graphRevision:11});
 assert.equal(p.plan.verifiedChanges,1);
 assert.equal(p.plan.graphRevision,11);
 assert.equal(p.nextStep,'verify');
 p.observe('edit_spica_graph','completed',{graphRevision:11});
 assert.equal(p.plan.verifiedChanges,1);
 assert.match(p.plan.lastError,/did not demonstrate a new graph revision/);
});
test('a successful verification cannot finish an app with no recorded graph change',()=>{
 const p=plan();
 p.observe('verify_spica_app','completed',{verified:true});
 assert.notEqual(p.plan.status,'completed');
 assert.notEqual(p.nextStep,null);
 p.observe('edit_spica_graph','completed',{graphRevision:11});
 p.observe('verify_spica_app','completed',{verified:true});
 assert.equal(p.plan.status,'completed');
 assert.equal(p.nextStep,null);
});
test('failed calls and permission denials preserve evidence without pretending to build',()=>{
 const p=plan();
 p.observe('check_spica_tool_call','failed',{evidence:'name is required'});
 assert.equal(p.plan.verifiedChanges,0);
 assert.match(p.plan.lastError,/name is required/);
 p.observe('edit_spica_graph','denied');
 assert.equal(p.plan.status,'blocked');
 assert.equal(p.plan.verifiedChanges,0);
});
test('three budget cycles persist exact plan state through round trips and resume',()=>{
 const scheduler=new AgentBudgetScheduler(4096,8192);
 let p=plan();
 p.observe('read_spica_graph','completed');
 p.cycle(scheduler.checkpoint(scheduler.allocate(),1900,'server',10));
 p.observe('search_spica_runtime_blocks','completed');
 let restored=JSON.parse(JSON.stringify(p.plan));
 p=new SpicaTaskOrchestrator(restored);
 p.cycle(scheduler.checkpoint(scheduler.allocate(),2048,'estimate',10));
 p.observe('edit_spica_graph','completed',{graphRevision:11});
 restored=JSON.parse(JSON.stringify(p.plan));
 p=new SpicaTaskOrchestrator(restored);
 p.cycle(scheduler.checkpoint(scheduler.allocate(),1200,'server',11));
 p.observe('edit_spica_graph','completed',{graphRevision:11});
 assert.equal(p.plan.verifiedChanges,1);
 assert.deepEqual(p.plan.cycles.map(c=>c.index),[1,2,3]);
 assert.equal(p.plan.graphRevision,11);
 assert.equal(p.plan.status,'verifying');
 assert.match(new AgentContextAssembler().assemble(p.plan),/revision 11/);
});
test('4096 is a working target, never a new model instance or unlimited context',()=>{
 const a=new AgentBudgetScheduler(4096,8192).allocate();
 assert.equal(a.workingLimit,4096);
 assert.equal(a.modelCapacity,8192);
 const b=new AgentBudgetScheduler(8192,2048).allocate();
 assert.equal(b.workingLimit,2048);
 const c=new AgentBudgetScheduler('auto',12000).allocate();
 assert.equal(c.workingLimit,12000);
});
test('mandatory tool contract may borrow native input capacity; no model inference retry',async()=>{
 let generated=0,counts=0;
 const adapter={countTokens:async()=>{counts++;return 3300;},generate:async()=>{generated++;throw Error('Should not generate during context preparation');}};
 const model={contextSize:8192};const capabilities={contextSize:8192};
 const messages=[{role:'system',content:'Identity and permission contract'},{role:'user',content:'Edit real app'}];
 const schema={type:'function',function:{name:'read_spica_graph',description:'Read',parameters:{type:'object',properties:{},additionalProperties:false}}};
 const prepared=await prepareGeneration(adapter,model,capabilities,messages,new AbortController().signal,
   {tools:[schema],requireTools:true},0,2048);
 assert.equal(prepared.contextSize,8192);
 assert.equal(prepared.tools.length,1);
 assert.equal(generated,0);
 assert.ok(counts>0);
});
test('non-interrupted generation stream and permission architecture remain intact',()=>{
 const code=fs.readFileSync(path.join(root,'src/engine/continuous-generation.ts'),'utf8');
 const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 assert.match(code,/adapter\.kind === 'llama\.cpp'[\s\S]*?-1/);
 assert.match(code,/const prepared = await prepareGeneration/);
 assert.match(agent,/decideToolPermission/);
 assert.match(agent,/onTaskPlan/);
 assert.match(agent,/spicaOrchestrator\.observe/);
 assert.match(agent,/spicaOrchestrator\.setStatus\('paused'/);
});
test('the composer renders a persistent build plan without adding a new route',()=>{
 const chat=fs.readFileSync(path.join(root,'src/views/Chat.tsx'),'utf8');
 assert.match(chat,/SpicaTaskPlanView/);
 assert.ok(chat.indexOf('<SpicaTaskPlanView')<chat.indexOf('<div className="composer glass"'));
 assert.match(chat,/TaskExecution\.latestSpicaPlan/);
 assert.match(chat,/onTaskPlan:/);
 assert.match(chat,/spicaCycleBudget/);
});

// Load the real durable TaskExecution class with an injected in-memory
// RecordStore; unrelated story and desktop modules are not used by this test.
function taskStoreHarness() {
 const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
 const source=fs.readFileSync(path.join(root,'src/engine/intelligence/task.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const records=new Map();let idCount=0;
 const store={
   async list(filter){return [...records.values()].filter(r=>r.collection===filter.collection&&filter.scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)).map(r=>structuredClone(r));},
   async batch(puts){for(const {record,expected} of puts){const prior=records.get(record.id);if((prior?.version??null)!==expected)throw Error('Revision conflict');records.set(record.id,structuredClone(record));}},
 };
 const newRecord=(collection,id,scope,title,data)=>({collection,id,scope,title,data,version:1,updatedAt:new Date().toISOString()});
 const mockRequire=(name)=>{
   if(name==='../../domain/types')return {uid:()=>`t${++idCount}`};
   if(name==='../../foundation/store')return {newRecord,foundationStore:store};
   return {};
 };
 const module={exports:{}};
 new Function('require','module','exports',compiled)(mockRequire,module,module.exports);
 return {TaskExecution:module.exports.TaskExecution,store,records};
}
test('durable checkpoint is stored in task_execution, reloaded by project/session and resumed without replaying writes',async()=>{
 const {TaskExecution,store}=taskStoreHarness();
 const session={id:'s1',messages:[{role:'user',content:'Build Notes Organizer'}]};
 const project={id:'p1'};
 const task=new TaskExecution(session,project,[],store);
 task.setSpicaPlan(createSpicaPlan(task.id,'s1','p1','Build Notes Organizer',20));
 await task.persist();
 const saved=await TaskExecution.latestSpicaPlan('s1','p1',store);
 assert.equal(saved.goal,'Build Notes Organizer');
 assert.equal(saved.graphRevision,20);
 assert.equal(await TaskExecution.latestSpicaPlan('other','p1',store),null);
 const resume=new TaskExecution({id:'s1',messages:[{role:'user',content:'Resume the SPICA task'}]},project,[],store);
 assert.equal(await resume.resume({id:'s1',messages:[{role:'user',content:'Resume the SPICA task'}]}),true);
 assert.equal(resume.data.requestedOutcome,'Build Notes Organizer');
 const orchestrator=new SpicaTaskOrchestrator(resume.data.spicaPlan);
 orchestrator.observe('edit_spica_graph','completed',{graphRevision:21});
 resume.setSpicaPlan(orchestrator.plan);
 await resume.persist();
 const read=await TaskExecution.latestSpicaPlan('s1','p1',store);
 assert.equal(read.graphRevision,21);
 assert.equal(read.verifiedChanges,1);
 assert.equal((await store.list({collection:'task_execution',scopes:[{kind:'project',id:'p1'}]})).length,1);
});
test('Pause and Cancel are durable states; a cancelled task cannot be inadvertently resumed',async()=>{
 const {TaskExecution,store}=taskStoreHarness();
 const session={id:'s2',messages:[{role:'user',content:'Build app'}]};
 const project={id:'p2'};const task=new TaskExecution(session,project,[],store);
 task.setSpicaPlan(createSpicaPlan(task.id,'s2','p2','Build app',1));
 await task.persist();
 const paused=await TaskExecution.updateSpicaStatus('s2','p2','paused',store);
 assert.equal(paused.status,'paused');
 const cancelled=await TaskExecution.updateSpicaStatus('s2','p2','cancelled',store);
 assert.equal(cancelled.status,'cancelled');
 const resumed=new TaskExecution({id:'s2',messages:[{role:'user',content:'Resume the task'}]},project,[],store);
 assert.equal(await resumed.resume({id:'s2',messages:[{role:'user',content:'Resume the task'}]}),false);
});
