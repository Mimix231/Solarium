'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const compiled = path.join(root, '.spica-phase03-test', 'spica');
const { emptySpicaGraphV2 } = require(path.join(compiled,'graph-v2/types.js'));
const { spicaTypeAssignable, validateSpicaGraphV2, assertSpicaGraphV2 } = require(path.join(compiled,'graph-v2/validation.js'));
const { spicaCanonicalJson, spicaGraphDigest, serializeSpicaGraphV2 } = require(path.join(compiled,'graph-v2/serialization.js'));
const { applySpicaGraphTransaction } = require(path.join(compiled,'graph-v2/transactions.js'));
const { migrateLegacyGraph, legacyOriginMatches } = require(path.join(compiled,'graph-v2/migration.js'));
const { starterGraph, stableGraphJson, compileGraph } = require(path.join(compiled,'graph.js'));
const { createHash } = require('node:crypto');
const ts = (()=>{ try { return require('typescript'); } catch { return require(require('node:child_process').execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()+'/typescript'); }})();
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const node = (id, block, inputs, outputs, extra={}) => ({
  id, block:{id:block,version:'1',availability:'placeholder'}, scope:'root', config:{}, inputs,outputs,...extra,
});
const port=(id,type,other={})=>({id,type,...other});
const num={kind:'number'}, str={kind:'string'}, evt={kind:'event',payload:str};
const fixture = () => ({...emptySpicaGraphV2('demo.graph','Demo'),nodes:[
  node('source','fixture.source',[],[port('out',num)]),
  node('display','fixture.display',[port('in',num,{required:true})],[]),
],edges:[{id:'connect',kind:'data',from:{node:'source',port:'out'},to:{node:'display',port:'in'}}]});

