'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const loaded=new Map();
function load(file){
  if(loaded.has(file))return loaded.get(file);
  const module={exports:{}};loaded.set(file,module.exports);
  const src=fs.readFileSync(path.join(root,file),'utf8');
  const compiled=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,structuredClone,Date,console,Set,Map,require(id){
    if(!id.startsWith('.'))throw Error('Unexpected runtime dependency: '+id);
    return load(path.posix.normalize(path.posix.join(path.posix.dirname(file),id+'.ts')));
  }},{filename:file});
  loaded.set(file,module.exports);return module.exports;
}
const {classifyConstructionIntent}=load('src/engine/construction/intent.ts');
const {createConstructionSession}=load('src/engine/construction/session.ts');
const {ConstructionOrchestrator}=load('src/engine/construction/orchestrator.ts');
const {ConstructionCheckpointStore}=load('src/engine/construction/checkpoint.ts');
const {needsAppPlan}=load('src/engine/intelligence/app-builder.ts');
const route=(request,opts={})=>classifyConstructionIntent({request,projectAttached:true,hasSpicaGraph:false,spicaIntent:'none',...opts});
const create=()=>createConstructionSession({taskId:'task-1',sessionId:'chat-1',projectId:'project-1',projectRoot:'E:/Source/Platformer',goal:'Build a platformer'});

