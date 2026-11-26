'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cp=require('node:child_process');
let ts;
try {ts=require('typescript');}
catch {ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}
const root=path.resolve(__dirname,'..');
const loadPure=(relative)=>{
 const mod={exports:{}};
 const source=fs.readFileSync(path.join(root,relative),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{module:mod,exports:mod.exports,require(){throw Error('Unexpected import');},console}, {filename:relative});
 return mod.exports;
};
const {constructionInferenceRecovery,completedModelToolCalls}=loadPure('src/engine/construction/inference-recovery.ts');
const base={finishReason:'length',hasFinalAnswer:false,completedToolCalls:0,offeredToolNames:['plan_project_app','read_project_file'],toolsSupported:true,stage:'plan',confirmedWrites:0,attempts:0};

test('reasoning-only capacity exits trigger an independent bounded action decision',()=>{
 let input={...base};
 for(let i=1;i<=2;i++){
   const result=constructionInferenceRecovery(input);
   assert.equal(result.kind,'retry');assert.equal(result.nextAttempts,i);
   assert.match(result.operationalPrompt,/plan_project_app/);
   assert.match(result.operationalPrompt,/NEW independent decision/);
   assert.doesNotMatch(result.operationalPrompt,/unfinished reasoning tail|continue thinking/i);
   input={...input,attempts:result.nextAttempts};
 }
 const result=constructionInferenceRecovery(input);assert.equal(result.kind,'pause');
 assert.match(result.diagnostic,/remains resumable/);
});

test('natural reasoning-only stop can recover but finished answer never replays',()=>{
 assert.equal(constructionInferenceRecovery({...base,finishReason:'stop'}).kind,'retry');
 assert.equal(constructionInferenceRecovery({...base,finishReason:'tool_calls'}).kind,'retry'); // no complete calls despite advertised tool finish
 assert.equal(constructionInferenceRecovery({...base,hasFinalAnswer:true}).kind,'none');
 assert.equal(constructionInferenceRecovery({...base,completedToolCalls:1}).kind,'none');
});

test('permissions/cancellation/content filters cannot turn into an automated retry',()=>{
 assert.equal(constructionInferenceRecovery({...base,cancelled:true}).kind,'none');
 assert.equal(constructionInferenceRecovery({...base,toolsSupported:false}).kind,'pause');
 assert.equal(constructionInferenceRecovery({...base,offeredToolNames:[]}).kind,'pause');
 assert.equal(constructionInferenceRecovery({...base,finishReason:'content_filter'}).kind,'pause');
});

test('an unfinished tool-call JSON fragment can never be executed at a length stop',()=>{
 const fragments=[{id:'x',function:{name:'apply_project_changes',arguments:'{"files":['}}];
 const limited=completedModelToolCalls('length',fragments);
 assert.equal(limited.calls.length,0);assert.equal(limited.discarded,1);
 assert.equal(completedModelToolCalls('tool_calls',fragments).calls.length,1);
 assert.equal(completedModelToolCalls('stop',[]).discarded,0);
});

test('the agent integrates recovery in its original inference loop without a second tool executor',()=>{
 const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 assert.match(agent,/constructionInferenceRecovery\(/);
 assert.match(agent,/completedModelToolCalls\(result\.finishReason,result\.calls\)/);
 assert.match(agent,/incompleteDecisionMessage\.content=recovery\.operationalPrompt/);
 assert.match(agent,/if\(recovery\.kind==='retry'\)/);
 assert.match(agent,/if\s*\(!executableCalls\.length\)/);
 assert.ok(agent.indexOf('if(recovery.kind===\'retry\')')<agent.indexOf('// No tool call means no application write'));
});

test('paused status reports real inference measurements without asserting why length happened',()=>{
 const {describeConstructionStop}=loadPure('src/engine/construction/termination.ts');
 const text=describeConstructionStop({finishReason:'length',hadReasoning:true,hadAnswer:false,stage:'plan',confirmedWrites:0,
   requestedTool:true,transport:{backend:'llama.cpp',contextSize:4096,promptTokens:3020,tokenCountSource:'server',keptPromptTokens:3020,requestedOutputTokens:-1,completionTokens:975,contextShift:'unknown'}});
 assert.match(text,/finish_reason=length/);assert.match(text,/n_ctx=4096/);assert.match(text,/n_keep=3020/);
 assert.match(text,/max_tokens=-1/);assert.match(text,/context shift=unknown/);
 assert.match(text,/did not distinguish output, context/);
 assert.doesNotMatch(text,/context shift (was|is) enabled/i);
});


test('unsupported context shifting is reported as a real finite-model limitation after retries',()=>{
 const next=constructionInferenceRecovery({...base,attempts:2,contextShift:'unsupported',contextSize:4096});
 assert.equal(next.kind,'pause');
 assert.match(next.diagnostic,/4096-token model\/server/);
 assert.match(next.diagnostic,/does not support context shifting/);
});
