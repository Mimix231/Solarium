const test=require('node:test');
const assert=require('node:assert/strict');
const {CloseCoordinator}=require('../.test-dist/engine/close-coordinator.js');
const {workLifecycle,withLocalWork}=require('../.test-dist/engine/work-lifecycle.js');
const {VerificationLedger}=require('../.test-dist/engine/intelligence/commands.js');
const {WorkMemory}=require('../.test-dist/engine/intelligence/work-memory.js');
const {decideToolPermission}=require('../.test-dist/engine/action-permissions.js');
const {allowedToolDefinitions}=require('../.test-dist/engine/tools.js');
const {validateToolArguments}=require('../.test-dist/engine/intelligence/tool-validation.js');
const {validateWorkspace}=require('../.test-dist/domain/validation.js');
const {defaultWorkspace}=require('../.test-dist/domain/defaults.js');

test('application close waits for work finalization, saves and recovery exactly once',async()=>{
 const order=[];let release;const wait=new Promise(r=>{release=r;});const coordinator=new CloseCoordinator({stopWork:async()=>{order.push('stop');await wait;},saveFiles:async()=>order.push('save'),saveRecovery:async()=>order.push('recovery'),saveWorkspace:async()=>order.push('workspace'),destroy:async()=>order.push('destroy')});
 const first=coordinator.close(true),second=coordinator.close(true);assert.equal(first,second);assert.deepEqual(order,['stop']);release();await first;assert.deepEqual(order,['stop','save','recovery','workspace','destroy']);
});
test('a failed source save blocks exit and permits a real retry or recovery choice',async()=>{
 let saves=0,destroyed=0,recovered=0;const coordinator=new CloseCoordinator({stopWork:async()=>{},saveFiles:async()=>{saves++;throw Error('source changed');},saveRecovery:async()=>{recovered++;},saveWorkspace:async()=>{},destroy:async()=>{destroyed++;}});
 await assert.rejects(()=>coordinator.close(true),/source changed/);assert.equal(destroyed,0);await coordinator.close(false);assert.equal(saves,1);assert.equal(recovered,1);assert.equal(destroyed,1);
});
test('local work prevents model/task overlap and Stop waits for actual finalization',async()=>{
 let finalized=false,started;const ready=new Promise(r=>{started=r;});const user=new AbortController();
 const run=withLocalWork('one','actual task','model.gguf',user.signal,async signal=>{started();try{await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('stopped')),{once:true}));}finally{await Promise.resolve();finalized=true;}});const observed=run.catch(e=>e.message);await ready;
 await assert.rejects(()=>withLocalWork('two','overlap',undefined,user.signal,async()=>{}),/active local task/);await workLifecycle.stopAll();assert.equal(await observed,'stopped');assert.equal(finalized,true);assert.deepEqual(workLifecycle.active(),[]);
});
const commands=[{id:'script:check',command:'check',verification:true,cwd:'.'},{id:'script:test',command:'test',verification:true,behavioral:true,cwd:'.'}];
test('the normal work owner preserves Pause and Cancel reasons through its child signal',async()=>{
 for(const reason of ['paused','cancelled']){
  const source=new AbortController();let ready;
  const started=new Promise(resolve=>{ready=resolve;});
  const result=withLocalWork('reason-'+reason,'actual task',undefined,source.signal,async signal=>{
   ready();return new Promise(resolve=>signal.addEventListener('abort',()=>resolve(signal.reason),{once:true}));
  });
  await started;source.abort(reason);assert.equal(await result,reason);
 }
 assert.deepEqual(workLifecycle.active(),[]);
});
const pass=(hash)=>({command:'check',exit_code:0,stdout:'passed',stderr:'',timed_out:false,source_before:hash,source_after:hash});
test('actual external source changes invalidate earlier passes without inventing model writes',()=>{
 const ledger=new VerificationLedger();ledger.configure(commands);ledger.edited();ledger.record('script:check',pass('old'));ledger.record('script:test',pass('old'));assert.equal(ledger.completion(true).ok,true);ledger.observeSource('external edit');assert.equal(ledger.state.writes,1);assert.deepEqual(ledger.pending(),['script:check','script:test']);assert.equal(ledger.completion(true).ok,false);
});
test('a check that rewrites its inputs cannot verify the resulting source',()=>{
 const ledger=new VerificationLedger();ledger.configure(commands);ledger.edited();ledger.record('script:test',{...pass('before'),source_after:'after'});assert.equal(ledger.state.checks['script:test'].status,'failed');ledger.record('script:check',pass('after'));assert.equal(ledger.completion(true).ok,false);ledger.record('script:test',pass('after'));assert.equal(ledger.completion(true).ok,true);assert.equal(ledger.state.checks['script:test'].attempts,2);
});
test('registered focused behavioural commands participate in completion evidence',()=>{
 const ledger=new VerificationLedger();ledger.state.requiresBehavior=true;ledger.configure([{id:'local:reference',command:'node --test tests/reference.js',verification:true,behavioral:true,cwd:'.'}]);assert.equal(ledger.behaviorMissing,false);ledger.edited();assert.equal(ledger.completion(true).ok,false);ledger.record('local:reference',pass('source'));assert.equal(ledger.completion(true).ok,true);
});
test('durable work memory retains edited paths and compiler failure locations across Resume',()=>{
 const memory=new WorkMemory();memory.note({decisions:[{key:'stack',value:'React + TypeScript'}]});memory.observe('apply_project_changes',{files:[{path:'src/App.tsx'}]},'completed','native source write',true);memory.observe('run_project_command',{},'failed','src/App.tsx(4,7): error TS2322');const restored=new WorkMemory(JSON.parse(JSON.stringify(memory.data)));assert.deepEqual(restored.data.affectedFiles,['src/App.tsx']);assert.deepEqual(restored.data.failurePaths,['src/App.tsx']);assert.match(restored.context(),/React \+ TypeScript/);
});
test('new coding tools preserve permission gates, root ownership and offline dependency reading',()=>{
 const names=allowedToolDefinitions(false,true).map(t=>t.function.name);for(const name of ['register_project_command','inspect_code_position','read_dependency_api','start_project_service','inspect_project_service','stop_project_service'])assert.ok(names.includes(name),name);assert.ok(!names.includes('research_coding_docs'));
 for(const name of ['register_project_command','start_project_service','stop_project_service']){const args={mode:'auto',name,webEnabled:false,projectAttached:true};assert.equal(decideToolPermission(args),'ask');assert.equal(decideToolPermission({...args,mode:'yolo',configured:'deny'}),'deny');assert.equal(decideToolPermission({...args,projectAttached:false}),'deny');}
 const tools=allowedToolDefinitions(false,true);assert.equal(validateToolArguments('register_project_command',{program:'node',args:['--test'],cwd:'.',purpose:'behaviour',kind:'test',network:false},tools).ok,true);assert.equal(validateToolArguments('register_project_command',{program:'node',args:'--test',cwd:'.',purpose:'behaviour',kind:'test',network:false},tools).ok,false);
});
test('manual local model allocation survives workspace validation without changing output policy',()=>{
 const w=defaultWorkspace();w.models=[{id:'m',name:'local',endpoint:'http://127.0.0.1:8080',modelId:'local',contextSize:8192,temperature:.7,maxTokens:8192,runtime:{mode:'manual',gpuLayers:12},createdAt:new Date().toISOString()}];const model=validateWorkspace(w).models[0];assert.deepEqual(model.runtime,{mode:'manual',gpuLayers:12});assert.equal(model.contextSize,8192);assert.equal(model.maxTokens,8192);
});

