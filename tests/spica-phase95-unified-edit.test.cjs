'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const base=path.join(root,'.spica-phase95-test');
const compiled=requireScript=>require(path.join(base,requireScript));
const {starterGraph,changeGraph,stableGraphJson,collectionUpgrade,GraphEditError}=compiled('spica/graph.js');
const {emptySpicaGraphV2}=compiled('spica/graph-v2/types.js');
const {validateSpicaGraphV2}=compiled('spica/graph-v2/validation.js');
const {applySpicaGraphTransaction}=compiled('spica/graph-v2/transactions.js');
const {expandSpicaV2Edits,assertSpicaRuntimeNodeContracts}=compiled('spica/graph-v2/edit-adapter.js');
const {getRuntimeBlock,listRuntimeBlocks}=compiled('spica/runtime/registry.js');
const {inspectExecutableBlock}=compiled('spica/runtime/discovery.js');
const {unifiedSpicaEditParameters,spicaScopedEditParameters}=compiled('spica/edit-schemas.js');
const {validateToolArguments}=compiled('engine/intelligence/tool-validation.js');
const {inspectSpicaV2Parameters}=compiled('spica/inspect-params-v2.js');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const transpile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const argumentDecoder={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-arguments.ts'),{module:argumentDecoder,exports:argumentDecoder.exports,console});
const contract={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-contract-intelligence.ts'),{
 module:contract,exports:contract.exports,require:id=>{
 if(id==='./tool-validation')return {validateToolArguments};
 if(id==='./tool-arguments')return argumentDecoder.exports;
 throw Error('Unmocked contract dependency: '+id);
 },console});
const {ToolContractRegistry,ToolCallValidator}=contract.exports;
const styleProperties={background:{},text:{}};
let current={title:'Notes',version:1,data:{revision:11,graph:starterGraph('Notes','notes'),graphV2:emptySpicaGraphV2('demo.notes','Notes')}};
const sampleGraph=()=>current;
let originCurrent=true;
class Repository {
 async read(){return current;}
 async v2OriginIsCurrent(){return originCurrent;}
 async updateV2(revision,edits){
  assert.equal(revision,current.data.revision);
  const next=applySpicaGraphTransaction(current.data.graphV2,edits,{resolveBlock:(id,version)=>Boolean(getRuntimeBlock(id,version))});
  assertSpicaRuntimeNodeContracts(next);
  current={...current,version:current.version+1,data:{...current.data,revision:revision+1,graphV2:next}};
  return current;
 }
 async update(revision,edits){
  assert.equal(revision,current.data.revision);
  const next=changeGraph(current.data.graph,edits);
  current={...current,version:current.version+1,data:{...current.data,revision:revision+1,graph:next}};
  return current;
 }
}
const mock={
 './inspect-tool-view':require('./inspect-tool-view-source.cjs'),
 '../engine/creator':{inspectProjectEnvironment:async()=>({rootEntryCount:0})},
 './repository':{SpicaRepository:Repository},
 './graph':{changeGraph,collectionUpgrade,GraphEditError,stableGraphJson},
 './appearance':{styleChanges:()=>[],styleProperties,styleStates:['base'],styleTargets:()=>[],styleValues:()=>[],supportedProperties:()=>[],supportedStates:()=>[]},
 './program':{capabilities:[],recipeCatalog:[]},
 './graph-v2/validation':{validateSpicaGraphV2},
 './graph-v2/transactions':{applySpicaGraphTransaction},
 './graph-v2/edit-adapter':{expandSpicaV2Edits,assertSpicaRuntimeNodeContracts},
 './runtime/registry':{getRuntimeBlock,listRuntimeBlocks},
 './runtime/blocks/registry':{getBlock:()=>undefined},
 './edit-schemas':compiled('spica/edit-schemas.js'),
 './inspect-params-v2':{inspectSpicaV2Parameters},
 './warehouse':{searchSpicaWarehouse:()=>({}),inspectSpicaComponent:()=>({}),registeredWarehouseCounts:{adapters:26}},
 './runtime/discovery':{searchExecutableBlocks:()=>({results:[]}),inspectExecutableBlock},
 './runtime/composition':{previewSpicaComposition:()=>({})},
 './runtime/executor':{executeSpicaGraphV2:()=>({})},
 './inspect-params':{inspectSpicaParameters:()=>({})},
 './catalog/unified':{inspectSpicaCapability:async()=>({}),searchSpicaCapabilities:async()=>({candidates:[]})},
 './catalog/client':{listCatalogCategories:async()=>[]},
 './catalog/categories':{warehouseCategories:[],warehouseCapacity:350000},
 './professionalism':{auditSpicaDesign:()=>({passed:true})},
 './research-tools':{spicaResearchTools:[]},
 './tool-intelligence':{listSpicaToolchain:()=>({}),inspectSpicaTool:()=>({}),inspectSpicaWiring:()=>({}),spicaToolPrerequisites:()=>[]},
 '../engine/intelligence/tool-validation':{validateToolArguments},
 '../engine/intelligence/tool-contract-intelligence':{ToolContractRegistry,ToolCallValidator},
};
const mod={exports:{}};
vm.runInNewContext(transpile('src/spica/tools.ts'),{
 module:mod,exports:mod.exports,require:id=>{
  if(id==='./tool-aliases')return require(path.join(path.join(root,'.spica-phase95-test'),'spica/tool-aliases.js'));
    if(id==='./construction-insights')return require(path.join(path.join(root,'.spica-phase95-test'),'spica/construction-insights.js'));
    if(Object.hasOwn(mock,id))return mock[id];throw Error('Unmocked dependency: '+id);
 },TextEncoder,AbortController,DOMException,structuredClone,console},{filename:'src/spica/tools.ts'});
