const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const phase2Root=path.join(root,'src/spica/source');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'solarium-dce-phase02-'));
const compiled=path.join(work,'source-runtime');
const tsfiles=fs.readdirSync(path.join(phase2Root,'portable')).filter(x=>x.endsWith('.ts')).map(x=>path.join(phase2Root,'portable',x));
const compiler=[...['types','validator','registry','loader','emitter','builtins','generators','receipts','index'].map(x=>path.join(phase2Root,x+'.ts')), ...tsfiles];
function tsc(files,out,rootDir) {
  cp.execFileSync('tsc',['--target','ES2022','--module','commonjs','--moduleResolution','node','--lib','ES2022,DOM',
    '--strict','--noUncheckedIndexedAccess','--skipLibCheck','--rootDir',rootDir,'--outDir',out,...files],
    {cwd:root,stdio:'pipe',timeout:90_000});
}
try {tsc(compiler,compiled,phase2Root);}catch(e){console.error(e.stdout?.toString(),e.stderr?.toString());throw e;}
const {createSourceBlockRegistry,SourceBlockLoader,SourceBlockEmitter,SourceBlockRegistry,validateSourceBlockDefinition,validateLoadedSource}=require(path.join(compiled,'index.js'));
const {themeTokensGenerator}=require(path.join(compiled,'generators.js'));
const registry=createSourceBlockRegistry();
const provider={async read(p){return fs.readFileSync(path.join(phase2Root,p),'utf8');}};
const loader=new SourceBlockLoader(registry,provider);
const emitter=new SourceBlockEmitter(registry,loader);
const portable=registry.portableForTarget('typescript-web');
const ids=portable.map(x=>x.id);
function compiledModule(name){return require(path.join(compiled,'portable',name+'.js'));}
const makeSelections=(blocks)=>blocks.map(id=>({id}));
test.after(()=>fs.rmSync(work,{recursive:true,force:true}));
test('registry contains 24 audited portable modules, one generator, and explicit non-portable entries',()=>{
  assert.equal(portable.length,24);
  assert.equal(registry.list('source-generator').length,1);
  assert.equal(registry.list('host-runtime').length,3);
  assert.equal(registry.list('knowledge-descriptor').length,1);
  assert.equal(registry.portableForTarget('typescript-desktop').length,24);
  assert.equal(new Set(ids).size,24);
  assert.ok(registry.get('source.game-movement').requires.some(x=>x.id==='source.game-vector2'));
});
test('manifests identify real runtime-adapter originals for legacy-derived modules',()=>{
  for (const def of portable.filter(x=>x.provenance.kind==='runtime-adaptation')) {
    assert.match(def.provenance.runtimeId,/^spica\.runtime\./);
    assert.ok(fs.existsSync(path.join(root,def.provenance.sourcePath)),def.id);
  }
});
test('all 24 source modules are individually loadable with exact SHA-256 and exported symbols',async()=>{
  for(const def of portable) {
    const loaded=await loader.load(def.id,def.version,'typescript-web');
    assert.equal(loaded.definition.id,def.id);
    assert.equal(crypto.createHash('sha256').update(loaded.source).digest('hex'),def.sha256);
    validateLoadedSource(def,loaded.source);
  }
});
test('runtime-only adapters and descriptors cannot masquerade as portable code',async()=>{
  for (const entry of registry.list().filter(x=>['host-runtime','knowledge-descriptor'].includes(x.kind))) {
    await assert.rejects(loader.load(entry.id),/not portable source/);
    await assert.rejects(emitter.emit([{id:entry.id}],'typescript-web'),/Non-executable|not portable|Unknown/);
  }
});
test('loader detects corrupted source and cannot resolve arbitrary provider paths',async()=>{
  const forged=new SourceBlockLoader(registry,{async read(){return 'export function clampNumber(){return 999;}';}});
  await assert.rejects(forged.load('source.number-clamp'),/integrity mismatch/);
  await assert.rejects(loader.load('source.unknown'),/Unknown source block/);
});
test('validator rejects duplicate identities, traversal and unreviewed source integrity',()=>{
  assert.throws(()=>new SourceBlockRegistry([portable[0],portable[0]]),/Duplicate/);
  assert.throws(()=>validateSourceBlockDefinition({...portable[0],outputPath:'../escape.ts'}),/Unsafe source file path/);
  assert.throws(()=>validateSourceBlockDefinition({...portable[0],sha256:'unreviewed'}),/Unverified source contract/);
  assert.throws(()=>validateLoadedSource(portable[0],"import fs from 'node:fs'; export function clampNumber(){}"),/unsupported host-only imports/);
});
test('dependency checks refuse hidden or mismatched inputs and duplicated outputs',async()=>{
  await assert.rejects(emitter.emit([{id:'source.game-movement'}],'typescript-web'),/Missing source dependency/);
  await assert.rejects(emitter.emit([{id:'source.game-movement'},{id:'source.number-clamp'}],'typescript-web'),/Missing source dependency/);
  await assert.rejects(emitter.emit([{id:'source.game-vector2'},{id:'source.game-vector2'}],'typescript-web'),/Duplicate source selection/);
  await assert.rejects(emitter.emit([{id:'source.number-clamp',config:{danger:'x'}}],'typescript-web'),/no generator parameters/);
  const valid=await emitter.emit([{id:'source.game-vector2'},{id:'source.game-movement'}],'typescript-web');
  assert.equal(valid.files.length,2);
  assert.equal(valid.files.find(x=>x.path.endsWith('game-movement.ts')).source.includes("from './game-vector2'"),true);
});
test('generator validates config, escapes data, and compiles as real TypeScript',async()=>{
  await assert.rejects(emitter.emit([{id:'source.theme-tokens',config:{background:'red',foreground:'#abcdef',accent:'#fedcba'}}],'typescript-web'),/Invalid theme token/);
  await assert.rejects(emitter.emit([{id:'source.theme-tokens',config:{background:'#010101',foreground:'#abcdef',accent:'#fedcba',evil:'x'}}],'typescript-web'),/Unknown generator config key/);
  const bundle=await emitter.emit([{id:'source.theme-tokens',config:{background:'#010101',foreground:'#abcdef',accent:'#fedcba'}}],'typescript-web');
  assert.deepEqual(bundle.files.map(x=>x.path),['src/warehouse/theme-tokens.ts']);
  assert.match(bundle.files[0].source,/"accent": "#fedcba"/);
  const dir=path.join(work,'generator');fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'theme-tokens.ts'),bundle.files[0].source);
  tsc([path.join(dir,'theme-tokens.ts')],path.join(work,'generator-out'),dir);
  assert.equal(require(path.join(work,'generator-out','theme-tokens.js')).themeTokens.background,'#010101');
});
test('real combined project compiles 24 emitted modules + generated theme using strict TypeScript',async()=>{
  const selections=[...makeSelections(ids),{id:'source.theme-tokens',config:{background:'#101018',foreground:'#eeeeee',accent:'#9f5fff'}}];
  const bundle=await emitter.emit(selections,'typescript-web');
  assert.equal(bundle.files.length,25);
  const project=path.join(work,'project');
  for(const file of bundle.files){const dest=path.join(project,file.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,file.source);}
  const emittedFiles=bundle.files.map(f=>path.join(project,f.path));
  tsc(emittedFiles,path.join(work,'built-output'),project);
  const out=path.join(work,'built-output','src/warehouse');
  assert.equal(require(path.join(out,'number-clamp.js')).clampNumber(12,0,10),10);
  const {stepMovement}=require(path.join(out,'game-movement.js'));
  assert.deepEqual(stepMovement({position:{x:0,y:1},velocity:{x:6,y:2}},0.5),{position:{x:3,y:2},velocity:{x:6,y:2}});
  assert.equal(require(path.join(out,'game-aabb-collision.js')).intersectsAabb({position:{x:0,y:0},width:10,height:10},{position:{x:9,y:0},width:2,height:2}),true);
  assert.equal(require(path.join(out,'theme-tokens.js')).themeTokens.accent,'#9f5fff');
});
test('desktop webview target composes the same reviewed warehouse source and compiles',async()=>{
  const {verifySourceFileBundle}=require(path.join(compiled,'receipts.js'));
  const config={background:'#181828',foreground:'#dcdce9',accent:'#45d7c8'};
  const bundle=await emitter.emit([...makeSelections(ids),{id:'source.theme-tokens',config}], 'typescript-desktop');
  assert.equal(bundle.files.length,25);
  await verifySourceFileBundle(bundle,registry);
  const project=path.join(work,'desktop-webview-project');
  const actual=[];
  for (const file of bundle.files){
    const name=path.join(project,file.path);
    fs.mkdirSync(path.dirname(name),{recursive:true});
    fs.writeFileSync(name,file.source);
    actual.push(name);
  }
  tsc(actual,path.join(work,'desktop-webview-project-out'),project);
  const built=path.join(work,'desktop-webview-project-out/src/warehouse');
  assert.equal(require(path.join(built,'theme-tokens.js')).themeTokens.accent,'#45d7c8');
  assert.equal(require(path.join(built,'number-add.js')).addNumbers(5,8),13);
});

