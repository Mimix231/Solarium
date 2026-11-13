'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const base = path.join(root,'.spica-phase04-test/spica');
const { emptySpicaGraphV2 } = require(path.join(base,'graph-v2/types.js'));
const { makeRuntimeNode, executeSpicaGraphV2 } = require(path.join(base,'runtime/executor.js'));
const { listRuntimeBlocks, getRuntimeBlock } = require(path.join(base,'runtime/registry.js'));
const { SpicaMemoryStore } = require(path.join(base,'runtime/store.js'));
const { validateSpicaGraphV2 } = require(path.join(base,'graph-v2/validation.js'));

const edge=(id,from,fromPort,to,toPort,kind='data',feedback)=>({id,kind,from:{node:from,port:fromPort},to:{node:to,port:toPort},...(feedback?{feedback}:{})});
function fixture(query='note') {
  const graph = emptySpicaGraphV2('demo.notes','Notes');
  graph.nodes = [
    makeRuntimeNode('source','spica.runtime.note_record',{title:'My note',body:'Remember things'}),
    makeRuntimeNode('match','spica.runtime.note_contains',{query}),
    makeRuntimeNode('condition','spica.runtime.when_true'),
    makeRuntimeNode('save','spica.runtime.save_note',{key:'first'}),
    makeRuntimeNode('preview','spica.runtime.note_card'),
  ];
  graph.edges = [
    edge('source_to_match','source','note','match','note'),
    edge('match_to_condition','match','matched','condition','condition'),
    edge('source_to_save','source','note','save','note'),
    edge('condition_to_save','condition','trigger','save','trigger','event'),
    edge('save_to_preview','save','saved','preview','note'),
  ];
  return graph;
}
const grants=new Set(['records.write']);
const run=(graph,extra={})=>executeSpicaGraphV2(graph,{target:'desktop',grants,...extra});