const api=mod.exports;
const project={id:'notes-project',folder:'/unused'};
const execution={webEnabled:false,spicaProgram:true};
async function call(name,args){return JSON.parse(await api.executeSpicaTool(name,args,project,execution));}
const permissionless=api.spicaTools.filter(t=>['edit_spica_graph','validate_spica_edit'].includes(t.function.name));
const goodV2={revision:11,view:'v2',edits:[{op:'add_block',id:'recent_item',blockId:'spica.runtime.note_record',version:'1',config:{title:'Recent',body:'From blocks'},scope:'root'}]};

test('one graph editor declaration, one canonical contract for preflight and execution',()=>{
 assert.equal(api.spicaToolNames.has('edit_spica_v2_graph'),false);
 assert.equal(api.spicaToolNames.has('edit_spica_graph'),true);
 assert.equal(permissionless.length,2);
 const [save,validate]=permissionless.map(item=>item.function.parameters);
 assert.equal(JSON.stringify(save),JSON.stringify(validate));
 assert.equal(JSON.stringify(save.properties),JSON.stringify(unifiedSpicaEditParameters.properties));
 assert.ok(save.properties.edits.items.oneOf.length>=20);
});

test('operation-scoped schema accepts exact V1 and V2 edits and rejects missing/unrecognized parameters',()=>{
 const v1=spicaScopedEditParameters({view:'schema1',operations:['add_page']});
 const v2=spicaScopedEditParameters({view:'v2',operations:['add_block']});
 const mk=(schema,input)=>validateToolArguments('edit_spica_graph',input,[{type:'function',function:{name:'edit_spica_graph',description:'',parameters:schema}}]);
 assert.equal(mk(v1,{revision:11,edits:[{op:'add_page',id:'preferences',label:'Preferences'}]}).ok,true);
 assert.equal(mk(v2,goodV2).ok,true);
 assert.equal(mk(v2,{revision:11,edits:goodV2.edits}).ok,false,'V2 must explicitly identify its view');
 assert.equal(mk(v2,{...goodV2,edits:[{op:'add_block',id:'x',blockId:'spica.runtime.note_record',arguments:{}}]}).ok,false);
 assert.equal(mk(v2,{...goodV2,edits:[{op:'add_block',id:'x'}]}).ok,false);
 assert.equal(mk(v2,{...goodV2,edits:[{op:'put_screen',screen:{id:'a'}}]}).ok,false);
});

test('V2 preflight is read-only, and exact registered blocks save through edit_spica_graph',async()=>{
 const original=sampleGraph();
 const preview=api.reviewSpicaEdit(original,goodV2);
 assert.equal(preview.ok,true,preview.result?.message);
 assert.equal(sampleGraph(),original,'preflight must not persist anything');
 const validated=await call('validate_spica_edit',goodV2);
 assert.equal(validated.ok,true,JSON.stringify(validated));
 assert.equal(validated.view,'v2');
 const saved=await call('edit_spica_graph',goodV2);
 assert.equal(saved.saved,true,JSON.stringify(saved));
 assert.equal(saved.view,'v2');
 assert.equal(saved.exported,false,'V2 authoring is not standalone export evidence');
 assert.equal(sampleGraph().data.revision,12);
 assert.equal(sampleGraph().data.graphV2.nodes.length,1);
 assert.equal(sampleGraph().data.graphV2.nodes[0].block.id,'spica.runtime.note_record');
 assert.deepEqual(sampleGraph().data.graphV2.nodes[0].outputs.map(x=>x.id),getRuntimeBlock('spica.runtime.note_record','1').outputs.map(x=>x.id));
 const stale=await call('edit_spica_graph',goodV2);
 assert.equal(stale.saved,false);
 assert.equal(stale.code,'STALE_GRAPH');
});