test('portable numeric, text, array, record and state implementations behave as intended',()=>{
  assert.equal(compiledModule('number-clamp').clampNumber(-3,0,10),0);
  assert.throws(()=>compiledModule('number-clamp').clampNumber(3,10,0),/Invalid/);
  assert.equal(compiledModule('number-add').addNumbers(3,4),7);
  assert.throws(()=>compiledModule('number-add').addNumbers(Infinity,1),/Non-finite/);
  assert.equal(compiledModule('number-round').roundNumber(1.236,2),1.24);
  assert.deepEqual(compiledModule('array-unique').uniqueArray([{a:1},{a:1},{a:2}]),[{a:1},{a:2}]);
  assert.deepEqual(compiledModule('array-sort-field').sortRecordsByField([{updatedAt:5},{updatedAt:1}], 'updatedAt',true),[{updatedAt:5},{updatedAt:1}]);
  assert.equal(compiledModule('text-slug').slugifyText('Hello, World!'),'hello-world');
  assert.equal(compiledModule('text-contains').textContains('Alpha beta','beta'),true);
  assert.equal(compiledModule('record-get').getRecordField({title:'Hi'},'missing'),null);
  assert.deepEqual(compiledModule('record-set').setRecordField({title:'old'},'title','new'),{title:'new'});
  const store=compiledModule('state-store').createTextStateStore({name:'A'});const events=[];
  const unsub=store.subscribe((k,v)=>events.push([k,v]));store.set('name','B');unsub();store.set('name','C');
  assert.equal(store.get('name'),'C');assert.deepEqual(events,[['name','B']]);
});
test('new gameplay primitives support input, motion, collision and Canvas2D rendering',()=>{
  const {keyboardSnapshot}=compiledModule('game-input');
  assert.deepEqual(keyboardSnapshot(new Set(['KeyD','Space'])),{horizontal:1,jump:true});
  const {vector2}=compiledModule('game-vector2');
  assert.deepEqual(vector2(2,3),{x:2,y:3});
  assert.equal(compiledModule('game-aabb-collision').intersectsAabb({position:vector2(0,0),width:2,height:2},{position:vector2(2,0),width:2,height:2}),false);
  const ops=[];const context={fillStyle:'',fillRect(...a){ops.push([this.fillStyle,...a]);}};
  compiledModule('game-canvas-renderer').drawColorRects(context,[{x:1,y:2,width:3,height:4,color:'#123456'}]);
  assert.deepEqual(ops,[['#123456',1,2,3,4]]);
  assert.throws(()=>compiledModule('game-canvas-renderer').drawColorRects(context,[{x:0,y:0,width:-1,height:1,color:'red'}]),/Invalid rectangle/);
});
test('original runtime pure adapters and portable counterparts agree on representative values',()=>{
  const pairs=[
    ['number-clamp','number-clamp',{value:12},{min:0,max:10},'clampNumber',[12,0,10],'result'],
    ['number-add','number-add',{a:3,b:4},{},'addNumbers',[3,4],'result'],
    ['number-round','number-round',{value:1.236},{places:2},'roundNumber',[1.236,2],'result'],
    ['array-unique','array-unique',{items:[1,2,1,3]},{},'uniqueArray',[[1,2,1,3]],'items'],
    ['array-sort-field','array-sort-field',{items:[{updatedAt:7},{updatedAt:2},{updatedAt:10}]},{field:'updatedAt',descending:true},'sortRecordsByField',[[{updatedAt:7},{updatedAt:2},{updatedAt:10}],'updatedAt',true],'items'],
    ['text-slug','text-slug',{value:'Hello World'},{},'slugifyText',['Hello World'],'result'],
    ['text-contains','text-contains',{value:'abc',query:'b'},{},'textContains',['abc','b'],'matched'],
    ['record-get','record-get',{record:{title:'Hi'}},{key:'title'},'getRecordField',[{title:'Hi'},'title'],'value'],
    ['record-set','record-set',{record:{title:'Old'},value:'New'},{key:'title'},'setRecordField',[{title:'Old'},'title','New'],'record'],
  ];
  const runtimeRoot=path.join(work,'runtime');
  const runtimeFiles=pairs.map(p=>p[0]).map(name=>{
    if(name.startsWith('number-'))return `functions/runtime/numbers/${name}.ts`;
    if(name.startsWith('array-'))return `functions/runtime/arrays/${name}.ts`;
    if(name.startsWith('text-'))return `functions/runtime/text/${name}.ts`;
    return `functions/runtime/records/${name}.ts`;
  }).map(p=>path.join(root,'src/spica/runtime/blocks',p));
  try{tsc(runtimeFiles,runtimeRoot,path.join(root,'src/spica'));}catch(e){console.error(e.stdout?.toString());throw e;}
  for(const [runtimeName,sourceName,inputs,config,fn,args,key] of pairs){
    const group=runtimeName.startsWith('number-')?'numbers':runtimeName.startsWith('array-')?'arrays':runtimeName.startsWith('text-')?'text':'records';
    const adapter=require(path.join(runtimeRoot,'runtime/blocks/functions/runtime',group,runtimeName+'.js')).default;
    adapter.validateConfig(config);
    const actual=adapter.execute({},inputs,config)[key];
    const adapted=compiledModule(sourceName)[fn](...args);
    assert.deepEqual(adapted,actual,sourceName);
  }
});
test('Phase 1 routing and legacy runtime adapter/registries are not replaced by source loader',()=>{
  assert.ok(fs.existsSync(path.join(root,'src/engine/construction/orchestrator.ts')));
  const registryText=fs.readFileSync(path.join(root,'src/spica/runtime/registry.ts'),'utf8');
  assert.match(registryText,/generatedRuntimeAdapters/);
  const sourceText=fs.readFileSync(path.join(root,'src/spica/source/loader.ts'),'utf8');
  assert.doesNotMatch(sourceText,/run_spica_v2_graph|edit_spica_graph|process\.run|execFileSync/);
  assert.ok(!fs.readFileSync(path.join(root,'src/spica/catalog/unified.ts'),'utf8').includes('source-block-runtime-overwrite'));
});
test('portable DOM blocks create real button, heading and flex layout objects',()=>{
  const original=global.document;const listeners=[];
  global.document={createElement(tag){return {tag,style:{},dataset:{},appendChild(child){this.children??=[];this.children.push(child);},addEventListener(type,cb){listeners.push([type,cb]);}};}};
  try {
    const button=compiledModule('ui-button').createButton('Play',()=>{},'outlined');
    const heading=compiledModule('ui-heading').createHeading('Title',2);
    const row=compiledModule('layout-row').createLayoutRow([heading,button],3);
    assert.equal(button.tag,'button');assert.equal(button.textContent,'Play');assert.equal(button.dataset.variant,'outlined');
    assert.equal(heading.tag,'h2');assert.equal(heading.textContent,'Title');
    assert.equal(row.style.display,'flex');assert.equal(row.style.gap,'12px');assert.deepEqual(row.children,[heading,button]);
    assert.equal(listeners.length,1);assert.equal(listeners[0][0],'click');
    assert.throws(()=>compiledModule('ui-heading').createHeading('Bad',9),/Invalid heading/);
  }finally{if(original===undefined)delete global.document;else global.document=original;}
});
test('source capability discovery remains metadata-only; generator functions are not exposed',()=>{
  const catalog=fs.readFileSync(path.join(root,'src/spica/catalog/source-capabilities.ts'),'utf8');
  assert.match(catalog,/const \{generate: _privateGenerator, \.\.\.publicContract\}/);
  assert.ok(registry.list('knowledge-descriptor').every(x=>x.kind==='knowledge-descriptor'));
  assert.ok(registry.list('host-runtime').every(x=>!('sourcePath' in x)));
});
test('validated registry metadata is immutable including nested targets, exports and requirements',()=>{
  const entry=registry.get('source.game-movement');
  assert.ok(Object.isFrozen(entry));assert.ok(Object.isFrozen(entry.targets));
  assert.ok(Object.isFrozen(entry.requires));assert.ok(Object.isFrozen(entry.requires[0]));
  assert.throws(()=>entry.requires.push({id:'source.fake',version:'1.0.0',symbol:'fake'}),/not extensible|read only|object is not extensible/);
});
test('emitter rejects compromised generator output, conflicting target files, and unknown versions',async()=>{
  const bad={...themeTokensGenerator,id:'source.unsafe-generator',configSchema:{allowed:[],required:[]},generate:()=>[{path:'../escape.ts',source:'export const oops = 1;'}]};
  const custom=new SourceBlockRegistry([...registry.list(),bad]);
  const runtime=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
  await assert.rejects(runtime.emit([{id:bad.id}],'typescript-web'),/Unsafe source file path/);
  const collision={...themeTokensGenerator,id:'source.collision-generator',configSchema:{allowed:[],required:[]},generate:()=>[{path:'src/warehouse/number-add.ts',source:'export const oops = 1;'}]};
  const shared=new SourceBlockRegistry([...registry.list(),collision]);
  const sharedEmitter=new SourceBlockEmitter(shared,new SourceBlockLoader(shared,provider));
  await assert.rejects(sharedEmitter.emit([{id:'source.number-add'},{id:collision.id}],'typescript-web'),/Duplicate, empty or oversized/);
  await assert.rejects(emitter.emit([{id:'source.number-add',version:'99.0.0'}],'typescript-web'),/Unknown source capability/);
});
test('generated source is deterministic and source output remains in memory until an authorized writer acts',async()=>{
  const config={background:'#000000',foreground:'#ffffff',accent:'#ff00ff'};
  const a=await emitter.emit([{id:'source.theme-tokens',config}],'typescript-web');
  const b=await emitter.emit([{id:'source.theme-tokens',config}],'typescript-web');
  assert.deepEqual(a,b);
  assert.ok(!fs.existsSync(path.join(root,'src/warehouse/theme-tokens.ts')),'emitter must not write into repository');
});