test('coding scorecards retain failures, stops and later manual corrections separately',()=>{
 const {qualityScorecards}=require('../.test-dist/quality/scorecard.js');
 const base={category:'coding',caseId:'repo',model:{id:'m',name:'Local'},fingerprints:{engine:'now',conditions:'config'},startedAt:'2026-11-02T12:00:00Z',finishedAt:'2026-11-02T12:00:02Z',metrics:[{firstTokenMs:500}]};
 const cards=qualityScorecards([{...base,state:'passed'},{...base,state:'failed'},{...base,state:'cancelled'},{...base,state:'passed',interventions:[{kind:'manual_code_correction'}]},{...base,state:'passed',fingerprints:{engine:'old',conditions:'config'}}],'now');
 assert.equal(cards.length,1);assert.equal(cards[0].attempts,4);assert.equal(cards[0].passed,1);assert.equal(cards[0].failed,1);assert.equal(cards[0].cancelled,1);assert.equal(cards[0].corrected,1);assert.equal(cards[0].medianElapsedMs,2000);
});

test('quality recovery never leaves a closed renderer trial looking active or changes a finished result',()=>{const {interruptedQualityRun}=require('../.test-dist/quality/scorecard.js');const startedAt='2026-11-02T12:00:00Z',renderer=Date.parse('2026-11-02T12:01:00Z');assert.equal(interruptedQualityRun({state:'running',startedAt},renderer),true);assert.equal(interruptedQualityRun({state:'failed',startedAt},renderer),false);assert.equal(interruptedQualityRun({state:'running',startedAt:'2026-11-02T12:02:00Z'},renderer),false);});
