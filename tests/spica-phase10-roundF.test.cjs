'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'..');const at=name=>require(path.join(root,'.spica-phase10-roundF-test',name+'.js'));
const {explicitSpicaToolAliases,resolveSpicaToolName,installVerifiedSpicaToolAliases,
 aliasNamesForTool,normalizeSpicaToolAliasArguments}=at('spica/tool-aliases');
const {getRuntimeBlock,listRuntimeBlocks}=at('spica/runtime/registry');
const {inspectGraphImpact,runSpicaBehaviorAssertions,inspectRuntimeRegistryHealth}=at('spica/construction-insights');
const {emptySpicaGraphV2}=at('spica/graph-v2/types');
const {previewSpicaComposition}=at('spica/runtime/composition');
const {executeSpicaGraphV2}=at('spica/runtime/executor');
const {SpicaMemoryStore}=at('spica/runtime/store');
const compose=(nodes,connections=[])=>previewSpicaComposition(emptySpicaGraphV2('roundf.test','Round F'),{nodes,connections}).graph;
const n=(id,block,config={})=>({id,blockId:'spica.runtime.'+block,config});
const edge=(from,output,to,input)=>({from,output,to,input});
const graph=(nodeList,connections=[])=>compose(nodeList,connections);
const execute=(g,opts={})=>executeSpicaGraphV2(g,{target:'desktop',grants:new Set(),...opts});
const registryTools=Object.values(explicitSpicaToolAliases).filter((n,i,a)=>a.indexOf(n)===i).map(name=>({function:{name}}));