test('same edit_spica_graph saves schema-1 edit without mutating V2 or pretending its save was V2',async()=>{
 const before=stableGraphJson(sampleGraph().data.graphV2);
 const args={revision:12,view:'schema1',edits:[{op:'add_page',id:'settings',label:'Settings'}]};
 const checked=api.reviewSpicaEdit(sampleGraph(),args);
 assert.equal(checked.ok,true,checked.result?.message);
 const saved=await call('edit_spica_graph',args);
 assert.equal(saved.saved,true,JSON.stringify(saved));
 assert.equal(saved.view,'schema1');
 assert.equal(saved.next,'export_spica_app');
 assert.equal(stableGraphJson(sampleGraph().data.graphV2),before);
 assert.equal(sampleGraph().data.revision,13);
});

test('small-model tool menu advances from V2 parameter inspection to validation then save',()=>{
 const state={hasGraph:true,hasV2:true,v2Intent:true,canEdit:true,
  editScope:{view:'v2',operations:['add_block']}};
 const select=(last,more={})=>api.selectSpicaTools(api.spicaTools,last,true,false,false,true,{...state,...more});
 assert.ok(select('inspect_params').some(t=>t.function.name==='validate_spica_edit'));
 const write=select('validate_spica_edit');
 assert.ok(write.some(t=>t.function.name==='edit_spica_graph'));
 const edit=write.find(t=>t.function.name==='edit_spica_graph');
 assert.equal(edit.function.parameters.properties.view.enum[0],'v2');
 assert.equal(edit.function.parameters.properties.edits.items.oneOf.length,1);
 assert.ok(!select('inspect_params').some(t=>t.function.name==='edit_spica_graph'));
});

test('batch block inspection accepts registered IDs as data, not callable tool names',async()=>{
 const name='inspect_spica_runtime_blocks';
 assert.equal(api.spicaToolNames.has(name),true);
 const result=await call(name,{blocks:[{id:'spica.runtime.note_record',version:'1'},{id:'spica.runtime.note_card'}]});
 assert.equal(result.ok,true);
 assert.equal(result.count,2);
 assert.equal(result.blocks[0].id,'spica.runtime.note_record');
 assert.ok(result.blocks[0].outputs.length>0);
 assert.equal(result.next,'inspect_params');
 const schema=api.spicaTools.find(t=>t.function.name===name).function.parameters;
 const checked=validateToolArguments(name,{blocks:[{id:'spica.runtime.note_card',random:'unrecognized'}]},[{type:'function',function:{name,description:'',parameters:schema}}]);
 assert.equal(checked.ok,false);
});

test('unified V2 editor supports scopes, registered nodes, typed edges, configuration, movement, rename and cleanup atomically',async()=>{
  // Separate fresh fixture: the complete V2 editor is exercised through the
  // same public tool used for schema-1 edits, not direct repository methods.
  current={title:'Notes',version:1,data:{revision:100,graph:starterGraph('Notes','notes'),graphV2:emptySpicaGraphV2('demo.notes','Notes')}};
  originCurrent=true;
  const commit=async edits=>{
    const args={revision:current.data.revision,view:'v2',edits};
    const before=current;
    const checked=await call('check_spica_tool_call',{name:'edit_spica_graph',arguments:args});
    assert.equal(checked.ok,true,JSON.stringify(checked));
    const dry=await call('validate_spica_edit',args);
    assert.equal(dry.ok,true,JSON.stringify(dry));
    assert.strictEqual(current,before,'dry-run cannot persist a graph');
    const saved=await call('edit_spica_graph',args);
    assert.equal(saved.saved,true,JSON.stringify(saved));
    assert.equal(saved.view,'v2');
    assert.equal(saved.exported,false);
    assert.equal(current.data.revision,args.revision+1);
    return saved;
  };
  await commit([
    {op:'add_scope',scope:{id:'additional',parent:'root',label:'Unused scope'}},
    {op:'add_block',id:'source',blockId:'spica.runtime.text_value',config:{value:'One'}},
    {op:'add_block',id:'upper',blockId:'spica.runtime.text_upper',config:{}},
  ]);
  assert.equal(current.data.graphV2.nodes.length,2);
  assert.deepEqual(current.data.graphV2.nodes[0].inputs,[]);
  assert.deepEqual(current.data.graphV2.nodes[1].inputs.map(p=>p.id),['value']);
  await commit([
    {op:'connect',edge:{id:'link',kind:'data',from:{node:'source',port:'value'},to:{node:'upper',port:'value'}}},
    {op:'move_node',id:'upper',x:125,y:230},
    {op:'set_node_config',id:'source',config:{value:'Updated'}},
    {op:'rename',name:'Revised V2'},
  ]);
  assert.equal(current.data.graphV2.name,'Revised V2');
  assert.equal(current.data.graphV2.nodes.find(n=>n.id==='source').config.value,'Updated');
  assert.equal(current.data.graphV2.edges.length,1);
  assert.equal(current.data.graphV2.nodes.find(n=>n.id==='upper').metadata.x,125);
  // The authoring graph must remain separate from the schema-1 standalone app.
  assert.equal(current.data.graph.name,'Notes');
  const candidate=structuredClone(current.data.graphV2.nodes[0]);
  candidate.id='second_source';
  await commit([{op:'add_node',node:candidate}]);
  assert.equal(current.data.graphV2.nodes.length,3);
  await commit([
    {op:'disconnect',id:'link'},
    {op:'remove_node',id:'upper'},
    {op:'remove_node',id:'source'},
    {op:'remove_node',id:'second_source'},
    {op:'remove_scope',id:'additional'},
  ]);
  assert.equal(current.data.graphV2.nodes.length,0);
  assert.equal(current.data.graphV2.edges.length,0);
  assert.equal(current.data.graphV2.scopes.length,1);
});

