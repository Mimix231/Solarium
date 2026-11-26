'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const vm=require('node:vm');const root=path.resolve(__dirname,'..');const compiled=path.join(root,'.spica-phase05-test/spica');
const {compileWarehouseManifestV2,fromDraftRecords,builtInWarehouseCategories}=require(path.join(compiled,'catalog/manifest-v2.js'));
const {catalogManifests}=require(path.join(compiled,'catalog/manifests.js'));
const {inspectSpicaParameters}=require(path.join(compiled,'inspect-params.js'));
const {starterGraph,changeGraph}=require(path.join(compiled,'graph.js'));
const {capabilities,recipeCatalog}=require(path.join(compiled,'program.js'));
const {styleProperties,styleStates}=require(path.join(compiled,'appearance.js'));

const definitions=(record=null)=>{
  const state={writes:0,record};
  const ts=(()=>{try{return require('typescript')}catch{return require(require('node:child_process').execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()+'/typescript')}})();
  const transpile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const editSchemas={exports:{}};
  vm.runInNewContext(transpile('src/spica/edit-schemas.ts'),{module:editSchemas,exports:editSchemas.exports,require:()=>({}),console});
  const validatorModule={exports:{}};
  vm.runInNewContext(transpile('src/engine/intelligence/tool-validation.ts'),{module:validatorModule,exports:validatorModule.exports,require:()=>({}),console});
  const mocks={
    '../engine/intelligence/tool-contract-intelligence':require('./tool-contract-mock.cjs'),
    '../engine/intelligence/tool-validation':validatorModule.exports,
    './edit-schemas':editSchemas.exports,
    './graph-v2/transactions':{applySpicaGraphTransaction:()=>({})},
    './graph-v2/edit-adapter':{expandSpicaV2Edits:edits=>edits,assertSpicaRuntimeNodeContracts:()=>{}},
    './runtime/blocks/registry':{getBlock:()=>undefined},
    './inspect-params-v2':{inspectSpicaV2Parameters:()=>({})},

    './inspect-tool-view':require('./inspect-tool-view-source.cjs'),
    '../engine/creator':{inspectProjectEnvironment:async()=>({rootEntryCount:0})},
    './repository':{SpicaRepository:class {
      async read(){return state.record;}
      async update(revision,edits){
        if(!state.record||state.record.data.revision!==revision)throw Error('stale');
        const next=changeGraph(state.record.data.graph,edits);state.writes++;
        state.record={...state.record,data:{...state.record.data,graph:next,revision:revision+1}};return state.record;
      }
    }},
    './graph':{stableGraphJson:JSON.stringify,changeGraph,collectionUpgrade:()=>[],GraphEditError:Error},
    './appearance':{styleChanges:()=>[],styleProperties,styleStates,styleTargets:()=>[],styleValues:()=>[],supportedProperties:()=>[],supportedStates:()=>[]},
    './program':{capabilities,recipeCatalog},
    './warehouse':{searchSpicaWarehouse:()=>[],inspectSpicaComponent:()=>({})},
    './research-tools':{spicaResearchTools:[]},
    './professionalism':{auditSpicaDesign:()=>({checked:1,passed:true,findings:[],errors:0,warnings:0})},
    './graph-v2/validation':{validateSpicaGraphV2:()=>({valid:true,errors:[],warnings:[]})},
    './runtime/discovery':{searchExecutableBlocks:()=>({total:0,results:[]}),inspectExecutableBlock:()=>({})},
    './runtime/composition':{previewSpicaComposition:()=>({graph:{},diagnostics:{valid:true,errors:[],warnings:[]}})},
    './runtime/registry':{listRuntimeBlocks:()=>[],getRuntimeBlock:()=>undefined},
    './runtime/executor':{executeSpicaGraphV2:async()=>({state:'failed'})},
    './inspect-params':{inspectSpicaParameters},
    './catalog/unified':{inspectSpicaCapability:async()=>({}),searchSpicaCapabilities:async()=>({candidates:[]})},
    './catalog/client':{listCatalogCategories:async()=>[]},
    './catalog/categories':{warehouseCategories:builtInWarehouseCategories(),warehouseCapacity:350000},
  };
  const mod={exports:{}};
  vm.runInNewContext(transpile('src/spica/tools.ts'),{module:mod,exports:mod.exports,require:id=>{
    if(id==='./tool-aliases')return require(path.join(path.join(root,'.spica-phase05-test'),'spica/tool-aliases.js'));
    if(id==='./construction-insights')return require(path.join(path.join(root,'.spica-phase05-test'),'spica/construction-insights.js'));
    if(Object.hasOwn(mocks,id))return mocks[id];throw Error('Unmocked dependency: '+id);
  },TextEncoder,AbortController,DOMException,structuredClone,console}, {filename:'src/spica/tools.ts'});
  const validator={exports:{}};
  vm.runInNewContext(transpile('src/engine/intelligence/tool-validation.ts'),{module:validator,exports:validator.exports,require:()=>({}),console});
  return {tools:mod.exports,validate:validator.exports.validateToolArguments,state};
};

