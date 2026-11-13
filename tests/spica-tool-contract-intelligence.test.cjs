'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const transpile=name=>ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const validator={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-validation.ts'),{module:validator,exports:validator.exports,require:()=>({})});
const contract={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-contract-intelligence.ts'),{module:contract,exports:contract.exports,
 require:id=>id==='./tool-validation'?validator.exports:{},console});
const {ToolContractRegistry,ToolDependencyGraph,AgentProgressTracker}=contract.exports;
const tool=(name,properties,required=[])=>({type:'function',function:{name,description:name,parameters:{type:'object',properties,required,additionalProperties:false}}});
const registry=new ToolContractRegistry([
 tool('inspect_spica_tool',{name:{type:'string'},operation:{type:'string'},arguments:{type:'object'}},['name']),
 tool('check_spica_tool_call',{name:{type:'string'},arguments:{type:'object'}},['name','arguments']),
 tool('edit_spica_graph',{revision:{type:'integer',minimum:1},edits:{type:'array',minItems:1}},['revision','edits']),
]);

test('one registered contract governs advertised schema, inspection and execution validation',()=>{
 const definition=registry.get('inspect_spica_tool');
 assert.strictEqual(registry.inspect('inspect_spica_tool').parameters,definition.function.parameters);
 registry.assertMatches('inspect_spica_tool',definition);
 assert.equal(registry.validate('inspect_spica_tool',{name:'edit_spica_graph',arguments:{revision:11,edits:[]}}).ok,true);
 const invalid=registry.validate('inspect_spica_tool',{name:'edit_spica_graph',unadvertised:true});
 assert.equal(invalid.ok,false);assert.match(invalid.error.message,/unadvertised Unexpected property/);
 assert.equal(registry.validate('check_spica_tool_call',{name:'edit_spica_graph',arguments:{revision:11}}).ok,true);
});
test('contract registry refuses duplicate names, unknown required fields and schema drift',()=>{
 assert.throws(()=>new ToolContractRegistry([tool('same',{}),tool('same',{})]),/Duplicate tool/);
 assert.throws(()=>new ToolContractRegistry([tool('broken',{},['missing'])]),/unknown required/);
 assert.throws(()=>registry.assertMatches('edit_spica_graph',tool('edit_spica_graph',{})),/drift/);
});
test('dependency graph validates named prerequisites instead of guessing operations',()=>{
 const deps=new ToolDependencyGraph([{tool:'edit_spica_graph',requires:['inspect_spica_tool','check_spica_tool_call'],stage:'edit'}],registry);
 assert.deepEqual(deps.inspect('edit_spica_graph').requires,['inspect_spica_tool','check_spica_tool_call']);
 assert.throws(()=>new ToolDependencyGraph([{tool:'edit_spica_graph',requires:['nonexistent'],stage:'edit'}],registry),/Unknown prerequisite/);
});
test('18 repeated invalid inspections are not erased by unrelated successful discovery',()=>{
 const tracker=new AgentProgressTracker();
 for(let n=0;n<18;n++){
   const failure=tracker.recordFailure('inspect_spica_tool',{name:'edit_spica_graph',unexpected:true},'inspect_spica_tool.unexpected Unexpected property.');
   tracker.recordRead();
   assert.equal(failure.count,n+1);
 }
 assert.equal(tracker.suppressedTool,'inspect_spica_tool');
 tracker.recordContractInspection('check_spica_tool_call');
 assert.equal(tracker.suppressedTool,'inspect_spica_tool');
 tracker.recordContractInspection('inspect_spica_tool');
 assert.equal(tracker.suppressedTool,null);
 const next=tracker.recordFailure('inspect_spica_tool',{name:'edit_spica_graph',unexpected:true},'inspect_spica_tool.unexpected Unexpected property.');
 assert.equal(next.repeated,true,'A read is not application progress and must not erase the loop history');
 tracker.recordStateChange();
 assert.equal(tracker.recordFailure('inspect_spica_tool',{},'another').count,1);
});
test('changing values cannot disguise 18 repetitions of the same invalid parameter',()=>{
 const tracker=new AgentProgressTracker();
 for(let n=0;n<18;n++) tracker.recordFailure('inspect_spica_tool',{
   name:'edit_spica_graph',arguments:{revision:n}},'inspect_spica_tool.arguments Unexpected property.');
 assert.equal(tracker.suppressedTool,'inspect_spica_tool');
 assert.equal(tracker.recordFailure('inspect_spica_tool',{arguments:{revision:999}},
   'inspect_spica_tool.arguments Unexpected property.').count,19);
});
test('failed calls with actually corrected parameters are not treated as identical',()=>{
 const tracker=new AgentProgressTracker();
 tracker.recordFailure('edit_spica_graph',{revision:11,edits:[{op:'bad'}]},'invalid op');
 const corrected=tracker.recordFailure('edit_spica_graph',{revision:11,edits:[{op:'rename'}]},'invalid op');
 assert.equal(corrected.repeated,false);
});

test('a third identical successful inspection does not masquerade as completed work',()=>{
 const tracker=new AgentProgressTracker();
 assert.equal(tracker.recordRead('list_spica_toolchain',{}).repeated,false);
 assert.equal(tracker.recordRead('list_spica_toolchain',{}).repeated,false);
 assert.equal(tracker.recordRead('list_spica_toolchain',{}).repeated,true);
 assert.equal(tracker.suppressedTool,'list_spica_toolchain');
 tracker.recordRead('read_spica_graph',{view:'both'});
 assert.equal(tracker.suppressedTool,'list_spica_toolchain');
 tracker.recordStateChange();
 assert.equal(tracker.suppressedTool,null);
});