test('Phase 02 hardening: emitted files carry verifiable owner and content receipts',async()=>{
  const bundle=await emitter.emit([
    {id:'source.game-vector2'},
    {id:'source.game-movement'},
    {id:'source.theme-tokens',config:{background:'#101010',foreground:'#eeeeee',accent:'#cc55aa'}},
  ],'typescript-web');
  assert.equal(bundle.receipts.length,bundle.files.length);
  for(const receipt of bundle.receipts){
    const file=bundle.files.find(f=>f.path===receipt.path);
    assert.ok(file);
    assert.equal(receipt.sha256,crypto.createHash('sha256').update(file.source,'utf8').digest('hex'));
    assert.equal(receipt.sizeBytes,Buffer.byteLength(file.source,'utf8'));
    assert.ok(registry.get(receipt.owner.id,receipt.owner.version));
  }
  assert.equal(bundle.receipts.find(r=>r.owner.id==='source.theme-tokens').path,'src/warehouse/theme-tokens.ts');
});

test('Phase 02 hardening: Windows-reserved names and case collisions cannot reach the project writer',async()=>{
  for(const filename of ['CON.ts','nul.ts','COM1.ts','aux.config.ts','LPT9.ts']){
    assert.throws(()=>validateSourceBlockDefinition({...portable[0],outputPath:`src/warehouse/${filename}`}),/Unsafe source file path/);
  }
  const collision={...themeTokensGenerator,id:'source.windows-case-conflict',configSchema:{allowed:[],required:[]},
    generate:()=>[{path:'src/warehouse/Number-Add.ts',source:'export const themeTokens = 1;'}]};
  const custom=new SourceBlockRegistry([...registry.list(),collision]);
  const customEmitter=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
  await assert.rejects(customEmitter.emit([{id:'source.number-add'},{id:collision.id}],'typescript-web'),/Duplicate, empty or oversized/);
});

