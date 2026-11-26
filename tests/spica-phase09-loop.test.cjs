'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {nextSpicaAction}=require(path.join(root,'.spica-phase07-test/spica/tool-intelligence.js'));
const definitions=[
  {type:'function',function:{name:'edit_spica_graph',description:'Unified editor',parameters:{type:'object',properties:{revision:{type:'integer'},view:{type:'string'},edits:{type:'array'}},required:['revision'],additionalProperties:false}}},
  {type:'function',function:{name:'resolve_spica_capabilities',description:'Resolve',parameters:{type:'object',properties:{queries:{type:'array'}},required:['queries'],additionalProperties:false}}},
  {type:'function',function:{name:'inspect_spica_target',description:'Target',parameters:{type:'object',properties:{target:{type:'string'}},required:['target'],additionalProperties:false}}},
];
test('next action detects absent V2 and gives exact migration call rather than repeated invalid composition',()=>{
 const state={hasGraph:true,hasV2:false,revision:11,linkedFolder:true};
 const answer=nextSpicaAction(definitions,state,'compose','desktop');
 assert.equal(answer.nextTool,'edit_spica_graph');
 assert.equal(answer.nextArguments.revision,11);
 assert.deepEqual(answer.preflightArguments,{name:'edit_spica_graph',arguments:{revision:11,view:'v2',edits:[{op:'migrate_graph'}]}});
 assert.equal(answer.registered,true);
 const after=nextSpicaAction(definitions,{...state,hasV2:true},'compose','web');
 assert.equal(after.nextTool,'resolve_spica_capabilities');
 assert.equal(after.nextArguments.target,'web');
});
test('tool declarations do not mix block IDs with callable names',()=>{
 const source=fs.readFileSync(path.join(root,'src/spica/tools.ts'),'utf8');
 const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 assert.match(source,/kind:'executable_block',callable:false/);
 assert.match(source,/nextTool:'inspect_spica_wiring'/);
 assert.match(source,/last === 'invalid_spica_tool' \? \['check_spica_tool_call','validate_spica_edit'/);
 assert.match(agent,/described.kind !== 'executable_block'/);
 assert.match(agent,/Use spica_next_action only when the next registered prerequisite is unknown/);
 assert.doesNotMatch(agent,/Before graph composition, call spica_next_action/);
 assert.doesNotMatch(agent,/SPICA action stopped after a failed or denied tool call/);
});

test('failed-call diagnostics persist while corrected arguments remain eligible for the same tool',()=>{
 const source=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 const tools=fs.readFileSync(path.join(root,'src/spica/tools.ts'),'utf8');
 assert.match(source,/spicaProgress = new AgentProgressTracker/);
 assert.match(source,/spicaProgress.recordFailure/);
 assert.match(source,/assessment.blockedTool/);
 assert.match(source,/spicaProgress.recordContractInspection/);
 assert.doesNotMatch(tools,/name !== state.suppressedTool/, 'Blocking the entire tool prevents a corrected call.');
 assert.match(tools,/previously failed tool remains available/);
 assert.match(tools,/last === 'spica_next_action'/);
});