test('built-in runtime implementations are individually registered and only exact IDs resolve',()=>{
  assert.ok(listRuntimeBlocks().length>=14);
  assert.equal(new Set(listRuntimeBlocks().map(b=>`${b.id}@${b.version}`)).size,listRuntimeBlocks().length);
  assert.equal(getRuntimeBlock('spica.runtime.note_record','1')?.kind,'pure');
  assert.equal(getRuntimeBlock('spica.block.save','1'),undefined);
});
test('data → conditional → storage → UI executes with real typed output, committed trace and no fake frontend',async()=>{
  const graph=fixture();assert.equal(validateSpicaGraphV2(graph,{requireComplete:true}).valid,true);
  const store=new SpicaMemoryStore();const events=[];
  const result=await run(graph,{store,onTrace:e=>events.push(e)});
  assert.equal(result.state,'passed',result.error);assert.equal(result.committed,true);
  assert.equal(result.operations,5);
  assert.deepEqual(store.read('notes','first'),{title:'My note',body:'Remember things'});
  assert.deepEqual(result.outputs.preview.view,{renderer:'spica.note_card',title:'My note',body:'Remember things'});
  assert.ok(events.some(e=>e.nodeId==='save'&&e.state==='completed'));
  assert.equal(result.storage,'host-transaction');
});
test('false condition skips effects and dependent renderer, writes nothing',async()=>{
  const store=new SpicaMemoryStore();const result=await run(fixture('not-present'),{store});
  assert.equal(result.state,'passed');assert.equal(result.outputs.condition.trigger,undefined);
  assert.equal(result.outputs.save,undefined);assert.equal(result.outputs.preview,undefined);
  assert.equal(store.read('notes','first'),undefined);
  assert.ok(result.trace.some(e=>e.nodeId==='save'&&e.state==='skipped'));
});
test('missing grants and denied broker cannot enter the transaction or run effects',async()=>{
  const store=new SpicaMemoryStore();
  const denied=await run(fixture(),{grants:new Set(),store});
  assert.equal(denied.state,'failed');assert.match(denied.error,/approved records.write/);assert.equal(store.read('notes','first'),undefined);
  const broker=await run(fixture(),{store,broker:{authorize:()=>false}});
  assert.equal(broker.state,'failed');assert.match(broker.error,/permission/);assert.equal(store.read('notes','first'),undefined);
});
test('invalid configurations and tampered ports are refused before executing',async()=>{
  const invalid=fixture();invalid.nodes[0].config.title='';
  const store=new SpicaMemoryStore();const result=await run(invalid,{store});
  assert.equal(result.state,'failed');assert.match(result.error,/note_record needs title/);assert.equal(store.read('notes','first'),undefined);
  const forged=fixture();forged.nodes[3].inputs[0].type={kind:'unknown'};
  const invalidPorts=await run(forged,{store});
  assert.equal(invalidPorts.state,'failed');assert.match(invalidPorts.error,/TYPE_MISMATCH|CONTRACT_MISMATCH|Ports for save do not match/);
});
test('unregistered/placeholder and invalid event edges never execute arbitrary JavaScript',async()=>{
  const graph=fixture();graph.nodes[0].block.availability='placeholder';
  const result=await run(graph);assert.equal(result.state,'failed');assert.match(result.error,/placeholder, not an executable adapter/);
  const malicious=fixture();malicious.nodes[0].block.id='fake.eval';
  const failure=await run(malicious);assert.equal(failure.state,'failed');assert.match(failure.error,/Unknown executable block|No executable adapter/);
});
test('pre-cancelled signal causes cancelled status, no committed writes',async()=>{
  const controller=new AbortController();controller.abort();
  const store=new SpicaMemoryStore();const result=await run(fixture(),{signal:controller.signal,store});
  assert.equal(result.state,'cancelled');assert.equal(result.committed,false);assert.equal(store.read('notes','first'),undefined);
});
test('cancellation after a staged write rolls back the transaction',async()=>{
  const controller=new AbortController();const store=new SpicaMemoryStore();
  const result=await run(fixture(),{store,signal:controller.signal,onTrace:e=>{
    if(e.nodeId==='save'&&e.state==='completed')controller.abort();
  }});
  assert.equal(result.state,'cancelled');assert.equal(result.committed,false);
  assert.equal(store.read('notes','first'),undefined,'staged writes must not commit on cancellation');
});
test('feedback rounds terminate on explicit limit (never unbounded)',async()=>{
  const graph=emptySpicaGraphV2('demo.feedback','Feedback');
  graph.nodes=[
    makeRuntimeNode('source','spica.runtime.note_record',{title:'My note',body:'check'}),
    makeRuntimeNode('contains','spica.runtime.note_contains',{query:'check'}),
    makeRuntimeNode('when','spica.runtime.when_true'),
    makeRuntimeNode('relay','spica.runtime.event_relay'),
  ];
  graph.edges=[edge('one','source','note','contains','note'),edge('two','contains','matched','when','condition'),
    edge('seed','when','trigger','relay','trigger','event'),
    edge('repeat','relay','trigger','relay','trigger','event',{maxIterations:2})];
  assert.equal(validateSpicaGraphV2(graph,{requireComplete:true}).valid,true);
  const result=await run(graph);
  assert.equal(result.state,'failed');assert.match(result.error,/feedback .*exceeded/i);
  assert.equal(result.committed,false);
});
test('resource budgets are enforced and deterministic; output is bounded',async()=>{
  const result=await run(fixture(),{maxOperations:2});
  assert.equal(result.state,'failed');assert.match(result.error,/exceeded 2 operations/);
});
test('legacy migration placeholders are excluded only if isolated and readonly',async()=>{
  const graph=fixture();graph.migration={sourceSchema:1,sourceHash:'a'.repeat(64),strategy:'readonly-snapshot',migratedAt:'2026-11-11T21:00:00Z'};
  graph.nodes.push({id:'legacy_page',scope:'root',block:{id:'spica.legacy.page',version:'1',availability:'placeholder'},config:{},inputs:[],outputs:[],metadata:{readonly:true}});
  const pass=await run(graph,{excludeIsolatedLegacy:true});assert.equal(pass.state,'passed',pass.error);
  const deny=await run(graph,{excludeIsolatedLegacy:false});assert.equal(deny.state,'failed');
  assert.match(deny.error,/placeholder, not an executable adapter/);
});

