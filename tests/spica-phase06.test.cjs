'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const compiled=path.join(root,'.spica-phase06-test/spica');
const {starterGraph,changeGraph,compileGraph}=require(path.join(compiled,'graph.js'));
const {auditSpicaDesign,spicaContrast}=require(path.join(compiled,'professionalism.js'));
const {memoryAdapters}=require(path.join(compiled,'data.js'));
const {emptySpicaGraphV2}=require(path.join(compiled,'graph-v2/types.js'));
const {makeRuntimeNode,executeSpicaGraphV2}=require(path.join(compiled,'runtime/executor.js'));
const {validateSpicaGraphV2}=require(path.join(compiled,'graph-v2/validation.js'));
const {listRuntimeBlocks,getRuntimeBlock}=require(path.join(compiled,'runtime/registry.js'));
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const text=file=>fs.readFileSync(path.join(root,file),'utf8');
const edge=(id,from,output,to,input)=>({id,kind:'data',from:{node:from,port:output},to:{node:to,port:input}});

test('all eight professional category adapters are separate registered source modules',()=>{
  const added=['theme_palette','derived_value','format_label','responsive_split','glass_surface','app_navigation','material_button','field_audit'];
  const registered=listRuntimeBlocks();assert.ok(registered.length>=14);
  for(const id of added){
    const entry=getRuntimeBlock('spica.runtime.'+id,'1');assert.ok(entry,id);
    assert.equal(entry.trust,'built-in');assert.ok(entry.targets.includes('desktop'));assert.deepEqual(entry.permissions,[]);
  }
  const registry=text('src/spica/runtime/registry.generated.ts');
  for(const id of added)assert.match(registry,new RegExp('\\b'+id.replace(/_/g,'-')+'\\b'));
});

test('UI/layout/appearance/interface graph composes executable typed descriptors',async()=>{
  const graph=emptySpicaGraphV2('preview.theme','Polished demo');
  graph.nodes=[
    makeRuntimeNode('note','spica.runtime.note_record',{title:'Reminder',body:'SPICA is working'}),
    makeRuntimeNode('card','spica.runtime.note_card'),
    makeRuntimeNode('glass','spica.runtime.glass_surface',{strength:'regular'}),
    makeRuntimeNode('split','spica.runtime.responsive_split',{ratio:0.35}),
    makeRuntimeNode('nav','spica.runtime.app_navigation',{title:'Notes',items:['Home','Settings']}),
  ];
  graph.edges=[edge('a','note','note','card','note'),edge('b','card','view','glass','content'),
    edge('c','card','view','split','left'),edge('d','glass','view','split','right'),edge('e','split','view','nav','body')];
  const validation=validateSpicaGraphV2(graph,{requireComplete:true});assert.equal(validation.valid,true,JSON.stringify(validation.errors));
  const result=await executeSpicaGraphV2(graph,{target:'desktop',grants:new Set()});
  assert.equal(result.state,'passed',result.error);
  assert.equal(result.outputs.nav.view.renderer,'spica.interface.navigation');
  assert.equal(result.outputs.nav.view.body.renderer,'spica.layout.responsive_split');
  assert.equal(result.outputs.nav.view.body.right.renderer,'spica.appearance.glass_surface');
  assert.equal(result.outputs.nav.view.items[1],'Settings');
});

test('new blocks reject unknown or unsafe configuration and retain typed outputs',async()=>{
  const palette=getRuntimeBlock('spica.runtime.theme_palette','1');
  const valid={background:'#101B35',surface:'#1C2744',accent:'#8871EE',text:'#FFFFFF'};
  assert.doesNotThrow(()=>palette.validateConfig(valid));
  assert.throws(()=>palette.validateConfig({...valid,background:'red'}),/theme_palette/);
  const nav=getRuntimeBlock('spica.runtime.app_navigation','1');
  assert.throws(()=>nav.validateConfig({title:'Demo',items:['Home'],script:'alert(1)'}),/only/);
  const field=getRuntimeBlock('spica.runtime.field_audit','1');
  const result=await field.execute({}, {label:'click here'},{});
  assert.equal(result.passed,false);assert.ok(result.findings.some(x=>x.includes('descriptive')));
  const material=getRuntimeBlock('spica.runtime.material_button','1');
  assert.throws(()=>material.validateConfig({variant:'<script>'}),/variant/);
  assert.equal((await material.execute({},{label:'Save'},{variant:'contained'})).view.label,'Save');
});

