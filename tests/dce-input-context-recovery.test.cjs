'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript');}catch{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
function load(rel){const module={exports:{}};
 const source=fs.readFileSync(path.join(root,rel),'utf8');
 const result=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
 assert.equal(result.diagnostics.length,0,rel);
 vm.runInNewContext(result.outputText,{module,exports:module.exports,require(){throw Error('Unexpected runtime import in '+rel);},TextEncoder,DOMException,console}, {filename:rel});
 return module.exports;
}
const {prepareGeneration,streamingDecisionHeadroom}=load('src/engine/context-window.ts');
const {buildConstructionDecisionContext}=load('src/engine/construction/decision-context.ts');
const model={backend:'llama.cpp',modelId:'fixture',contextSize:4096};
const capabilities={contextSize:4096,contextShift:'unsupported',tools:'supported'};
const signal=new AbortController().signal;
const tool={type:'function',function:{name:'plan_project_app',description:'Save a feature/file plan.',parameters:{type:'object',properties:{architecture:{type:'string'},steps:{type:'array',items:{type:'object',properties:{id:{type:'string'},title:{type:'string'},files:{type:'array',items:{type:'string'}},acceptance:{type:'array',items:{type:'string'}}},required:['id','title','files','acceptance']}}},required:['architecture','steps']}}};
const request={tools:[tool],requireTools:true,toolChoice:'required'};
const packetData={
 actionContract:'For implementation tasks call real tools; never invent file writes.',
 sparkIdentity:'Dona, the Curious Intellectual. Build things rather than narrating them. '.repeat(7),
 projectBriefing:'PROJECT Notes Organizer: '+ 'old file and settings summary '.repeat(125),
 projectInstructions:'Preserve existing notes and edit the linked project only.',
 originalGoal:'Build me a notes application with Markdown 2.0.',
 latestUserRequest:'Build me a notes application with Markdown 2.0.',
 checkpoint:'SOURCE CONSTRUCTION CHECKPOINT: Goal notes; Status active; stage plan; inspected true; plan saved false. '+ 'previous status '.repeat(40),
 verification:'Verification: 0 confirmed writes, 0 passing checks; pending implementation. '+ 'unused logs '.repeat(80),
 offeredTools:['plan_project_app'],
 lastToolObservation:'PROJECT FILE SNAPSHOT: valid linked directory; notes listed, project manifests read. '+ 'file metadata '.repeat(140),
 recoveryHint:'The prior generation ended before selecting a tool. '+ 'prior transport error '.repeat(75),
};

test('the real 4K source construction packet can shed large optional evidence without losing essential state',async()=>{
 const packet=buildConstructionDecisionContext(packetData);
 const original=JSON.stringify(packet);
 const adapter={kind:'llama.cpp',countTokens:async(_model,messages)=>messages.reduce((n,m)=>n+Math.ceil(String(m.content).length/2)+18,0)};
 const fitted=await prepareGeneration(adapter,model,capabilities,packet,signal,request);
 const combined=fitted.messages.map(m=>String(m.content)).join('\n');
 assert.equal(packet.at(-1).content,packetData.latestUserRequest);
 assert.match(combined,/Curious Intellectual/);
 assert.match(combined,/stage plan/);
 assert.match(combined,/plan_project_app/);
 assert.match(combined,/Preserve existing notes/);
 assert.match(combined,/inspected true/);
 assert.ok(fitted.discardedHistory>0,'the test must actually page optional material');
 assert.ok(fitted.outputTokens>=512,'a real decision window remains');
 assert.equal(fitted.tools.length,1);
 assert.equal(JSON.stringify(packet),original,'input packet is neither edited nor erased');
});

test('screenshot-size mandatory input uses safe reduced headroom rather than falsely blocking a valid tool',async()=>{
 // 3262 tokens including the one actual schema, as recorded in the screenshot.
 const toolsCost=Math.ceil(JSON.stringify(request.tools).length/2)+64;
 const adapter={kind:'llama.cpp',countTokens:async()=>3262-toolsCost};
 const original=[{role:'system',content:'Mandatory user-authored identity and project instructions'},{role:'user',content:packetData.latestUserRequest}];
 const prepared=await prepareGeneration(adapter,model,capabilities,original,signal,request);
 assert.equal(prepared.promptTokens,3262);
 assert.equal(prepared.reducedDecisionHeadroom,true);
 assert.ok(prepared.outputTokens>=512 && prepared.outputTokens<streamingDecisionHeadroom(4096,'unsupported'));
 assert.equal(prepared.tools[0].function.name,'plan_project_app');
});

test('soft working budgets borrow the loaded context before reducing the decision runway',async()=>{
 const cost=Math.ceil(JSON.stringify(request.tools).length/2)+64;
 const adapter={kind:'llama.cpp',countTokens:async()=>1800-cost};
 const original=[{role:'system',content:'Dona persona'},{role:'user',content:'Build Markdown notes app'}];
 const result=await prepareGeneration(adapter,model,capabilities,original,signal,request,0,2048);
 assert.equal(result.contextSize,4096);
 assert.ok(result.outputTokens>=512);
});

test('irresolvable mandatory context still stops instead of truncating the real user goal or unadvertising tools',async()=>{
 const cost=Math.ceil(JSON.stringify(request.tools).length/2)+64;
 const adapter={kind:'llama.cpp',countTokens:async()=>3990-cost};
 const prompt=[{role:'system',content:'Mandatory persona'},{role:'user',content:'Long specific user request'}];
 const snapshot=JSON.stringify(prompt);
 await assert.rejects(prepareGeneration(adapter,model,capabilities,prompt,signal,request),/INPUT context limitation/);
 assert.equal(JSON.stringify(prompt),snapshot);
});

test('no parallel tool schema is introduced when compact evidence is paged out',async()=>{
 const packet=buildConstructionDecisionContext(packetData);
 const adapter={kind:'llama.cpp',countTokens:async(_m,m)=>m.reduce((sum,v)=>sum+Math.ceil(String(v.content).length/3),0)};
 const result=await prepareGeneration(adapter,model,capabilities,packet,signal,request);
 assert.equal(result.tools.length,1);
 assert.ok(result.messages.some(m=>m.role==='user'&&m.content===packetData.latestUserRequest));
});

test('runAgent includes the actual initial inspected directory as fallback evidence for the first decision',()=>{
 const code=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 assert.match(code,/lastToolObservation:latestExecutedToolObservation\(messages\)\?\?inspectedContext/);
});

test('varying saved evidence sizes cannot silently remove identity, task goal, or the required tool',async()=>{
 const adapter={kind:'llama.cpp',countTokens:async(_m,m)=>m.reduce((n,v)=>n+Math.ceil(String(v.content).length/2)+14,0)};
 for(let i=0;i<80;i++){
  const input={...packetData,projectBriefing:'Directory metadata '.repeat(i*9),
   checkpoint:'SOURCE CONSTRUCTION CHECKPOINT: stage plan; 0 writes. '+ 'Recorded event '.repeat(i*8),
   verification:'Checks pending. '+ 'Log evidence '.repeat(i*6),
   lastToolObservation:'PROJECT FILE SNAPSHOT: inspected. '+ 'File entry '.repeat(i*11)};
  const packet=buildConstructionDecisionContext(input);
  const result=await prepareGeneration(adapter,model,capabilities,packet,signal,request);
  assert.equal(result.tools.length,1,`iteration ${i}`);
  assert.equal(result.messages.at(-1).content,input.latestUserRequest,`iteration ${i}`);
  const prompt=result.messages.map(m=>String(m.content)).join('\n');
  assert.match(prompt,/Curious Intellectual/,`iteration ${i}`);
  assert.match(prompt,/stage plan/,`iteration ${i}`);
  assert.match(prompt,/plan_project_app/,`iteration ${i}`);
  assert.ok(result.outputTokens>=512,`iteration ${i}`);
 }
});

test('an exact server count with tool schemas is never charged for the same tools a second time',async()=>{
 let calls=0;
 const a={kind:'llama.cpp',countChatTokens:async(_m,_messages,tools,_signal,choice)=>{
  calls++;assert.equal(tools.length,1);assert.equal(choice,'required');return 1825;
 },countTokens:async()=>{throw Error('message-only fallback must not be used for an exact tool-aware server count');}};
 const result=await prepareGeneration(a,model,capabilities,[{role:'system',content:'Dona'},{role:'user',content:'Build notes'}],signal,request);
 assert.equal(result.promptTokens,1825);assert.equal(result.tokenCountSource,'server');
 assert.equal(result.tools.length,1);assert.equal(calls,1);
});

test('missing tool-aware endpoint falls back to actual message count plus conservative schema charge',async()=>{
 const a={kind:'llama.cpp',countChatTokens:async()=>null,countTokens:async()=>950};
 const result=await prepareGeneration(a,model,capabilities,[{role:'system',content:'Dona'},{role:'user',content:'Build notes'}],signal,request);
 assert.equal(result.promptTokens,950+Math.ceil(JSON.stringify(request.tools).length/2)+64);
 assert.equal(result.tools[0].function.name,'plan_project_app');
});


test('a zero server tool-aware count is rejected in favour of conservative fallback',async()=>{
 const a={kind:'llama.cpp',countChatTokens:async()=>0,countTokens:async()=>1050};
 const result=await prepareGeneration(a,model,capabilities,[{role:'system',content:'Dona'},{role:'user',content:'Build notes'}],signal,request);
 assert.equal(result.promptTokens,1050+Math.ceil(JSON.stringify(request.tools).length/2)+64);
 assert.equal(result.tools.length,1);
});

test('actual registered plan_project_app contract survives 4K construction prompt fitting',async()=>{
 const file='src/engine/intelligence/coding-tools.ts';
 const source=fs.readFileSync(path.join(root,file),'utf8');
 const {outputText,diagnostics}=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 assert.equal(diagnostics.length,0);
 const mod={exports:{}};
 vm.runInNewContext(outputText,{module:mod,exports:mod.exports,require(){return {spicaTools:[]};},console}, {filename:file});
 const realPlanTool=mod.exports.codingToolDefinitions.find(x=>x.function.name==='plan_project_app');
 assert.ok(realPlanTool,'the real source tool must be registered');
 assert.deepEqual(Array.from(realPlanTool.function.parameters.required),['architecture','steps']);
 assert.ok(realPlanTool.function.parameters.properties.steps.items.properties.depends_on);
 const packet=buildConstructionDecisionContext({...packetData,offeredTools:['plan_project_app']});
 const realRequest={tools:[JSON.parse(JSON.stringify(realPlanTool))],requireTools:true,toolChoice:'required'};
 const adapter={kind:'llama.cpp',countTokens:async(_m,messages)=>messages.reduce((n,m)=>n+Math.ceil(String(m.content).length/2)+18,0)};
 const fitted=await prepareGeneration(adapter,model,capabilities,packet,signal,realRequest);
 assert.equal(fitted.tools.length,1);
 assert.equal(fitted.tools[0].function.name,'plan_project_app');
 assert.ok(fitted.outputTokens>=512);
 assert.ok(fitted.messages.some(m=>m.role==='user'&&m.content===packetData.latestUserRequest));
});


test('a zero message-only tokenizer response falls back to a conservative nonzero token estimate',async()=>{
 const a={kind:'llama.cpp',countChatTokens:async()=>null,countTokens:async()=>0};
 const fitted=await prepareGeneration(a,model,capabilities,[{role:'system',content:'Dona handles project construction'},{role:'user',content:'Build a note editor with Markdown support'}],signal,request);
 assert.ok(fitted.promptTokens>64);
 assert.equal(fitted.tokenCountSource,'estimate');
 assert.equal(fitted.tools.length,1);
});
