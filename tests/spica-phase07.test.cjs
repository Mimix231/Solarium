 'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');const built=path.join(root,'.spica-phase07-test/spica');
const {listSpicaToolchain,inspectSpicaTool,inspectSpicaWiring,spicaToolPrerequisites}=require(path.join(built,'tool-intelligence.js'));
const {classifySpicaIntent}=require(path.join(built,'intent.js'));
const {listRuntimeBlocks,getRuntimeBlock}=require(path.join(built,'runtime/registry.js'));
const {previewSpicaComposition}=require(path.join(built,'runtime/composition.js'));
const {executeSpicaGraphV2}=require(path.join(built,'runtime/executor.js'));
const {emptySpicaGraphV2}=require(path.join(built,'graph-v2/types.js'));
const src=name=>fs.readFileSync(path.join(root,name),'utf8');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const simpleTypes={type:'object',properties:{revision:{type:'integer'},edits:{type:'array'}},required:['revision','edits'],additionalProperties:false};
const tools=[
  {type:'function',function:{name:'edit_spica_graph',description:'Commit graph edits',parameters:simpleTypes}},
  {type:'function',function:{name:'read_spica_graph',description:'Read authoritative graph revision',parameters:{type:'object',properties:{},additionalProperties:false}}},
  {type:'function',function:{name:'inspect_spica_tool',description:'Inspect exact schema',parameters:{type:'object',properties:{name:{type:'string'}},required:['name'],additionalProperties:false}}},
];

test('Phase 7 adds a broad real executable block registry, not 10K metadata-only placeholders',()=>{
  const registered=listRuntimeBlocks();assert.ok(registered.length>=100);
  assert.equal(new Set(registered.map(b=>b.id)).size,registered.length);
  const categories=new Set(registered.map(b=>b.category).filter(Boolean));
  for(const cat of ['ui','functions','styling','layout','professionalism'])assert.ok(categories.has(cat),cat);
  const manifest=src('src/spica/runtime/registry.generated.ts');
  assert.equal((manifest.match(/^import adapter\d+ from/gm)||[]).length,registered.length);
  const searched=registered.filter(b=>/markdown|sort|date|list|grid|card/i.test(b.id));
  assert.ok(searched.length>=8,'features must be assembled from general-purpose executable capabilities');
});

test('toolchain is derived from registered schemas with precise required args and current prerequisites',()=>{
  const state={hasGraph:true,hasV2:false,revision:12,linkedFolder:true};
  const chain=listSpicaToolchain(tools,state);
  assert.equal(chain.actions.length,tools.length);
  const edit=chain.actions.find(action=>action.name==='edit_spica_graph');
  assert.deepEqual(edit.required,['revision','edits']);assert.equal(edit.mutatesOrExecutes,true);
  const detail=inspectSpicaTool(tools,'edit_spica_graph',state);
  assert.equal(detail.schema,tools[0].function.parameters,'must use the same exact registered schema, not a parallel invented contract');
  assert.equal(detail.revision,12);assert.deepEqual(detail.required,['revision','edits']);
  assert.deepEqual(spicaToolPrerequisites('compose_spica_v2_graph',state),['Graph migration required: edit_spica_graph with view:v2, edits:[{op:migrate_graph}].']);
  const unknown=inspectSpicaTool(tools,'nonexistent',state);assert.equal(unknown.ok,false);
});

test('read-only tool and wiring discovery does not generate files or silently connect arbitrary ports',()=>{
  const map=inspectSpicaWiring(['spica.runtime.note_record','spica.runtime.note_card','spica.runtime.glass_surface']);
  assert.ok(map.compatible.some(c=>c.from==='spica.runtime.note_card'&&c.output==='view'&&c.input==='content'));
  assert.ok(map.compatible.some(c=>c.from==='spica.runtime.note_record'&&c.output==='note'&&c.input==='note'));
  assert.throws(()=>inspectSpicaWiring(['spica.runtime.not_a_block']),/Unknown executable/);
  assert.throws(()=>inspectSpicaWiring(['spica.runtime.ui_card','spica.runtime.ui_card']),/unique/);
  assert.deepEqual(map.blocks.map(b=>b.version),['1','1','1']);
});