test('Phase 02 hardening: generators must actually emit their declared exports',async()=>{
  const missing={...themeTokensGenerator,id:'source.missing-generated-export',configSchema:{allowed:[],required:[]},
    generate:()=>[{path:'src/warehouse/missing.ts',source:'export const unrelated = 42;'}]};
  const custom=new SourceBlockRegistry([...registry.list(),missing]);
  const customEmitter=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
  await assert.rejects(customEmitter.emit([{id:missing.id}],'typescript-web'),/Missing exported value themeTokens/);
});

test('Phase 02 hardening: undeclared, unresolved, external and dynamic code imports are rejected',async()=>{
  const attempts=[
    ['source.undeclared-import','import { addNumbers } from "./number-add"; export const themeTokens = addNumbers(1,2);',/Undeclared source import/],
    ['source.missing-import','import { missing } from "./missing"; export const themeTokens = missing;',/Unresolved source import/],
    ['source.external-import','import { useState } from "react"; export const themeTokens = useState;',/External source import/],
    ['source.dynamic-import','export const themeTokens = import("./number-add");',/unsupported host-only imports|Dynamic imports/],
  ];
  for(const [id,source,pattern] of attempts){
    const block={...themeTokensGenerator,id,configSchema:{allowed:[],required:[]},generate:()=>[{path:'src/warehouse/generated-test.ts',source}]};
    const custom=new SourceBlockRegistry([...registry.list(),block]);
    const customEmitter=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
    await assert.rejects(customEmitter.emit([{id:'source.number-add'},{id:block.id}],'typescript-web'),pattern,id);
  }
});