test('35 immutable 10K categories and safe user extensions remain distinct',()=>{
  const categories=builtInWarehouseCategories();assert.equal(categories.length,35);
  assert.equal(categories.reduce((n,c)=>n+c.capacity,0),350000);
  for(const [n,label] of [[5,'Variables, collections, and state'],[27,'Web research, retrieval, and evidence'],[29,'Styling'],[30,'Functions'],[31,'Layout'],[32,'Visual Appearance'],[33,'Interface Architecture'],[34,'UI Components'],[35,'Professionalism']]) assert.equal(categories[n-1].title,label);
  const extended=[...categories,{id:36,slug:'my-elements',title:'My Elements',capacity:10000,origin:'user'}];
  const fixture={format:2,source:'test',categories:extended,entries:[]};
  assert.equal(compileWarehouseManifestV2(fixture).categories.length,36);
  assert.throws(()=>compileWarehouseManifestV2({...fixture,categories:[...extended,{...extended[1]}]}),/duplicate/i);
  assert.throws(()=>compileWarehouseManifestV2({...fixture,categories:[...categories.slice(1),extended[35]]}),/built-in warehouse category/i);
});

test('versioned descriptor compiler validates dependencies, replacement locks and cycles',()=>{
  const base={format:2,source:'example',categories:builtInWarehouseCategories(),entries:[
    {id:'spica.user.examples.alpha',version:'1.0.0',category:34,family:'candidate-blocks',kind:'primitive',maturity:'draft',title:'Alpha',summary:'Test metadata',tags:['ui'],reference:'test'},
    {id:'spica.user.examples.beta',version:'1.0.0',category:34,family:'candidate-blocks',kind:'composition',maturity:'draft',title:'Beta',summary:'Test metadata',tags:['ui'],reference:'test',dependencies:[{id:'spica.user.examples.alpha',version:'1.0.0'}]},
  ]};
  const result=compileWarehouseManifestV2(base);assert.deepEqual(result.orderedIds,['spica.user.examples.alpha@1.0.0','spica.user.examples.beta@1.0.0']);
  assert.equal(result.entries.every(x=>x.maturity==='draft'),true);
  assert.equal(result.revisionMaterial,compileWarehouseManifestV2({...base,entries:[...base.entries].reverse()}).revisionMaterial);
  assert.throws(()=>compileWarehouseManifestV2({...base,entries:[base.entries[0],{...base.entries[1],dependencies:[{id:'spica.missing',version:'1.0.0'}]}]}),/Missing locked/);
  assert.throws(()=>compileWarehouseManifestV2({...base,entries:[{...base.entries[0],dependencies:[{id:'spica.user.examples.beta',version:'1.0.0'}]},base.entries[1]]}),/cycle/i);
  assert.throws(()=>compileWarehouseManifestV2({...base,entries:[base.entries[0],base.entries[0]]}),/duplicate/i);
  assert.throws(()=>compileWarehouseManifestV2({...base,entries:[{...base.entries[0],maturity:'deprecated',replacedBy:{id:'spica.unknown',version:'1.0.0'}},base.entries[1]]}),/replacement/i);
});