test('ordinary application construction uses native source route, even for game requests',()=>{
  for(const request of ['Build me a 2D platformer with enemies and collectibles',
    'Create an application for managing notes', 'Make a playable browser game',
    'Develop a dashboard', 'Fix this', 'run tests', 'Build me a game with swimming mechanics',
    'Build a game using SPICA runtime blocks', 'Implement a SPICA runtime block',
    'Create a REST API', 'Develop a CLI tool', 'Build a TypeScript plugin']){
    assert.equal(route(request),'source',request);
  }
});
test('ordinary games are recognized as durable multi-step app builds',()=>{
  for(const request of ['Build me a 2D platformer with swimming mechanics',
    'Create an RPG game', 'Develop a game simulator', 'Make a playable browser game',
    'Build a dashboard']) assert.equal(needsAppPlan(request),true,request);
  assert.equal(needsAppPlan('Only a plan for a platformer'),false);
  assert.equal(needsAppPlan('Build a skeleton game scaffold'),false);
});
test('existing SPICA graphs and explicit graph requests stay on the legacy path',()=>{
  assert.equal(route('Add a recents page and Markdown editing',{hasSpicaGraph:true,spicaIntent:'edit'}),'legacy-spica');
  assert.equal(route('Inspect this graph',{hasSpicaGraph:true,spicaIntent:'inspect'}),'legacy-spica');
  assert.equal(route('Create a SPICA app'),'legacy-spica');
  assert.equal(route('Migrate the universal graph V2'),'legacy-spica');
  assert.equal(route('Build a 2D platformer',{hasSpicaGraph:true,spicaIntent:'edit'}),'source','new source project is not silently forced into existing SPICA graph');
});
test('fiction, questions, plans, and chat-only snippets do not create a construction session',()=>{
  for(const request of ['Write Chapter 1 of my fanfiction', 'Write a Re:Zero AU chapter',
    'How do I build a platformer?', 'Please describe a game architecture',
    'Give me code in this chat', 'Could you explain the build system?']){
    assert.equal(route(request),'conversation',request);
  }
});
test('questions about SPICA graphs or app construction never dispatch file or graph tools',()=>{
  for(const question of ['How does SPICA graph V2 work?',
    'Please explain how to build a web app',
    'Could you show me how to create a platformer?',
    'I want to know how to build an application',
    'Can you describe how to edit the block graph?']) {
    assert.equal(route(question,{hasSpicaGraph:true,spicaIntent:'inspect'}),'conversation',question);
  }
});
test('a session needs explicit project scope and never claims a file was created at start',()=>{
  assert.throws(()=>createConstructionSession({taskId:'',sessionId:'s',projectId:'p',projectRoot:'root',goal:'build'}),/requires a persisted task/);
  const runner=new ConstructionOrchestrator(create());
  assert.equal(runner.snapshot.files.length,0);assert.equal(runner.snapshot.stage,'inspect');
  const event=runner.start();assert.equal(event.kind,'session_started');assert.equal(event.sequence,1);
  assert.equal(runner.snapshot.status,'active');assert.equal(runner.snapshot.inspected,false);
  assert.throws(()=>runner.start(),/only start once/);
});
test('failed inspection cannot advance the plan; native inspection can',()=>{
  const runner=new ConstructionOrchestrator(create());runner.start();
  assert.equal(runner.observe({tool:'inspect_project',status:'failed',summary:'Folder missing'}).kind,'tool_failed');
  assert.equal(runner.snapshot.stage,'inspect');assert.equal(runner.snapshot.inspected,false);
  assert.equal(runner.observe({tool:'inspect_project',status:'completed'}).kind,'project_inspected');
  assert.equal(runner.snapshot.stage,'plan');assert.equal(runner.snapshot.inspected,true);
  assert.equal(runner.observe({tool:'plan_project_app',status:'completed'}).kind,'plan_saved');
  assert.equal(runner.snapshot.stage,'build');assert.equal(runner.snapshot.files.length,0);
});
test('only native callback paths and a valid revision can create a source_write event',()=>{
  const runner=new ConstructionOrchestrator(create());runner.start();
  assert.equal(runner.observe({tool:'apply_project_changes',status:'completed'}),null);
  assert.equal(runner.snapshot.files.length,0);
  assert.throws(()=>runner.observe({tool:'replace_project_text',status:'completed',confirmedPaths:['src/game.ts'],sourceRevision:0}),/valid native source revision/);
  const saved=runner.observe({tool:'apply_project_changes',status:'completed',confirmedPaths:['src/game.ts','src/game.ts','src/player.ts'],sourceRevision:2});
  assert.equal(saved.kind,'source_written');
  assert.deepEqual(Array.from(saved.paths),['src/game.ts','src/player.ts']);
  assert.equal(runner.snapshot.files.length,2);assert.equal(runner.snapshot.stage,'build');
  assert.equal(runner.snapshot.files[0].revision,2);
});
test('checks are not completion: only authoritative complete_project_task evidence can finish',()=>{
  const runner=new ConstructionOrchestrator(create());runner.start();
  runner.observe({tool:'apply_project_changes',status:'completed',confirmedPaths:['main.ts'],sourceRevision:1});
  assert.equal(runner.observe({tool:'run_project_check',status:'failed',summary:'tsc failed'}).kind,'tool_failed');
  assert.equal(runner.snapshot.status,'active');assert.equal(runner.snapshot.lastFailure,'tsc failed');
  assert.equal(runner.observe({tool:'complete_project_task',status:'completed',verified:false}).kind,'check_executed');
  assert.equal(runner.snapshot.status,'active');
  assert.equal(runner.observe({tool:'complete_project_task',status:'completed',verified:true}).kind,'session_completed');
  assert.equal(runner.snapshot.status,'completed');
  assert.equal(runner.snapshot.stage,'finish');
  assert.equal(runner.settle('paused','not possible'),null);
});
test('construction context distinguishes retained receipts from unique saved files or passed checks',()=>{
  const runner=new ConstructionOrchestrator(create());runner.start();
  runner.observe({tool:'apply_project_changes',status:'completed',confirmedPaths:['src/player.ts'],sourceRevision:1});
  runner.observe({tool:'apply_project_changes',status:'completed',confirmedPaths:['src/player.ts'],sourceRevision:2});
  runner.observe({tool:'run_project_check',status:'failed',summary:'Type check failed'});
  const context=runner.context(1500);
  assert.match(context,/retained native file receipts: 2/);
  assert.match(context,/retained check attempts: 1/);
  assert.doesNotMatch(context,/checks passed/);
  assert.match(context,/Last real failure: Type check failed/);
});
test('permission denial blocks writes and a resume cannot switch project roots',()=>{
  const runner=new ConstructionOrchestrator(create());runner.start();
  assert.equal(runner.observe({tool:'apply_project_changes',status:'denied'}).kind,'permission_denied');
  assert.equal(runner.snapshot.status,'blocked');
  assert.equal(runner.observe({tool:'apply_project_changes',status:'completed',confirmedPaths:['hack.ts'],sourceRevision:1}),null);
  assert.equal(runner.snapshot.files.length,0);
  const snapshot=runner.snapshot;
  const restored=new ConstructionOrchestrator(snapshot);
  assert.throws(()=>restored.resume('project-2','E:/Source/Platformer'),/linked project or root changed/);
  assert.throws(()=>restored.resume('project-1','E:/Different'),/linked project or root changed/);
  assert.equal(restored.resume('project-1','E:/Source/Platformer').kind,'session_resumed');
  assert.equal(restored.snapshot.status,'active');
  assert.equal(restored.snapshot.files.length,0);
});
test('pause/cancel survive restoration without fabricating completed files',()=>{
  const runner=new ConstructionOrchestrator(create());runner.start();
  runner.observe({tool:'inspect_project',status:'completed'});
  runner.settle('paused','Model stopped before a file write');
  const restored=new ConstructionOrchestrator(runner.snapshot);
  assert.equal(restored.snapshot.status,'paused');assert.equal(restored.snapshot.files.length,0);
  restored.resume('project-1','E:/Source/Platformer');
  restored.settle('cancelled','User stopped construction');
  assert.equal(restored.snapshot.status,'cancelled');
  assert.throws(()=>restored.resume('project-1','E:/Source/Platformer'),/cannot be resumed/);
});
test('construction event sequence stays stable through a restored checkpoint',()=>{
  const runner=new ConstructionOrchestrator(create());
  runner.start();runner.observe({tool:'inspect_project',status:'completed'});
  const next=new ConstructionOrchestrator(runner.snapshot);
  assert.equal(next.resume('project-1','E:/Source/Platformer').sequence,3);
  next.observe({tool:'plan_project_app',status:'completed'});
  assert.deepEqual(Array.from(next.snapshot.events,x=>x.sequence),[1,2,3,4]);
});
test('checkpoint writes to the existing task owner; failed persistence does not become UI success',async()=>{
  const calls=[];
  const task={setConstructionCheckpoint(value){calls.push(['set',value]);},async persist(){calls.push(['persist']);}};
  const store=new ConstructionCheckpointStore(task);
  await store.save(create());assert.equal(calls.length,2);
  const blocked={setConstructionCheckpoint(){},async persist(){throw Error('Storage unavailable');}};
  await assert.rejects(()=>new ConstructionCheckpointStore(blocked).save(create()),/Storage unavailable/);
});
test('agent route is integrated without changing the single model streaming path or breaking SPICA tools',()=>{
  const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
  assert.match(agent,/classifyConstructionIntent\(/);
  assert.match(agent,/const spicaRequest = constructionRoute === 'legacy-spica'/);
  assert.match(agent,/const wantsAction = sourceConstruction \|\| Boolean\(spica && spicaRequest\)/);
  assert.match(agent,/new ConstructionCheckpointStore\(task\)/);
  assert.match(agent,/construction\.observe\(\{[\s\S]*?confirmedPaths:resultStatus/);
  assert.match(agent,/streamContinuousAnswer\(/);
  assert.doesNotMatch(agent,/new ConstructionOrchestrator\([\s\S]*?adapter\.generate\(/,'construction coordinator must not start a parallel model');
});

test('agent validates the native inspection payload before recording progress and blocks failed inspection',()=>{
  const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
  const parse=agent.indexOf('const validatedInspection = formatProjectInspection(result)');
  const save=agent.indexOf("construction.observe({tool:'inspect_project',status:'completed'");
  assert.ok(parse>0 && save>parse,'verified inspection must precede progress');
  assert.match(agent,/if\(construction && \(!environment \|\| construction\.snapshot\.status==='blocked'\)\)/);
  assert.match(agent,/if\(sourceConstruction && task\)await recordTask\(\(\)=>task\.finish\('paused'\)\)/);
});
test('real TaskExecution CAS storage persists construction checkpoints and restores the same task',async()=>{
  const records=new Map();let nextId=0;
  const store={
    async list(filter){return [...records.values()].filter(rec=>(!filter.collection||rec.collection===filter.collection)&&filter.scopes.some(scope=>scope.id===rec.scope.id&&scope.kind===rec.scope.kind)).map(rec=>structuredClone(rec));},
    async body(){return null;},
    async batch(puts){for(const {record,expected} of puts){
      const prior=records.get(record.id);assert.equal(prior?.version??null,expected,'optimistic version must match');
      records.set(record.id,structuredClone(record));
    }},
  };
  const source=fs.readFileSync(path.join(root,'src/engine/intelligence/task.ts'),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(compiled,{module,exports:module.exports,structuredClone,Date,console,require(id){
    if(id==='../../domain/types')return {uid:()=>`task-${++nextId}`};
    if(id==='../../foundation/store')return {foundationStore:store,newRecord:(collection,id,scope,title,data)=>({id,collection,scope,title,data,version:1,updatedAt:new Date().toISOString()})};
    return {}; // buildTaskContext's optional repositories are not used in this test.
  }},{filename:'src/engine/intelligence/task.ts'});
  const {TaskExecution}=module.exports;
  const session={id:'chat-1',messages:[{role:'user',content:'Build a playable platformer'}]};
  const project={id:'project-1'};
  const task=new TaskExecution(session,project,[],store);
  const snapshot=createConstructionSession({taskId:task.id,sessionId:session.id,projectId:project.id,
    projectRoot:'E:/Source/Platformer',goal:'Build a playable platformer'});
  assert.throws(()=>task.setConstructionCheckpoint({...snapshot,sessionId:'another-user'}),/does not belong/);
  assert.throws(()=>task.setConstructionCheckpoint({...snapshot,projectId:'another-project'}),/another project/);
  const orchestrator=new ConstructionOrchestrator(snapshot);orchestrator.start();
  task.setConstructionCheckpoint(orchestrator.snapshot);await task.persist();
  const initial=await TaskExecution.latestConstruction(session.id,project.id,store);
  assert.equal(initial.taskId,task.id);assert.equal(initial.sequence,1);
  orchestrator.observe({tool:'inspect_project',status:'completed'});
  orchestrator.observe({tool:'plan_project_app',status:'completed'});
  task.setConstructionCheckpoint(orchestrator.snapshot);
  await task.operation({id:'plan-1',tool:'plan_project_app',status:'completed'});
  await task.finish('paused');
  const resumedSession={...session,messages:[...session.messages,{role:'user',content:'Resume the build'}]};
  const resumedTask=new TaskExecution(resumedSession,project,[],store);
  assert.equal(await resumedTask.resume(resumedSession),true);
  assert.equal(resumedTask.id,task.id,'resume must use the stored task, not create a separate session');
  const recovered=new ConstructionOrchestrator(resumedTask.data.construction);
  recovered.resume(project.id,'E:/Source/Platformer');
  recovered.observe({tool:'apply_project_changes',status:'completed',confirmedPaths:['src/player.ts'],sourceRevision:1});
  resumedTask.setConstructionCheckpoint(recovered.snapshot);await resumedTask.persist();
  const latest=await TaskExecution.latestConstruction(session.id,project.id,store);
  assert.equal(latest.files[0].path,'src/player.ts');assert.equal(latest.status,'active');
  assert.equal(latest.sequence,5,'event order survives task persistence and resume');
  assert.equal(records.size,1,'the checkpoint lives in the existing task_execution record');
});