test('Phase 02 hardening: malicious generator contracts and oversized output are rejected',async()=>{
  assert.throws(()=>validateSourceBlockDefinition({...themeTokensGenerator,
    configSchema:{allowed:['background','background'],required:[]}}),/Invalid source generator/);
  assert.throws(()=>validateSourceBlockDefinition({...themeTokensGenerator,
    configSchema:{allowed:['__proto__'],required:[]}}),/Invalid source generator/);
  const scenarios=[
    ['source.empty-generator',()=>[],/no source files/],
    ['source.invalid-generator',()=>null,/no source files/],
    ['source.overlong-generator',()=>[{path:'src/warehouse/a.ts',source:'export const themeTokens='+ 'a'.repeat(1_000_001)}],/oversized|unsupported host-only imports/],
    ['source.too-many-generator',()=>Array.from({length:257},(_,i)=>({path:`src/warehouse/a-${i}.ts`,source:'export const themeTokens = 1;'})),/exceeded file count/],
  ];
  for(const [id,generate,pattern] of scenarios){
    const block={...themeTokensGenerator,id,configSchema:{allowed:[],required:[]},generate};
    const custom=new SourceBlockRegistry([...registry.list(),block]);
    const customEmitter=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
    await assert.rejects(customEmitter.emit([{id:block.id}],'typescript-web'),pattern,id);
  }
});

test('Phase 02 hardening: game collision and movement refuse non-finite/degenerate states',()=>{
  const {stepMovement}=compiledModule('game-movement');
  const {intersectsAabb}=compiledModule('game-aabb-collision');
  const full={position:{x:0,y:0},width:10,height:10};
  assert.equal(intersectsAabb({position:{x:5,y:5},width:0,height:4},full),false);
  assert.equal(intersectsAabb({position:{x:5,y:5},width:4,height:0},full),false);
  assert.throws(()=>intersectsAabb({position:{x:NaN,y:0},width:2,height:2},full),/Invalid collision box/);
  assert.throws(()=>stepMovement({position:{x:0,y:0},velocity:{x:Infinity,y:0}},0.1),/Non-finite movement state/);
  assert.throws(()=>stepMovement({position:{x:Number.MAX_VALUE,y:0},velocity:{x:Number.MAX_VALUE,y:0}},1),/Movement overflow/);
  assert.throws(()=>compiledModule('number-round').roundNumber(Number.MAX_VALUE,8),/Non-finite rounding result/);
});

