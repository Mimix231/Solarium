const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'solarium-dce-phase03-'));
const out=path.join(temp,'compiled');
const sourceRoot=path.join(root,'src/spica/source');
const intelRoot=path.join(sourceRoot,'intelligence');
const sourceFiles=[...fs.readdirSync(sourceRoot).filter(f=>f.endsWith('.ts')&&!f.includes('provider-vite')).map(f=>path.join(sourceRoot,f)),
  ...fs.readdirSync(intelRoot).filter(f=>f.endsWith('.ts')).map(f=>path.join(intelRoot,f))];
cp.execFileSync('tsc',['--target','ES2022','--module','commonjs','--moduleResolution','node','--lib','ES2022,DOM',
  '--strict','--noUncheckedIndexedAccess','--skipLibCheck','--rootDir',sourceRoot,'--outDir',out,...sourceFiles],
  {cwd:root,timeout:90_000,stdio:'pipe'});
const api=require(path.join(out,'index.js'));
const {WarehouseIndexer,CapabilitySearchEngine,indexedCapability,SourceDependencyResolver,
  CompositionRecipeRegistry,builtInCompositionRecipes,createSourceBlockRegistry,SourceBlockEmitter,
  SourceBlockLoader,SourceBlockRegistry}=api;
const registry=createSourceBlockRegistry();
const filesRoot=path.join(sourceRoot,'portable');
const loader=new SourceBlockLoader(registry,{async read(p){return fs.promises.readFile(path.join(sourceRoot,p),'utf8');}});
const emitter=new SourceBlockEmitter(registry,loader);
let index,engine;
test.before(async()=>{
  index=await WarehouseIndexer.build(registry.list().map(indexedCapability),16);
  const shards=new Map(index.shards.map(shard=>[shard.id,shard]));
  engine=new CapabilitySearchEngine(index.manifest,{async readShard(id){return shards.get(id);}});
});
test.after(()=>fs.rmSync(temp,{recursive:true,force:true}));