test('graph-v2 accepts valid typed connections and warns about non-executable placeholders',()=>{
  const result=validateSpicaGraphV2(fixture(),{requireComplete:true});
  assert.equal(result.valid,true,JSON.stringify(result.errors));
  assert.ok(result.warnings.some(item=>item.code==='NON_EXECUTABLE_NODE'));
  assert.equal(spicaTypeAssignable(num,num),true);
  assert.equal(spicaTypeAssignable(num,str),false);
  assert.equal(spicaTypeAssignable({kind:'record',fields:{title:str}}, {kind:'record',fields:{title:str}}),true);
  assert.equal(spicaTypeAssignable({kind:'array',element:num}, {kind:'array',element:str}),false);
  assert.equal(spicaTypeAssignable({kind:'async',result:str},str),false);
  assert.equal(spicaTypeAssignable({kind:'reference',collection:'notes'}, {kind:'reference',collection:'tasks'}),false);
});
test('mismatched port type, fan-in, dangling edge and unbounded cycle are rejected',()=>{
  const mismatched=fixture();mismatched.nodes[1].inputs[0].type=str;
  assert.ok(validateSpicaGraphV2(mismatched).errors.some(d=>d.code==='TYPE_MISMATCH'));
  const duplicate=fixture();duplicate.edges.push({...duplicate.edges[0],id:'second'});
  assert.ok(validateSpicaGraphV2(duplicate).errors.some(d=>d.code==='FAN_IN'));
  const dangling=fixture();dangling.edges[0].from.node='missing';
  assert.ok(validateSpicaGraphV2(dangling).errors.some(d=>d.code==='DANGLING_EDGE'));
  const cycle=fixture();cycle.nodes[0].inputs=[port('again',num)];cycle.nodes[1].outputs=[port('back',num)];
  cycle.edges.push({id:'back',kind:'data',from:{node:'display',port:'back'},to:{node:'source',port:'again'}});
  assert.ok(validateSpicaGraphV2(cycle).errors.some(d=>d.code==='UNBOUNDED_CYCLE'));
});
test('event feedback must be explicit, typed and bounded',()=>{
  const graph=emptySpicaGraphV2('event.graph','Events');graph.nodes=[
    node('source','fixture.event',[port('in',evt)],[port('out',evt)]),
    node('sink','fixture.sink',[port('in',evt)],[port('out',evt)]),
  ];
  graph.edges=[{id:'go',kind:'event',from:{node:'source',port:'out'},to:{node:'sink',port:'in'}},
    {id:'feedback',kind:'event',from:{node:'sink',port:'out'},to:{node:'source',port:'in'},feedback:{maxIterations:12}}];
  assert.equal(validateSpicaGraphV2(graph).valid,true);
  delete graph.edges[1].feedback;
  assert.ok(validateSpicaGraphV2(graph).errors.some(d=>d.code==='UNBOUNDED_CYCLE'));
  graph.edges[1].feedback={maxIterations:200};
  assert.ok(validateSpicaGraphV2(graph).errors.some(d=>d.code==='INVALID_FEEDBACK'));
});
test('graph-v2 transactions are atomic, deterministic, and respect required port completeness',()=>{
  const base=emptySpicaGraphV2('demo.graph','Demo');
  const next=applySpicaGraphTransaction(base,[{op:'add_node',node:node('source','fixture.source',[],[port('out',num)])},
    {op:'add_node',node:node('sink','fixture.sink',[port('in',num,{required:true})],[])},
    {op:'connect',edge:{id:'link',kind:'data',from:{node:'source',port:'out'},to:{node:'sink',port:'in'}}}]);
  assert.equal(base.nodes.length,0);assert.equal(next.edges.length,1);
  assert.ok(!validateSpicaGraphV2(next,{requireComplete:true}).errors.length);
  assert.throws(()=>applySpicaGraphTransaction(next,[{op:'disconnect',id:'link'},{op:'connect',edge:{id:'bad',kind:'data',from:{node:'missing',port:'out'},to:{node:'sink',port:'in'}}}]),/DANGLING_EDGE/);
  assert.equal(next.edges.length,1,'failed transaction must not mutate its input');
  const removed=applySpicaGraphTransaction(next,[{op:'remove_node',id:'sink'}]);
  assert.equal(removed.edges.length,0);
});
test('nested scopes validate parents and isolate connections',()=>{
  const graph=fixture();graph.scopes.push({id:'child',parent:'root',label:'Subgraph'});graph.nodes[1].scope='child';
  assert.ok(validateSpicaGraphV2(graph).errors.some(d=>d.code==='CROSS_SCOPE_EDGE'));
  graph.nodes[1].scope='root';graph.scopes.push({id:'bad',parent:'bad',label:'Cycle'});
  assert.ok(validateSpicaGraphV2(graph).errors.some(d=>d.code==='SCOPE_CYCLE'));
});
test('canonical serialization is deterministic, hashable and rejects unsafe objects',async()=>{
  assert.equal(spicaCanonicalJson({b:2,a:{z:3,k:1}}),spicaCanonicalJson({a:{k:1,z:3},b:2}));
  const graph=fixture(); assert.equal(serializeSpicaGraphV2(graph),spicaCanonicalJson(graph));
  const hash=await spicaGraphDigest(graph);assert.match(hash,/^[a-f0-9]{64}$/);
  assert.equal(hash,createHash('sha256').update(spicaCanonicalJson(graph)).digest('hex'));
  assert.throws(()=>spicaCanonicalJson({amount:Infinity}),/finite JSON/);
  const cycle={};cycle.self=cycle;assert.throws(()=>spicaCanonicalJson(cycle),/cyclic/);
});
test('schema-1 notes and settings graph migrate as a read-only projection without modifying legacy source',async()=>{
  for(const recipe of ['notes','settings','tasks']){
    const source=starterGraph('Demo '+recipe,recipe); const before=stableGraphJson(source);
    const migrated=await migrateLegacyGraph(source,'demo.graph','2026-11-11T21:00:00.000Z');
    assert.equal(migrated.schema,2);
    assert.equal(migrated.migration.strategy,'readonly-snapshot');
    assert.equal(await legacyOriginMatches(source,migrated),true);
    assert.equal(stableGraphJson(source),before,'migration must not change source schema 1');
    assert.equal(compileGraph(source).schema,1);
    assert.ok(migrated.nodes.every(n=>n.block.availability==='placeholder'&&n.metadata.readonly));
    assert.ok(validateSpicaGraphV2(migrated).valid);
    if (migrated.nodes.length) assert.throws(()=>applySpicaGraphTransaction(migrated,[{op:'remove_node',id:migrated.nodes[0].id}]),/read-only/);
    source.name='Changed';assert.equal(await legacyOriginMatches(source,migrated),false);
  }
});
test('registered block locks must resolve against real registry when resolver supplied',()=>{
  const g=fixture();g.nodes[0].block.availability='registered';g.nodes[0].block.id='spica.block.fake';
  assert.ok(validateSpicaGraphV2(g,{resolveBlock:()=>false}).errors.some(d=>d.code==='UNREGISTERED_BLOCK'));
});
test('repository V2 migration, CAS revision, undo/redo and rollback preserve schema-1 graph', async()=>{
  const compiledRepoPath=path.join(compiled,'repository.js');
  const source=read('src/spica/repository.ts');
  fs.writeFileSync(compiledRepoPath,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
  const Module=require('node:module');const prior=Module.prototype.require;
  let stored=null;
  const store={
    list:async()=>stored?[stored]:[],
    batch:async ops=>{for(const op of ops){assert.equal(op.expected,stored?.version??null);stored=op.record;}},
  };
  Module.prototype.require=function(id){
    if(this.filename===compiledRepoPath){
      if(id==='../foundation/store')return {foundationStore:store,newRecord:(kind,id,scope,title,data)=>({collection:kind,id,scope,title,data,version:1})};
      if(id==='../domain/types')return {uid:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'};
      if(id==='./runtime/registry')return {getRuntimeBlock:()=>undefined};
    }
    return prior.apply(this,arguments);
  };
  let SpicaRepository;
  try { SpicaRepository=require(compiledRepoPath).SpicaRepository; }finally{Module.prototype.require=prior;}
  const repo=new SpicaRepository('fixture',store);
  const made=await repo.create('Notes','notes');
  assert.equal(made.data.graph.schema,1); const original=stableGraphJson(made.data.graph);
  const v2=await repo.migrateV2(made.data.revision);
  assert.equal(v2.data.revision,2); assert.ok(v2.data.graphV2);assert.equal(stableGraphJson(v2.data.graph),original);
  assert.equal(await repo.v2OriginIsCurrent(v2),true);
  await assert.rejects(repo.migrateV2(1),/STALE_GRAPH/);
  const edited=await repo.updateV2(2,[{op:'add_node',node:node('custom','fixture.custom',[],[])}]);
  assert.equal(edited.data.graphV2.nodes.some(n=>n.id==='custom'),true);
  const undone=await repo.updateV2(3,'undo');assert.equal(undone.data.graphV2.nodes.some(n=>n.id==='custom'),false);
  const redone=await repo.updateV2(4,'redo');assert.equal(redone.data.graphV2.nodes.some(n=>n.id==='custom'),true);
  const rolled=await repo.updateV2(5,'rollback');assert.equal(rolled.data.graphV2,undefined);
  assert.equal(stableGraphJson(rolled.data.graph),original);
  const reprojection=await repo.migrateV2(6);
  assert.equal(reprojection.data.revision,7);
  const renamed=await repo.update(7,[{op:'rename',name:'Changed Legacy'}]);
  assert.equal(renamed.data.graph.name,'Changed Legacy');
  await assert.rejects(repo.updateV2(8,[{op:'rename',name:'Unsafe V2'}]),/STALE_V2_ORIGIN/);
  const back=await repo.updateV2(8,'rollback');
  assert.equal(back.data.graph.name,'Changed Legacy');
  assert.equal(back.data.graphV2,undefined);
});
function toolModule(file,mocks){
  const js=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};
  vm.runInNewContext(js,{module,exports:module.exports,require:id=>{
    if(Object.hasOwn(mocks,id))return mocks[id];throw Error('Unmocked dependency: '+id);
  },TextEncoder,TextDecoder,AbortController,DOMException,structuredClone,crypto:globalThis.crypto,console}, {filename:file});
  return module.exports;
}
function toolMocks(){
  const editSchemas=toolModule('src/spica/edit-schemas.ts',{});
  const validator=toolModule('src/engine/intelligence/tool-validation.ts',{});
  return {
    '../engine/intelligence/tool-contract-intelligence':require('./tool-contract-mock.cjs'),
    '../engine/intelligence/tool-validation':validator,
    './edit-schemas':editSchemas,
    './graph-v2/transactions':{applySpicaGraphTransaction:()=>({})},
    './graph-v2/edit-adapter':{expandSpicaV2Edits:edits=>edits},
    './runtime/blocks/registry':{getBlock:()=>undefined},
    './inspect-params-v2':{inspectSpicaV2Parameters:()=>({})},

    '../engine/creator':{inspectProjectEnvironment:async()=>({rootEntryCount:0})},
    './repository':{SpicaRepository:class{}},
    './research-tools':{spicaResearchTools:[]},
    './graph':{stableGraphJson:()=>'',changeGraph:()=>({}),collectionUpgrade:()=>[],GraphEditError:Error},
    './appearance':{styleChanges:()=>[],styleProperties:{color:[]},styleStates:['base'],styleTargets:()=>[],styleValues:{},supportedProperties:[],supportedStates:[]},
    './program':{capabilities:['records.write'],recipeCatalog:[{id:'quick_capture',label:'Quick Capture'}]},
    './warehouse':{searchSpicaWarehouse:()=>[],inspectSpicaComponent:()=>({})},
    './professionalism':{auditSpicaDesign:()=>({checked:1,passed:true,findings:[],errors:0,warnings:0})},
    './graph-v2/validation':{validateSpicaGraphV2:()=>({valid:true,errors:[],warnings:[]})},
    './runtime/discovery':{searchExecutableBlocks:()=>({total:0,results:[]}),inspectExecutableBlock:()=>({})},
    './runtime/composition':{previewSpicaComposition:()=>({graph:{},diagnostics:{valid:true,errors:[],warnings:[]}})},
    './runtime/registry':{getRuntimeBlock:()=>undefined,listRuntimeBlocks:()=>[]},
    './runtime/executor':{executeSpicaGraphV2:async()=>({state:'failed',error:'Not installed in phase 3 fixture'})},
    './inspect-params':{inspectSpicaParameters:()=>({})},
    './catalog/unified':{inspectSpicaCapability:async()=>({}),searchSpicaCapabilities:async()=>({candidates:[]})},
    './catalog/client':{listCatalogCategories:async()=>[]},
    './catalog/categories':{warehouseCategories:[],warehouseCapacity:0},
  };
}
test('natural-language routing selects real Spica tools for the exact failed Spark prompt',()=>{
  const tools=toolModule('src/spica/tools.ts',toolMocks());
  const request='Dona, I want you to build a fully functional application using SPICA\'s internal block warehouse. Application: SPICA Notes Demo';
  assert.equal(tools.isSpicaCreationRequest(request),true);
  assert.equal(tools.isSpicaProgramRequest(request),true);
  assert.equal(tools.spicaRequestedRecipe(request),'notes');
  assert.equal(tools.isSpicaCreationRequest('What if SPICA could build a notes app?'),false);
  assert.equal(tools.isSpicaCreationRequest('Please explain how SPICA works.'),false);
  assert.equal(tools.isSpicaCreationRequest('Build the current exported SPICA app'),false);
  const allowed=tools.spicaTools;
  assert.deepEqual(Array.from(tools.selectSpicaTools(allowed,null,true,false,false,true,{hasGraph:false}),t=>t.function.name),['spica_next_action','inspect_spica_tool','check_spica_tool_call','inspect_spica_identifier']);
  assert.deepEqual(Array.from(tools.selectSpicaTools(allowed,null,true,false,false,true,{hasGraph:true,v2Intent:true,hasV2:false}),t=>t.function.name),['spica_next_action','inspect_spica_tool','check_spica_tool_call','read_spica_graph','inspect_spica_identifier']);
  assert.equal(allowed.find(t=>t.function.name==='create_spica_app').function.parameters.properties.recipe.enum.includes('notes'),true);
});
test('non-tool-capable models cannot run an implicit starter-app fallback',()=>{
  assert.doesNotMatch(read('src/engine/agent.ts'),/buildSupportedSpicaTemplate/);
  assert.equal(require('node:fs').existsSync(path.join(root,'src/spica/agent-build.ts')),false);
  assert.match(read('src/engine/agent.ts'),/Tool capability unavailable/);
});
test('Phase 3 preserves the shared permission registry and Workbench guard',()=>{
  assert.match(read('src/engine/intelligence/coding-tools.ts'),/\.\.\.spicaTools/);
  assert.match(read('src/engine/action-permissions.ts'),/\.\.\.codingNames/);
  assert.match(read('src/engine/agent.ts'),/spicaRequestedRecipe/);
  assert.match(read('src/components/SpicaWorkbench.tsx'),/sourceSnapshot != null && sourceSnapshot\.revision/);
  assert.match(read('src/views/Chat.tsx'),/['"]create_spica_app['"]/);
});
