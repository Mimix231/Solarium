'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const runtime=path.resolve(__dirname,'../.spica-phase07-test/spica');
const {getRuntimeBlock,listRuntimeBlocks,isRuntimeBlock}=require(path.join(runtime,'runtime/registry.js'));
const {runtimeBlockAliases}=require(path.join(runtime,'runtime/aliases.js'));
const {searchExecutableBlocks,inspectExecutableBlock}=require(path.join(runtime,'runtime/discovery.js'));
const {SpicaMemoryStore}=require(path.join(runtime,'runtime/store.js'));
const {emptySpicaGraphV2}=require(path.join(runtime,'graph-v2/types.js'));
const {previewSpicaComposition}=require(path.join(runtime,'runtime/composition.js'));
const {executeSpicaGraphV2}=require(path.join(runtime,'runtime/executor.js'));
const compose=(nodes,connections=[])=>previewSpicaComposition(emptySpicaGraphV2('integration.session','Integration'),{nodes,connections}).graph;
const source=(id,blockId,config={})=>({id,blockId,config});
const edge=(from,output,to,input)=>({from,output,to,input});
const run=(graph,extra={})=>executeSpicaGraphV2(graph,{target:'desktop',grants:new Set(),...extra});

test('all curated runtime aliases resolve to registered executable blocks without creating duplicate adapters',()=>{
 const registry=listRuntimeBlocks();assert.equal(new Set(registry.map(x=>x.id)).size,registry.length);
 for(const [alias,id] of Object.entries(runtimeBlockAliases)) {
   assert.equal(getRuntimeBlock(alias,'1'),getRuntimeBlock(id,'1'),alias);
   assert.equal(isRuntimeBlock(alias,'1'),true);
 }
 assert.equal(getRuntimeBlock('search_spica_runtime_blocks','1'),undefined);
 assert.equal(getRuntimeBlock('edit_spica_graph','1'),undefined);
 assert.equal(getRuntimeBlock('totally_guessed_notes_manager','1'),undefined);
 assert.ok(registry.some(x=>x.id==='spica.runtime.state_update'));
 assert.ok(registry.some(x=>x.id==='spica.runtime.ui_selectable_list'));
 for(const block of registry.filter(x=>x.configSchema)) {
   assert.equal(block.configSchema.additionalProperties,false);
   assert.ok((block.configSchema.required??[]).every(k=>Object.hasOwn(block.configSchema.properties??{},k))); // JSON Schema required is optional; [] means no required config
   assert.doesNotThrow(()=>block.validateConfig(block.exampleConfig??{}),`Invalid example for ${block.id}`);
 }
});

test('aliases appear as real canonical IDs during discovery and graph construction',()=>{
 const found=searchExecutableBlocks({query:'MarkdownEditorBlock',limit:20});
 assert.ok(found.results.some(r=>r.id==='spica.runtime.ui_markdown_editor'));
 const inspected=inspectExecutableBlock('spica.runtime.markdown_renderer');
 assert.equal(inspected.id,'spica.runtime.ui_markdown');
 assert.equal(inspected.resolvedAlias,true);
 assert.equal(inspectExecutableBlock('spica.runtime.ui_search_field').configSchema.required[0],'eventId');
 assert.equal(inspectExecutableBlock('spica.runtime.ui_markdown_editor').configSchema.properties.eventId.type,'string');
 assert.equal(inspectExecutableBlock('spica.runtime.ui_screen_router').interaction.sourceBlockId,'spica.runtime.ui_event_binding');
 const graph=compose([source('notes','notes_list',{collection:'notes',limit:5})]);
 assert.equal(graph.nodes[0].block.id,'spica.runtime.record_list');
});

