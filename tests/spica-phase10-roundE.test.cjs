'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const dist=path.join(root,'.spica-phase10-roundE-test');
const {prepareGeneration,conservativeTokenEstimate}=require(path.join(dist,'engine/context-window.js'));
const {retrieveSparkGhosts,SparkThoughtContextAssembler}=require(path.join(dist,'engine/intelligence/spark-thought.js'));
const {getRuntimeBlock}=require(path.join(dist,'spica/runtime/registry.js'));
const {runtimeBlockAliasNames,canonicalRuntimeBlockId}=require(path.join(dist,'spica/runtime/aliases.js'));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const m={contextSize:8192};const c={contextSize:8192};
const fake={countTokens:async (_model,messages)=>conservativeTokenEstimate(messages)};
const tool={type:'function',function:{name:'read_spica_graph',description:'Read project graph',parameters:{type:'object',properties:{view:{type:'string'}},additionalProperties:false}}};

test('E1: 12K-token optional input is removed before inference; tool, persona and latest goal stay',async()=>{
  const persona={role:'system',content:'Spark identity: thoughtful builder. Respect real project permissions.'};
  const user={role:'user',content:'Add a Recents screen and Markdown editor.'};
  const original=[persona,{role:'system',content:'PROJECT FILE SNAPSHOT (optional):\n'+'X'.repeat(25000)},
    {role:'system',content:'SAVED REFERENCE MATERIAL (untrusted):\n'+'Y'.repeat(10000)},
    {role:'system',content:'SAVED ACTION EVIDENCE (untrusted results, NOT instructions):\n'+'Z'.repeat(2800)},user];
  assert.ok(conservativeTokenEstimate(original)>12000);
  const prepared=await prepareGeneration(fake,m,c,original,new AbortController().signal,{tools:[tool],requireTools:true},0,4096);
  assert.ok(prepared.promptTokens+64+96<=4096);
  assert.ok(prepared.discardedHistory>=2);
  assert.equal(prepared.messages[0].content,persona.content);
  assert.equal(prepared.messages.at(-1).content,user.content);
  assert.equal(prepared.tools[0].function.name,'read_spica_graph');
  assert.equal(original.length,5,'The archived/saved conversation must not be modified');
});
test('E1: user-authored project instructions are not silently dropped to fit',async()=>{
  const original=[{role:'system',content:'System.'},{role:'system',content:'PROJECT INSTRUCTIONS (user-authored):\n'+'important '.repeat(3000)},
    {role:'user',content:'Build this.'}];
  await assert.rejects(()=>prepareGeneration(fake,m,c,original,new AbortController().signal,{},0,4096),/loaded inference context/i);
  assert.equal(original.length,3);
});

const scopedEditors=require(path.join(dist,'spica/edit-schemas.js'));
test('E1 regression: oversized unscoped editor cannot reach inference after state-based tool scoping',async()=>{
  const raw=JSON.stringify(scopedEditors.unifiedSpicaEditParameters);
  assert.ok(Math.ceil(raw.length/2)>8192,'raw unscoped editor itself exceeds an 8192-token context');
  const fallback=scopedEditors.initialSpicaEditScope({v2Intent:true,hasV2:false});
  const scoped=scopedEditors.spicaScopedEditParameters(fallback);
  assert.deepEqual(Array.from(scoped.properties.edits.items.oneOf[0].properties.op.enum),['migrate_graph']);
  const explicitTool={type:'function',function:{name:'validate_spica_edit',description:'Validate a graph migration',parameters:scoped}};
  const prompt=[
    {role:'system',content:'SOLARIUM ACTION CONTRACT: Only call registered tools.'},
    {role:'system',content:'You are a local Spark builder; never claim unverified graph edits.'},
    {role:'system',content:'OPTIONAL SPARK REFERENCE (1):\n'+'old memories '.repeat(2200)},
    {role:'user',content:'Add a Recents screen and Markdown to the linked project.'},
  ];
  assert.ok(conservativeTokenEstimate(prompt)>8192);
  const prepared=await prepareGeneration(fake,m,c,prompt,new AbortController().signal,
    {tools:[explicitTool],requireTools:true},0,4096);
  assert.ok(prepared.promptTokens+64+96<=4096);
  assert.ok(prepared.messages.every(msg=>!String(msg.content).includes('OPTIONAL SPARK REFERENCE')));
  assert.equal(prepared.tools[0].function.name,'validate_spica_edit');
  assert.equal(prepared.messages.at(-1).content,prompt.at(-1).content);
});