test('checked-in catalog compiles into stable metadata-only descriptors, never modules',()=>{
  const seed=catalogManifests();assert.equal(seed.categories.length,35);assert.equal(seed.manifestVersion,2);
  assert.equal(seed.intents.length * seed.domains.length * seed.policies.length,10000);
  assert.ok(seed.records.length>600);
  const compiled=compileWarehouseManifestV2(fromDraftRecords(seed.records,'solarium-bundled'));
  assert.equal(compiled.entries.length,seed.records.length);
  assert.ok(compiled.entries.every(e=>e.maturity==='draft' && typeof e.reference==='string'));
});

test('inspect_params gives exact supported operation examples using live current IDs',()=>{
  const graph=starterGraph('Notes','notes');const revision=10;
  const summary=inspectSpicaParameters(graph,revision);
  assert.equal(summary.revision,10);assert.ok(summary.operations.includes('put_screen'));
  assert.ok(summary.operations.includes('add_setting'));
  const screen=inspectSpicaParameters(graph,revision,'put_screen');
  assert.equal(screen.example.revision,revision);
  assert.ok(screen.constraints.some(v=>v.includes('No settings view')));
  assert.ok(screen.context.collections.some(c=>c.id==='notes'));
  const field=inspectSpicaParameters(graph,revision,'add_record_field');
  assert.ok(field.constraints.some(v=>v.includes('No date'))===false);
  assert.deepEqual(field.context.fieldTypes,['text','boolean','reference','number','choice']);
  assert.equal(inspectSpicaParameters(graph,revision,'invalid').error,'UNKNOWN_OPERATION');
});

test('inspector examples apply cleanly, or explicitly report missing prerequisites',()=>{
  const graphs=[starterGraph('Notes','notes'),changeGraph(starterGraph('Notes','notes'),[{op:'install_recipe',recipe:'quick_capture'}])];
  for (const graph of graphs) {
    for (const op of inspectSpicaParameters(graph,10).operations) {
      const info=inspectSpicaParameters(graph,10,op);
      if (!info.available) {
        assert.equal(info.example,null,op);
        assert.ok(info.blockers.length,op);
        continue;
      }
      assert.ok(info.example,op);
      assert.doesNotThrow(()=>changeGraph(graph,info.example.edits),op);
    }
  }
});

test('tool selector reveals contracts and offers dry-run before saving',()=>{
  const {tools}=definitions();const allowed=tools.spicaTools;
  const selection=(last)=>Array.from(tools.selectSpicaTools(allowed,last,true,false,false,true,{hasGraph:true,canEdit:true}),tool=>tool.function.name);
  assert.ok(selection('read_spica_graph').includes('inspect_params'));
  assert.ok(!selection('read_spica_graph').includes('edit_spica_graph'));
  assert.ok(selection('inspect_params').includes('validate_spica_edit'));
  assert.ok(selection('validate_spica_edit').includes('edit_spica_graph'));
  assert.ok(!selection('edit_spica_graph').includes('export_spica_app'));
  assert.ok(!selection(null).includes('edit_spica_graph'));
  assert.ok(!selection('read_spica_graph').includes('inspect_spica_tool'),'Do not reread the same general inspector in every schema-1 edit turn');
  assert.ok(selection('read_spica_graph').includes('inspect_params'),'Expose the actual operation-specific editing schema');
  assert.ok(selection('check_spica_tool_call').includes('inspect_params'),'A non-authorized preflight cannot open a mutation; inspect actual edit parameters again');
  const edit=tools.spicaTools.find(t=>t.function.name==='edit_spica_graph');
  const validation=tools.spicaTools.find(t=>t.function.name==='validate_spica_edit');
  assert.deepEqual(JSON.stringify(tools.spicaToolContract(edit,true).function.parameters),JSON.stringify(tools.spicaToolContract(validation,true).function.parameters));
});

test('tool schemas expose settings and reject invented views, invalid record types and unknown properties',()=>{
  const {tools,validate}=definitions();
  const def=tools.spicaToolContract(tools.spicaTools.find(t=>t.function.name==='edit_spica_graph'),true);
  const valid={revision:10,edits:[{op:'add_page',id:'preferences',label:'Preferences'},
    {op:'add_setting',page:'preferences',key:'show_tips',label:'Show tips',initial:true,type:'boolean'}]};
  assert.equal(validate('edit_spica_graph',valid,[def]).ok,true);
  const bad=validate('edit_spica_graph',{revision:10,edits:[{op:'put_screen',screen:{id:'bad',label:'Bad',view:'settings',collection:'notes',unexpected:true}}]},[def]);
  assert.equal(bad.ok,false);assert.match(bad.error.message,/Choose list \| form|Unexpected property/);
  const invalidType=validate('edit_spica_graph',{revision:10,edits:[{op:'add_record_field',collection:'notes',field:{key:'created_at',label:'Date',type:'date'}}]},[def]);
  assert.equal(invalidType.ok,false);assert.match(invalidType.error.message,/text \| boolean \| reference \| number \| choice/);
});