test('preview sample store survives an added record field and preserves notes across graph revisions',async()=>{
  const old=starterGraph('Live Notes','notes');
  const memory={};
  const initial=memoryAdapters(compileGraph(old),true,memory);
  const query={collection:'notes',query:'',archived:false,filter:null,offset:0};
  const first=await initial.records.list(query);
  assert.equal(first.rows.length,2);
  const added=changeGraph(old,[{op:'add_record_field',collection:'notes',field:{key:'priority',label:'Priority',type:'number',min:0,max:5}}]);
  const next=memoryAdapters(compileGraph(added),true,memory);
  const second=await next.records.list(query);
  assert.deepEqual(second.rows.map(r=>r.values.title),first.rows.map(r=>r.values.title));
  assert.equal(second.rows[0].values.priority,0);
  assert.equal(second.rows[0].revision,first.rows[0].revision+1);
});

test('professional audit spots low contrast, missing labels, and duplicate navigation',()=>{
  assert.ok(spicaContrast('#FFFFFF','#000000')>20);
  assert.ok(spicaContrast('#777777','#777777')<4.5);
  const graph=starterGraph('Audit','notes');
  graph.appearance={...(graph.appearance??{}),theme:{...(graph.appearance?.theme??{}),text:'#777777',background:'#777777'}};
  const report=auditSpicaDesign(graph);
  assert.equal(report.passed,false);
  assert.ok(report.findings.some(item=>item.code==='LOW_CONTRAST'));
});

test('preview and export use identical versioned Material components, with preserved scenario selectors',()=>{
  const action=text('src/spica/target/ui/buttons/SpicaAction.tsx');
  const workflow=text('src/spica/target/WorkflowApp.tsx');
  const collection=text('src/spica/target/CollectionApp.tsx');
  const settings=text('src/spica/target/SettingsApp.tsx');
  const surface=text('src/spica/target/SpicaUiTheme.tsx');
  assert.match(workflow,/route=\{item\.id\}/);assert.match(workflow,/submitFlow=\{screen\.submit\}/);
  assert.match(action,/data-spica-route=\{route\}/);assert.match(action,/data-spica-submit=\{submitFlow\}/);
  assert.match(collection,/data-spica-sort/);assert.match(collection,/SpicaTextInput/);
  assert.match(settings,/SpicaMaterialProvider/);
  assert.match(surface,/ThemeProvider/);assert.match(surface,/createCache/);
  assert.match(text('src/components/SpicaPreview.tsx'),/memoryAdapters\(plan, true, previewMemory.current\)/);
});

test('actual emitter ships MUI components, secure Emotion style nonce, shared UI implementation',()=>{
  const source=text('src/spica/emit.ts');
  const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  const fakeModule={exports:{}};
  const requireStub=id=>{
    if(id.endsWith('?raw'))return {__esModule:true,default:fs.readFileSync(path.resolve(root,'src/spica',id.slice(0,-4)),'utf8')};
    if(['./graph','./appearance','./program','./runtime/blocks/standalone'].includes(id))return require(path.join(compiled,id.replace(/^\.\//,'')+'.js'));
    throw Error('Unexpected module '+id);
  };
  new Function('module','exports','require',transpiled)(fakeModule,fakeModule.exports,requireStub);
  const output=fakeModule.exports.emitTauri({appId:'phase6-test',revision:9,graph:starterGraph('Phase 6','notes')});
  const pkg=JSON.parse(output['package.json']);
  assert.ok(pkg.dependencies['@mui/material']);assert.ok(pkg.dependencies['@emotion/react']);assert.ok(pkg.dependencies['@emotion/cache']);
  assert.match(output['src/main.tsx'],/function SpicaMaterialProvider/);
  assert.match(output['src/main.tsx'],/function SpicaTextInput/);
  assert.match(output['src/main.tsx'],/function SpicaAction/);
  assert.match(output['src/main.tsx'],/function SpicaOptionSelect/);
  assert.match(output['src/main.tsx'],/function SpicaToggle/);
  assert.match(output['src/main.tsx'],/data-spica-submit=\{submitFlow\}/);
  assert.doesNotMatch(output['src/main.tsx'],/from ['"]\.\/ui\//);
  const syntax=ts.transpileModule(output['src/main.tsx'],{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true});
  assert.deepEqual(syntax.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[]);
  const nonce='spica-style-phase6-test';
  assert.match(output['index.html'],new RegExp(nonce));
  const csp=JSON.parse(output['src-tauri/tauri.conf.json']).app.security.csp;
  assert.match(csp,new RegExp("style-src 'self' 'nonce-"+nonce+"'"));
  assert.doesNotMatch(csp,/unsafe-inline/);
});
