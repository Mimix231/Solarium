'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const built=path.join(root,'.spica-phase07-test/spica');
const {listSpicaToolchain,inspectSpicaTool,inspectSpicaWiring,spicaToolPrerequisites}=require(path.join(built,'tool-intelligence.js'));
const {listRuntimeBlocks,getRuntimeBlock}=require(path.join(built,'runtime/registry.js'));
const {inspectExecutableBlock}=require(path.join(built,'runtime/discovery.js'));
const {previewSpicaComposition}=require(path.join(built,'runtime/composition.js'));
const {executeSpicaGraphV2}=require(path.join(built,'runtime/executor.js'));
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const transpile=name=>ts.transpileModule(fs.readFileSync(path.join(root,name),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const validator={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-validation.ts'),{module:validator,exports:validator.exports,require:()=>({}),console});
const contract={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-contract-intelligence.ts'),{module:contract,exports:contract.exports,require:id=>{
 if(id==='./tool-validation')return validator.exports;
 throw Error('Unmocked contract dependency: '+id);
},console});
const styleProperties={background:{},text:{}};
const current={data:{revision:12,graph:{pages:[],controls:[],program:{screens:[],flows:[],scenarios:[],grants:[]},collections:[]},graphV2:undefined},title:'Test project'};
const editSchemas={exports:{}};
vm.runInNewContext(transpile('src/spica/edit-schemas.ts'),{module:editSchemas,exports:editSchemas.exports,require:()=>({}),console});
const mock={
  '../engine/creator':{inspectProjectEnvironment:async()=>({rootEntryCount:0})},
  './edit-schemas':editSchemas.exports,
  './graph-v2/transactions':{applySpicaGraphTransaction:()=>({})},
  './graph-v2/edit-adapter':{expandSpicaV2Edits:edits=>edits},
  './runtime/blocks/registry':{getBlock:()=>undefined},
  './inspect-params-v2':{inspectSpicaV2Parameters:()=>({})},

  './repository':{SpicaRepository:class {async read(){return current;}}},
  './graph':{stableGraphJson:JSON.stringify,changeGraph:()=>{throw Error('No mutation allowed');},collectionUpgrade:()=>[],GraphEditError:Error},
  './appearance':{styleChanges:()=>[],styleProperties,styleStates:['base'],styleTargets:()=>[],styleValues:()=>[],supportedProperties:()=>[],supportedStates:()=>[]},
  './program':{capabilities:[],recipeCatalog:[]},
  './graph-v2/validation':{validateSpicaGraphV2:()=>({valid:true,errors:[],warnings:[]})},
  './warehouse':{searchSpicaWarehouse:()=>({}),inspectSpicaComponent:()=>({}),registeredWarehouseCounts:{adapters:26}},
  './runtime/registry':{listRuntimeBlocks,getRuntimeBlock},
  './runtime/discovery':{searchExecutableBlocks:()=>({total:0,results:[]}),inspectExecutableBlock},
  './runtime/composition':{previewSpicaComposition},
  './runtime/executor':{executeSpicaGraphV2},
  './inspect-params':{inspectSpicaParameters:(_graph,revision,operation)=>({revision,operation,available:true,fieldTypes:['text','boolean']})},
  './catalog/unified':{inspectSpicaCapability:async()=>({}),searchSpicaCapabilities:async()=>({candidates:[]})},
  './catalog/client':{listCatalogCategories:async()=>[]},
  './catalog/categories':{warehouseCategories:[],warehouseCapacity:350000},
  './professionalism':{auditSpicaDesign:()=>({passed:true})},
  './research-tools':{spicaResearchTools:[]},
  './tool-intelligence':{listSpicaToolchain,inspectSpicaTool,inspectSpicaWiring,spicaToolPrerequisites},
  '../engine/intelligence/tool-validation':validator.exports,
  '../engine/intelligence/tool-contract-intelligence':contract.exports,
};
const mod={exports:{}};
vm.runInNewContext(transpile('src/spica/tools.ts'),{module:mod,exports:mod.exports,require:id=>{
 if(Object.hasOwn(mock,id))return mock[id];throw Error('Unmocked dependency: '+id);
},TextEncoder,AbortController,DOMException,structuredClone,console},{filename:'src/spica/tools.ts'});
const api=mod.exports;const context={spicaProgram:true,webEnabled:false};const project={id:'test',folder:'/tmp/output'};
const call=async(name,args)=>JSON.parse(await api.executeSpicaTool(name,args,project,context));

test('real Spark tools enumerate their exact registered argument contracts',async()=>{
 const list=await call('list_spica_toolchain',{});
 const entry=list.actions.find(x=>x.name==='edit_spica_graph');
 assert.deepEqual(Array.from(entry.required),['revision','edits']);
 assert.equal(list.revision,12);
 assert.ok(list.actions.find(x=>x.name==='inspect_spica_wiring'));
 const details=await call('inspect_spica_tool',{name:'edit_spica_graph',operation:'add_page'});
 assert.equal(details.ok,true);
 assert.equal(details.schema.additionalProperties,false);
 assert.equal(details.operationContract.operation,'add_page');
 assert.ok(details.schema.properties.edits);
});

test('toolchain supplies exact paginated schemas with stage filters instead of requiring repeat inspections',async()=>{
 const page=await call('list_spica_toolchain',{stage:'edit',limit:2,offset:0,includeSchemas:true});
 assert.equal(page.actions.length,2);
 assert.ok(page.total>=2);
 assert.ok(page.actions.every(action=>action.stage==='edit'));
 for(const action of page.actions){
   assert.equal(action.schema.additionalProperties,false);
   assert.deepEqual(Array.from(action.schema.required||[]),Array.from(action.required));
   assert.deepEqual(Object.keys(action.schema.properties),Array.from(action.parameters));
 }
 const next=await call('list_spica_toolchain',{stage:'edit',limit:2,offset:page.nextOffset,includeSchemas:true});
 assert.ok(!next.actions.some(action=>page.actions.some(previous=>previous.name===action.name)));
 const discovery=await call('list_spica_toolchain',{query:'edit_spica_graph',includeSchemas:true});
 assert.equal(discovery.total,1);
 assert.equal(discovery.actions[0].name,'edit_spica_graph');
 assert.ok(discovery.actions[0].schema.properties.edits);
 const noSchema=await call('list_spica_toolchain',{stage:'inspect',limit:2});
 assert.ok(noSchema.actions.every(action=>!Object.hasOwn(action,'schema')));
});

test('exact preflight accepts valid registered arguments but rejects guessed parameters',async()=>{
 const passed=await call('check_spica_tool_call',{name:'search_spica_runtime_blocks',arguments:{query:'markdown',limit:5}});
 assert.equal(passed.ok,true,JSON.stringify(passed.errors));
 assert.equal(passed.canSubmit,true);
 assert.equal(passed.next,'search_spica_runtime_blocks');
 const failed=await call('check_spica_tool_call',{name:'search_spica_runtime_blocks',arguments:{query:'markdown',unregistered:true}});
 assert.equal(failed.ok,false);
 assert.equal(failed.canSubmit,false);
 assert.ok(failed.errors.length);
});

test('tool preflight checks live edit prerequisites and revision instead of silently rewriting arguments',async()=>{
 const stale=await call('check_spica_tool_call',{name:'edit_spica_graph',arguments:{revision:10,edits:[{op:'rename',name:'Example'}]}});
 assert.equal(stale.ok,false);
 assert.ok(stale.errors.some(x=>/revision/i.test(x)));
 const malformed=await call('check_spica_tool_call',{name:'edit_spica_graph',arguments:{revision:12,edits:[{op:'put_screen',screen:{id:'invalid',view:'settings'}}]}});
 assert.equal(malformed.ok,false);
 assert.ok(malformed.errors.length);
});

test('Spark wiring inspection resolves real block ports without changing graph state',async()=>{
 const before=JSON.stringify(current);
 const wired=await call('inspect_spica_wiring',{blockIds:['spica.runtime.note_record','spica.runtime.note_card','spica.runtime.glass_surface']});
 assert.ok(wired.compatible.some(edge=>edge.from==='spica.runtime.note_record'&&edge.to==='spica.runtime.note_card'));
 assert.equal(JSON.stringify(current),before);
});

test('selection hides all writing tools until matching preflight',()=>{
 const selected=(last,action)=>api.selectSpicaTools(api.spicaTools,last,true,false,false,true,{hasGraph:true,hasV2:true,v2Intent:true,validatedAction:action}).map(x=>x.function.name);
 assert.ok(!selected(null).includes('compose_spica_v2_graph'));
 assert.ok(!selected('inspect_spica_tool').includes('compose_spica_v2_graph'));
 assert.ok(selected('check_spica_tool_call','compose_spica_v2_graph').includes('compose_spica_v2_graph'));
 assert.ok(!selected('check_spica_tool_call','compose_spica_v2_graph').includes('edit_spica_graph'));
});


test('block ID offered to tool inspector returns correct executable-block tool and does not block the next action',async()=>{
 const result=await call('inspect_spica_tool',{name:'spica.runtime.ui_markdown_editor'});
 assert.equal(result.ok,true);
 assert.equal(result.kind,'executable_block');
 assert.equal(result.callable,false);
 assert.equal(result.id,'spica.runtime.ui_markdown_editor');
 assert.equal(result.nextTool,'inspect_spica_wiring');
 const options=api.selectSpicaTools(api.spicaTools,'invalid_spica_tool',true,false,false,true,{hasGraph:true,hasV2:true,v2Intent:true}).map(t=>t.function.name);
 assert.ok(options.includes('inspect_spica_runtime_block'),options.join(','));
 assert.ok(options.includes('inspect_spica_identifier'),options.join(','));
 assert.ok(!options.includes('compose_spica_v2_graph'),'a rejected inspector cannot authorize writes');
 const block=await call('inspect_spica_runtime_block',{id:'spica.runtime.ui_markdown_editor',version:'1'});
 assert.equal(block.id,'spica.runtime.ui_markdown_editor');
 assert.equal(block.kind,'renderer');
 assert.equal(block.runtimeOnly,true);
});

test('inspector accepts candidate arguments under the declared contract, without executing the target',async()=>{
 const before=JSON.stringify(current);
 const inspected=await call('inspect_spica_tool',{name:'search_spica_runtime_blocks',arguments:{query:'markdown',limit:5}});
 assert.equal(inspected.ok,true);
 assert.equal(inspected.candidateValidation.ok,true);
 const bad=await call('inspect_spica_tool',{name:'search_spica_runtime_blocks',arguments:{query:'markdown',inventedParameter:true}});
 assert.equal(bad.ok,true);
 assert.equal(bad.candidateValidation.ok,false);
 assert.match(bad.candidateValidation.error.message,/inventedParameter Unexpected property/);
 assert.equal(JSON.stringify(current),before);
});

test('every registered SPICA operation has a non-ambiguous contract in the shared registry',()=>{
 const registry=new contract.exports.ToolContractRegistry(api.spicaTools);
 assert.equal(registry.names().length,api.spicaTools.length);
 for(const name of registry.names()){
   const details=registry.inspect(name);
   assert.equal(details.ok,true);
   assert.equal(details.parameters.additionalProperties,false);
   assert.ok(details.required.every(key=>details.acceptedKeys.includes(key)),name);
 }
});