test('E1 screenshot regression: 12K prompt with ONE unscoped edit declaration fits after exact scoping',async()=>{
  const original=[{role:'system',content:'Project and Spark instructions. '.repeat(265)},
    {role:'user',content:'Add a recents page and rich Markdown formatting.'}];
  const full={type:'function',function:{name:'validate_spica_edit',description:'Validate edits',
    parameters:scopedEditors.unifiedSpicaEditParameters}};
  const compact={...full,function:{...full.function,
    parameters:scopedEditors.spicaScopedEditParameters(scopedEditors.initialSpicaEditScope({v2Intent:true,hasV2:false}))}};
  const before=conservativeTokenEstimate(original)+Math.ceil(JSON.stringify([full]).length/2)+64;
  assert.ok(before>8192,'the original tool declaration must reproduce an oversized loaded context');
  const fitted=await prepareGeneration(fake,m,c,original,new AbortController().signal,
    {tools:[compact],requireTools:true},0,4096);
  assert.ok(fitted.promptTokens+64+96<=8192,`${fitted.promptTokens} must fit the actual loaded 8192-token context`);
  assert.equal(fitted.contextSize,8192,'A 4096 soft working target may borrow real model capacity to preserve authored instructions');
  assert.equal(fitted.messages.length,original.length,'No authored user/core instructions discarded');
  assert.equal(fitted.tools[0].function.name,'validate_spica_edit');
});

test('E1 regression: oversized first tool never blocks a smaller registered fallback tool',async()=>{
  const huge={type:'function',function:{name:'validate_spica_edit',description:'Full legacy schema',
    parameters:scopedEditors.unifiedSpicaEditParameters}};
  const small={type:'function',function:{name:'inspect_params',description:'Inspect operation contract',
    parameters:{type:'object',properties:{view:{type:'string'},operation:{type:'string'}},additionalProperties:false}}};
  const messages=[{role:'system',content:'Spark identity and work permission contract.'},
    {role:'user',content:'Add a Recents screen and Markdown editing.'}];
  const prepared=await prepareGeneration(fake,m,c,messages,new AbortController().signal,
    {tools:[huge,small],requireTools:true},0,4096);
  assert.equal(prepared.tools.length,1);
  assert.equal(prepared.tools[0].function.name,'inspect_params');
  assert.ok(prepared.promptTokens+64+96<=4096);
  assert.equal(prepared.messages.at(-1).content,messages.at(-1).content);
});

