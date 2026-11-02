const test=require('node:test');
const assert=require('node:assert/strict');
const {WorkspaceSessionRepository,validateWorkspaceSnapshot,sourceFileUri}=require('../.test-dist/coding/integration/session.js');
const {importFoundation}=require('../.test-dist/foundation/backup.js');
const {defaultWorkspace}=require('../.test-dist/domain/defaults.js');
class Store{
 records=new Map();bodies=new Map();
 async list(filter){return [...this.records.values()].filter(r=>filter.scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)&&(!filter.collection||r.collection===filter.collection)).map(r=>structuredClone(r));}
 async body(id,scopes){const r=this.records.get(id);return r&&scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)?this.bodies.get(id)??null:null;}
 async batch(writes){for(const w of writes)if((this.records.get(w.record.id)?.version??null)!==w.expected)throw Error('Revision conflict');for(const w of writes){this.records.set(w.record.id,structuredClone(w.record));if(w.body!==undefined)this.bodies.set(w.record.id,w.body);}}
}
const snapshot=()=>({root:'E:/Project',activePath:'E:/Project/story.ts',documents:[{path:'E:/Project/story.ts',name:'story.ts',content:'水😀 unsaved\n'.repeat(5000),savedContent:'original\n',viewState:{position:{lineNumber:2,column:1}}}]});
test('workspace recovery preserves full dirty text, exact save base and owner across restart',async()=>{
 const store=new Store(),saved=snapshot();await new WorkspaceSessionRepository('p','E:/Project',store).save(saved);
 assert.deepEqual(await new WorkspaceSessionRepository('p','e:\\project',store).read(),saved);
 assert.equal(await new WorkspaceSessionRepository('foreign','E:/Project',store).read(),null);
 assert.equal(await new WorkspaceSessionRepository('p','E:/Other',store).read(),null);
});
test('recovery rejects sibling roots, parent traversal, duplicates and malformed content',()=>{
 for(const path of ['E:/Project2/file.ts','E:/Project/../secret.ts','E:/Project/new/../../secret.ts','E:/Outside/file.ts']){const value=snapshot();value.documents[0].path=path;assert.throws(()=>validateWorkspaceSnapshot(value,'E:/Project'),/foreign/);}
 const duplicate=snapshot();duplicate.documents.push({...duplicate.documents[0],path:'e:/project/STORY.ts'});assert.throws(()=>validateWorkspaceSnapshot(duplicate,'E:/Project'),/duplicate/);
});
test('simultaneous recovery writes enforce the real revision boundary',async()=>{
 const store=new Store(),repo=new WorkspaceSessionRepository('p','E:/Project',store),first=snapshot(),second=snapshot();second.documents[0].content='different';
 const result=await Promise.allSettled([repo.save(first),repo.save(second)]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.filter(r=>r.status==='rejected').length,1);
});
test('backup import rejects forged workspace recovery before writing',async()=>{
 const store=new Store(),repo=new WorkspaceSessionRepository('p','E:/Project',store);await repo.save(snapshot());const record=await store.list({scopes:[{kind:'project',id:'p'}]});const value=snapshot();value.documents[0].path='E:/Other/secret.ts';
 const workspace=defaultWorkspace();workspace.projects=[{id:'p',folder:'E:/Project'}];
 await assert.rejects(()=>importFoundation({schemaVersion:1,records:[{record:record[0],body:JSON.stringify(value)}]},workspace,new Store()),/foreign/);
});

test('editor file URIs preserve literal spaces, hashes and question marks',()=>{assert.equal(sourceFileUri('E:\\Project\\birds #1?.ts'),'file:///E:/Project/birds%20%231%3F.ts');assert.equal(sourceFileUri('/tmp/bird name.ts'),'file:///tmp/bird%20name.ts');});

