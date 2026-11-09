const test=require('node:test');
const assert=require('node:assert/strict');
const {WorkMemory,withWorkNotes}=require('../.test-dist/engine/intelligence/work-memory.js');
const {allowedToolDefinitions,selectActionTools}=require('../.test-dist/engine/tools.js');
const {prepareGeneration}=require('../.test-dist/engine/context-window.js');
const {StoryRepository}=require('../.test-dist/stories/repository.js');
const {WritingRepository}=require('../.test-dist/writing/repository.js');
const {markdownContent}=require('../.test-dist/writing/schema.js');
const {StoryMemoryStream,rememberStoryEvents}=require('../.test-dist/stories/memory.js');
const {workLogRows}=require('../.test-dist/engine/work-log.js');
class Store {
  records=new Map();bodies=new Map();
  async list(f){return [...this.records.values()].filter(r=>f.scopes.some(s=>s.id===r.scope.id&&s.kind===r.scope.kind)&&(!f.collection||r.collection===f.collection)&&(!f.storyId||f.storyId===r.storyId)).map(r=>structuredClone(r));}
  async body(id,scopes){const r=this.records.get(id);return r&&scopes.some(s=>s.id===r.scope.id&&s.kind===r.scope.kind)?this.bodies.get(id)??null:null;}
  async batch(writes,deletes=[]){for(const w of writes)assert.equal(this.records.get(w.record.id)?.version??null,w.expected);for(const w of writes){this.records.set(w.record.id,structuredClone(w.record));if(w.body!==undefined)this.bodies.set(w.record.id,w.body);}for(const d of deletes){this.records.delete(d.id);this.bodies.delete(d.id);}}
}
const empty={rootEntryCount:0,fileCount:0,commands:[],checks:[],dependenciesInstalled:false};
test('uncapped llama.cpp streams retain the fitted prompt; vLLM receives no unsupported retention option',async()=>{
  const {streamLlamaTurn}=require('../.test-dist/engine/llama.js');const previous=global.fetch,requests=[];
  global.fetch=async(url,init)=>{requests.push(JSON.parse(init.body));return new Response('data: '+JSON.stringify({choices:[{delta:{reasoning_content:'genuine reasoning'},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{content:'answer'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');};
  try{for(const backend of ['llama.cpp','vllm','ollama']){let thought='',answer='';await streamLlamaTurn({backend,modelId:'fixture',endpoint:'http://localhost:8080',temperature:.7,maxTokens:128},[{role:'system',content:'Retain the goal and chosen stack.'},{role:'user',content:'Create the project.'}],{tools:'supported'},{reasoning:d=>thought+=d,answer:d=>answer+=d},new AbortController().signal,{outputTokens:-1});assert.equal(thought,'genuine reasoning');assert.equal(answer,'answer');}assert.equal(requests.length,3);assert.equal(requests[0].max_tokens,-1);assert.equal(requests[0].n_keep,-1);assert.equal(requests[1].n_keep,undefined);assert.equal(requests[2].n_keep,undefined);}finally{global.fetch=previous;}
});
test('a resumed task restores its actual goal, decisions and unresolved verification together',async()=>{
  const {TaskExecution}=require('../.test-dist/engine/intelligence/task.js');const {VerificationLedger}=require('../.test-dist/engine/intelligence/commands.js');
  const store=new Store(),session={id:'s',messages:[{role:'user',content:'Build a Tauri video editor.'}]},project={id:'p'};
  const task=new TaskExecution(session,project,[],store),ledger=new VerificationLedger(),memory=new WorkMemory();memory.note({decisions:[{key:'frontend',value:'SvelteKit'}],next_action:'Create files.'});
  task.checkpoint(ledger.state,memory.data);await task.persist();await task.finish('cancelled');
  const resumed=new TaskExecution({...session,messages:[...session.messages,{role:'user',content:'Continue'}]},project,[],store);
  assert.equal(await resumed.resume({...session,messages:[{role:'user',content:'Continue'}]}),true);assert.equal(resumed.data.requestedOutcome,'Build a Tauri video editor.');assert.equal(resumed.data.workMemory.decisions[0].value,'SvelteKit');assert.equal(resumed.data.workMemory.nextAction,'Create files.');assert.equal(resumed.data.state,'working');await resumed.persist();
});
test('settled decisions survive reload and repeated discovery changes the next offered strategy',async()=>{
  const memory=new WorkMemory();memory.environment=empty;
  memory.note({decisions:[{key:'frontend',value:'SvelteKit + TypeScript'}],next_action:'Create project files.'});
  memory.observe('get_project_map',{},'completed','{"files":[]}');memory.observe('get_project_map',{},'completed','{"files":[]}');assert.equal(memory.stalled,true);
  const restored=new WorkMemory(JSON.parse(JSON.stringify(memory.data)));restored.environment=empty;
  assert.match(restored.context(),/SvelteKit/);assert.match(restored.context(),/unchanged x2/);assert.match(restored.context(),/apply_project_changes/);
  assert.equal(restored.note({decisions:[{key:'frontend',value:'React'}]}).length,1);assert.equal(restored.data.decisions[0].value,'SvelteKit + TypeScript');
  const tools=selectActionTools(allowedToolDefinitions(false),{projectHasFiles:false,environment:empty,pending:[],selected:['get_project_map','run_project_command'],stalled:restored.stalled}).map(withWorkNotes);
  assert.equal(tools[0].function.name,'apply_project_changes');assert.ok(!tools.some(t=>t.function.name==='run_project_command'));
  const prepared=await prepareGeneration({countTokens:async()=>null},{backend:'llama.cpp',contextSize:4096},{contextSize:4096},[{role:'system',content:restored.context()},{role:'user',content:'Create the Tauri project files.'}],new AbortController().signal,{tools,requireTools:true});assert.equal(prepared.tools[0].function.name,'apply_project_changes');assert.match(prepared.messages[0].content,/SvelteKit/);
});
test('unchanged file evidence survives new archive IDs without confusing distinct files or changed contents',()=>{
 const memory=new WorkMemory();
 const output=(archiveId,content)=>JSON.stringify({path:'src/App.tsx',archiveId,content,startLine:1,nextLine:2,totalLines:1,hasMore:false});
 memory.observe('read_project_file',{path:'src/App.tsx'},'completed',output('archive-one','const value=1;'));
 memory.observe('read_project_file',{path:'src/other.ts'},'completed',output('archive-two','const value=1;'));
 assert.equal(memory.stalled,false);
 memory.observe('read_project_file',{path:'src/App.tsx'},'completed',output('archive-three','const value=2;'));
 assert.equal(memory.stalled,false);
 memory.observe('read_project_file',{path:'src/App.tsx'},'completed',output('archive-four','const value=2;'));
 assert.equal(memory.stalled,true);assert.match(memory.context(),/unchanged x2/);
 memory.observe('replace_project_text',{path:'src/App.tsx'},'completed','{"replacements":1}',true);
 assert.equal(memory.stalled,false);
 const runs=new WorkMemory();
 for(const [run_id,duration_ms] of [['one',12],['two',23]])runs.observe('run_project_command',{command_id:'script:test'},'failed',JSON.stringify({run_id,duration_ms,exit_code:1,stderr:'same failure'}));
 assert.equal(runs.stalled,true);
});
test('different discovery calls without changed evidence lead to creation; small-context new-file expectations stay exact',()=>{
 const {validateToolArguments}=require('../.test-dist/engine/intelligence/tool-validation.js');const memory=new WorkMemory();memory.environment=empty;
 memory.observe('choose_project_tools',{names:['get_project_map']},'completed','Selected map');memory.observe('get_project_map',{},'completed','No files');
 assert.equal(memory.stalled,true);
 const tools=selectActionTools(allowedToolDefinitions(false),{projectHasFiles:false,environment:empty,pending:[],stalled:memory.stalled,contextSize:4096,requireWrite:true}).map(withWorkNotes);
 assert.deepEqual(tools.map(t=>t.function.name),['apply_project_changes']);
 const file={path:'package.json',content:'{}',expected:null};assert.equal(validateToolArguments('apply_project_changes',{files:[file]},tools).ok,true);
 assert.equal(validateToolArguments('apply_project_changes',{files:[{...file,expected:''}]},tools).ok,false);
 assert.equal(validateToolArguments('apply_project_changes',{files:[file,{...file,path:'b.json'},{...file,path:'c.json'}]},tools).ok,false);
 const inspect=selectActionTools(allowedToolDefinitions(false),{projectHasFiles:false,environment:empty,pending:[],contextSize:4096,requireWrite:false});assert.equal(inspect[0].function.name,'complete_project_task');
});
test('discovery explicitly rejects nonexistent or disabled tools and preserves a usable writer',async()=>{
  const {executeCodingTool}=require('../.test-dist/engine/intelligence/coding-tools.js');
  const result=JSON.parse(await executeCodingTool('choose_project_tools',{names:['write_file','search_web','apply_project_changes']},{id:'s',projectId:'p'},[{id:'p',folder:'C:/fixture'}],{webEnabled:false,availableToolNames:['apply_project_changes','read_project_file']}));
  assert.equal(result.ok,false);assert.deepEqual(result.rejected,['write_file','search_web']);assert.deepEqual(result.selected,['apply_project_changes']);assert.match(result.notice,/expected=null/);
});
test('unknown catalogue commands never launch a process and return the creation route',async()=>{
  const commands=require('../.test-dist/engine/intelligence/commands.js');const {executeCodingTool}=require('../.test-dist/engine/intelligence/coding-tools.js');const original=commands.listProjectCommands;commands.listProjectCommands=async()=>[];
  try{await assert.rejects(executeCodingTool('run_project_command',{command_id:'npm create tauri-app'},{id:'s',projectId:'p'},[{id:'p',folder:'C:/fixture'}],{webEnabled:false}),/UNKNOWN_COMMAND_ID.*apply_project_changes/);}finally{commands.listProjectCommands=original;}
});
test('story metadata is separated at every stream boundary without clipping prose',()=>{
  const prose='Mara hid the brass key.\n';const input=prose+'<solarium-memory>'+JSON.stringify([{summary:'Mara hid the key.',quote:'Mara hid the brass key.',knowledge:[{character:'Mara',state:'knows'}]}])+'</solarium-memory>';
  for(const size of [1,2,7,31,4096]){let shown='';const stream=new StoryMemoryStream(d=>shown+=d);for(let i=0;i<input.length;i+=size)stream.push(input.slice(i,i+size));const memories=stream.finish();assert.equal(shown,prose);assert.equal(memories[0].knowledge[0].state,'knows');}
});
test('character memory persists knowledge, stays in its story and drops retracted prose',async()=>{
  const store=new Store(),access={sessionId:'s',projectId:'p'},stories=new StoryRepository(access,store),writing=new WritingRepository(access,store);
  const world=await stories.create('The brass key',{kind:'project',id:'p'},{originKind:'fanfiction'});
  const mara=await stories.character(world.id,'Mara',[],'adapted'),ilya=await stories.character(world.id,'Ilya',[],'adapted');
  await stories.saveClaims(mara,[{characterId:mara.id,section:'Personality & Voice',field:'voice',value:'Speaks plainly; never boasts.',kind:'au_override',locked:true,reviewed:true,sourceLinks:[]}],true);
  let doc=await writing.create({scope:{kind:'project',id:'p'},storyId:world.id,title:'Chapter one',markdown:'Mara hid the brass key beneath the floor. Ilya was asleep elsewhere.'});
  const input={summary:'Mara hid the key while Ilya was absent.',quote:'Mara hid the brass key beneath the floor.',knowledge:[{character:mara.id,state:'knows'},{character:ilya.id,state:'unknown'}]};
  await rememberStoryEvents(stories,writing,doc,[input]);await rememberStoryEvents(stories,writing,doc,[input]);assert.equal((await stories.events(world.id)).length,1);
  const restored=new StoryRepository(access,store),context=await restored.contextPack(world.id,'Write the next chapter.');assert.match(context,/Speaks plainly/);assert.match(context,/Ilya=unknown/);assert.match(context,/Mara=knows/);
  await assert.rejects(rememberStoryEvents(stories,writing,doc,[{...input,quote:'A future event that never happened.'}]),/exact passage/);
  const foreign=new StoryRepository({sessionId:'other',projectId:'q'},store);await assert.rejects(foreign.contextPack(world.id,'Mara'),/outside/);
  doc=await writing.save(doc,markdownContent('Mara hid the **brass** key beneath the floor. Ilya was asleep elsewhere.'));assert.equal((await restored.activeEvents(world.id)).length,1);
  doc=await writing.save(doc,markdownContent('Mara returned the key to the keeper.'));assert.equal((await restored.activeEvents(world.id)).length,0);
});
test('work log consolidates repeated failures while retaining every attempt and actual commands',()=>{
  const a={id:'1',kind:'check',status:'failed',title:'Checking · run_project_command',detail:'Unknown command',output:'Unknown command',createdAt:'now',updatedAt:'now'};
  const rows=workLogRows([a,{...a,id:'2'},{...a,id:'3',status:'completed',output:JSON.stringify({command:'npm run check'})},{...a,id:'4',title:'Inspecting · choose_project_tools',kind:'inspect',status:'completed'}],[{command:'npm run check',exitCode:0,stdout:'passed',stderr:''}]);
  assert.equal(rows[0].attempts.length,2);assert.equal(rows.filter(r=>r.run).length,1);assert.equal(rows.find(r=>r.run).title,'Ran npm run check');assert.equal(rows.at(-1).internal,true);
});

test('no-op edits cannot count as progress and Web OFF never advertises network installation',()=>{
 const {validateToolArguments}=require('../.test-dist/engine/intelligence/tool-validation.js');const defs=allowedToolDefinitions(false);
 assert.equal(validateToolArguments('replace_project_text',{path:'package.json',expected_fragment:'^18.2.0',replacement:'^18.2.0'},defs).ok,false);
 assert.equal(validateToolArguments('apply_project_changes',{files:[{path:'file.ts',expected:'const x=1;',content:'const x=1;'}]},defs).ok,false);
 const environment={...empty,rootEntryCount:2,fileCount:2,commands:[{id:'install:network',command:'npm install'},{id:'install:cached',command:'npm install --offline'}]};
 const tools=selectActionTools(defs,{projectHasFiles:true,environment,pending:[],selected:['run_project_command'],webEnabled:false});assert.deepEqual(tools[0].function.parameters.properties.command_id.enum,['install:cached']);
 const memory=new WorkMemory();memory.note({next_action:'Create the remaining source files.'});memory.observe('apply_project_changes',{},'completed','Created manifests.',true);assert.equal(memory.data.nextAction,'Create the remaining source files.');
});

test('an explicit runnable catalogue selection survives the stalled-write and app-plan defaults', () => {
  const environment = { ...empty, rootEntryCount: 1, fileCount: 1, files: ['package.json'], commands: [
    { id: 'script:test', command: 'npm test' },
    { id: 'install:network', command: 'npm install', network: true },
  ] };
  const tools = selectActionTools(allowedToolDefinitions(false), {
    projectHasFiles: true, environment, pending: ['script:test'], stalled: true,
    appStage: 'plan', selected: ['run_project_command'], webEnabled: false,
  });
  assert.deepEqual(tools.map(tool => tool.function.name), ['run_project_command']);
  assert.deepEqual(tools[0].function.parameters.properties.command_id.enum, ['script:test']);
  assert.match(tools[0].function.description, /script:test/);
});

test('the real empty-project starter is reachable in 4K and keeps a verified Rust bridge',async()=>{
 const {videoEditorTemplate}=require('../.test-dist/engine/intelligence/recipes.js');const files=videoEditorTemplate('Video Editor');
 assert.match(files.find(f=>f.path==='src/App.tsx').content,/invoke<string>\('greet'/);assert.match(files.find(f=>f.path==='src-tauri/src/main.rs').content,/generate_handler!\[greet\]/);assert.match(files.find(f=>f.path==='src-tauri/src/main.rs').content,/rust_bridge_reply/);
 const tools=selectActionTools(allowedToolDefinitions(false),{projectHasFiles:false,environment:empty,pending:[],contextSize:4096,bootstrap:true,requireWrite:true}).map(withWorkNotes);
 assert.equal(tools[0].function.name,'create_video_editor_project');
 const prepared=await prepareGeneration({countTokens:async()=>null},{backend:'llama.cpp',contextSize:4096},{contextSize:4096},[{role:'system',content:'Create the requested Tauri video editor. Preserve the selected Spark.'},{role:'user',content:'Start Phase 1.'}],new AbortController().signal,{tools,requireTools:true});assert.equal(prepared.tools[0].function.name,'create_video_editor_project');
});
test('live work memory is compact without deleting its stored decisions or diagnostics',()=>{
 const {VerificationLedger}=require('../.test-dist/engine/intelligence/commands.js');const memory=new WorkMemory();memory.environment=empty;
 for(let i=0;i<20;i++)memory.note({decisions:[{key:'strategy'+i,value:'Detailed strategy '.repeat(14)}]});
 memory.note({decisions:[{key:'tech_stack',value:'Tauri 2, React, TypeScript'}]});memory.observe('run_project_command',{command_id:'script:build'},'failed','ERR_MODULE_NOT_FOUND: Cannot find package vite. '+ 'stack trace '.repeat(1000));
 assert.ok(memory.context().length<2000);assert.equal(memory.data.decisions.length,21);assert.match(memory.context(),/Tauri 2/);
 const ledger=new VerificationLedger();ledger.record('script:build',{command:'npm run build',exit_code:1,stdout:'',stderr:'Error [ERR_MODULE_NOT_FOUND]: Cannot find package vite.\n'+'stack trace\n'.repeat(300),timed_out:false});assert.ok(ledger.context().length<1000);assert.ok(ledger.state.checks['script:build'].diagnostic.length>3000);
});

test('unrun checks lead to verification while actual failing checks lead to diagnosis',()=>{
 const environment={...empty,rootEntryCount:14,fileCount:14,files:['package.json'],manifests:[{path:'package.json',content:'{"scripts":{"check":"node --check index.js"}}'}],dependenciesInstalled:true,commands:[{id:'script:check',command:'npm run check',verification:true}],checks:['npm_check']};const allowed=allowedToolDefinitions(false);
 const verify=selectActionTools(allowed,{projectHasFiles:true,environment,pending:['script:check'],failures:[],starterCreated:true,lastTool:'read_project_file'});assert.equal(verify[0].function.name,'run_project_command');assert.deepEqual(verify[0].function.parameters.properties.command_id.enum,['script:check']);
 assert.equal(selectActionTools(allowed,{projectHasFiles:true,environment,pending:['script:check'],failures:['script:check'],lastTool:'run_project_command'})[0].function.name,'read_command_output');
 const noDeps={...environment,dependenciesInstalled:false};assert.ok(!selectActionTools(allowed,{projectHasFiles:true,environment:noDeps,pending:['script:check'],lastTool:'apply_project_changes'}).some(t=>t.function.name==='install_project_dependencies'));
});
test('a writing fence flushes before genuine finalization without warning on an identical saved revision',async()=>{
 const {WritingDraftStream}=require('../.test-dist/writing/stream.js');const store=new Store(),repo=new WritingRepository({sessionId:'stream',projectId:null},store),warnings=[];
 await repo.create({scope:{kind:'chat',id:'stream'},title:'Tool title',messageId:'message'});
 const stream=new WritingDraftStream(repo,{kind:'chat',id:'stream'},'message',null,e=>warnings.push(String(e)));stream.push('```solarium-writing title="Fence title"\nMira listened before opening the door.\n```');await stream.flush();const docs=await repo.list();assert.equal(docs.length,1);const draft=await repo.draft(docs[0].id);assert.equal(draft.status,'draft');await repo.save((await repo.get(docs[0].id)).document,markdownContent(draft.markdown));await stream.finish(false);assert.deepEqual(warnings,[]);assert.match((await repo.get(docs[0].id)).content.markdownProjection,/Mira listened/);
});
test('a long truncated operation preview still labels the actual command only once',()=>{
 const a={id:'1',kind:'check',status:'completed',title:'Checking · script:build',detail:'Actual result',output:'{"command":"npm run build","stdout":"'+ 'log'.repeat(20000),createdAt:'now',updatedAt:'now'};const rows=workLogRows([a],[{command:'npm run build',exitCode:0,stdout:'log',stderr:''}]);assert.equal(rows.length,1);assert.equal(rows[0].title,'Ran npm run build');
});

test('oversized latest tool results keep their real identity and archive while fitting 4K input',async()=>{
 const model={backend:'llama.cpp',contextSize:4096};const capabilities={contextSize:4096};const raw=JSON.stringify({path:'src/App.tsx',archiveId:'archive-proof',content:'const nativeBridge = true;\n'.repeat(500),startLine:1,nextLine:501,totalLines:500,hasMore:false});
 const original=[{role:'system',content:'User goal and Spark. '.repeat(100)},{role:'user',content:'Run the declared checks.'},{role:'assistant',content:'Read source.',tool_calls:[{id:'actual-call',type:'function',function:{name:'read_project_file',arguments:'{"path":"src/App.tsx"}'}}]},{role:'tool',tool_call_id:'actual-call',content:raw}];
 const tools=selectActionTools(allowedToolDefinitions(false),{projectHasFiles:true,environment:{...empty,rootEntryCount:14,files:[],commands:[{id:'script:check',command:'npm run check'}]},pending:['script:check'],starterCreated:true}).map(withWorkNotes);
 const prepared=await prepareGeneration({countTokens:async()=>null},model,capabilities,original,new AbortController().signal,{tools,requireTools:true});const result=prepared.messages.find(m=>m.role==='tool');assert.equal(result.tool_call_id,'actual-call');assert.match(result.content,/archive-proof/);assert.match(result.content,/inputExcerpt/);assert.equal(original.at(-1).content,raw);assert.ok(result.content.length<1500);assert.equal(prepared.tools[0].function.name,'run_project_command');
});

test('a text-only model can assign an opaque portrait reference without pretending to see pixels',()=>{
 const {buildMessage}=require('../.test-dist/engine/agent.js');const message={role:'user',content:'Use this image as Mira avatar.',attachments:[{id:'portrait-id',name:'Mira.png',kind:'image',dataUrl:'data:image/png;base64,AAAA'}]};
 assert.throws(()=>buildMessage(message,{vision:'unknown'}),/vision support/);const opaque=buildMessage(message,{vision:'unknown'},true);assert.equal(typeof opaque.content,'string');assert.match(opaque.content,/portrait-id/);assert.ok(!opaque.content.includes('base64'));assert.match(opaque.content,/cannot describe/);
});
test('character identities deduplicate aliases and dynamic knowledge retains its timeline point',async()=>{
 const store=new Store(),repo=new StoryRepository({sessionId:'s',projectId:'p'},store),world=await repo.create('Cast',{kind:'project',id:'p'});const mira=await repo.character(world.id,'Mira',['Keeper'],'original'),ren=await repo.character(world.id,'Ren',[],'original');
 assert.equal((await repo.character(world.id,'keeper',[],'original')).id,mira.id);await assert.rejects(repo.editCharacter(ren,'Keeper',ren.data),/already uses/);
 await repo.saveClaims(mira,[{characterId:mira.id,section:'Knowledge State',field:'knowledge',value:'Ren has not seen the key.',kind:'user_defined',locked:true,reviewed:true,sourceLinks:[],dynamicKnowledge:true,knowledgeAfterEvent:0}],true);
 const context=await repo.contextPack(world.id,'Write the next scene.',true);assert.match(context,/baseline after event 0/);assert.match(context,/Later revelations advance/);
});

test('memory metadata removes only its control block and retains a trailing writing fence',()=>{
 let shown='';const stream=new StoryMemoryStream(d=>shown+=d);stream.push('```solarium-writing\nMira listened.\n<solarium-memory>');stream.push('[]</solarium-memory>\n```');stream.push('\nSaved scene.');assert.deepEqual(stream.finish(),[]);assert.equal(shown,'```solarium-writing\nMira listened.\n\n```\nSaved scene.');
});