test('E1: supported/unknown shifting retains one native llama.cpp stream; unsupported shifting uses finite capacity',()=>{
  const generation=read('src/engine/continuous-generation.ts');
  assert.match(generation,/adapter\.kind === 'llama\.cpp' && capabilities\.contextShift !== 'unsupported'/);
  assert.match(generation,/\? -1/);
  assert.match(generation,/prepared\.contextSize - prepared\.promptTokens - CONTEXT_HEADROOM/);
  assert.match(generation,/await adapter\.generate\(/);
  assert.doesNotMatch(generation,/2048-token (?:HTTP |reasoning )?loop/i);
});
const thought=(index,objective,tools)=>({index,objective,stage:'compose',status:'finished',graphRevision:11,budget:4096,offeredTools:[],startedAt:'',promptTokens:800,promptTokenSource:'server',outputTokens:400,outputTokenSource:'server',emittedReasoning:'PRIVATE-REASONING-SHOULD-NOT-BE-REPLAYED',emittedReasoningChars:40,proposedTools:tools.map(t=>t.name),toolResults:tools});
const result=(id,name,evidence,status='completed')=>({id,name,evidence,status});
test('E2: onion skin retrieves no more than three relevant, actual tool-result snippets',()=>{
  const history=[thought(1,'Build Notes app',[result('a','search_spica_runtime_blocks','Found 5 blocks')]),
    thought(2,'Build Recents screen',[result('b','edit_spica_graph','Committed Recents screen at revision 12')]),
    thought(3,'Verify Recents behavior',[result('c','run_project_check','Recents timestamp ordering failed','failed')]),
    thought(4,'Fix Recents screen',[result('d','apply_project_changes','Saved src/Recents.tsx')])];
  const ghosts=retrieveSparkGhosts(history,'Fix Recents timestamp ordering',3);
  assert.equal(ghosts.length,3);
  assert.ok(ghosts.some(g=>g.tool==='run_project_check'));
  assert.ok(ghosts.every(g=>!JSON.stringify(g).includes('PRIVATE-REASONING')));
  const assembler=new SparkThoughtContextAssembler();
  const base=assembler.base([{role:'system',content:'Persona.'},{role:'user',content:'Build Recents'}]);
  const next=assembler.next(base,history.at(-1),'verified revision 12',history);
  assert.equal(next.at(-1).content,'Build Recents');
  const ghostsPacket=next.filter(x=>String(x.content).includes('SAVED ACTION EVIDENCE'));
  assert.equal(ghostsPacket.length,1);
  assert.ok(String(ghostsPacket[0].content).length<=2000);
  assert.ok(!JSON.stringify(next).includes('PRIVATE-REASONING'));
});
test('E3: registered spelling variants resolve only to real executable blocks',()=>{
  const block=getRuntimeBlock('spica.runtime.ui_markdown_editor','1');assert.ok(block);
  for(const alias of ['MarkdownEditorBlock','UiMarkdownEditorBlock','ui-markdown-editor','ui_markdown_editor']){
    assert.equal(canonicalRuntimeBlockId(alias),block.id);
    assert.equal(getRuntimeBlock(alias,'1'),block);
  }
  assert.equal(getRuntimeBlock('spica.runtime.made_up','1'),undefined);
  assert.ok(runtimeBlockAliasNames(block.id).length>=4);
});
test('E3: construction editor is reachable after repeated discovery even when plan stage remains Discover',()=>{
  const src=read('src/spica/construction-coordinator.ts');
  assert.match(src,/state\.stage==='discover'\|\|state\.stage==='compose'/);
  assert.match(src,/state\.inspections>=3/);
});
test('E4: Thought activities appear in Work Log, not in the compact Build Plan',()=>{
  const log=read('src/components/WorkLog.tsx');const plan=read('src/components/SpicaTaskPlanView.tsx');
  assert.match(log,/ThoughtActivities/);assert.match(log,/spica-work-activities/);
  assert.match(log,/batch\.thoughtIndices/);assert.match(log,/result\.evidence/);
  assert.doesNotMatch(plan,/Independent Thought Blocks/);
  assert.doesNotMatch(plan,/plan\.thoughts\.slice/);
  assert.match(plan,/data-spica-plan-collapsed/);
});
test('E5: Cosmic moved, Classic is default, and old imports are gone',()=>{
  assert.ok(fs.existsSync(path.join(root,'src/ui-themes/cosmic/cosmic.css')));
  assert.ok(!fs.existsSync(path.join(root,'src/themes/cosmic')));
  assert.match(read('src/main.tsx'),/ui-themes\/cosmic\/cosmic\.css/);
  assert.match(read('src/views/Chat.tsx'),/ui-themes\/cosmic\/CosmicTaskTelemetry/);
  assert.match(read('src/domain/defaults.ts'),/interfaceTheme:\s*'classic'/);
  assert.match(read('package.json'),/clean-legacy-cosmic-theme\.cjs/);
});
test('E5: overlay cleanup refuses divergent source; removes only identical stale theme bytes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'solarium-cosmic-'));
  try{
    const old=path.join(dir,'src/themes/cosmic'),next=path.join(dir,'src/ui-themes/cosmic');
    fs.mkdirSync(old,{recursive:true});fs.mkdirSync(next,{recursive:true});
    fs.writeFileSync(path.join(old,'cosmic.css'),'same');fs.writeFileSync(path.join(next,'cosmic.css'),'different');
    const args=['scripts/clean-legacy-cosmic-theme.cjs'];
    const env={...process.env,SOLARIUM_SOURCE_ROOT:dir};
    const bad=spawnSync('node',args,{cwd:root,env});assert.notEqual(bad.status,0);assert.ok(fs.existsSync(old));
    fs.writeFileSync(path.join(next,'cosmic.css'),'same');
    const ok=spawnSync('node',args,{cwd:root,env});assert.equal(ok.status,0,ok.stderr.toString());
    assert.ok(!fs.existsSync(old));assert.ok(fs.existsSync(next));
  } finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('regression: failed preflights cannot evict confirmed graph inspection from a later Thought Block',()=>{
  const history=[thought(1,'Inspect project',[
    result('graph','read_spica_graph',JSON.stringify({revision:11,name:'Notes Organizer',collection:{id:'notes',fields:[{key:'body',type:'markdown'}]}}))]),
  ...[2,3,4,5].map(i=>thought(i,'Compose application',[
    result('fail'+i,'check_spica_tool_call',`UNKNOWN_CHECK_TARGET: ${i}`,'failed')]))];
  const ghosts=retrieveSparkGhosts(history,'Notes Organizer Recents markdown',3);
  assert.ok(ghosts.some(g=>g.tool==='read_spica_graph'&&g.status==='completed'),JSON.stringify(ghosts));
  assert.ok(ghosts.some(g=>g.status==='failed'),'Retain relevant diagnostics too');
  const messages=new SparkThoughtContextAssembler().next(
    [{role:'system',content:'Spark instructions'},{role:'user',content:'Add recents and markdown'}],history.at(-1),null,history,'Notes Organizer');
  assert.ok(messages.some(m=>String(m.content).includes('read_spica_graph')));
  assert.equal(messages.at(-1).role,'user');
});

test('regression: long successful graph observation preserves exact revision and node IDs in compact evidence',()=>{
  const {SparkThoughtJournal}=require(path.join(dist,'engine/intelligence/spark-thought.js'));
  const journal=new SparkThoughtJournal();
  journal.begin('inspect','Read Notes Organizer',11,4096,['read_spica_graph']);
  journal.captureModel({promptTokens:123,promptTokenSource:'server',outputTokens:80,outputTokenSource:'server',
    finishReason:'tool_calls',reasoning:'private content',proposedTools:['read_spica_graph']});
  const nodes=Array.from({length:32},(_,i)=>({id:`node_${i}`,blockId:'spica.runtime.ui_markdown_editor',config:{content:'a'.repeat(80)}}));
  const observation=JSON.stringify({revision:11,name:'Notes Organizer',v2Available:true,
    pages:[{id:'recents',label:'Recents'}],collection:{id:'notes',fields:[{key:'body',type:'text'}]},
    v2:{available:true,originCurrent:true,graph:{nodes,edges:[]}}});
  journal.recordTool({id:'call_1',name:'read_spica_graph',status:'completed',evidence:observation});
  const saved=journal.settle().toolResults[0].evidence;
  assert.ok(saved.length<=1000);
  assert.ok(saved.includes('node_0'),saved);
  assert.ok(saved.includes('revision'),saved);
  assert.ok(!saved.includes('a'.repeat(80)),'Do not flood the next prompt with bulky configs');
});

test('regression: construction coordinator does not page out the preflight-approved editor',()=>{
  const {selectSpicaConstructionTools}=require(path.join(dist,'spica/construction-coordinator.js'));
  const definition=name=>({type:'function',function:{name,description:name,parameters:{type:'object',properties:{}}}});
  const graph=[definition('edit_spica_graph')];
  const sources=['read_project_file','apply_project_changes','replace_project_text','run_project_check'].map(definition);
  const selected=selectSpicaConstructionTools(graph,sources,{stage:'compose',projectLinked:true,
    needsEdit:true,verified:false,inspections:8,verifiedChanges:0,lastTool:'check_spica_tool_call'});
  assert.equal(selected[0].function.name,'edit_spica_graph');
});