test('cache telemetry cannot hide repeated unchanged indexed context',()=>{const {WorkMemory}=require('../.test-dist/engine/intelligence/work-memory.js');const memory=new WorkMemory(),args={kind:'context',query:'feedBirds'};for(const cacheHits of [0,1])memory.observe('query_project_intelligence',args,'completed',JSON.stringify({provider:'glitch-project-index',root:'E:/Project',text:'exact original source',report:{cacheHits}}));assert.equal(memory.stalled,true);assert.match(memory.context(),/unchanged x2/);memory.observe('query_project_intelligence',args,'completed',JSON.stringify({provider:'glitch-project-index',root:'E:/Project',text:'actually changed source',report:{cacheHits:2}}));assert.equal(memory.data.observations.at(-1).count,1);});

test('all actual coding acceptance prompts reach project tools, including linked existing repairs',()=>{const {isImplementationRequest}=require('../.test-dist/engine/task-intent.js');const {qualityCases}=require('../.test-dist/quality/cases.js');for(const scenario of qualityCases.filter(c=>c.category==='coding'&&c.files))assert.equal(isImplementationRequest(scenario.messages.at(-1).content,true),true,scenario.id);assert.equal(isImplementationRequest('Fix the linked existing project.',true),true);for(const prompt of ['How would you fix this source file?','Fix the dialogue in my chapter.','Repair the plot of this story.'])assert.equal(isImplementationRequest(prompt,true),false,prompt);});

test('remaining checks stay actionable while repeated passes cannot hide missing tests',()=>{const {selectActionTools,allowedToolDefinitions}=require('../.test-dist/engine/tools.js');const {validateToolArguments}=require('../.test-dist/engine/intelligence/tool-validation.js');const {WorkMemory}=require('../.test-dist/engine/intelligence/work-memory.js');const environment={rootEntryCount:3,fileCount:3,checks:['npm_test'],commands:['build','check','test'].map(name=>({id:'script:'+name,command:'npm run '+name,purpose:name,verification:true,cwd:'.'}))};const options={projectHasFiles:true,environment,pending:['script:test'],lastTool:'run_project_command',requireWrite:true};for(const stalled of [false,true]){const tools=selectActionTools(allowedToolDefinitions(false,true),{...options,stalled});const runner=tools.find(t=>t.function.name==='run_project_command');assert.deepEqual(runner.function.parameters.properties.command_id.enum,['script:test']);assert.equal(validateToolArguments('run_project_command',JSON.stringify({command_id:'script:build'}),tools).ok,false);assert.equal(validateToolArguments('run_project_command',JSON.stringify({command_id:'script:test'}),tools).ok,true);}const memory=new WorkMemory();for(let n=0;n<2;n++)memory.observe('run_project_command',{command_id:'script:build'},'completed',JSON.stringify({exit_code:0,stdout:'passed',run_id:String(n),duration_ms:n}));assert.equal(memory.stalled,true);memory.observe('apply_project_changes',{},'completed','actual edit',true);assert.equal(memory.stalled,false);});

test('passing verification stays in its actual command phase until completion; failures retain repairs',()=>{const {selectActionTools,allowedToolDefinitions}=require('../.test-dist/engine/tools.js');const all=allowedToolDefinitions(false,true),environment={rootEntryCount:3,fileCount:3,checks:[],commands:[{id:'script:test',command:'npm test',verification:true,cwd:'.'}]};const base={projectHasFiles:true,environment,lastTool:'run_project_command',failures:[],requireWrite:true};assert.deepEqual(selectActionTools(all,{...base,pending:['script:test']}).map(t=>t.function.name),['run_project_command']);assert.deepEqual(selectActionTools(all,{...base,pending:[]}).map(t=>t.function.name),['complete_project_task']);assert.ok(selectActionTools(all,{...base,pending:['script:test'],failures:['script:test']}).some(t=>t.function.name==='replace_project_text'));assert.ok(selectActionTools(all,{...base,pending:[],behaviorMissing:true}).some(t=>t.function.name==='apply_project_changes'));});