test('schema-1 add_record_field adds missing typed fields and rejects duplicates atomically',()=>{
  const {starterGraph,changeGraph,stableGraphJson}=require(path.join(base,'graph.js'));
  const original=starterGraph('Notes','notes');const before=stableGraphJson(original);
  const added=changeGraph(original,[{op:'add_record_field',collection:'notes',field:{key:'priority',label:'Priority',type:'number',min:0,max:5}}]);
  assert.equal(added.collection.fields.find(f=>f.key==='priority').initial,0);
  assert.equal(stableGraphJson(original),before);
  assert.throws(()=>changeGraph(added,[{op:'add_record_field',collection:'notes',field:{key:'priority',label:'Duplicate',type:'number'}}]),/already exists/);
  assert.throws(()=>changeGraph(added,[{op:'add_record_field',collection:'notes',field:{key:'Bad Key',label:'Invalid',type:'text'}}]),/Invalid record field key/);
});

test('Spark screen field IDs and query must match the exact published contract',()=>{
  const fs=require('node:fs'); const vm=require('node:vm');
  const ts=(()=>{try{return require('typescript')}catch{return require(require('node:child_process').execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()+'/typescript')}})();
  const transpile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const editSchemas={exports:{}};
  vm.runInNewContext(transpile('src/spica/edit-schemas.ts'),{module:editSchemas,exports:editSchemas.exports,require:()=>({}),console});
  const validatorModule={exports:{}};
  vm.runInNewContext(transpile('src/engine/intelligence/tool-validation.ts'),{module:validatorModule,exports:validatorModule.exports,require:()=>({}),console});
  const mod={exports:{}};
  const mocks={
    '../engine/intelligence/tool-contract-intelligence':require('./tool-contract-mock.cjs'),
    '../engine/intelligence/tool-validation':validatorModule.exports,
    './edit-schemas':editSchemas.exports,
    './graph-v2/transactions':{applySpicaGraphTransaction:()=>({})},
    './graph-v2/edit-adapter':{expandSpicaV2Edits:edits=>edits},
    './runtime/blocks/registry':{getBlock:()=>undefined},
    './inspect-params-v2':{inspectSpicaV2Parameters:()=>({})},

    '../engine/creator':{inspectProjectEnvironment:async()=>({rootEntryCount:0})},
    './repository':{SpicaRepository:class{}},
    './graph':{stableGraphJson:()=>'',changeGraph:()=>({}),collectionUpgrade:()=>[],GraphEditError:Error},
    './appearance':{styleChanges:()=>[],styleProperties:{color:[]},styleStates:['base'],styleTargets:()=>[],styleValues:{},supportedProperties:[],supportedStates:[]},
    './program':{capabilities:['records.write'],recipeCatalog:[{id:'quick_capture',label:'Quick Capture'}]},
    './warehouse':{searchSpicaWarehouse:()=>[],inspectSpicaComponent:()=>({})},
    './research-tools':{spicaResearchTools:[]},
    './professionalism':{auditSpicaDesign:()=>({checked:1,passed:true,findings:[],errors:0,warnings:0})},
    './inspect-params':{inspectSpicaParameters:()=>({})},
    './catalog/unified':{inspectSpicaCapability:async()=>({}),searchSpicaCapabilities:async()=>({candidates:[]})},
    './catalog/client':{listCatalogCategories:async()=>[]},
    './catalog/categories':{warehouseCategories:[],warehouseCapacity:0},
    './graph-v2/validation':{validateSpicaGraphV2:()=>({valid:true,errors:[],warnings:[]})},
    './runtime/discovery':{searchExecutableBlocks:()=>({total:0,results:[]}),inspectExecutableBlock:()=>({})},
    './runtime/composition':{previewSpicaComposition:()=>({graph:{},diagnostics:{valid:true,errors:[],warnings:[]}})},
    './runtime/registry':{listRuntimeBlocks:()=>[],getRuntimeBlock:()=>undefined},
    './runtime/executor':{executeSpicaGraphV2:async()=>({state:'failed'})},
  };
  vm.runInNewContext(transpile('src/spica/tools.ts'),{module:mod,exports:mod.exports,require:id=>{
    if(Object.hasOwn(mocks,id))return mocks[id];throw Error('Unmocked dependency: '+id);
  },TextEncoder,AbortController,DOMException,structuredClone,console}, {filename:'src/spica/tools.ts'});
  const tools=mod.exports;
  const validator={exports:{}};
  vm.runInNewContext(transpile('src/engine/intelligence/tool-validation.ts'),{module:validator,exports:validator.exports,require:()=>({}),console},
    {filename:'src/engine/intelligence/tool-validation.ts'});
  const validate=validator.exports.validateToolArguments;
  const definition=tools.spicaToolContract(tools.spicaTools.find(t=>t.function.name==='edit_spica_graph'),true);
  const original={revision:4,edits:[
    {op:'put_screen',screen:{id:'edit_note',label:'Edit Note',view:'form',collection:'notes',fields:[{key:'title',label:'Title',type:'text'},
      {key:'body',label:'Body',type:'text'}],submit:'save_note'}},
    {op:'put_screen',screen:{id:'notes_list',label:'Notes',view:'list',collection:'notes',query:'hello'}},
    {op:'add_record_field',collection:'notes',field:{key:'priority',label:'Priority',type:'number'}},
  ]};
  assert.equal(validate('edit_spica_graph',original,[definition]).ok,false,'Field objects are invalid; no implicit conversion is allowed');
  const valid={revision:4,edits:[
    {op:'put_screen',screen:{id:'edit_note',label:'Edit Note',view:'form',collection:'notes',fields:['title','body'],submit:'save_note'}},
    {op:'put_screen',screen:{id:'notes_list',label:'Notes',view:'list',collection:'notes',query:'hello'}},
    {op:'add_record_field',collection:'notes',field:{key:'priority',label:'Priority',type:'number'}},
  ]};
  assert.equal(validate('edit_spica_graph',valid,[definition]).ok,true);
  assert.deepEqual(valid.edits[0].screen.fields,['title','body']);
  const bad={revision:4,edits:[{op:'put_screen',screen:{id:'bad',label:'Bad',view:'list',collection:'notes',unknown:'unsupported'}}]};
  assert.equal(validate('edit_spica_graph',bad,[definition]).ok,false,'unknown fields must be rejected, not translated');
});

