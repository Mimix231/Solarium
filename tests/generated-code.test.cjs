const test=require('node:test');
const assert=require('node:assert/strict');
const {CodeRepository,sourcePathHint}=require('../.test-dist/coding/artifacts/repository.js');
const {GeneratedCodeStream}=require('../.test-dist/coding/artifacts/stream.js');
const {codeArtifactEvents}=require('../.test-dist/coding/artifacts/events.js');
const {parseMessageParts}=require('../.test-dist/blocks/protocol.js');
const {isImplementationRequest,isCodeArtifactRequest}=require('../.test-dist/engine/task-intent.js');
const {allowedToolDefinitions}=require('../.test-dist/engine/tools.js');
const {decideToolPermission}=require('../.test-dist/engine/action-permissions.js');
const {importFoundation,exportAll,cleanupDeletedOwners}=require('../.test-dist/foundation/backup.js');
const {defaultWorkspace}=require('../.test-dist/domain/defaults.js');
class Store{
 records=new Map();bodies=new Map();
 async list(filter){return [...this.records.values()].filter(r=>filter.scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)&&(!filter.collection||r.collection===filter.collection)).map(r=>structuredClone(r));}
 async body(id,scopes){const r=this.records.get(id);return r&&scopes.some(s=>s.kind===r.scope.kind&&s.id===r.scope.id)?this.bodies.get(id)??null:null;}
 async batch(writes,deletes=[]){for(const w of writes)if((this.records.get(w.record.id)?.version??null)!==w.expected)throw Error('Revision conflict');for(const d of deletes)if(this.records.get(d.id)?.version!==d.expected)throw Error('Revision conflict');for(const w of writes){this.records.set(w.record.id,structuredClone(w.record));if(w.body!==undefined)this.bodies.set(w.record.id,w.body);}for(const d of deletes){this.records.delete(d.id);this.bodies.delete(d.id);}}
}
const origin={sessionId:'chat-a',messageId:'message-a',blockId:'block-0',sparkId:'spark-a'};
const block=(content='export const birds="水😀";\n')=>({id:'block-0',kind:'code',title:'src/birds.ts',language:'typescript',fileName:'src/birds.ts',content,status:'complete',provenance:'model'});
const access={sessionId:'chat-a',projectId:'project-a'};
test('ordinary fenced code is a durable artifact with exact Unicode, identity and original revision',async()=>{
 const store=new Store(),repo=new CodeRepository(access,store),source=block('水😀\n'.repeat(18000));const saved=await repo.capture(source,origin,true);
 assert.equal(saved.data.state,'ready');assert.equal(saved.data.naturalEnd,true);assert.equal(saved.data.pathHint,'src/birds.ts');assert.equal((await repo.get(saved.id)).content,source.content);assert.equal((await repo.revisions(saved.id)).length,1);
 assert.equal((await repo.capture(source,origin,true)).version,saved.version);assert.equal((await repo.list()).length,1);
});
test('stream checkpoints survive Stop, remain incomplete, and can be edited without losing their original',async()=>{
 const store=new Store(),repo=new CodeRepository(access,store);const stream=new GeneratedCodeStream(repo,{sessionId:origin.sessionId,messageId:origin.messageId},e=>{throw e;});
 stream.push('```python file="birds.py"\ndef chirp():\n    return "水😀"');await stream.finish(false,true);
 const [saved]=await repo.list();assert.equal(saved.data.state,'incomplete');assert.equal(saved.data.naturalEnd,false);const original=(await repo.get(saved.id)).content;const edited=await repo.edit(saved.id,original+'\n',saved.version);assert.equal((await repo.get(saved.id)).content,original+'\n');assert.equal(edited.data.state,'incomplete');const revisions=await repo.revisions(saved.id);assert.equal(revisions.length,2);assert.ok((await Promise.all(revisions.map(r=>store.body(r.id,[saved.scope])))).includes(original));
});
test('a closed source fence without natural model completion does not claim completed generation',async()=>{
 const repo=new CodeRepository(access,new Store());const stream=new GeneratedCodeStream(repo,{sessionId:'chat-a',messageId:'unknown-end'},()=>{});stream.push('```js\nconsole.log(1)\n```');await stream.finish(false,false);assert.equal((await repo.list())[0].data.state,'incomplete');
});
test('concurrent artifact edits enforce CAS and reopening chat cannot overwrite a user revision',async()=>{
 const store=new Store(),repo=new CodeRepository(access,store),original=block(),saved=await repo.capture(original,origin,true);
 const results=await Promise.allSettled([repo.edit(saved.id,'first edit',saved.version),repo.edit(saved.id,'second edit',saved.version)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 await repo.capture(original,origin,true);assert.ok(['first edit','second edit'].includes((await repo.get(saved.id)).content));assert.equal((await repo.revisions(saved.id)).length,2);
});
test('artifacts stay scoped; private chat code never appears in another project or peer chat',async()=>{
 const store=new Store(),repo=new CodeRepository(access,store),shared=await repo.capture(block(),origin,true);assert.equal((await new CodeRepository({sessionId:'peer',projectId:'project-a'},store).get(shared.id)).content,block().content);
 await assert.rejects(()=>new CodeRepository({sessionId:'other',projectId:'project-b'},store).get(shared.id),/unavailable/);
 const privateRepo=new CodeRepository({sessionId:'private',projectId:null},store);const saved=await privateRepo.capture(block(),{...origin,sessionId:'private'},true);assert.equal((await new CodeRepository({sessionId:'peer',projectId:null},store).list()).length,0);await assert.rejects(()=>repo.get(saved.id),/unavailable/);
});
test('source readers page the complete original without clipping storage',async()=>{
 const source='🦜abcdefgh'.repeat(7000),repo=new CodeRepository(access,new Store()),saved=await repo.capture(block(source),origin,true);let rebuilt='',offset=0;do{const page=await repo.read(saved.id,offset);rebuilt+=page.content;offset=page.nextOffset;if(!page.hasMore)break;}while(offset<source.length);assert.equal(rebuilt,source);await assert.rejects(()=>repo.read(saved.id,-1),/nonnegative/);
});
test('file metadata is retained separately from a friendly title and unsafe paths are proposals only',()=>{
 const part=parseMessageParts('```typescript title="Bird helper" file="src/birds.ts"\nexport const birds=1;\n```')[0];assert.equal(part.block.fileName,'src/birds.ts');assert.equal(sourcePathHint(part.block),'src/birds.ts');for(const fileName of ['../escape.ts','C:/escape.ts','/root/file.py','src/../../escape.js','src/file?.js'])assert.equal(sourcePathHint({...block(),fileName}),null);
});
test('a source artifact does not masquerade as a project write or behavioral verification',async()=>{
 const repo=new CodeRepository(access,new Store()),saved=await repo.capture(block(),origin,true);assert.equal(saved.data.applied,undefined);await repo.markApplied(saved.id,saved.data.currentRevisionId,'E:/Project','src/birds.ts');const applied=(await repo.get(saved.id)).artifact;assert.equal(applied.data.applied.path,'src/birds.ts');const changed=await repo.edit(saved.id,'changed source',applied.version);assert.equal(changed.data.applied,undefined);
});
test('writing/terminal blocks are not captured as generated code',async()=>{
 const repo=new CodeRepository(access,new Store());for(const kind of ['writing','terminal','file','workflow'])await assert.rejects(()=>repo.capture({...block(),kind},origin,true),/Only actual source/);
});
test('explicit chat-code delivery stays generative even in a project, while actual file changes retain tools',()=>{
 for(const prompt of ['Implement a Python helper in a code block.','Write JavaScript source in chat using code blocks.','Create a React component in fenced code with file="src/App.tsx".']){assert.equal(isCodeArtifactRequest(prompt),true,prompt);assert.equal(isImplementationRequest(prompt,true),false,prompt);}
 assert.equal(isImplementationRequest('Apply this code block to the project files.',true),true);assert.equal(isImplementationRequest('Fix the linked existing project.',true),true);
 const names=allowedToolDefinitions(false,false).map(t=>t.function.name);assert.ok(names.includes('list_generated_code'));assert.ok(names.includes('read_generated_code'));assert.ok(!names.includes('read_project_file'));
 assert.equal(decideToolPermission({mode:'auto',name:'read_generated_code',webEnabled:false,projectAttached:false}),'allow');assert.equal(decideToolPermission({mode:'ask',name:'read_generated_code',webEnabled:false,projectAttached:false}),'ask');assert.equal(decideToolPermission({mode:'yolo',name:'read_generated_code',webEnabled:false,projectAttached:false,configured:'deny'}),'deny');
});
test('backup restores source bodies/revisions and rejects missing or foreign revisions before writing',async()=>{
 const store=new Store(),repo=new CodeRepository(access,store);await repo.capture(block(),origin,true);const w=defaultWorkspace();w.projects=[{id:'project-a',folder:'E:/Project'}];w.sessions=[];const exported=await exportAll(w,store),restored=new Store();await importFoundation(exported.foundation,w,restored);assert.equal((await new CodeRepository(access,restored).list()).length,1);
 const bad=structuredClone(exported.foundation);bad.records=bad.records.filter(e=>e.record.collection!=='code_revision');await assert.rejects(()=>importFoundation(bad,w,new Store()),/revision is missing/);
});
test('owner deletion retains authored code in recovered storage with explicit access',async()=>{
 const store=new Store(),before=defaultWorkspace();before.projects=[{id:'project-a',folder:'E:/Project'}];before.sessions=[];const repo=new CodeRepository(access,store),saved=await repo.capture(block(),origin,true);const after=structuredClone(before);after.projects=[];await cleanupDeletedOwners(before,after,store);
 assert.equal((await new CodeRepository({sessionId:'new',projectId:null},store).list()).length,0);const recovered=new CodeRepository({sessionId:null,projectId:null,personal:true},store);assert.equal((await recovered.get(saved.id)).content,block().content);const exported=await exportAll(after,store);await importFoundation(exported.foundation,after,new Store());
});

test('restart recovery preserves the last checkpoint as an incomplete immutable revision and protects active streams',async()=>{
 const repo=new CodeRepository(access,new Store());const draft=await repo.capture({...block(),status:'streaming'},origin);
 codeArtifactEvents.setStreaming(origin.sessionId,origin.messageId,true);
 try{await assert.rejects(()=>repo.recoverInterrupted(draft.id,draft.version),/still generating/);}finally{codeArtifactEvents.setStreaming(origin.sessionId,origin.messageId,false);}
 const recovered=await repo.recoverInterrupted(draft.id,draft.version);assert.equal(recovered.data.state,'incomplete');assert.equal(recovered.data.naturalEnd,false);assert.equal((await repo.get(draft.id)).content,block().content);assert.equal((await repo.revisions(draft.id)).length,1);
 await assert.rejects(()=>repo.recoverInterrupted(draft.id,draft.version),/changed/);
 await repo.edit(draft.id,'repaired incomplete source',recovered.version);assert.equal((await repo.revisions(draft.id)).length,2);
 await assert.rejects(()=>repo.read(draft.id,999999),/past the end/);
});

test('substantial repeated generated code is flagged while exact originals remain saved and repairs clear the finding',async()=>{
 const repo=new CodeRepository(access,new Store());const repeated=Array.from({length:36},(_,i)=>`const value${i}=input+${i};`).join('\n');const original=block(`function a(input){${repeated}return input;}\nfunction b(input){${repeated}return input;}`);const saved=await repo.capture(original,origin,true);assert.ok(saved.data.diagnostics.length);assert.equal((await repo.get(saved.id)).content,original.content);const fixed=await repo.edit(saved.id,'export const result=42;\n',saved.version);assert.deepEqual(fixed.data.diagnostics,[]);assert.equal((await repo.revisions(saved.id)).length,2);
});

test('large source blocks can scroll to their actual final line beyond the former 12,000-line display cutoff',()=>{
 const {codeWindow,CODE_LINE_HEIGHT}=require('../.test-dist/blocks/code-window.js');const lines=Array.from({length:13050},(_,i)=>`line ${i+1} 水😀`);const source=lines.join('\n');const last=codeWindow(lines,lines.length*CODE_LINE_HEIGHT);assert.equal(last.end,13050);assert.equal(last.rows.at(-1),'line 13050 水😀');assert.equal(last.top+last.rows.length*CODE_LINE_HEIGHT+last.bottom,lines.length*CODE_LINE_HEIGHT);assert.equal(lines.join('\n'),source);
});