test('dry-run validation previews valid atomic edits without modifying the original graph',()=>{
  const graph=starterGraph('Notes','notes');const before=JSON.stringify(graph);
  const {tools}=definitions();
  const mockRecord={data:{revision:10,graph}};
  const changes={revision:10,edits:[{op:'add_record_field',collection:'notes',field:{key:'priority',label:'Priority',type:'number'}}]};
  const answer=tools.reviewSpicaEdit(mockRecord,changes);
  assert.equal(answer.ok,true,answer.result?.message);
  assert.equal(JSON.stringify(graph),before);
  assert.equal(changeGraph(graph,changes.edits).collection.fields.some(f=>f.key==='priority'),true);
  const invalid=tools.reviewSpicaEdit(mockRecord,{revision:10,edits:[{op:'add_record_field',collection:'notes',field:{key:'title',label:'Duplicate',type:'text'}}]});
  assert.equal(invalid.ok,false);assert.match(invalid.result.message,/already exists/);
});

test('native catalog commands stay metadata-only and registered with Tauri',()=>{
  const rust=fs.readFileSync(path.join(root,'src-tauri/src/spica_catalog.rs'),'utf8');
  const lib=fs.readFileSync(path.join(root,'src-tauri/src/lib.rs'),'utf8');
  for(const name of ['spica_catalog_prepare','spica_catalog_search','spica_catalog_inspect','spica_catalog_register_category','spica_catalog_categories','spica_catalog_add_drafts']) {
    assert.match(rust,new RegExp('pub async fn '+name+'\\('));assert.ok(lib.includes('spica_catalog::'+name));
  }
  assert.match(rust,/WHERE category <= 35/,'seed upgrade must leave user descriptors in place');
  assert.match(rust,/incremental FTS/i);
  assert.doesNotMatch(rust,/pub async fn spica_catalog_execute/);
});


test('the actual Spark inspect/dry-run/save handlers prevent attempted duplicate-field writes',async()=>{
  const graph=starterGraph('Notes','notes');const record={data:{revision:10,graph},title:'Notes'};
  const {tools,state}=definitions(record);
  const project={id:'demo',folder:null};const execution={webEnabled:false,spicaProgram:true};
  const inspect=JSON.parse(await tools.executeSpicaTool('inspect_params',{operation:'add_record_field'},project,execution));
  assert.equal(inspect.revision,10);assert.equal(inspect.operation,'add_record_field');
  assert.ok(inspect.context.collections[0].fields.some(f=>f.key==='title'));
  assert.equal(state.writes,0);
  const duplicate={revision:10,edits:[{op:'add_record_field',collection:'notes',field:{key:'title',label:'Duplicate',type:'text'}}]};
  const rejected=JSON.parse(await tools.executeSpicaTool('validate_spica_edit',duplicate,project,execution));
  assert.equal(rejected.ok,false);assert.match(rejected.message,/already exists/);assert.equal(state.writes,0);
  const good={revision:10,edits:[{op:'add_record_field',collection:'notes',field:{key:'bookmarked',label:'Bookmarked',type:'boolean',initial:false}}]};
  const preview=JSON.parse(await tools.executeSpicaTool('validate_spica_edit',good,project,execution));
  assert.equal(preview.ok,true);assert.equal(preview.next,'edit_spica_graph');assert.equal(state.writes,0);
  const saved=JSON.parse(await tools.executeSpicaTool('edit_spica_graph',good,project,execution));
  assert.equal(saved.saved,true);assert.equal(saved.revision,11);assert.equal(state.writes,1);
  assert.equal(state.record.data.graph.collection.fields.find(f=>f.key==='bookmarked').initial,false);
});
