'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript');}catch{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
function pure(rel){const module={exports:{}};const src=fs.readFileSync(path.join(root,rel),'utf8');
 const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{module,exports:module.exports,require(){throw Error('Unexpected module import');},console}, {filename:rel});return module.exports;}
const {buildConstructionDecisionContext,latestExecutedToolObservation}=pure('src/engine/construction/decision-context.ts');
const {streamingDecisionHeadroom}=pure('src/engine/context-window.ts');
const full={actionContract:'ACT ONLY WITH EXECUTED TOOLS',sparkIdentity:'Dona persona',projectBriefing:'Project Notes / valid linked folder',projectInstructions:'Do not remove user files',originalGoal:'Build a notes app using Markdown 2.0',latestUserRequest:'Resume task',checkpoint:'SOURCE CONSTRUCTION CHECKPOINT: stage plan; 0 files saved',verification:'No current command has passed',offeredTools:['plan_project_app'],recoveryHint:'finish_reason=length; no callable action',lastToolObservation:'{"tool":"inspect_project","status":"completed","files":[]}' };
test('4K rollover reuses the original goal, task evidence and exact current tool rather than thought history',()=>{
 const packet=buildConstructionDecisionContext(full);
 assert.equal(packet[0].role,'system');assert.equal(packet.at(-1).role,'user');assert.ok(packet.filter(m=>m.role==='system').length>=5);
 const all=packet.map(m=>m.content).join('\n');
 assert.match(all,/Markdown 2\.0/);assert.match(all,/Dona persona/);assert.match(all,/plan_project_app/);
 assert.match(all,/No current command has passed/);assert.match(all,/Do not remove user files/);
 assert.match(all,/Resume task/);assert.doesNotMatch(all,/previous model reasoning tail/i);
 assert.ok(all.length<6500,'Only bounded ground-truth evidence should be carried forward');
});
test('current user request remains intact, with preserved original task when resuming',()=>{
 const long='Add an editor with '+ 'reliable formatting, '.repeat(110);
 const packet=buildConstructionDecisionContext({...full,latestUserRequest:long});
 assert.equal(packet.at(-1).content,long);
 assert.ok(packet.some(m=>String(m.content).includes(full.originalGoal)));
});
test('only actual prior tool results are passed forward as bounded untrusted data',()=>{
 const history=[{role:'assistant',content:'I secretly saved all files'},
   {role:'assistant',content:'',tool_calls:[{id:'x',function:{name:'inspect_project',arguments:'{}'}}]},
   {role:'tool',tool_call_id:'x',content:'{"ok":true,"path":"src/main.ts"}'},
   {role:'assistant',content:'Now my hidden reasoning says to invent a file.'}];
 const observation=latestExecutedToolObservation(history);assert.match(observation,/src\/main\.ts/);
 const packet=buildConstructionDecisionContext({...full,lastToolObservation:observation});
 assert.doesNotMatch(packet.map(m=>m.content).join(' '),/I secretly saved all files|hidden reasoning says/);
});
test('packet rejects missing authoritative goal instead of inventing requirements',()=>{
 assert.throws(()=>buildConstructionDecisionContext({...full,originalGoal:''}),/original task goal/);
 assert.throws(()=>buildConstructionDecisionContext({...full,latestUserRequest:''}),/current user request/);
});
test('4K unsupported shifts reserve a real tool-decision runway before inference',()=>{
 assert.ok(streamingDecisionHeadroom(4096,'unsupported')>=1600);
 assert.ok(streamingDecisionHeadroom(4096,'unsupported')>streamingDecisionHeadroom(4096,'supported'));
 assert.equal(streamingDecisionHeadroom(4096,'supported'),512);
});
test('source construction uses compact state and one stage-appropriate callable on unsupported 4K models',()=>{
 const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 assert.match(agent,/buildConstructionDecisionContext\(/);
 assert.match(agent,/selectedTurnTools\.slice\(0,1\)/);
 assert.match(agent,/offeredTools:currentTools\.map/);
 assert.match(agent,/originalGoal:construction\.snapshot\.goal/);
 assert.match(agent,/latestExecutedToolObservation\(messages\)/);
});