test('F1: every explicit alias resolves to a declared callable tool and never registers a clone',()=>{
 installVerifiedSpicaToolAliases(registryTools);
 assert.ok(Object.keys(explicitSpicaToolAliases).length>=60);
 assert.equal(Object.keys(explicitSpicaToolAliases).length,new Set(Object.keys(explicitSpicaToolAliases)).size);
 for(const [name,target] of Object.entries(explicitSpicaToolAliases)){
   assert.equal(resolveSpicaToolName(name),target);
   assert.ok(registryTools.some(item=>item.function.name===target),`${name} → ${target}`);
   assert.ok(!registryTools.some(item=>item.function.name===name),`Alias ${name} must not register a new handler`);
 }
 assert.equal(resolveSpicaToolName('new_random_tool_123'),'new_random_tool_123');
 assert.ok(aliasNamesForTool('edit_spica_graph').includes('spica_graph_edit'));
});
test('F1: exact repeated UNKNOWN_CHECK_TARGET alias canonicalizes and validates using REAL resolver inputs',()=>{
 assert.equal(resolveSpicaToolName('discover_compatible_blocks'),'resolve_spica_capabilities');
 assert.deepEqual(normalizeSpicaToolAliasArguments('discover_compatible_blocks',
   {query:'recent notes Markdown',limit:4}),{queries:['recent notes Markdown'],limitPerQuery:4});
 assert.deepEqual(normalizeSpicaToolAliasArguments('discover_compatible_blocks',
   {requirements:['record list','markdown'],target:'desktop'}),{queries:['record list','markdown'],target:'desktop'});
 installVerifiedSpicaToolAliases(registryTools);
 assert.equal(resolveSpicaToolName('discover_compatible_blocks'),'resolve_spica_capabilities');
 assert.equal(resolveSpicaToolName('spica_graph_edit'),'edit_spica_graph');
});
test('F1: auto aliases are generated from registered names only and ambiguous names are not executed',()=>{
 installVerifiedSpicaToolAliases(registryTools);
 assert.equal(resolveSpicaToolName('read-spica-graph'),'read_spica_graph');
 assert.equal(resolveSpicaToolName('ReadSpicaGraph'),'read_spica_graph');
 assert.equal(resolveSpicaToolName('madeUpBlock'),'madeUpBlock');
 assert.throws(()=>installVerifiedSpicaToolAliases([{function:{name:'spica_graph_edit'}}]),/Invalid SPICA tool alias/);
});
test('F3: 18 new runtime blocks are unique, source-backed, validated and executable',()=>{
 const names=['ui_tooltip','ui_context_menu','ui_breadcrumbs','ui_tree_view','ui_range_slider','ui_file_picker',
  'ui_resizable_panel','ui_keyboard_shortcut','record_exists','record_lookup_many','record_bulk_upsert',
  'array_zip','array_chunk','array_index_by','text_parse_json','text_format_json','validate_assertion','url_parse'];
 const all=listRuntimeBlocks();assert.ok(all.length>=166);
 assert.equal(new Set(all.map(b=>b.id)).size,all.length);
 for(const name of names){
   const block=getRuntimeBlock('spica.runtime.'+name,'1');assert.ok(block,`Missing ${name}`);
   assert.ok(block.configSchema,`Missing config schema ${name}`);
   assert.ok(block.inputs&&block.outputs&&typeof block.execute==='function');
   assert.doesNotThrow(()=>block.validateConfig(block.exampleConfig??{}),name);
   const sourceDir=path.join(root,'src/spica/runtime/blocks');
   // One canonical file per runtime block; generated registry imports the file.
   assert.ok(fs.readFileSync(path.join(root,'src/spica/runtime/registry.generated.ts'),'utf8').includes(`/${name.replaceAll('_','-')}'`),name);
   assert.ok(fs.existsSync(sourceDir));
 }
});
test('F3: UI blocks produce live renderable descriptors, not catalog-only definitions',async()=>{
 for(const [name,config] of [['ui_tooltip',{text:'Hint'}],['ui_breadcrumbs',{items:['Home','Notes']}],
  ['ui_context_menu',{items:['Edit','Delete']}],['ui_range_slider',{}],['ui_file_picker',{}],
  ['ui_keyboard_shortcut',{shortcut:'ctrl+k'}],['ui_resizable_panel',{}],['ui_tree_view',{}]]){
   const block=getRuntimeBlock('spica.runtime.'+name,'1');
   // Actual execution may require input data; match the registered required ports.
   const inputs={};for(const p of block.inputs){if(p.required){if(p.type.kind==='string')inputs[p.id]='text';else if(p.type.kind==='array')inputs[p.id]=[];else if(p.type.kind==='boolean')inputs[p.id]=true;else if(p.type.kind==='number')inputs[p.id]=0;else inputs[p.id]={};}}
   const ctx={runId:'f',nodeId:'n',target:'desktop',signal:new AbortController().signal,storage:{},interaction:{read:()=>undefined,write:()=>{},event:()=>undefined},requirePermission:()=>{throw Error('No permission allowed');}};
   const output=await block.execute(ctx,inputs,{...block.exampleConfig,...config});
   assert.ok(output.view&&typeof output.view==='object',`${name}: descriptor missing`);
   assert.equal(output.view.renderer,'spica.ui.'+name,`${name}: renderer identity mismatch`);
 }
});
test('F3: JSON parser and array transform run through real graph executor',async()=>{
 const g=graph([n('raw','text_value',{value:'{"status":"ok","count":3}'}),n('parsed','text_parse_json')],
  [edge('raw','value','parsed','text')]);
 const out=await execute(g);assert.equal(out.state,'passed',out.error);
 assert.equal(out.outputs.parsed.ok,true);assert.deepEqual(out.outputs.parsed.value,{status:'ok',count:3});
 const bad=graph([n('raw','text_value',{value:'{not-json'}),n('parsed','text_parse_json')],
  [edge('raw','value','parsed','text')]);
 const fail=await execute(bad);assert.equal(fail.state,'passed');assert.equal(fail.outputs.parsed.ok,false);
});
test('F3: new record existence block enforces read grant and returns real store state',async()=>{
 const store=new SpicaMemoryStore();const tx=await store.begin();await tx.put('notes','note_a',{title:'A'});await tx.commit();
 const g=graph([n('exists','record_exists',{collection:'notes',key:'note_a'})]);
 const deny=await execute(g,{store});assert.equal(deny.state,'failed');
 const allow=await execute(g,{store,grants:new Set(['records.read'])});assert.equal(allow.state,'passed',allow.error);
 assert.equal(allow.outputs.exists.exists,true);
});
test('F3: batch upsert writes real records atomically and enforces permission gates',async()=>{
 const store=new SpicaMemoryStore();
 const items=[{key:'note_a',value:{title:'Alpha'}},{key:'note_b',value:{title:'Beta'}}];
 const graphOk=graph([n('items','array_value',{items}),n('save','record_bulk_upsert',{collection:'notes'})],[edge('items','items','save','items')]);
 const denied=await execute(graphOk,{store});assert.equal(denied.state,'failed');
 assert.equal(store.read('notes','note_a'),undefined);
 const permitted=await execute(graphOk,{store,grants:new Set(['records.write'])});
 assert.equal(permitted.state,'passed',permitted.error);assert.equal(permitted.outputs.save.count,2);
 assert.deepEqual(store.read('notes','note_b'),{title:'Beta'});
 // The block rejects the entire batch before any writes if a key is invalid.
 const invalid=graph([n('items','array_value',{items:[{key:'valid_key',value:{v:1}},{key:'NOT VALID',value:{v:2}}]}),
   n('save','record_bulk_upsert',{collection:'notes'})],[edge('items','items','save','items')]);
 const failed=await execute(invalid,{store,grants:new Set(['records.write'])});
 assert.equal(failed.state,'failed');assert.equal(store.read('notes','valid_key'),undefined);
});
test('F3: assert-failure never persists earlier transactional writes',async()=>{
 const store=new SpicaMemoryStore();
 const g=graph([
   n('items','array_value',{items:[{key:'note_c',value:{title:'C'}}]}),
   n('save','record_bulk_upsert',{collection:'notes'}),
   n('zero','number_value',{value:0}),
   n('cmp','number_compare'),
   n('assert','validate_assertion',{message:'The batch must contain no records'})
 ],[edge('items','items','save','items'),edge('save','count','cmp','a'),edge('zero','value','cmp','b'),edge('cmp','equal','assert','condition')]);
 const result=await execute(g,{store,grants:new Set(['records.write'])});
 assert.equal(result.state,'failed');assert.equal(store.read('notes','note_c'),undefined);
});

