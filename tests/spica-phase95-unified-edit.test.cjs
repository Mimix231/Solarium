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
const {expandSpicaV2Edits}=compiled('spica/graph-v2/edit-adapter.js');
const {getRuntimeBlock,listRuntimeBlocks}=compiled('spica/runtime/registry.js');
const {inspectExecutableBlock}=compiled('spica/runtime/discovery.js');
const {unifiedSpicaEditParameters,spicaScopedEditParameters}=compiled('spica/edit-schemas.js');
const {validateToolArguments}=compiled('engine/intelligence/tool-validation.js');
const {inspectSpicaV2Parameters}=compiled('spica/inspect-params-v2.js');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const transpile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const contract={exports:{}};
vm.runInNewContext(transpile('src/engine/intelligence/tool-contract-intelligence.ts'),{
 module:contract,exports:contract.exports,require:id=>{
 if(id==='./tool-validation')return {validateToolArguments};throw Error('Unmocked contract dependency: '+id);
 },console});
const {ToolContractRegistry,ToolCallValidator}=contract.exports;
const styleProperties={background:{},text:{}};
let current={title:'Notes',version:1,data:{revision:11,graph:starterGraph('Notes','notes'),graphV2:emptySpicaGraphV2('demo.notes','Notes')}};
const sampleGraph=()=>current;
class Repository {
 async read(){return current;}
 async updateV2(revision,edits){
  assert.equal(revision,current.data.revision);
  const next=applySpicaGraphTransaction(current.data.graphV2,edits,{resolveBlock:(id,version)=>Boolean(getRuntimeBlock(id,version))});
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
 '../engine/creator':{inspectProjectEnvironment:async()=>({rootEntryCount:0})},
 './repository':{SpicaRepository:Repository},
 './graph':{changeGraph,collectionUpgrade,GraphEditError,stableGraphJson},
 './appearance':{styleChanges:()=>[],styleProperties,styleStates:['base'],styleTargets:()=>[],styleValues:()=>[],supportedProperties:()=>[],supportedStates:()=>[]},
 './program':{capabilities:[],recipeCatalog:[]},
 './graph-v2/validation':{validateSpicaGraphV2},
 './graph-v2/transactions':{applySpicaGraphTransaction},
 './graph-v2/edit-adapter':{expandSpicaV2Edits},
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
