'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const runtime=path.join(root,'.spica-phase07-test/spica');
const {getRuntimeBlock,listRuntimeBlocks}=require(path.join(runtime,'runtime/registry.js'));
const {SpicaMemoryStore}=require(path.join(runtime,'runtime/store.js'));
const {emptySpicaGraphV2}=require(path.join(runtime,'graph-v2/types.js'));
const {previewSpicaComposition}=require(path.join(runtime,'runtime/composition.js'));
const {executeSpicaGraphV2}=require(path.join(runtime,'runtime/executor.js'));
const {searchExecutableBlocks}=require(path.join(runtime,'runtime/discovery.js'));

const seed=async()=>{const store=new SpicaMemoryStore();const tx=await store.begin();
 await tx.put('notes','first',{title:'Old note',body:'**Old**',updatedAt:'2026-11-01T12:00:00Z'});
 await tx.put('notes','latest',{title:'New note',body:'**New**',updatedAt:'2026-11-13T12:00:00Z'});
 await tx.commit();return store;};
const listGraph=()=>previewSpicaComposition(emptySpicaGraphV2('notes.recent','Recent Notes'),{nodes:[
 {id:'source',blockId:'spica.runtime.record_list',config:{collection:'notes',limit:100}},
 {id:'sort',blockId:'spica.runtime.array_sort_field',config:{field:'updatedAt',descending:true}},
 {id:'take',blockId:'spica.runtime.array_take',config:{count:10}},
 {id:'list',blockId:'spica.runtime.ui_list',config:{labelField:'title'}},
],connections:[
 {from:'source',output:'items',to:'sort',input:'items'},
 {from:'sort',output:'items',to:'take',input:'items'},
 {from:'take',output:'items',to:'list',input:'items'},
 ]});

test('all executable blocks use unique one-file source identities and real registered ports',()=>{
 const blocks=listRuntimeBlocks();
 assert.equal(new Set(blocks.map(b=>`${b.id}@${b.version}`)).size,blocks.length);
 for(const id of ['spica.runtime.record_list','spica.runtime.record_delete','spica.runtime.ui_markdown_editor','spica.runtime.ui_markdown','spica.runtime.array_sort_field']){
  const block=getRuntimeBlock(id,'1');assert.ok(block,id);
  assert.equal(block.trust,'built-in');assert.ok(block.outputs.length);
 }
});
test('natural-language recents and markdown search resolves only real executable IDs',()=>{
 const recents=searchExecutableBlocks({query:'recent notes',limit:20});
 const markdown=searchExecutableBlocks({query:'rich markdown editor',limit:20});
 assert.ok(recents.results.some(x=>x.id==='spica.runtime.record_list'));
 assert.ok(markdown.results.some(x=>x.id==='spica.runtime.ui_markdown_editor'));
 assert.ok([...recents.results,...markdown.results].every(x=>Boolean(getRuntimeBlock(x.id,x.version))));
});
test('transaction store enumerates, rolls back and deletes records atomically',async()=>{
 const store=await seed();const tx=await store.begin();
 assert.equal((await tx.list('notes',100)).length,2);
 await tx.delete('notes','latest');
 assert.equal((await tx.list('notes',100)).length,1);
 await tx.rollback();
 assert.equal((await (await store.begin()).list('notes',100)).length,2);
 const deleting=await store.begin();await deleting.delete('notes','latest');await deleting.commit();
 assert.equal((await (await store.begin()).list('notes',100)).length,1);
 await assert.rejects(()=>store.begin().then(t=>t.list('notes',600)),/limit/);
});
test('a real recents graph reads, sorts and renders records using their registered ports',async()=>{
 const reviewed=listGraph();assert.equal(reviewed.complete,true);
 const result=await executeSpicaGraphV2(reviewed.graph,{
   target:'desktop',grants:new Set(['records.read']),store:await seed()});
 assert.equal(result.state,'passed',result.error);
 assert.deepEqual(result.outputs.list.view.items.map(x=>x.title),['New note','Old note']);
 assert.equal(result.outputs.list.view.renderer,'spica.ui.ui_list');
});
test('record list and delete are denied without their explicit grants',async()=>{
 const store=await seed();
 const read=await executeSpicaGraphV2(listGraph().graph,{target:'desktop',grants:new Set(),store});
 assert.notEqual(read.state,'passed');
 const graph=previewSpicaComposition(emptySpicaGraphV2('demo.remove','Demo'),{
   nodes:[{id:'key',blockId:'spica.runtime.text_value',config:{value:'latest'}},
     {id:'remove',blockId:'spica.runtime.record_delete',config:{collection:'notes'}}],
   connections:[{from:'key',output:'value',to:'remove',input:'key'}],
 }).graph;
 const denied=await executeSpicaGraphV2(graph,{target:'desktop',grants:new Set(),store});
 assert.notEqual(denied.state,'passed');
 assert.ok(store.read('notes','latest'));
 const granted=await executeSpicaGraphV2(graph,{target:'desktop',grants:new Set(['records.write']),store});
 assert.equal(granted.state,'passed',granted.error);
 assert.equal(store.read('notes','latest'),undefined);
});