test('Phase 02 expanded gameplay: gravity and grounded jump compose correctly',async()=>{
  const sourceBundle=await emitter.emit([
    {id:'source.game-vector2'}, {id:'source.game-movement'},
    {id:'source.game-gravity'}, {id:'source.game-jump'},
  ],'typescript-web');
  assert.equal(sourceBundle.files.length,4);
  const body={position:{x:1,y:30},velocity:{x:2,y:0}};
  const jump=compiledModule('game-jump').tryJump(body,true,true,10);
  assert.equal(jump.jumped,true);
  assert.equal(jump.body.velocity.y,-10);
  const blocked=compiledModule('game-jump').tryJump(body,false,true,10);
  assert.equal(blocked.jumped,false);
  const gravity=compiledModule('game-gravity').applyGravity(jump.body,20,0.25,30);
  assert.equal(gravity.velocity.y,-5);
  const moved=compiledModule('game-movement').stepMovement(gravity,0.25);
  assert.deepEqual(moved.position,{x:1.5,y:28.75});
  assert.deepEqual(body,{position:{x:1,y:30},velocity:{x:2,y:0}},'primitives must not mutate caller state');
  assert.throws(()=>compiledModule('game-gravity').applyGravity(body,-1,0.5,50),/Invalid gravity parameters/);
  assert.throws(()=>compiledModule('game-jump').tryJump(body,true,true,-1),/Invalid jump parameters/);
});

test('Phase 02 expanded gameplay: collectibles, camera and animation compose',()=>{
  const player={position:{x:2,y:2},width:2,height:2};
  const collectibles=[
    {id:'one',box:{position:{x:3,y:3},width:2,height:2}},
    {id:'two',box:{position:{x:8,y:8},width:2,height:2}},
  ];
  const outcome=compiledModule('game-collectibles').collectOverlaps(player,collectibles);
  assert.deepEqual(outcome.collectedIds,['one']);
  assert.deepEqual(outcome.remaining,[collectibles[1]]);
  assert.equal(collectibles.length,2,'source input cannot be mutated');
  assert.throws(()=>compiledModule('game-collectibles').collectOverlaps(player,[collectibles[0],collectibles[0]]),/duplicate collectible/);
  assert.deepEqual(compiledModule('game-camera').followCamera({x:150,y:20},{x:100,y:100},{x:300,y:200}),{x:100,y:0});
  assert.deepEqual(compiledModule('game-camera').followCamera({x:800,y:800},{x:100,y:100},{x:300,y:200}),{x:200,y:100});
  assert.throws(()=>compiledModule('game-camera').followCamera({x:0,y:0},{x:0,y:100},{x:200,y:200}),/Invalid camera/);
  const anim=compiledModule('game-animation').advanceAnimationFrame(2,0.35,0.02,0.1,4);
  assert.equal(anim.frame,1);
  assert.ok(Math.abs(anim.remainderSeconds-0.07)<1e-9);
});

test('Phase 02 expanded gameplay: swept platform landing detects crossing but not false positives',()=>{
  const land=compiledModule('game-platform-landing').resolveDownwardLanding;
  const platform={position:{x:0,y:100},width:200,height:12};
  const prev={position:{x:50,y:70},width:12,height:15};
  const next={position:{x:50,y:105},width:12,height:15};
  assert.deepEqual(land(prev,next,[platform]),{position:{x:50,y:85},grounded:true});
  assert.deepEqual(land(prev,{...next,position:{x:250,y:105}},[platform]),{position:{x:250,y:105},grounded:false});
  assert.deepEqual(land(next,prev,[platform]),{position:{x:50,y:70},grounded:false});
  assert.throws(()=>land(prev,next,[{...platform,width:-2}]),/Invalid landing box/);
});

test('Phase 02 integration: emitted gameplay modules compile into a working game-core consumer',async()=>{
  const sourceIds=[
    'source.game-vector2','source.game-movement','source.game-gravity','source.game-jump',
    'source.game-platform-landing','source.game-aabb-collision','source.game-collectibles',
    'source.game-camera','source.game-animation','source.game-input',
  ];
  const bundle=await emitter.emit(makeSelections(sourceIds),'typescript-web');
  const project=path.join(work,'game-core-project');
  const entry=path.join(project,'src/game-core.ts');
  for (const file of bundle.files) {
    const destination=path.join(project,file.path);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,file.source);
  }
  fs.mkdirSync(path.dirname(entry),{recursive:true});
  fs.writeFileSync(entry,`
    import { keyboardSnapshot } from './warehouse/game-input';
    import { tryJump } from './warehouse/game-jump';
    import { applyGravity } from './warehouse/game-gravity';
    import { stepMovement } from './warehouse/game-movement';
    import { resolveDownwardLanding } from './warehouse/game-platform-landing';
    import { collectOverlaps } from './warehouse/game-collectibles';
    import { followCamera } from './warehouse/game-camera';
    import { advanceAnimationFrame } from './warehouse/game-animation';
    export function runGameCore() {
      const input=keyboardSnapshot(new Set(['Space','KeyD']));
      const jumping=tryJump({position:{x:5,y:30},velocity:{x:3,y:0}},true,input.jump,20);
      const falling=applyGravity(jumping.body,40,0.25,50);
      const moved=stepMovement(falling,0.25);
      const landed=resolveDownwardLanding(
        {position:{x:10,y:70},width:12,height:12},
        {position:{x:10,y:120},width:12,height:12},
        [{position:{x:0,y:100},width:100,height:12}]);
      const found=collectOverlaps(
        {position:moved.position,width:12,height:12},
        [{id:'star-1',box:{position:{x:6,y:27},width:2,height:2}}]);
      const camera=followCamera(moved.position,{x:100,y:70},{x:1000,y:500});
      const frame=advanceAnimationFrame(0,0.25,0,0.1,4);
      return {input,jumped:jumping.jumped,moved:moved.position,landed,found:found.collectedIds,camera,frame:frame.frame};
    }
  `);
  const out=path.join(work,'game-core-project-out');
  tsc([...bundle.files.map(f=>path.join(project,f.path)),entry],out,project);
  const result=require(path.join(out,'src/game-core.js')).runGameCore();
  assert.deepEqual(result,{
    input:{horizontal:1,jump:true},jumped:true,moved:{x:5.75,y:27.5},
    landed:{position:{x:10,y:88},grounded:true},found:['star-1'],camera:{x:0,y:0},frame:2,
  });
});