test('UI event changes Markdown state through typed graph edges and survives subsequent preview cycles',async()=>{
 const graph=compose([
  source('state','spica.runtime.state_value',{key:'draft',initial:''}),
  source('editor','MarkdownEditorBlock',{label:'Body',eventId:'edit_note'}),
  source('change','spica.runtime.ui_event_binding',{eventId:'edit_note'}),
  source('update','spica.runtime.state_update',{key:'draft'}),
 ],[edge('state','value','editor','text'),edge('change','trigger','update','trigger')]);
 const session=new Map();
 const first=await run(graph,{interactionState:session});
 assert.equal(first.state,'passed',first.error);
 assert.equal(first.outputs.editor.view.text,'');
 assert.equal(first.outputs.editor.view.eventId,'edit_note');
 assert.equal(session.size,0);
 const changed=await run(graph,{interactionState:session,events:{edit_note:'**A saved Markdown draft**'}});
 assert.equal(changed.state,'passed',changed.error);
 assert.equal(session.get('draft'),'**A saved Markdown draft**');
 const reopened=await run(graph,{interactionState:session});
 assert.equal(reopened.state,'passed',reopened.error);
 assert.equal(reopened.outputs.editor.view.text,'**A saved Markdown draft**');
});

test('interaction state is rolled back if a later, authorized record write fails',async()=>{
 const graph=compose([
  source('change','spica.runtime.ui_event_binding',{eventId:'edit_note'}),
  source('update','spica.runtime.state_update',{key:'draft'}),
  source('key','spica.runtime.text_value',{value:'invalid-key'}),
  source('value','spica.runtime.record_value',{record:{title:'Forbidden'}}),
  source('save','spica.runtime.record_write',{collection:'notes'}),
 ],[edge('change','trigger','update','trigger'),edge('key','value','save','key'),edge('value','record','save','value')]);
 const session=new Map([['draft','original']]);
 const failed=await run(graph,{interactionState:session,events:{edit_note:'should not persist'},grants:new Set(['records.write'])});
 assert.equal(failed.state,'failed');
 assert.equal(session.get('draft'),'original');
});

test('real collection records can be retrieved, sorted and rendered as selectable rows with stable keys',async()=>{
 const store=new SpicaMemoryStore();const tx=await store.begin();
 await tx.put('notes','old',{title:'Old',updatedAt:'2026-01-01T12:00:00Z'});
 await tx.put('notes','new',{title:'New',updatedAt:'2026-11-12T12:00:00Z'});await tx.commit();
 const graph=compose([
  source('records','notes_list',{collection:'notes',limit:20}),
  source('sort','spica.runtime.array_sort_field',{field:'updatedAt',descending:true}),
  source('list','spica.runtime.ui_selectable_list',{eventId:'select_note',labelField:'title',keyField:'key'}),
 ],[edge('records','items','sort','items'),edge('sort','items','list','items')]);
 const denied=await run(graph,{store});assert.equal(denied.state,'failed');
 const allowed=await run(graph,{store,grants:new Set(['records.read'])});
 assert.equal(allowed.state,'passed',allowed.error);
 assert.equal(allowed.outputs.list.view.eventId,'select_note');
 assert.deepEqual(allowed.outputs.list.view.items.map(row=>row.key),['new','old']);
});

test('record_timestamps preserves createdAt; settings_store requires explicit write grant and event',async()=>{
 const stamped=compose([
  source('record','spica.runtime.record_value',{record:{title:'One',createdAt:'2020-01-01T00:00:00Z'}}),
  source('time','spica.runtime.record_timestamps',{}),
 ],[edge('record','record','time','record')]);
 const result=await run(stamped);assert.equal(result.state,'passed',result.error);
 assert.equal(result.outputs.time.record.createdAt,'2020-01-01T00:00:00Z');
 assert.ok(!Number.isNaN(Date.parse(result.outputs.time.record.updatedAt)));
 const settings=compose([source('ev','spica.runtime.ui_event_binding',{eventId:'change_setting'}),
  source('save','spica.runtime.settings_store',{key:'view_mode'})],[edge('ev','trigger','save','trigger')]);
 const store=new SpicaMemoryStore();
 const before=await run(settings,{store,events:{change_setting:'compact'}});
 assert.equal(before.state,'failed');
 const permitted=await run(settings,{store,events:{change_setting:'compact'},grants:new Set(['records.write'])});
 assert.equal(permitted.state,'passed',permitted.error);
 assert.deepEqual(store.read('settings','view_mode'),{value:'compact'});
 const idle=await run(settings,{store,grants:new Set(['records.write'])});
 assert.equal(idle.state,'passed');
 assert.equal(idle.outputs.save,undefined);
});

