const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {VerificationLedger}=require('../.test-dist/engine/intelligence/commands.js');
const {ContextArchive}=require('../.test-dist/foundation/archive.js');
const {lengthTarget,checkChapterLength,runLongWriting}=require('../.test-dist/writing/long-task.js');
const pass={command:'node --test',exit_code:0,stdout:'passed',stderr:'',timed_out:false};
class Store{
  records=new Map();bodies=new Map();
  async list(f){return structuredClone([...this.records.values()].filter(r=>f.scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)&&(!f.collection||f.collection===r.collection)));}
  async body(id,scopes){const r=this.records.get(id);return r&&scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)?this.bodies.get(id)??null:null;}
  async batch(puts,deletes=[]){for(const {record,expected}of puts)assert.equal(this.records.get(record.id)?.version??null,expected);for(const d of deletes)assert.equal(this.records.get(d.id)?.version,d.expected);for(const {record,body}of puts){this.records.set(record.id,structuredClone(record));if(body!==undefined)this.bodies.set(record.id,body);}for(const d of deletes){this.records.delete(d.id);this.bodies.delete(d.id);}}
}
test('verification keeps each failure, invalidates old passes, and survives recovery',()=>{
  const ledger=new VerificationLedger();ledger.configure([{id:'script:test',verification:true},{id:'script:build',verification:true}]);ledger.edited();ledger.record('script:test',{...pass,exit_code:1,stderr:'assertion failed'});ledger.record('script:build',pass);
  assert.deepEqual(ledger.pending(),['script:test']);assert.equal(ledger.completion(true).ok,false);
  ledger.edited();ledger.record('script:test',pass);assert.deepEqual(ledger.pending(),['script:build']);
  const resumed=new VerificationLedger(ledger.state);resumed.record('script:build',pass);assert.equal(resumed.completion(true).ok,true);
  resumed.record('script:test',{...pass,cancelled:true});assert.equal(resumed.completion(true).ok,false);
});
test('input fitting pages complete old tool exchanges without dropping the current result or original goal',async()=>{
  const {prepareGeneration}=require('../.test-dist/engine/context-window.js');const goal={role:'user',content:'Fix this project and preserve the original feature.'};
  const messages=[{role:'system',content:'Spark identity'},goal];for(let i=0;i<9;i++)messages.push({role:'assistant',content:'',tool_calls:[{id:'c'+i,type:'function',function:{name:'read_project_file',arguments:'{}'}}]},{role:'tool',tool_call_id:'c'+i,content:'actual result '+i+' '+('x'.repeat(1800))});
  const original=JSON.stringify(messages);const prepared=await prepareGeneration({kind:'llama.cpp',countTokens:async(model,items)=>Math.ceil(JSON.stringify(items).length/3)}, {contextSize:4096},{contextSize:4096},messages,new AbortController().signal);
  assert.equal(JSON.stringify(messages),original);assert.ok(prepared.messages.includes(goal));assert.equal(prepared.messages.at(-1).tool_call_id,'c8');
  for(const m of prepared.messages.filter(m=>m.role==='tool'))assert.ok(prepared.messages.some(a=>a.tool_calls?.some(c=>c.id===m.tool_call_id)));
  assert.ok(prepared.discardedHistory>0);
});
test('full archived context is losslessly paged and cannot cross projects',async()=>{
  const store=new Store();const archive=new ContextArchive({sessionId:'a',projectId:'p'},store);const original='first fact\n'+Array.from({length:14000},(_,i)=>`record ${i}: é🌞\n`).join('')+'LAST FACT';
  const saved=await archive.save({kind:'project',id:'p'},'Original compiler output',original,{kind:'tool_result',sessionId:'a'});
  let restored='',offset=0;while(offset<original.length){const page=await archive.read(saved.id,offset,7913);restored+=page.text;offset=page.nextOffset;}assert.equal(restored,original);
  assert.ok((await archive.search('LAST FACT')).some(r=>r.archiveId===saved.id));
  await assert.rejects(new ContextArchive({sessionId:'b',projectId:'q'},store).read(saved.id),/unavailable/);
  assert.equal((await new ContextArchive({sessionId:'b',projectId:'p'},store).read(saved.id)).text,original.slice(0,8000));
});
test('length targets count real prose and Unicode, never a 4096-character success',()=>{
  assert.deepEqual(lengthTarget('Write a 50k character chapter'),{minimum:50000,unit:'characters'});assert.deepEqual(lengthTarget('Write 50,000 characters'),{minimum:50000,unit:'characters'});
  assert.equal(checkChapterLength('x'.repeat(4096),{minimum:50000,unit:'characters'}).complete,false);
  assert.equal(checkChapterLength('🌞'.repeat(50000),{minimum:50000,unit:'characters'}).actual,50000);
});
test('the actual serialized prompt keeps every system instruction in one leading template turn',()=>{
  const {mergeSystemPrefix}=require('../.test-dist/engine/llama.js');const original=[{role:'system',content:'Spark identity'},{role:'system',content:'Scene operation: one finished scene'},{role:'user',content:'Original exact user request'}];const before=JSON.stringify(original);
  const merged=mergeSystemPrefix(original);assert.equal(merged.length,2);assert.equal(merged[0].content,'Spark identity\n\nScene operation: one finished scene');assert.equal(merged[1],original[2]);assert.equal(JSON.stringify(original),before);
});
test('reasoning followed by a genuine tool call is not misreported as a missing final answer',async()=>{
  const {streamContinuousAnswer}=require('../.test-dist/engine/continuous-generation.js');let outcome;
  const adapter={kind:'llama.cpp',countTokens:async()=>100,async generate(m,msg,c,cb){cb.reasoning('Inspect the file first.');return{answer:'',reasoning:'Inspect the file first.',calls:[{id:'read',type:'function',function:{name:'read_project_file',arguments:'{"path":"index.js"}'}}],finishReason:'tool_calls'};}};
  const result=await streamContinuousAnswer({adapter,model:{modelId:'test',contextSize:4096},capabilities:{contextSize:4096},messages:[{role:'user',content:'Fix the code.'}],signal:new AbortController().signal,onAnswer(){},onReasoning(){},onOutcome:o=>outcome=o});assert.equal(result.warning,undefined);assert.equal(outcome.reason,'tool_call');
});
test('restart validation preserves stop diagnostics, command-log locators, and all saved conversation turns',()=>{
  const {validateWorkspace}=require('../.test-dist/domain/validation.js');const {defaultWorkspace}=require('../.test-dist/domain/defaults.js');const w=defaultWorkspace();const message={id:'m',role:'assistant',content:'x'.repeat(55000),createdAt:new Date().toISOString(),generationOutcomes:[{backend:'llama.cpp',reason:'output_or_context_limit',contextShift:'unsupported',contextSize:4096,promptTokens:500}],terminalRuns:[{command:'node test',exitCode:0,stdout:'actual',stderr:'',timedOut:false,runId:'run-evidence',cancelled:false,outputComplete:false}]};
  w.sessions=[{id:'s',title:'History',sparkId:w.sparks[0].id,mode:'conversation',messages:[...Array.from({length:2001},(_,i)=>({id:'u'+i,role:'user',content:'saved '+i,createdAt:message.createdAt})),message]}];
  const restored=validateWorkspace(w).sessions[0];assert.equal(restored.messages.length,2002);const reply=restored.messages.at(-1);assert.equal(reply.content.length,55000);assert.equal(reply.terminalRuns[0].runId,'run-evidence');assert.equal(reply.terminalRuns[0].outputComplete,false);assert.equal(reply.generationOutcomes[0].contextShift,'unsupported');
});
test('a portable nested category includes parents, world, revisions and evidence without unrelated writing',()=>{
  const {categoryArchive}=require('../.test-dist/writing/portable.js');const r=(id,collection,data,storyId)=>({record:{id,collection,data,storyId,scope:{kind:'project',id:'p'},version:1,title:id,updatedAt:''},body:null});
  const archive={schemaVersion:1,records:[r('root','writing_category',{parentId:null},'world'),r('child','writing_category',{parentId:'root'},'world'),r('world','story_world',{}),r('doc','writing_document',{categoryId:'child',currentRevisionId:'rev',sourceIds:['source']},'world'),r('rev','writing_revision',{documentId:'doc'},'world'),r('source','source',{}),r('chunk','source_chunk',{sourceId:'source'}),r('elsewhere','writing_document',{categoryId:null},'world')]};
  const exported=categoryArchive(archive,'child');assert.deepEqual(new Set(exported.records.map(e=>e.record.id)),new Set(['root','child','world','doc','rev','source','chunk']));
});
test('exact-scene research falls back from irrelevant results and follows a real chapter-index link',async()=>{
  const {researchTopic,verifyScene}=require('../.test-dist/research/research.js');const reads=[];let fallbacks=0;
  const provider={search:async()=>[{title:'Subaru cars',url:'https://cars.example/subaru',excerpt:'SUV models'}],fallbackSearch:async()=>{fallbacks++;return[{title:'Arc 7: The Land of Wolves | Novel Translations',url:'https://novel.example/arc-7/',excerpt:'Translation index'}];},read:async(url)=>{reads.push(url);return url.endsWith('/arc-7/')?{url,title:'Arc 7 translation index',locator:'Arc 7',text:'Chapter index for the novel.',retrievedAt:'now',contentHash:'index',links:[{url:'https://novel.example/arc-7-chapter-1',title:'Chapter 1: Initiation'}]}:{url,title:'Arc 7 Chapter 1',locator:'Chapter 1, forest scene',text:'Subaru was hit by an arrow and pinned to a tree in the forest.',retrievedAt:'now',contentHash:'chapter'};}};
  const result=await researchTopic('Find Re:Zero Subaru pinned to a tree by an arrow, Arc 7 Chapter 1. Distinguish it from the poisoned arrow.','',provider,true,new AbortController().signal);
  assert.equal(fallbacks,1);assert.ok(!result.intent.eventTerms.includes('poison'));assert.deepEqual(reads,['https://novel.example/arc-7/','https://novel.example/arc-7-chapter-1']);const chapter=result.candidates.find(c=>c.url.endsWith('chapter-1'));assert.equal(chapter.status,'read');assert.ok(verifyScene(chapter.page,result.intent).supported);assert.ok(result.context.indexOf('Arc 7 Chapter 1')<result.context.indexOf('Arc 7 translation index'));
  assert.equal(verifyScene({...chapter.page,title:'Arc 7 Chapter 12',locator:'Chapter 12',url:'https://novel.example/chapter-12'},result.intent).supported,false);
});
test('authored document recall uses exact saved text and excludes foreign or personal work',async()=>{
  const {WritingRepository}=require('../.test-dist/writing/repository.js');const {writingContext}=require('../.test-dist/writing/context.js');const store=new Store(),repo=new WritingRepository({sessionId:'s',projectId:'p'},store);
  await repo.create({scope:{kind:'project',id:'p'},title:'Chapter 1 Brass Key',markdown:'Mara kept a brass key wrapped in blue cloth.\n\nThe bell remained silent.'});
  await repo.create({scope:{kind:'library',id:'personal'},title:'Private other book',markdown:'PERSONAL_SECRET'});const other=new WritingRepository({sessionId:'other',projectId:'q'},store);await other.create({scope:{kind:'project',id:'q'},title:'Chapter 1 Brass Key',markdown:'FOREIGN_SECRET'});
  const context=await writingContext(repo,'Write chapter 2 and preserve the brass key.');assert.match(context,/blue cloth/);assert.match(context,/read_writing_document/);assert.ok(!context.includes('PERSONAL_SECRET')&&!context.includes('FOREIGN_SECRET'));
});
test('planned writing keeps uncapped native scene streams and persists a 50k+ document and revision',async()=>{
  const {defaultWorkspace}=require('../.test-dist/domain/defaults.js');const {WritingRepository}=require('../.test-dist/writing/repository.js');const w=defaultWorkspace(),store=new Store();let calls=0;const requests=[];let streamed='';
  const plan=JSON.stringify({title:'Transport regression chapter',facts:['A brass key is retained.'],scenes:[{title:'Arrival',purpose:'Meet the keeper',stateAfter:'Keeper agrees to help'},{title:'Departure',purpose:'Use the key',stateAfter:'The door opens'}]});
  const adapter={kind:'llama.cpp',countTokens:async()=>100,async generate(model,messages,caps,cb,signal,request){requests.push({messages,request});calls++;const text=calls===1?plan:Array.from({length:420},(_,i)=>`Scene ${calls}, paragraph ${i}: The keeper carried the brass key through a changing landscape, considering the promise made at the gate.\n\n`).join('');cb.reasoning('Actual test reasoning channel.');for(let i=0;i<text.length;i+=157)cb.answer(text.slice(i,i+157));return{answer:text,reasoning:'Actual test reasoning channel.',calls:[],finishReason:'stop'};}};
  const opts={spark:w.sparks[0],model:{modelId:'test',backend:'llama.cpp',endpoint:'http://127.0.0.1:8080',contextSize:4096},session:{id:'writing-test',mode:'creative',messages:[{role:'user',content:'Write a chapter of 50,000 characters involving a brass key. Save the chapter under "Acceptance/Chapters".'}]},preferences:w.preferences,memories:[],signal:new AbortController().signal,events:{emit(){}},onAnswer:d=>{streamed+=d;},onApproval:async()=> 'allow'};
  const answer=await runLongWriting(opts,adapter,{contextSize:4096},'',null,store);assert.equal(calls,3);assert.equal(answer,streamed);assert.ok(requests.every(r=>r.request.outputTokens===-1));
  for(const r of requests){const users=r.messages.filter(m=>m.role==='user');assert.equal(users.length,1);assert.ok(users[0].content.includes(opts.session.messages[0].content));assert.match(users[0].content,/CURRENT SOLARIUM DOCUMENT OPERATION/);}
  const repo=new WritingRepository({sessionId:'writing-test',projectId:null},store);const docs=await repo.list();assert.equal(docs.length,1);const saved=await repo.get(docs[0].id);assert.ok(saved.content.markdownProjection.length>50000);assert.equal(saved.document.data.metadata.targetCharacters,50000);assert.equal((await repo.categories()).find(c=>c.id===saved.document.data.categoryId).title,'Chapters');assert.equal((await repo.revisions(docs[0].id)).length,4);
  const tasks=await store.list({scopes:repo.scopes(),collection:'writing_task'});assert.equal(tasks[0].data.state,'completed');assert.ok(!requests.some(r=>r.messages.some(m=>/continue thinking/i.test(m.content))));
});
test('an actual stopped scene preserves partial prose without an automatic reasoning replay',async()=>{
  const {defaultWorkspace}=require('../.test-dist/domain/defaults.js');const w=defaultWorkspace(),store=new Store(),abort=new AbortController();let calls=0;
  const adapter={kind:'llama.cpp',countTokens:async()=>100,async generate(model,messages,caps,cb){calls++;if(calls===1){const text=JSON.stringify({title:'Stopped chapter',facts:[],scenes:[{title:'A',purpose:'A',stateAfter:'A'},{title:'B',purpose:'B',stateAfter:'B'}]});cb.answer(text);return{answer:text,calls:[],finishReason:'stop'};}cb.answer('The key turned halfway.');abort.abort();throw new DOMException('Stopped','AbortError');}};
  const opts={spark:w.sparks[0],model:{modelId:'test',backend:'llama.cpp',contextSize:4096},session:{id:'stop',mode:'creative',messages:[{role:'user',content:'Write a 50k character chapter.'}]},preferences:w.preferences,memories:[],signal:abort.signal,events:{emit(){}},onAnswer(){},onApproval:async()=> 'allow'};
  await assert.rejects(runLongWriting(opts,adapter,{contextSize:4096},'',null,store),/Stopped/);assert.equal(calls,2);
  const tasks=await store.list({scopes:[{kind:'chat',id:'stop'}],collection:'writing_task'});assert.equal(tasks[0].data.state,'cancelled');assert.ok([...store.bodies.values()].some(body=>body==='The key turned halfway.'));
});
test('agent executes three real failed checks, preserves their diagnostics, repairs and verifies all commands',async()=>{
  // Only the native boundary and model transport are substituted. Node actually
  // runs each assertion process on a real temporary project; this verifies the
  // orchestration, not the intelligence of a real GGUF.
  const creator=require('../.test-dist/engine/creator.js');const commands=require('../.test-dist/engine/intelligence/commands.js');const {runAgent}=require('../.test-dist/engine/agent.js');
  const {defaultWorkspace}=require('../.test-dist/domain/defaults.js');const {AgentEventEmitter}=require('../.test-dist/engine/activity.js');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'solarium-repair-'));const file=path.join(dir,'state.cjs');fs.writeFileSync(file,'module.exports={a:0,b:0,c:0}');
  fs.writeFileSync(path.join(dir,'verify.cjs'),"const a=require('node:assert/strict');const s=require('./state.cjs');a.equal(s.a,1);a.equal(s.b,2);a.equal(s.c,3)");
  const catalogue=[{id:'script:test',command:'node verify.cjs',purpose:'assert three conditions',verification:true,cwd:'.'},{id:'script:build',command:'node --check state.cjs',purpose:'syntax',verification:true,cwd:'.'}];
  const originals={inspect:creator.inspectProjectEnvironment,replace:creator.replaceProjectText,list:commands.listProjectCommands,run:commands.runProjectCommand,fetch:global.fetch};
  const checks=[];const decisions=[];const requests=[];
  const steps=[['run_project_command',{command_id:'script:test'}],['run_project_command',{command_id:'script:build'}],['complete_project_task',{summary:'premature'}],['replace_project_text',{path:'state.cjs',expected_fragment:'a:0',replacement:'a:1'}],['run_project_command',{command_id:'script:test'}],['replace_project_text',{path:'state.cjs',expected_fragment:'b:0',replacement:'b:2'}],['run_project_command',{command_id:'script:test'}],['replace_project_text',{path:'state.cjs',expected_fragment:'c:0',replacement:'c:3'}],['run_project_command',{command_id:'script:test'}],['run_project_command',{command_id:'script:build'}],['complete_project_task',{summary:'Three conditions repaired and both commands pass.'}]];
  creator.inspectProjectEnvironment=async()=>({files:['state.cjs','verify.cjs','package.json'],fileCount:3,rootEntryCount:3,truncated:false,manifests:[{path:'package.json',content:'{"scripts":{"test":"node verify.cjs","build":"node --check state.cjs"}}'}],hasGit:false,dependenciesInstalled:true,errors:[]});
  creator.replaceProjectText=async(root,relative,expected,replacement)=>{assert.equal(root,dir);const p=path.join(root,relative);const old=fs.readFileSync(p,'utf8');assert.equal(old.split(expected).length,2);fs.writeFileSync(p,old.replace(expected,replacement));return 1;};
  commands.listProjectCommands=async()=>catalogue;
  commands.runProjectCommand=async(root,id)=>{const result=spawnSync(process.execPath,id==='script:test'?['verify.cjs']:['--check','state.cjs'],{cwd:root,encoding:'utf8'});checks.push({id,exit:result.status});return{command:catalogue.find(c=>c.id===id).command,exit_code:result.status,stdout:result.stdout,stderr:result.stderr,timed_out:false,cancelled:false,run_id:'run-'+checks.length,command_id:id,output_complete:true,duration_ms:1};};
  let turn=0;global.fetch=async(url,init={})=>{url=String(url);if(url.endsWith('/v1/models'))return Response.json({data:[{id:'test'}]});if(url.endsWith('/props'))return Response.json({supports_tools:true,default_generation_settings:{n_ctx:16384}});if(!url.endsWith('/v1/chat/completions'))return new Response('',{status:404});
    const body=JSON.parse(init.body);requests.push(body);let choice;if(turn<steps.length){const [name,args]=steps[turn];choice={delta:{tool_calls:[{index:0,id:'call-'+turn,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'};}else if(turn===steps.length)choice={delta:{content:'All requested corrections are verified.'},finish_reason:'stop'};else throw Error('Unexpected extra inference request');turn++;return new Response('data: '+JSON.stringify({choices:[choice]})+'\n\ndata: [DONE]\n\n');};
  try{const w=defaultWorkspace();w.preferences.actionMode='yolo';const result=await runAgent({spark:w.sparks[0],model:{id:'test',modelId:'test',backend:'llama.cpp',endpoint:'http://127.0.0.1:8080',contextSize:16384,temperature:.5,toolCalling:true},session:{id:'s',projectId:'p',mode:'work',messages:[{id:'u',role:'user',content:'Fix the code and verify all tests.'}]},projects:[{id:'p',name:'Fixture',folder:dir,description:'Real assertion fixture',instructions:''}],memories:[],preferences:w.preferences,events:new AgentEventEmitter(e=>decisions.push(e)),signal:new AbortController().signal,onAnswer(){},onApproval:async()=>{throw Error('YOLO should not prompt');}});
    assert.equal(result,'All requested corrections are verified.');assert.equal(checks.filter(c=>c.id==='script:test'&&c.exit!==0).length,3);assert.equal(checks.at(-1).exit,0);
    assert.ok(decisions.some(e=>e.tool==='complete_project_task'&&e.status==='failed'));assert.ok(decisions.some(e=>e.tool==='complete_project_task'&&e.status==='completed'));
    assert.equal(requests.length,steps.length+1);assert.ok(requests.every(r=>r.max_tokens===-1));assert.ok(!requests.some(r=>r.messages.some(m=>m.role==='user'&&/continue thinking/i.test(m.content))));
  }finally{creator.inspectProjectEnvironment=originals.inspect;creator.replaceProjectText=originals.replace;commands.listProjectCommands=originals.list;commands.runProjectCommand=originals.run;global.fetch=originals.fetch;fs.rmSync(dir,{recursive:true,force:true});}
});