test('F2: impact inspector returns only bounded actual connected nodes',()=>{
 const g=graph([n('a','text_value',{value:'Hello'}),n('b','text_length')],[edge('a','value','b','value')]);
 const info=inspectGraphImpact(g,['a'],'downstream',2);
 assert.equal(info.ok,true);assert.equal(info.impacted.length,2);assert.equal(info.connections.length,1);
 assert.equal(inspectGraphImpact(g,['notthere']).code,'UNKNOWN_GRAPH_NODES');
});
test('F2: isolated behavior checker verifies real outputs and reports failure without pretending a native build',async()=>{
 const g=graph([n('text','text_value',{value:'Hello'}),n('len','text_length')],[edge('text','value','len','value')]);
 const check=await runSpicaBehaviorAssertions(g,[{nodeId:'text',port:'value',condition:'equals',expected:'Hello'},
  {nodeId:'len',port:'length',condition:'equals',expected:5}]);
 assert.equal(check.ok,true,JSON.stringify(check));assert.equal(check.total,2);
 const bad=await runSpicaBehaviorAssertions(g,[{nodeId:'text',port:'value',condition:'equals',expected:'Wrong'}]);
 assert.equal(bad.ok,false);assert.equal(bad.passed,0);
 const missing=await runSpicaBehaviorAssertions(g,[{nodeId:'text',port:'value',condition:'equals'}]);
 assert.equal(missing.ok,false);assert.equal(missing.checks[0].code,'MISSING_EXPECTED_VALUE');
});
test('F2: registry health checks registered contracts without requiring a project graph',()=>{
 const health=inspectRuntimeRegistryHealth(undefined,200);
 assert.equal(health.checked,listRuntimeBlocks().length);assert.equal(health.registeredTotal,listRuntimeBlocks().length);
 const aliasesBroken=health.findings.filter(f=>f.code==='BROKEN_ALIAS');
 assert.deepEqual(aliasesBroken,[]);
 assert.equal(health.ok,true,JSON.stringify(health.findings.slice(0,6)));
});
test('F5: Cosmic interface uses code components, never a flattened UI image',()=>{
 const base=path.join(root,'src/ui-themes/cosmic');
 const banner=fs.readFileSync(path.join(base,'CosmicBuildBanner.tsx'),'utf8');
 const css=fs.readFileSync(path.join(base,'cosmic.banner.css'),'utf8');
 const existing=fs.readFileSync(path.join(base,'cosmic.css'),'utf8');
 const chat=fs.readFileSync(path.join(root,'src/views/Chat.tsx'),'utf8');
 assert.match(banner,/<svg/);assert.match(banner,/onOpenWorkbench/);assert.match(banner,/onOpenPlan/);
 assert.match(css,/cosmic-build-banner/);assert.match(css,/box-shadow/);
 assert.doesNotMatch(existing,/url\(['"]?\.\/assets\/nebula-floor\.webp/);
 assert.match(chat,/CosmicBuildBanner/);
 assert.ok(!fs.existsSync(path.join(root,'src/themes/cosmic')));
});