test('screen navigation, search input, refresh, and notifications expose real safe UI descriptors and events',async()=>{
 const graph=compose([
  source('screen','spica.runtime.ui_screen_router',{eventId:'navigate',screens:[{id:'notes',label:'Notes'},{id:'recents',label:'Recents'}]}),
  source('search','spica.runtime.ui_search_field',{eventId:'search_notes',label:'Search'}),
  source('refresh','spica.runtime.record_refresh',{eventId:'refresh_notes'}),
  source('text','spica.runtime.text_value',{value:'Saved'}),
  source('notification','spica.runtime.ui_notification',{severity:'success'}),
 ],[edge('text','value','notification','message')]);
 const initial=await run(graph);assert.equal(initial.state,'passed',initial.error);
 assert.equal(initial.outputs.screen.view.renderer,'spica.ui.ui_screen_router');
 assert.equal(initial.outputs.search.view.eventId,'search_notes');
 assert.equal(initial.outputs.notification.view.text,'Saved');
 assert.equal(initial.outputs.refresh.trigger,undefined);
 const clicked=await run(graph,{events:{refresh_notes:'true'}});
 assert.equal(clicked.state,'passed',clicked.error);
 assert.equal(clicked.outputs.refresh.trigger,'true');
});

test('Notes Organizer saves changed Markdown only on explicit Save event, then reopens the durable host record',async()=>{
 const store=new SpicaMemoryStore();
 const seed=await store.begin();await seed.put('notes','demo',{title:'Diary',body:'Old body'});await seed.commit();
 const graph=compose([
  source('draft','spica.runtime.state_value',{key:'draft',initial:'Old body'}),
  source('editor','spica.runtime.ui_markdown_editor',{label:'Body',eventId:'edit_note'}),
  source('change','spica.runtime.ui_event_binding',{eventId:'edit_note'}),
  source('apply','spica.runtime.state_update',{key:'draft'}),
  source('save_event','spica.runtime.ui_event_binding',{eventId:'save_note'}),
  source('key','spica.runtime.text_value',{value:'demo'}),
  source('original','spica.runtime.record_value',{record:{title:'Diary',body:'Old body'}}),
  source('modify','spica.runtime.record_set',{key:'body'}),
  source('save','notes_save',{collection:'notes'}),
  source('read','spica.runtime.record_read',{collection:'notes'}),
 ],[
  edge('draft','value','editor','text'),edge('change','trigger','apply','trigger'),
  edge('original','record','modify','record'),edge('draft','value','modify','value'),
  edge('key','value','save','key'),edge('modify','record','save','value'),
  edge('save_event','trigger','save','trigger'),edge('key','value','read','key'),
 ]);
 const session=new Map();const grants=new Set(['records.write','records.read']);
 const initial=await run(graph,{store,interactionState:session,grants});
 assert.equal(initial.state,'passed',initial.error);
 assert.equal(initial.outputs.editor.view.text,'Old body');
 assert.equal(initial.outputs.save,undefined);
 assert.equal(store.read('notes','demo').body,'Old body');
 const edit=await run(graph,{store,interactionState:session,grants,events:{edit_note:'**Updated!**'}});
 assert.equal(edit.state,'passed',edit.error);
 assert.equal(store.read('notes','demo').body,'Old body','editing alone is not a database write');
 const reRender=await run(graph,{store,interactionState:session,grants});
 assert.equal(reRender.outputs.editor.view.text,'**Updated!**');
 const saved=await run(graph,{store,interactionState:session,grants,events:{save_note:'true'}});
 assert.equal(saved.state,'passed',saved.error);
 assert.equal(saved.outputs.save.saved,true);
 assert.equal(store.read('notes','demo').body,'**Updated!**');
 const reopen=await run(graph,{store,interactionState:session,grants});
 assert.equal(reopen.state,'passed',reopen.error);
 assert.equal(reopen.outputs.read.value.body,'**Updated!**');
});
