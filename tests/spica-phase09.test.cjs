'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
function evaluate(relative,mocks){
 const js=ts.transpileModule(read(relative),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},fileName:relative,reportDiagnostics:true});
 assert.equal(js.diagnostics?.length??0,0,relative);
 const module={exports:{}};
 vm.runInNewContext(js.outputText,{module,exports:module.exports,require:id=>{
  if(Object.hasOwn(mocks,id))return mocks[id];throw Error(`Unexpected ${relative} import: ${id}`);
 },TextEncoder,TextDecoder,crypto:require('node:crypto').webcrypto,console},{filename:relative});
 return module.exports;
}
const project={appId:'aabbccdd-1122-3344-5566-778899001122',revision:12,
 graph:{name:'Notes',schema:1},graphV2:undefined};
const plan={schema:1,name:'Notes',pages:[],program:{screens:[],flows:[],grants:[]},blocks:{'spica.block.list':1}};
const lowering=evaluate('src/spica/target-lowering.ts',{
 './graph':{compileGraph:()=>plan},
 './runtime/blocks/registry':{getBlock:(id,v)=>id==='spica.block.list'&&v===1?{id,targets:['desktop','web']}:null},
 './runtime/registry':{getRuntimeBlock:()=>({id:'spica.runtime.example'})},
});
test('target lowering supports real schema-1 app blocks on desktop and web',()=>{
 for(const target of ['desktop','web']){
  const result=lowering.inspectSpicaTarget(project,target);
  assert.equal(result.supported,true);
  assert.equal(result.ir.kind,'spica-app-ir');
  assert.equal(result.ir.revision,12);
 }
 const unknown={...project,graphV2:{migration:{strategy:'readonly-snapshot'},nodes:[{
  id:'manual',block:{id:'spica.runtime.ui_markdown_editor',version:'1',availability:'registered'}}]}};
 const report=lowering.inspectSpicaTarget(unknown,'web');
 assert.equal(report.supported,false);
 assert.equal(report.diagnostics[0].code,'V2_NOT_LOWERED');
 assert.throws(()=>lowering.lowerSpicaTarget(unknown,'desktop'),/V2_NOT_LOWERED/);
 assert.throws(()=>lowering.lowerSpicaTarget(project,'game'),/Unsupported/);
});
const raw={};
const emitSource=read('src/spica/emit.ts');
for(const m of emitSource.matchAll(/from '\.\/(target\/[^']+\?raw)'/g))raw['./'+m[1]]=read('src/spica/'+m[1].replace('?raw',''));
for(const m of emitSource.matchAll(/from '(\.\/[^']+\.ts\?raw|\.\.\/varmover\/[^']+\.ts\?raw)'/g)){
 raw[m[1]]=read(path.normalize(path.join('src/spica',m[1].replace('?raw',''))));
}
const emitter=evaluate('src/spica/emit.ts',{
 ...raw,
 './appearance':{appearanceCss:()=>'',STANDALONE_STYLE_SCOPE:'.spica'},
 './graph':{compileGraph:()=>plan,stableGraphJson:()=>JSON.stringify(plan)},
 './program':{blockRegistry:[]},
 './runtime/blocks/standalone':{inlineLegacyBlockRegistry:(src)=>src},
});
test('standalone browser emitter has real independent Vite, MUI and IndexedDB source, not a Tauri shim',()=>{
 const files=emitter.emitWeb(project);
 const desktop=emitter.emitTauri(project);
 assert.ok(Object.hasOwn(desktop,'src-tauri/Cargo.toml'));
 assert.ok(!Object.hasOwn(files,'src-tauri/Cargo.toml'));
 assert.ok(!Object.keys(files).some(name=>name.startsWith('src-tauri/')));
 assert.ok(files['src/main.tsx'].includes('webAdapters(design, APP_ID)'));
 assert.ok(files['src/main.tsx'].includes('createRoot(root).render'));
 assert.ok(!files['src/main.tsx'].includes("from '@tauri-apps/api/core'"));
 assert.ok(!files['src/main.tsx'].includes("invoke('save_record'"));
 assert.ok(files['src/graph.ts'].includes('indexedDB.open'));
 assert.ok(files['src/main.tsx'].includes("from '@mui/material'"));
 assert.ok(files['package.json'].includes('"build:web"'));
 assert.ok(files['index.html'].includes('Content-Security-Policy'));
 assert.ok(files['scripts/verify-web-build.mjs'].includes('dist-web/index.html'));
 assert.ok(!files['package.json'].includes('"@tauri-apps/api"'));
 assert.ok(Object.hasOwn(files,'src/plan.json'));
});
test('Phase 9 native integration uses web-specific artifact and lock evidence',()=>{
 const native=read('src-tauri/src/spica_preview.rs');
 const tauri=read('src-tauri/src/lib.rs');
 const exporter=read('src/spica/export.ts');
 const tools=read('src/spica/tools.ts');
 assert.match(native,/fn web_artifact_hash\(/);
 assert.match(native,/fn spica_web_lock_fingerprints\(/);
 assert.match(native,/fn spica_web_artifact_hash\(/);
 assert.match(tauri,/spica_preview::spica_web_artifact_hash/);
 assert.match(tauri,/spica_preview::spica_web_lock_fingerprints/);
 assert.match(exporter,/spica_web_artifact_hash/);
 assert.match(exporter,/spica_web_lock_fingerprints/);
 assert.match(exporter,/target === 'web' \? webChecks : desktopChecks/);
 assert.match(exporter,/lowerSpicaTarget\(record.data, target\)/);
 assert.match(tools,/define\('inspect_spica_target'/);
});

test('Workbench supports explicit verified web target without mistaking it for native launch',()=>{
  const ui=read('src/components/SpicaWorkbench.tsx');
  const timeline=read('src/components/spica/SpicaBuildTimeline.tsx');
  const exportSource=read('src/spica/export.ts');
  assert.match(ui,/value=\{exportTarget\}/);
  assert.match(ui,/value="web">Web \(Vite\)/);
  assert.match(ui,/exportSpica\(root, current, build\.record, target\)/);
  assert.match(ui,/verifySpica\(root, current, false, signal, output,/);
  assert.match(ui,/launch = exportTarget === 'desktop'/);
  assert.match(timeline,/target === 'web' \? webPhases : desktopPhases/);
  assert.match(exportSource,/currentSpicaTargetBuild/);
  assert.match(exportSource,/spica_web_artifact_hash/);
});
