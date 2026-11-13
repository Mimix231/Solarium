'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const {nextSpicaAction}=require(path.join(root,'.spica-phase07-test/spica/tool-intelligence.js'));
const definitions=[
  {type:'function',function:{name:'migrate_spica_v2_graph',description:'Migrate',parameters:{type:'object',properties:{revision:{type:'integer'}},required:['revision'],additionalProperties:false}}},
  {type:'function',function:{name:'search_spica_runtime_blocks',description:'Search',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}},
  {type:'function',function:{name:'inspect_spica_target',description:'Target',parameters:{type:'object',properties:{target:{type:'string'}},required:['target'],additionalProperties:false}}},
];
test('next action detects absent V2 and gives exact migration call rather than repeated invalid composition',()=>{
 const state={hasGraph:true,hasV2:false,revision:11,linkedFolder:true};
 const answer=nextSpicaAction(definitions,state,'compose','desktop');
 assert.equal(answer.nextTool,'migrate_spica_v2_graph');
 assert.equal(answer.nextArguments.revision,11);
 assert.deepEqual(answer.preflightArguments,{name:'migrate_spica_v2_graph',arguments:{revision:11}});
 assert.equal(answer.registered,true);
 const after=nextSpicaAction(definitions,{...state,hasV2:true},'compose','web');
 assert.equal(after.nextTool,'search_spica_runtime_blocks');
 assert.equal(after.nextArguments.target,'web');
});
test('tool declarations do not mix block IDs with callable names',()=>{
 const source=fs.readFileSync(path.join(root,'src/spica/tools.ts'),'utf8');
 const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 assert.match(source,/kind:'executable_block',callable:false/);
 assert.match(source,/nextTool:'inspect_spica_wiring'/);
 assert.match(source,/last === 'invalid_spica_tool' \? \['inspect_solarium_tool','spica_next_action'/);
 assert.match(agent,/described.kind !== 'executable_block'/);
 assert.match(agent,/Before graph composition, call spica_next_action/);
 assert.doesNotMatch(agent,/SPICA action stopped after a failed or denied tool call/);
});

test('identical failed calls become withheld, while a different registered operation stays possible',()=>{
 const source=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
 const tools=fs.readFileSync(path.join(root,'src/spica/tools.ts'),'utf8');
 assert.match(source,/spicaProgress = new AgentProgressTracker/);
 assert.match(source,/spicaProgress.recordFailure/);
 assert.match(source,/assessment.blockedTool/);
 assert.match(source,/spicaProgress.recordContractInspection/);
 assert.match(tools,/name !== state.suppressedTool/);
 assert.match(tools,/last === 'spica_next_action'/);
});
