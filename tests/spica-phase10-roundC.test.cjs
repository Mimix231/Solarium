'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const fromSource=file=>fs.readFileSync(path.join(root,file),'utf8');
const moduleAt=moduleName=>require(path.join(root,'.spica-phase10-test',moduleName+'.js'));
const {starterGraph,changeGraph}=moduleAt('spica/graph');
const {normalizeSpicaEditArguments,spicaEditOperationSchema,editScopeFromArguments,verifiedSpicaEditScope,unifiedSpicaEditParameters}=moduleAt('spica/edit-schemas');
const {SparkActionBatchJournal}=moduleAt('engine/intelligence/spark-action-batches');
const {SpicaTaskOrchestrator,createSpicaPlan}=moduleAt('engine/intelligence/spica-task-orchestrator');

test('Round C: single-operation field edit normalizes into canonical version-checked transaction',()=>{
  const original=starterGraph('Notes','notes');
  const input=normalizeSpicaEditArguments({revision:11,edit_type:'set_field_property',collection_id:'notes',field_key:'body',property:'format',new_value:'markdown'});
  assert.equal(input.revision,11);
  assert.deepEqual(input.edits,[{op:'set_field_property',collection_id:'notes',field_key:'body',property:'format',new_value:'markdown'}]);
  const updated=changeGraph(original,input.edits);
  assert.equal(updated.collection.fields.find(f=>f.key==='body').format,'markdown');
  assert.equal(original.collection.fields.find(f=>f.key==='body').format,undefined,'review must not mutate the original graph');
  assert.ok(editScopeFromArguments({revision:11,edit_type:'set_field_property',collection_id:'notes',field_key:'body',property:'format',new_value:'markdown'}));
});
test('Round C: old edit batch retains behavior, mixed shorthand is rejected, unsupported graph operations stay uncallable',()=>{
  assert.deepEqual(normalizeSpicaEditArguments({revision:12,edits:[{op:'rename',name:'Hello'}]}).edits,[{op:'rename',name:'Hello'}]);
  assert.throws(()=>normalizeSpicaEditArguments({revision:12,edit_type:'rename',edits:[{op:'rename',name:'Hey'}]}),/either edits or edit_type/);
  assert.throws(()=>normalizeSpicaEditArguments({revision:12,edit_type:'imaginary_new_operation'}),/not registered/);
  assert.equal(verifiedSpicaEditScope({view:'v2',operations:['imaginary_new_operation']}),null);
  assert.ok(spicaEditOperationSchema('v2','migrate_graph'));
  assert.ok(spicaEditOperationSchema('v2','compose_blocks'));
  assert.ok(spicaEditOperationSchema('schema1','set_field_property'));
  assert.deepEqual(unifiedSpicaEditParameters.required,['revision']);
});
test('Round C: edit arguments have strict property and value validation',()=>{
  const base=starterGraph('Notes','notes');
  assert.throws(()=>changeGraph(base,[{op:'set_field_property',collection_id:'notes',field_key:'body',property:'format',new_value:'not-a-format'}]),/format plain or markdown/);
  assert.throws(()=>changeGraph(base,[{op:'set_field_property',collection_id:'notes',field_key:'unknown',property:'format',new_value:'markdown'}]),/does not exist/);
  assert.throws(()=>changeGraph(base,[{op:'set_field_property',collection_id:'notes',field_key:'body',property:'multiline',new_value:'yes'}]),/Boolean multiline/);
});
test('Round C: a batch groups distinct tool turns and does NOT checkpoint after inspection',()=>{
  const journal=new SparkActionBatchJournal();
  journal.enter('compose','Build Recents screen',11,1);
  journal.recordUsage(680,120);journal.recordTool('inspect_spica_runtime_block','completed');
  assert.equal(journal.checkpoint({revision:11,verified:false,stage:'compose',stepEvidence:[],lastTool:'inspect_spica_runtime_block'}),null);
  journal.enter('compose','Build Recents screen',11,2);
  journal.recordUsage(930,210);journal.recordTool('edit_spica_graph','completed');
  const sealed=journal.checkpoint({revision:12,verified:false,stage:'compose',stepEvidence:['Saved screen nodes'],lastTool:'edit_spica_graph'});
  assert.deepEqual(sealed.thoughtIndices,[1,2]);
  assert.equal(sealed.toolCalls,2);assert.equal(sealed.inspections,1);assert.equal(sealed.promptTokens,1610);
  assert.equal(sealed.status,'checkpointed');
  assert.ok(journal.lastCheckpoint().includes('Saved screen nodes'));
  journal.enter('verify','Check the Recents screen',12,3);
  assert.equal(journal.current.index,2);assert.deepEqual(journal.current.thoughtIndices,[3]);
});
test('Round C: persisted interrupted batches do not replay writes or pretend to be checkpoints',()=>{
  const previous=new SparkActionBatchJournal();previous.enter('compose','Build Recents screen',4,1);
  previous.recordTool('edit_spica_graph','completed');
  const resumed=new SparkActionBatchJournal(previous.history);
  assert.equal(resumed.current.status,'paused');assert.equal(resumed.lastCheckpoint(),null);
  const retry=resumed.enter('compose','Read saved graph',4,2);
  assert.equal(retry.status,'active');assert.equal(retry.index,2);
  assert.equal(retry.toolCalls,0);
});
test('Round C: migration revision is tracked, but NOT treated as a completed application feature',()=>{
  const plan=createSpicaPlan('task','session','project','Create a Recents screen',11);
  const orchestrator=new SpicaTaskOrchestrator(plan);
  orchestrator.observe('edit_spica_graph','completed',{graphRevision:12,migrationOnly:true});
  assert.equal(orchestrator.plan.graphRevision,12);
  assert.notEqual(orchestrator.plan.steps.find(step=>step.id==='discover').state,'completed');
  assert.notEqual(orchestrator.plan.steps.find(step=>step.id==='compose').state,'completed');
  orchestrator.observe('edit_spica_graph','completed',{graphRevision:13});
  assert.equal(orchestrator.plan.steps.find(step=>step.id==='compose').state,'completed');
  orchestrator.observe('verify_spica_app','completed',{graphRevision:13,verified:true});
  assert.equal(orchestrator.plan.status,'completed');
});
test('Round C: Classic default, Cosmic isolated and references available',()=>{
  const defaults=fromSource('src/domain/defaults.ts');
  const shell=fromSource('src/components/Shell.tsx');
  const chat=fromSource('src/views/Chat.tsx');
  const css=fromSource('src/ui-themes/cosmic/cosmic.css');
  assert.match(defaults,/interfaceTheme:\s*'classic'/);
  assert.match(shell,/interfaceTheme:cosmic\?'classic':'cosmic'/);
  assert.match(shell,/data-cosmic-toggle/);
  assert.match(chat,/CosmicTaskTelemetry/);
  assert.match(chat,/cosmic-plan-rail/);
  assert.match(css,/:root\[data-interface='cosmic'\]/);
  assert.match(css,/cosmic-telemetry-panel/);
  assert.ok(!/:root\[data-motion='reduced'\]\[data-interface='cosmic'\] \*,\s*@media/.test(css));
  for(let i=1;i<=5;i++)assert.ok(fs.statSync(path.join(root,'docs/design/cosmic',`concept-${i}.png`)).size>50000);
});
test('Round C: UI exposes saved action batch checkpoints with no fabricated completions',()=>{
  const view=fromSource('src/components/SpicaTaskPlanView.tsx');
  const telemetry=fromSource('src/ui-themes/cosmic/CosmicTaskTelemetry.tsx');
  const log=fromSource('src/components/WorkLog.tsx');
  assert.doesNotMatch(view,/Independent Thought Blocks/);
  assert.match(log,/spica-work-activities/);assert.match(log,/batch.checkpoint/);
  assert.match(telemetry,/verifiedChanges/);assert.match(telemetry,/batches/);
});

test('Round C: new Spark toolchain exposes canonical graph APIs and reports compatibility aliases separately',()=>{
  const {listSpicaToolchain}=moduleAt('spica/tool-intelligence');
  const definition=name=>({type:'function',function:{name,description:name,parameters:{type:'object',properties:{revision:{type:'integer'}},required:['revision'],additionalProperties:false}}});
  const definitions=['edit_spica_graph','run_spica_graph','migrate_spica_v2_graph','compose_spica_v2_graph','run_spica_v2_graph'].map(definition);
  const chain=listSpicaToolchain(definitions,{hasGraph:true,hasV2:true,revision:13,linkedFolder:true});
  assert.deepEqual(chain.actions.map(item=>item.name),['edit_spica_graph','run_spica_graph']);
  assert.equal(chain.compatibilityAliases.migrate_spica_v2_graph,'edit_spica_graph');
  assert.equal(chain.compatibilityAliases.run_spica_v2_graph,'run_spica_graph');
  const source=fromSource('src/spica/tools.ts');
  assert.match(source,/define\('run_spica_graph'/);
  assert.match(source,/name === 'run_spica_v2_graph' \|\| name === 'run_spica_graph'/);
});