test('Spark run_spica_v2_graph returns real execution evidence, rejects stale revisions and never claims durable storage',async()=>{
  const fs=require('node:fs');const vm=require('node:vm');
  const ts=(()=>{try{return require('typescript')}catch{return require(require('node:child_process').execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()+'/typescript')}})();
  const transpile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const graph=fixture();let record={data:{revision:9,graph:{schema:1,program:{grants:['records.write']}},graphV2:graph}};
  class FakeRepository {async read(){return record}async v2OriginIsCurrent(){return true}}
  const editSchemas={exports:{}};
  vm.runInNewContext(transpile('src/spica/edit-schemas.ts'),{module:editSchemas,exports:editSchemas.exports,require:()=>({}),console});
  const validatorModule={exports:{}};
  vm.runInNewContext(transpile('src/engine/intelligence/tool-validation.ts'),{module:validatorModule,exports:validatorModule.exports,require:()=>({}),console});
  const module={exports:{}};const mocks={
    '../engine/intelligence/tool-contract-intelligence':require('./tool-contract-mock.cjs'),
    '../engine/intelligence/tool-validation':validatorModule.exports,
    './edit-schemas':editSchemas.exports,
    './graph-v2/transactions':{applySpicaGraphTransaction:()=>({})},
    './graph-v2/edit-adapter':{expandSpicaV2Edits:edits=>edits},
    './runtime/blocks/registry':{getBlock:()=>undefined},
    './inspect-params-v2':{inspectSpicaV2Parameters:()=>({})},
    '../engine/creator':{inspectProjectEnvironment:async()=>({rootEntryCount:0})},
    './repository':{SpicaRepository:FakeRepository},
    './graph':{stableGraphJson:()=>'',changeGraph:()=>({}),collectionUpgrade:()=>[],GraphEditError:Error},
    './appearance':{styleChanges:()=>[],styleProperties:{color:[]},styleStates:['base'],styleTargets:()=>[],styleValues:{},supportedProperties:[],supportedStates:[]},
    './program':{capabilities:['records.write'],recipeCatalog:[{id:'quick_capture',label:'Quick Capture'}]},
    './warehouse':{searchSpicaWarehouse:()=>[],inspectSpicaComponent:()=>({})},
    './research-tools':{spicaResearchTools:[]},
    './professionalism':{auditSpicaDesign:()=>({checked:1,passed:true,findings:[],errors:0,warnings:0})},
    './inspect-params':{inspectSpicaParameters:()=>({})},
    './catalog/unified':{inspectSpicaCapability:async()=>({}),searchSpicaCapabilities:async()=>({candidates:[]})},
    './catalog/client':{listCatalogCategories:async()=>[]},
    './catalog/categories':{warehouseCategories:[],warehouseCapacity:0},
    './graph-v2/validation':{validateSpicaGraphV2:()=>({valid:true,errors:[],warnings:[]})},
    './runtime/discovery':{searchExecutableBlocks:()=>({total:0,results:[]}),inspectExecutableBlock:()=>({})},
    './runtime/composition':{previewSpicaComposition:()=>({graph:{},diagnostics:{valid:true,errors:[],warnings:[]}})},
    './runtime/registry':require(path.join(base,'runtime/registry.js')),
    './runtime/executor':require(path.join(base,'runtime/executor.js')),
  };
  vm.runInNewContext(transpile('src/spica/tools.ts'),{module,exports:module.exports,require:id=>{
    if(Object.hasOwn(mocks,id))return mocks[id];throw Error('Unmocked dependency: '+id);
  },TextEncoder,AbortController,DOMException,structuredClone,console}, {filename:'src/spica/tools.ts'});
  const tools=module.exports;const project={id:'project'};const execution={webEnabled:false,signal:new AbortController().signal};
  const lines=[];
  const response=JSON.parse(await tools.executeSpicaTool('run_spica_v2_graph',{revision:9},project,execution,(stream,chunk)=>lines.push({stream,chunk})));
  assert.equal(response.ok,true,response.error);assert.equal(response.operations,5);
  assert.equal(response.durableStorage,false);assert.equal(response.standaloneExported,false);
  assert.equal(response.outputs.preview.view.title,'My note');
  assert.ok(lines.some(entry=>entry.chunk.includes('[completed] save')));
  const stale=JSON.parse(await tools.executeSpicaTool('run_spica_v2_graph',{revision:8},project,execution));
  assert.equal(stale.code,'STALE_GRAPH');
  record={data:{...record.data,graph:{schema:1,program:{grants:[]}}}};
  const denied=JSON.parse(await tools.executeSpicaTool('run_spica_v2_graph',{revision:9},project,execution));
  assert.equal(denied.ok,false);assert.match(denied.error,/requires approved records.write/);
});
