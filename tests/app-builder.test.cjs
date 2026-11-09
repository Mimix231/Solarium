const test=require('node:test');const assert=require('node:assert/strict');
const {AppBuilder,needsAppPlan,APP_AUTHORING_GUIDE}=require('../.test-dist/engine/intelligence/app-builder.js');
const {duplicatedCode}=require('../.test-dist/engine/intelligence/code-duplication.js');
const {VerificationLedger}=require('../.test-dist/engine/intelligence/commands.js');
const {selectActionTools,toolDefinitions}=require('../.test-dist/engine/tools.js');
const {decideToolPermission}=require('../.test-dist/engine/action-permissions.js');
const step=(id,files,depends_on=[])=>({id,title:id,files,depends_on,acceptance:['Actual user behaviour is exercised by native tests.']});
const passing=()=>{const ledger=new VerificationLedger();ledger.configure([{id:'script:test',verification:true,behavioral:true}]);ledger.record('script:test',{command:'npm test',exit_code:0,timed_out:false,stdout:'passed',stderr:'',source_before:'actual-source',source_after:'actual-source'});return ledger;};

test('application authoring asks for complete functionality without a length ceiling or padding',()=>{
 assert.equal(needsAppPlan('Build a complete task management app with persistence.'),true);
 assert.equal(needsAppPlan('Fix the linked existing project.'),false);
 assert.equal(needsAppPlan('Create a video editor phase 1 skeleton.'),false);
 assert.match(APP_AUTHORING_GUIDE,/no short-answer or 4,096-character ceiling/);assert.match(APP_AUTHORING_GUIDE,/Never inflate length/);
});
test('app plans retain original goals, dependencies and verified work across Resume',async()=>{
 const builder=new AppBuilder('Build my entire application',true),ledger=passing();builder.plan('Node with separated storage and UI',[step('storage',['src/store.js']),step('ui',['src/ui.js'],['storage'])]);
 await assert.rejects(builder.verifyStep('ui',['script:test'],async()=> 'export const ui=1;',ledger),/dependencies/);
 await builder.verifyStep('storage',['script:test'],async()=> 'export const store=1;',ledger);
 const restored=new AppBuilder('Resume',true,builder.data);assert.equal(restored.data.goal,'Build my entire application');assert.equal(restored.pending[0].id,'ui');assert.match(restored.context(),/Next ui/);
 assert.throws(()=>restored.plan('Replace with a starter',[step('only',['stub.js'])]),/already exists/);
 assert.equal((await restored.audit(async()=>'',ledger)).ok,false);
});
test('planned files must exist and actual native checks must be current before a step verifies',async()=>{
 const builder=new AppBuilder('Application',true);builder.plan('Actual modules',[step('feature',['src/feature.js'])]);
 await assert.rejects(builder.verifyStep('feature',['script:test'],async()=> 'code',new VerificationLedger()),/current native/);
 await assert.rejects(builder.verifyStep('feature',['script:test'],async()=>{throw Error('File missing');},passing()),/File missing/);
 assert.equal(builder.pending.length,1);
});
test('changed implementations reopen the affected feature before final application completion',async()=>{
 const builder=new AppBuilder('Application',true),ledger=passing();let source='export const result=42;';builder.plan('One module',[step('feature',['src/feature.js'])]);await builder.verifyStep('feature',['script:test'],async()=>source,ledger);
 assert.equal((await builder.audit(async()=>source,ledger)).ok,true);source='export const result=43;';const result=await builder.audit(async()=>source,ledger);assert.equal(result.ok,false);assert.deepEqual(result.pending,['feature']);
});
test('plans reject cycles, duplicate IDs and foreign/build-output destinations',()=>{
 for(const steps of [[step('a',['../foreign.js'])],[step('a',['dist/out.js'])],[step('a',['a.js'],['b']),step('b',['b.js'],['a'])],[step('a',['a.js']),step('a',['b.js'])]])assert.throws(()=>new AppBuilder('goal',true).plan('architecture',steps));
});
const body=Array.from({length:36},(_,i)=>`const value${i}=input+${i};`).join('\n');
test('duplication audit locates substantial same-file and cross-file repetition without changing originals',()=>{
 const source=`export function first(input){${body}return input;}\nexport function second(input){${body}return input;}`;
 const issues=duplicatedCode([{path:'src/repeated.js',content:source}]);assert.ok(issues.length);assert.equal(issues[0].first.path,'src/repeated.js');assert.ok(issues[0].tokens>=120);assert.match(source,/second/);
 assert.ok(duplicatedCode([{path:'src/a.js',content:body},{path:'src/b.js',content:'// different comment\n'+body}]).length);
 assert.equal(duplicatedCode([{path:'src/a.js',content:'export const a=1;'},{path:'src/b.js',content:'export const b=2;'}]).length,0);
 assert.equal(duplicatedCode([{path:'README.md',content:body+body}]).length,0);
});
test('a fully tested app still cannot complete with duplicated modules',async()=>{
 const builder=new AppBuilder('Application',true),ledger=passing();builder.plan('Shared behaviour',[step('first',['src/a.js']),step('second',['src/b.js'])]);for(const id of ['first','second'])await builder.verifyStep(id,['script:test'],async()=>body,ledger);const result=await builder.audit(async()=>body,ledger);assert.equal(result.ok,false);assert.ok(result.duplicates.length);
});
test('small-context paging keeps a real file writer alongside planning and exposes feature verification',()=>{
 const empty={rootEntryCount:0,fileCount:0,commands:[],checks:[]};const names=selectActionTools(toolDefinitions,{projectHasFiles:false,appStage:'plan',environment:empty,pending:[],contextSize:4096}).map(t=>t.function.name);assert.ok(names.includes('plan_project_app'));assert.ok(names.includes('apply_project_changes'));
 const verified=selectActionTools(toolDefinitions,{projectHasFiles:true,appStage:'implement',lastTool:'run_project_command',pending:[],failures:[],environment:{...empty,rootEntryCount:4,commands:[{id:'script:test'}]}}).map(t=>t.function.name);assert.ok(verified.includes('complete_app_step'));
 for(const name of ['plan_project_app','read_app_plan','complete_app_step']){const input={name,webEnabled:false,projectAttached:true};assert.equal(decideToolPermission({...input,mode:'ask'}),'ask');assert.equal(decideToolPermission({...input,mode:'yolo',configured:'deny'}),'deny');assert.equal(decideToolPermission({...input,mode:'auto',projectAttached:false}),'deny');}
});