test('indexed metadata represents every category but never contains source text or generator functions',()=>{
  assert.equal(index.manifest.count,registry.list().length);
  assert.equal(index.manifest.countsByKind['portable-source'],24);
  assert.equal(index.manifest.countsByKind['source-generator'],1);
  assert.equal(index.manifest.countsByKind['host-runtime'],3);
  assert.equal(index.manifest.countsByKind['knowledge-descriptor'],1);
  assert.equal(index.manifest.shards.reduce((sum,shard)=>sum+shard.count,0),29);
  for(const shard of index.shards)for(const cap of shard.entries){
    assert.equal(Object.keys(cap).includes('generate'),false);
    assert.equal(Object.keys(cap).includes('source'),false);
    assert.equal(Object.keys(cap).includes('sourcePath'),false);
    assert.equal(typeof cap.id,'string');
  }
});
test('search finds real sources with target/category filters and scores exact IDs highly',async()=>{
  const game=await engine.search({query:'game movement',target:'typescript-web',kind:'portable-source'});
  assert.ok(game.matches.some(m=>m.capability.id==='source.game-movement'));
  assert.ok(game.matches.every(m=>m.capability.kind==='portable-source'));
  const exact=await engine.exact('source.game-jump');
  assert.equal(exact.id,'source.game-jump');
  assert.equal(await engine.exact('source.no-such-module'),undefined);
  assert.deepEqual((await engine.search({query:'jump',category:'data'})).matches,[]);
});
test('search is I/O bounded and reports incomplete coverage rather than inventing completeness',async()=>{
  const engineBounded=new CapabilitySearchEngine(index.manifest,{async readShard(id){
    const file=index.shards.find(s=>s.id===id);return file;
  }});
  const result=await engineBounded.search({query:'source',maxShardReads:1,limit:3});
  assert.equal(result.shardsRead,1);
  assert.equal(result.incomplete,true);
  assert.ok(result.candidateShards>1);
  assert.equal(result.matches.length<=3,true);
  await assert.rejects(engineBounded.search({query:'source',maxShardReads:0}),/bounds/);
});
test('corrupted disk-backed shard and forged metadata fail SHA-256 integrity checks',async()=>{
  const directory=path.join(temp,'index');fs.mkdirSync(directory);
  for(const shard of index.shards)fs.writeFileSync(path.join(directory,shard.id+'.json'),JSON.stringify(shard));
  const diskEngine=new CapabilitySearchEngine(index.manifest,{async readShard(id){return JSON.parse(await fs.promises.readFile(path.join(directory,id+'.json'),'utf8'));}});
  assert.equal((await diskEngine.exact('source.game-jump')).id,'source.game-jump');
  const shard=index.shards.find(s=>s.entries.some(e=>e.id==='source.game-movement'));
  fs.writeFileSync(path.join(directory,shard.id+'.json'),JSON.stringify({...shard,entries:shard.entries.map(e=>e.id==='source.game-movement'?{...e,kind:'knowledge-descriptor'}:e)}));
  const corruptedEngine=new CapabilitySearchEngine(index.manifest,{async readShard(id){return JSON.parse(await fs.promises.readFile(path.join(directory,id+'.json'),'utf8'));}});
  await assert.rejects(corruptedEngine.exact('source.game-movement'),/integrity mismatch/);
});
test('indexing and query results are deterministic independent of insertion order',async()=>{
  const entries=registry.list().map(indexedCapability);
  const reversed=await WarehouseIndexer.build([...entries].reverse(),16);
  assert.deepEqual(reversed.manifest,index.manifest);
  assert.deepEqual(reversed.shards,index.shards);
  await assert.rejects(WarehouseIndexer.build([...entries,entries[0]],16),/Duplicate indexed/);
});
test('resolver includes concrete transitive dependencies and bundle compiles',async()=>{
  const resolver=new SourceDependencyResolver(registry);
  const result=resolver.resolve([{id:'source.game-movement'},{id:'source.game-aabb-collision'}],'typescript-web');
  assert.equal(result.ok,true);
  assert.ok(result.addedDependencies.includes('source.game-vector2@1.0.0'));
  assert.deepEqual(result.ordered.map(s=>s.id),['source.game-vector2','source.game-movement','source.game-aabb-collision']);
  const bundle=await emitter.emit(result.ordered,'typescript-web');
  assert.equal(bundle.files.length,3);
  const project=path.join(temp,'combined');
  for(const file of bundle.files){const name=path.join(project,file.path);fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,file.source);}
  cp.execFileSync('tsc',['--noEmit','--strict','--target','ES2022','--module','commonjs','--lib','ES2022,DOM',
    ...bundle.files.map(f=>path.join(project,f.path))],{cwd:root,stdio:'pipe',timeout:30000});
});
test('resolver refuses nonportable descriptions, missing versions, generator config omissions and missing symbols',()=>{
  const resolver=new SourceDependencyResolver(registry);
  assert.equal(resolver.resolve([{id:'source.theme-tokens'}],'typescript-web').errors[0].code,'GENERATOR_CONFIG_REQUIRED');
  assert.equal(resolver.resolve([{id:'source.theme-tokens',config:{background:'#101010',foreground:'#eeeeee',accent:'#333333'}}],'typescript-web').ok,true);
  assert.equal(resolver.resolve([{id:registry.list('host-runtime')[0].id}],'typescript-web').errors[0].code,'NON_EXECUTABLE');
  assert.equal(resolver.resolve([{id:'source.game-jump',version:'2.0.0'}],'typescript-web').errors[0].code,'UNKNOWN_BLOCK');
  assert.equal(resolver.resolve([{id:'source.game-jump'},{id:'source.game-jump'}],'typescript-web').errors[0].code,'SELECTION_CONFLICT');
});
test('resolver detects dependency cycles before emission',()=>{
  const base=registry.get('source.number-add');
  const a={...base,id:'source.test-a',outputPath:'src/warehouse/test-a.ts',requires:[{id:'source.test-b',version:'1.0.0',symbol:'addNumbers'}]};
  const b={...base,id:'source.test-b',outputPath:'src/warehouse/test-b.ts',requires:[{id:'source.test-a',version:'1.0.0',symbol:'addNumbers'}]};
  const isolated=new SourceBlockRegistry([a,b]);
  const result=new SourceDependencyResolver(isolated).resolve([{id:'source.test-a'}],'typescript-web');
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(e=>e.code==='CYCLIC_DEPENDENCY'));
});
test('recipes contain only registered target-compatible source modules and expand deterministically',async()=>{
  const recipes=new CompositionRecipeRegistry(builtInCompositionRecipes,registry);
  assert.deepEqual(recipes.list().map(x=>x.id),['recipe.platformer-core','recipe.notes-core']);
  const platformer=recipes.resolve('recipe.platformer-core','typescript-web');
  assert.equal(platformer.ok,true);
  assert.ok(platformer.ordered.some(x=>x.id==='source.game-vector2'));
  const bundle=await emitter.emit(platformer.ordered,'typescript-web');
  assert.ok(bundle.files.length>=8);
  assert.throws(()=>recipes.resolve('recipe.nonexistent','typescript-web'),/Unknown/);
});
test('index rejects unsafe manifests, unknown target filters, and oversized search requests',async()=>{
  const bad={...index.manifest,count:index.manifest.count+1};
  assert.throws(()=>new CapabilitySearchEngine(bad,{async readShard(){throw Error('not found');}}),/count mismatch/);
  await assert.rejects(engine.search({query:'x'.repeat(513)}),/Invalid warehouse search query/);
  await assert.rejects(engine.search({query:'game',limit:101}),/bounds/);
});
test('a reasoning-only native stop receives a visible truthful paused status instead of an empty assistant message',()=>{
  const terminationOut=path.join(temp,'termination-out');
  cp.execFileSync('tsc',['--target','ES2022','--module','commonjs','--outDir',terminationOut,
    path.join(root,'src/engine/construction/termination.ts')],{cwd:root,stdio:'pipe',timeout:30000});
  const {describeConstructionStop}=require(path.join(terminationOut,'termination.js'));
  const status=describeConstructionStop({finishReason:'stop',hadReasoning:true,hadAnswer:false,
    requestedTool:true,confirmedWrites:0,stage:'plan'});
  assert.match(status,/Source construction paused — not completed/);
  assert.match(status,/reasoning but no final answer or callable action/);
  assert.match(status,/Use \*\*Resume task\*\*/);
  assert.doesNotMatch(status,/completed successfully|automatically retried/i);
  const limited=describeConstructionStop({finishReason:'length',hadReasoning:true,hadAnswer:false,
    requestedTool:true,confirmedWrites:1,stage:'build'});
  assert.match(limited,/finish_reason=length/);
  assert.match(limited,/Confirmed writes in this attempt: 1/);
  const agentSource=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
  assert.match(agentSource,/answer = status;\s*onAnswer\(status\)/);
  assert.match(agentSource,/describeConstructionStop\(/);
});
test('curated lexical variants find real implementations without inventing swimming or unrelated capabilities',async()=>{
  const jumping=await engine.search({query:'jumping',target:'typescript-web'});
  assert.ok(jumping.matches.some(x=>x.capability.id==='source.game-jump'));
  const swimming=await engine.search({query:'swimming',target:'typescript-web'});
  assert.ok(!swimming.matches.some(x=>x.capability.id==='source.game-jump'));
  const movement=await engine.search({query:'moving',target:'typescript-web'});
  assert.ok(movement.matches.some(x=>x.capability.id==='source.game-movement'));
});
test('compatibility validation rejects unknown generator configuration and portable config rather than deferring to emission',()=>{
  const resolver=new SourceDependencyResolver(registry);
  const unknown=resolver.resolve([{id:'source.theme-tokens',config:{background:'#111111',foreground:'#222222',accent:'#333333',unexpected:true}}],'typescript-web');
  assert.equal(unknown.ok,false);assert.equal(unknown.errors[0].code,'INVALID_CONFIG');
  const portable=resolver.resolve([{id:'source.game-jump',config:{jumpForce:900}}],'typescript-web');
  assert.equal(portable.ok,false);assert.equal(portable.errors[0].code,'INVALID_CONFIG');
});
test('composition recipe search does not conflate recipes with executable warehouse capabilities',()=>{
  const recipes=new CompositionRecipeRegistry(builtInCompositionRecipes,registry);
  const found=recipes.search('platformer','typescript-web');
  assert.deepEqual(found.map(x=>x.id),['recipe.platformer-core']);
  const notes=recipes.search('notes','typescript-desktop');
  assert.deepEqual(notes.map(x=>x.id),['recipe.notes-core']);
  assert.deepEqual(recipes.search('teleportation','typescript-web'),[]);
});
test('reasoning-channel-open stops are identified without hallucinating an execution',()=>{
  const {describeConstructionStop}=require(path.join(temp,'termination-out','termination.js'));
  const report=describeConstructionStop({finishReason:'stop',hadReasoning:true,reasoningOpen:true,
    hadAnswer:false,requestedTool:true,confirmedWrites:0,stage:'inspect'});
  assert.match(report,/reasoning channel was still open/);
  assert.match(report,/chat template/);
});
test('a paused construction checkpoint retains its reason across Resume until an actual operation advances the task',()=>{
  const compileDir=path.join(temp,'construction-compiled');
  cp.execFileSync('tsc',['--target','ES2022','--module','commonjs','--outDir',compileDir,
    path.join(root,'src/engine/construction/session.ts'),path.join(root,'src/engine/construction/orchestrator.ts')],
    {cwd:root,stdio:'pipe',timeout:30000});
  const {ConstructionOrchestrator}=require(path.join(compileDir,'orchestrator.js'));
  const {createConstructionSession}=require(path.join(compileDir,'session.js'));
  const state=createConstructionSession({taskId:'task',sessionId:'chat',projectId:'project',projectRoot:'C:/Source',goal:'Build a notes app'});
  const runner=new ConstructionOrchestrator(state);runner.start();
  runner.settle('paused','No final response or tool call from the model.');
  assert.match(runner.context(),/Last pause: No final response/);
  const restored=new ConstructionOrchestrator(runner.snapshot);
  restored.resume('project','C:/Source');
  assert.match(restored.context(),/Last pause: No final response/);
  restored.observe({tool:'inspect_project',status:'completed'});
  assert.doesNotMatch(restored.context(),/Last pause:/);
});
test('on-disk index builder emits checkable public metadata and refuses to overwrite or accept corruption',()=>{
  const folder=path.join(temp,'generated-cli-index');
  const script=path.join(root,'scripts/build-dce-warehouse-index.cjs');
  cp.execFileSync('node',[script,'--out',folder],{cwd:root,stdio:'pipe',timeout:30000});
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
  assert.equal(manifest.count,29);
  assert.equal(manifest.countsByKind['knowledge-descriptor'],1);
  cp.execFileSync('node',[script,'--out',folder,'--check'],{cwd:root,stdio:'pipe',timeout:30000});
  assert.throws(()=>cp.execFileSync('node',[script,'--out',folder],{cwd:root,stdio:'pipe',timeout:30000}),/Index directory already exists/);
  const first=fs.readdirSync(path.join(folder,'shards'))[0];
  const shard=path.join(folder,'shards',first);
  fs.writeFileSync(shard,fs.readFileSync(shard,'utf8').replace('source.','source.corrupted-'));
  assert.throws(()=>cp.execFileSync('node',[script,'--out',folder,'--check'],{cwd:root,stdio:'pipe',timeout:30000}),/Changed warehouse shard/);
});
test('exact symbol, symbol kind and version filters locate real callable definitions without converting descriptors',async()=>{
  const results=await engine.search({query:'',symbol:'stepMovement',symbolKind:'function',version:'1.0.0',language:'typescript',target:'typescript-web'});
  assert.deepEqual(results.matches.map(x=>x.capability.id),['source.game-movement']);
  assert.deepEqual((await engine.search({query:'',symbol:'stepMovement',symbolKind:'interface'})).matches,[]);
  assert.deepEqual((await engine.search({query:'',symbol:'stepMovement',version:'2.0.0'})).matches,[]);
  await assert.rejects(engine.search({query:'',symbol:'../../unsafe'}),/Invalid warehouse search filter/);
});
test('the warehouse rejects source-bearing metadata, invalid counters, and malicious prototype-shaped search terms',async()=>{
  const baseline=index.shards[0].entries[0];
  await assert.rejects(WarehouseIndexer.build([{...baseline,generate(){return [{path:'evil.ts',source:'not a descriptor'}];}}],4),/Invalid or executable warehouse index descriptor/);
  await assert.rejects(WarehouseIndexer.build([{...baseline,description:'x'.repeat(2100)}],4),/Invalid or executable warehouse index descriptor/);
  const invalid={...index.manifest,countsByKind:{...index.manifest.countsByKind,'portable-source':999}};
  assert.throws(()=>new CapabilitySearchEngine(invalid,{async readShard(){throw Error('bad');}}),/kind-count mismatch/);
  const safe=await engine.search({query:'constructor',limit:5});
  assert.deepEqual(safe.matches,[]);
  await assert.rejects(engine.search({query:'',target:'unknown-platform'}),/Invalid warehouse search filter/);
});
test('indexed descriptors are immutable copies even if the original catalog object changes',async()=>{
  const raw={...index.shards[0].entries[0],description:'Immutable test descriptor'};
  const {shards}=await WarehouseIndexer.build([raw],2);
  raw.description='Mutated after indexing';
  assert.equal(shards[0].entries[0].description,'Immutable test descriptor');
  assert.equal(Object.isFrozen(shards[0].entries[0]),true);
});
test('optional semantic provider can retrieve a non-lexical candidate but cannot bypass the shard manifest',async()=>{
  const jumpShard=index.shards.find(shard=>shard.entries.some(e=>e.id==='source.game-jump'));
  const lookup=new Map(index.shards.map(shard=>[shard.id,shard]));
  const searched=new CapabilitySearchEngine(index.manifest,{async readShard(id){return lookup.get(id);}}, {
    async candidateShards(){return [jumpShard.id];},
    relevance(_query,entry){return entry.id==='source.game-jump'?78:0;},
  });
  const result=await searched.search({query:'aerial-action',limit:3});
  assert.equal(result.matches[0].capability.id,'source.game-jump');
  const malicious=new CapabilitySearchEngine(index.manifest,{async readShard(id){return lookup.get(id);}}, {
    async candidateShards(){return ['../../outside'];},relevance(){return 100;},
  });
  await assert.rejects(malicious.search({query:'aerial-action'}),/Unknown semantic shard suggestion/);
});
test('large queries respect an explicit scoring budget and truthfully report incomplete coverage',async()=>{
  const result=await engine.search({query:'source',limit:5,maxEntriesScored:2,maxShardReads:16});
  assert.equal(result.incomplete,true);
  assert.ok(result.matches.length<=2);
  assert.equal(result.shardsRead<=16,true);
  await assert.rejects(engine.search({query:'source',maxEntriesScored:0}),/Invalid warehouse search bounds/);
});
test('recipes and resolved selections cannot be changed by outside mutations after validation',()=>{
  const original={id:'recipe.immutable',description:'Immutable tested recipe',targets:['typescript-web'],selections:[{id:'source.game-jump'}]};
  const recipes=new CompositionRecipeRegistry([original],registry);
  original.targets[0]='unknown-platform';
  original.selections[0].id='source.unknown';
  const retained=recipes.resolve('recipe.immutable','typescript-web');
  assert.equal(retained.ok,true);
  assert.ok(retained.ordered.some(item=>item.id==='source.game-jump'));
  assert.equal(Object.isFrozen(retained.ordered[0]),true);
  assert.equal(Object.isFrozen(recipes.list()[0].targets),true);
});
test('external descriptor getters are rejected without being executed during metadata indexing',async()=>{
  const original=index.shards[0].entries[0];
  const descriptor={...original};
  Object.defineProperty(descriptor,'description',{enumerable:true,get(){throw Error('getter executed');}});
  await assert.rejects(WarehouseIndexer.build([descriptor],4),/Invalid or executable warehouse index descriptor/);
  const inherited=Object.create({description:'inherited'});
  for(const [key,value] of Object.entries(original)){if(key!=='description')inherited[key]=value;}
  await assert.rejects(WarehouseIndexer.build([inherited],4),/Invalid or executable warehouse index descriptor/);
});