test('Phase 02 hardening: source imports require exact symbols and matching case',async()=>{
  const contract=[{id:'source.number-add',version:'1.0.0',symbol:'addNumbers'}];
  const examples=[
    ['source.unknown-imported-symbol',
     'import { nonexistent } from "./number-add"; export const themeTokens = nonexistent;',
     /Undeclared imported symbol nonexistent/],
    ['source.case-mismatch',
     'import { addNumbers } from "./Number-Add"; export const themeTokens = addNumbers(1,2);',
     /Source import casing differs/],
    ['source.uncontracted-side-effect',
     'import "./number-add"; export const themeTokens = 12;',
     /Unsupported source import syntax/],
  ];
  for(const [id,source,pattern] of examples){
    const block={...themeTokensGenerator,id,configSchema:{allowed:[],required:[]},requires:contract,
      generate:()=>[{path:'src/warehouse/reference-test.ts',source}]};
    const custom=new SourceBlockRegistry([...registry.list(),block]);
    const customEmitter=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
    await assert.rejects(customEmitter.emit([{id:'source.number-add'},{id:block.id}],'typescript-web'),pattern,id);
  }
});

test('Phase 02 hardening: emitted content and receipts are immutable snapshots',async()=>{
  const bundle=await emitter.emit([{id:'source.number-add'}],'typescript-web');
  assert.ok(Object.isFrozen(bundle));
  assert.ok(Object.isFrozen(bundle.files));
  assert.ok(Object.isFrozen(bundle.files[0]));
  assert.ok(Object.isFrozen(bundle.receipts));
  assert.ok(Object.isFrozen(bundle.receipts[0]));
  assert.ok(Object.isFrozen(bundle.receipts[0].owner));
  const originalSource=bundle.files[0].source;
  const originalDigest=bundle.receipts[0].sha256;
  bundle.files[0].source='export const broken = true;';
  bundle.receipts[0].sha256='f'.repeat(64);
  assert.equal(bundle.files[0].source,originalSource);
  assert.equal(bundle.receipts[0].sha256,originalDigest);
});

test('Phase 02 hardening: one generator may emit multiple validated, internally importing files',async()=>{
  const multi={...themeTokensGenerator,id:'source.multi-file-generator',configSchema:{allowed:[],required:[]},
    generate:()=>[
      {path:'src/warehouse/theme-core.ts',source:'export const themeTokens = {accent: "#14b8a6"} as const;'},
      {path:'src/warehouse/theme-entry.ts',source:'import { themeTokens } from "./theme-core"; export const accent = themeTokens.accent;'},
    ]};
  const custom=new SourceBlockRegistry([...registry.list(),multi]);
  const multiEmitter=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
  const bundle=await multiEmitter.emit([{id:multi.id}],'typescript-web');
  assert.deepEqual(bundle.files.map(f=>f.path),['src/warehouse/theme-core.ts','src/warehouse/theme-entry.ts']);
  assert.equal(bundle.receipts.length,2);
  const project=path.join(work,'multi-file-source-generator');
  const output=path.join(work,'multi-file-source-generator-out');
  for(const file of bundle.files){
    const p=path.join(project,file.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,file.source);
  }
  tsc(bundle.files.map(f=>path.join(project,f.path)),output,project);
  assert.equal(require(path.join(output,'src/warehouse/theme-entry.js')).accent,'#14b8a6');
});

test('Phase 02 property checks: collision symmetry, zero area, and frame progress stay consistent',()=>{
  let random=0x71f00baa;
  const next=()=>{ random=(Math.imul(random,1664525)+1013904223)>>>0; return random/0x100000000; };
  const collision=compiledModule('game-aabb-collision').intersectsAabb;
  const animation=compiledModule('game-animation').advanceAnimationFrame;
  for(let index=0;index<600;index++){
    const box=()=>({position:{x:next()*400-100,y:next()*400-100},width:next()*50,height:next()*50});
    const a=box(),b=box();
    assert.equal(collision(a,b),collision(b,a),'AABB intersection must be symmetric');
    assert.equal(collision({...a,width:0},b),false,'zero-area boxes never collide');
    const frame=Math.floor(next()*16),frames=16;
    const step=animation(frame,next()*2,0,0.125,frames);
    assert.ok(step.frame>=0&&step.frame<frames);
    assert.ok(step.remainderSeconds>=0&&step.remainderSeconds<0.125);
  }
});