test('arbitrary registered block composition validates and executes real typed nodes',async()=>{
  const graph=emptySpicaGraphV2('demo.assembly','Demo');
  const plan={nodes:[
    {id:'note',blockId:'spica.runtime.note_record',config:{title:'Hello',body:'Real block assembly'}},
    {id:'card',blockId:'spica.runtime.note_card'},
    {id:'glass',blockId:'spica.runtime.glass_surface',config:{strength:'regular'}},
  ],connections:[
    {from:'note',output:'note',to:'card',input:'note'},
    {from:'card',output:'view',to:'glass',input:'content'},
  ]};
  const reviewed=previewSpicaComposition(graph,plan);
  assert.equal(reviewed.diagnostics.valid,true);assert.equal(reviewed.complete,true);
  assert.equal(graph.nodes.length,0,'dry run must never mutate source graph');
  const executed=await executeSpicaGraphV2(reviewed.graph,{target:'desktop',grants:new Set()});
  assert.equal(executed.state,'passed',executed.error);
  assert.equal(executed.outputs.glass.view.renderer,'spica.appearance.glass_surface');
  assert.throws(()=>previewSpicaComposition(graph,{nodes:[{id:'bad',blockId:'spica.runtime.unknown'}],connections:[]}),/not executable/);
});

test('project-aware intent routes imperatives to action and never confuses conceptual questions with edits',()=>{
  assert.equal(classifySpicaIntent('Dona, add a Recents page with Markdown formatting',true),'edit');
  assert.equal(classifySpicaIntent('Add an accessible data table and responsive toolbar',true),'edit');
  assert.equal(classifySpicaIntent('How would you build a Markdown notes page?',true),'discuss');
  assert.equal(classifySpicaIntent('Imagine a better editor',true),'discuss');
  assert.equal(classifySpicaIntent('Add a notes editor',false),'none');
  assert.ok(!src('src/spica/intent.ts').includes('supportedSpicaFeatures'));
});

test('Spark action stage offers exact introspection and preflight without calling an implementation shortcut',()=>{
  const code=src('src/spica/tools.ts');
  assert.match(code,/define\('list_spica_toolchain'/);
  assert.match(code,/define\('inspect_spica_tool'/);
  assert.match(code,/define\('check_spica_tool_call'/);
  assert.match(code,/define\('inspect_spica_wiring'/);
  assert.match(code,/validatedAction\?: string/);
  assert.doesNotMatch(code,/normalizeSpicaProposal/);
  const agent=src('src/engine/agent.ts');
  assert.match(agent,/check_spica_tool_call/);
  assert.match(agent,/stableGraphJson\(canonicalArguments\)/);
  assert.match(agent,/Missing matching preflight/);
  assert.doesNotMatch(agent,/buildSupportedSpicaTemplate|runSupportedSpicaChange/);
  assert.doesNotMatch(agent,/normalizeSpicaProposal/);
  assert.match(agent,/if \(spica && taskBlocked\)/);
});

test('permission and source-ownership gates remain authoritative',()=>{
  const permission=src('src/engine/action-permissions.ts');
  assert.match(permission,/compose_spica_v2_graph/);
  const agent=src('src/engine/agent.ts');
  assert.match(agent,/await authorize\(call\.function\.name/);
  assert.match(agent,/taskBlocked = true/);
  const stage=src('src/spica/tools.ts');
  assert.match(stage,/if \(!project\.folder\) throw Error\('Link a standalone output folder first\.'\)/);
  assert.match(stage,/reviewSpicaEdit/);
});

test('visual preview discovers all registered renderer blocks rather than hardcoding UI name prefixes',()=>{
  const source=src('src/components/spica/SpicaLivePreviewPane.tsx');
  assert.match(source,/getRuntimeBlock\(node\.block\.id,node\.block\.version\)\?\.kind === 'renderer'/);
  assert.doesNotMatch(source,/startsWith\('spica\.runtime\.ui_'\)/);
  assert.equal(getRuntimeBlock('spica.runtime.glass_surface','1')?.kind,'renderer');
});