test('registered V2 node contract failures are rejected before saving and leave the revision unchanged',async()=>{
  current={title:'Notes',version:1,data:{revision:210,graph:starterGraph('Notes','notes'),graphV2:emptySpicaGraphV2('demo.notes','Notes')}};
  originCurrent=true;
  const setup={revision:210,view:'v2',edits:[{op:'add_block',id:'node',blockId:'spica.runtime.text_value',config:{value:'ok'}}]};
  assert.equal((await call('edit_spica_graph',setup)).saved,true);
  const revision=current.data.revision;
  const before=stableGraphJson(current.data.graphV2);
  const badConfig={revision,view:'v2',edits:[{op:'set_node_config',id:'node',config:{value:42}}]};
  const dry=await call('validate_spica_edit',badConfig);
  assert.equal(dry.ok,false);
  assert.match(dry.message,/INVALID_BLOCK_CONFIG/);
  const save=await call('edit_spica_graph',badConfig);
  assert.equal(save.saved,false);
  assert.equal(current.data.revision,revision);
  assert.equal(stableGraphJson(current.data.graphV2),before);
  const fakeNode=structuredClone(current.data.graphV2.nodes[0]);
  fakeNode.id='fake_port';
  fakeNode.outputs[0].id='not_a_registered_port';
  const badPorts={revision,view:'v2',edits:[{op:'add_node',node:fakeNode}]};
  assert.equal((await call('validate_spica_edit',badPorts)).ok,false);
  assert.equal((await call('edit_spica_graph',badPorts)).saved,false);
  assert.equal(current.data.revision,revision);
  assert.equal(stableGraphJson(current.data.graphV2),before);
});

test('outdated schema-1 origin rejects both unified V2 dry-run and save at identical revision',async()=>{
  current={title:'Notes',version:1,data:{revision:300,graph:starterGraph('Notes','notes'),graphV2:emptySpicaGraphV2('demo.notes','Notes')}};
  originCurrent=false;
  const args={revision:300,view:'v2',edits:[{op:'add_block',id:'test',blockId:'spica.runtime.text_value',config:{value:'okay'}}]};
  const inspected=await call('check_spica_tool_call',{name:'edit_spica_graph',arguments:args});
  const dry=await call('validate_spica_edit',args);
  const saved=await call('edit_spica_graph',args);
  assert.equal(inspected.ok,false);
  assert.match(inspected.errors.join(' | '),/STALE_V2_ORIGIN/);
  assert.equal(dry.ok,false);
  assert.equal(dry.code,'STALE_V2_ORIGIN');
  assert.equal(saved.saved,false);
  assert.equal(saved.code,'STALE_V2_ORIGIN');
  assert.equal(current.data.revision,300);
  assert.equal(current.data.graphV2.nodes.length,0);
  originCurrent=true;
});

test('the single editing tool covers every V2 operation name without a secondary handler',()=>{
  const {v2EditOperations}=compiled('spica/edit-schemas.js');
  const expected=['rename','migrate_graph','rollback_graph','undo_graph','redo_graph','compose_blocks','add_scope','remove_scope','add_node','add_block','remove_node',
    'set_node_config','move_node','connect','disconnect'];
  assert.deepEqual([...v2EditOperations].sort(),expected.sort());
  const source=fs.readFileSync(path.join(root,'src/spica/tools.ts'),'utf8');
  // Historical docs may describe the deleted name but no callable declaration,
  // permission route or execution handler can bring it back.
  assert.doesNotMatch(source,/define\(['"]edit_spica_v2_graph['"]/);
  assert.doesNotMatch(source,/name\s*===\s*['"]edit_spica_v2_graph['"]/);
  const editing=api.spicaTools.filter(t=>/^edit_spica.*graph$/.test(t.function.name));
  assert.deepEqual(Array.from(editing,t=>t.function.name),['edit_spica_graph']);
});