test('Phase 02 hardening: comments and string contents cannot fake exported symbols',async()=>{
  const invalidSources=[
    '// export const themeTokens = 1;\nexport const unrelated = 1;',
    '/* export const themeTokens = 1; */\nexport const unrelated = 1;',
    'const distraction = "export const themeTokens = 1"; export const unrelated = 1;',
    'const distraction = `export const themeTokens = 1`; export const unrelated = 1;',
  ];
  for(const source of invalidSources){
    const fake={...themeTokensGenerator,id:'source.fake-export',configSchema:{allowed:[],required:[]},
      generate:()=>[{path:'src/warehouse/fake-export.ts',source}]};
    const custom=new SourceBlockRegistry([...registry.list(),fake]);
    const fakeEmitter=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
    await assert.rejects(fakeEmitter.emit([{id:fake.id}],'typescript-web'),/Missing exported value themeTokens/);
  }
});

test('Phase 02 transport: receipt validation detects changed bytes, missing evidence and forged owners',async()=>{
  const {verifySourceFileBundle}=require(path.join(compiled,'receipts.js'));
  const bundle=await emitter.emit([{id:'source.game-vector2'},{id:'source.game-movement'}],'typescript-web');
  await verifySourceFileBundle(bundle,registry);
  const copy=()=>JSON.parse(JSON.stringify(bundle));
  const replaced=copy();replaced.files[0].source+='\nexport const injected=true;';
  await assert.rejects(verifySourceFileBundle(replaced),/integrity mismatch/);
  const missing=copy();missing.receipts.pop();
  await assert.rejects(verifySourceFileBundle(missing),/incomplete receipt set/);
  const forged=copy();forged.receipts[0].owner.id='source.unregistered';
  await assert.rejects(verifySourceFileBundle(forged),/Unknown source bundle owner/);
  const wrongCase=copy();wrongCase.receipts[0].path=wrongCase.receipts[0].path.toUpperCase().replace('.TS','.ts');
  await assert.rejects(verifySourceFileBundle(wrongCase),/receipt path mismatch|Unsafe source file path/);
  const fakeOwner=copy();fakeOwner.blocks[0].id='source.nonexistent';fakeOwner.receipts[0].owner.id='source.nonexistent';
  await assert.rejects(verifySourceFileBundle(fakeOwner,registry),/not registered/);
  const selfConsistentForgery=copy();
  selfConsistentForgery.files[0].source+='\nexport const malicious = true;';
  selfConsistentForgery.receipts[0].sha256=crypto.createHash('sha256')
    .update(selfConsistentForgery.files[0].source,'utf8').digest('hex');
  selfConsistentForgery.receipts[0].sizeBytes=Buffer.byteLength(selfConsistentForgery.files[0].source,'utf8');
  await verifySourceFileBundle(selfConsistentForgery); // transport integrity is self-consistent
  await assert.rejects(verifySourceFileBundle(selfConsistentForgery,registry),/diverges from registered portable source/);
  const forgedPortablePath=copy();
  forgedPortablePath.files[0].path='src/warehouse/forged-location.ts';
  forgedPortablePath.receipts[0].path=forgedPortablePath.files[0].path;
  await assert.rejects(verifySourceFileBundle(forgedPortablePath,registry),/diverges from registered portable source/);
  const falseProvenance=copy();
  falseProvenance.blocks[0].provenance={kind:'documentation'};
  await assert.rejects(verifySourceFileBundle(falseProvenance,registry),/provenance differs from registry/);
  const unusedOwner=copy();
  const extra=registry.get('source.number-clamp');
  unusedOwner.blocks.push({id:extra.id,version:extra.version,provenance:extra.provenance});
  await assert.rejects(verifySourceFileBundle(unusedOwner,registry),/un-emitted block/);
  const empty={files:[],receipts:[],blocks:[]};
  await assert.rejects(verifySourceFileBundle(empty,registry),/Malformed source bundle/);
});

test('Phase 02 lexical analysis ignores import-looking documentation and string contents',async()=>{
  const source = `
    // Example: import { fake } from "evil-package";
    /* Example: export { missing } from "node:fs"; */
    export const themeTokens = {
      note: "Documentation: import { fake } from 'external-lib'",
      hint: "from 'node:fs' is not actually imported here",
    } as const;
  `;
  const block={...themeTokensGenerator,id:'source.comment-lex-test',configSchema:{allowed:[],required:[]},
    generate:()=>[{path:'src/warehouse/comment-lex-test.ts',source}]};
  const custom=new SourceBlockRegistry([...registry.list(),block]);
  const customEmitter=new SourceBlockEmitter(custom,new SourceBlockLoader(custom,provider));
  const bundle=await customEmitter.emit([{id:block.id}],'typescript-web');
  assert.equal(bundle.files.length,1);
  const project=path.join(work,'comment-lex');
  const file=path.join(project,bundle.files[0].path);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bundle.files[0].source);
  tsc([file],path.join(work,'comment-lex-out'),project);
});
