'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const transpile=file=>ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded=new Map();
function load(file){
  if(loaded.has(file))return loaded.get(file);
  const mod={exports:{}};loaded.set(file,mod.exports);
  vm.runInNewContext(transpile(file),{module:mod,exports:mod.exports,console,require(id){
    const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),id+'.ts'));
    if(!relative.startsWith('src/'))throw Error('Unexpected import '+id);
    return load(relative);
  }});
  loaded.set(file,mod.exports);return mod.exports;
}
const {ToolContractRegistry,ToolArgumentResolver,ToolExecutionCoordinator,ToolCallValidator,offerToolCorrection}=load('src/engine/intelligence/tool-contract-intelligence.ts');
const {fictionProfileToolForStage,nextFictionProfileProgress}=load('src/engine/intelligence/fiction-profile-contract.ts');
const {validationRecovery,runtimeFailureRecovery}=load('src/engine/intelligence/tool-recovery.ts');
const simple=(name,properties,required=[])=>({type:'function',function:{name,description:name,parameters:{type:'object',properties,required,additionalProperties:false}}});
const profile=simple('save_fiction_profiles',{
  story:{type:'object',properties:{title:{type:'string',minLength:1},franchise:{type:'string',minLength:1}},required:['title','franchise'],additionalProperties:false},
  profiles:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},kind:{type:'string',enum:['original','canon','adapted']},sections:{type:'object',properties:{personality:{type:'string'}},additionalProperties:false}},required:['name','kind','sections']}},
},['profiles']);
const iona={name:'Iona',kind:'adapted',sections:{personality:'Calm and capable'}};
const call=(profiles,story)=>({profiles,...(story?{story}:{})});

test('new Story World requires actual title and franchise in the displayed profile contract',()=>{
  const staged=fictionProfileToolForStage(profile,false);
  const reg=new ToolContractRegistry([staged]);
  assert.deepEqual([...staged.function.parameters.required],['profiles','story']);
  const missing=reg.validate('save_fiction_profiles',call([iona]));
  assert.equal(missing.ok,false);assert.match(missing.error.message,/story is required/);
  const valid=reg.validate('save_fiction_profiles',call([iona],{title:'River Republic AU',franchise:'River Republic'}));
  assert.equal(valid.ok,true);
});

test('a selected Story World never requires a second invented world, and batches stay bounded',()=>{
  const staged=fictionProfileToolForStage(profile,true);
  const reg=new ToolContractRegistry([staged]);
  assert.equal(reg.validate('save_fiction_profiles',call([iona])).ok,true);
  assert.equal(reg.validate('save_fiction_profiles',call([iona,iona])).ok,true);
  const many=reg.validate('save_fiction_profiles',call(Array(3).fill(iona)));
  assert.equal(many.ok,false);assert.match(many.error.message,/1–2 items/);
  assert.equal(profile.function.parameters.properties.profiles.maxItems,12,'canonical registry schema remains unchanged');
});

test('successful saves advance all remaining cast entries without using up a failure counter',()=>{
  let state=nextFictionProfileProgress(['Iona','Noor','Marek','Tess'],['Iona','Noor'],2);
  assert.deepEqual([...state.remaining],['Marek','Tess']);
  assert.equal(state.failures,0);assert.equal(state.pending,true);
  state=nextFictionProfileProgress(state.remaining,['Marek','Tess'],state.failures);
  assert.equal(state.pending,false);assert.deepEqual([...state.remaining],[]);
  assert.equal(nextFictionProfileProgress(['Iona'],[],2).failures,3,'no confirmed entries count as a no-progress attempt');
  assert.equal(nextFictionProfileProgress(['Iona'],['Unknown'],1).failures,2,'unrelated save does not reset failure streak');
});

test('model tool JSON transport wrappers are decoded without inventing argument values',()=>{
  const registry=new ToolContractRegistry([profile]);
  const resolver=new ToolArgumentResolver(registry);
  for(const candidate of [
    '```json\n'+JSON.stringify(call([iona]))+'\n```',
    JSON.stringify(JSON.stringify(call([iona]))),
    JSON.stringify({arguments:call([iona])}),
  ]) {
    const result=resolver.resolve('save_fiction_profiles',candidate);
    assert.equal(result.validation.ok,true);
    assert.ok(result.adjustments.length);
    assert.equal(result.validation.value.profiles[0].name,'Iona');
  }
});

test('known non-nullable optional nulls can be omitted, but required null and unknown keys fail',()=>{
  const tool=simple('create_writing_document',{title:{type:'string'},kind:{type:'string'},category_id:{type:['string','null']}},['title']);
  const resolver=new ToolArgumentResolver(new ToolContractRegistry([tool]));
  assert.equal(resolver.resolve('create_writing_document',{title:'One',kind:null,category_id:null}).validation.ok,true);
  const nulled=resolver.resolve('create_writing_document',{title:'One',kind:null,category_id:null});
  assert.equal(Object.hasOwn(nulled.validation.value,'category_id'),true,'nullable category is preserved');
  const union=simple('union',{option:{oneOf:[{type:'string'},{type:'null'}]}},[]);
  const unionResult=new ToolArgumentResolver(new ToolContractRegistry([union])).resolve('union',{option:null});
  assert.equal(unionResult.validation.ok,true);
  assert.equal(Object.hasOwn(unionResult.validation.value,'option'),true,'nullable union is preserved');
  assert.equal(resolver.resolve('create_writing_document',{title:null}).validation.ok,false);
  assert.equal(resolver.resolve('create_writing_document',{title:'One',forged:true}).validation.ok,false);
});

test('the same offered schema validates and executes; unoffered names do not run',()=>{
  const registry=new ToolContractRegistry([simple('read_only',{id:{type:'string'}},['id'])]);
  const gateway=new ToolExecutionCoordinator(new ToolCallValidator(registry));
  assert.equal(gateway.prepare('read_only','```json\n{"id":"verified"}\n```').id,'verified');
  assert.throws(()=>gateway.prepare('edit_file','{"path":"secret"}'),/not registered or available/);
});

test('invalid calls return actionable contract guidance without performing or replaying operations',()=>{
  const staged=fictionProfileToolForStage(profile,false);
  const reg=new ToolContractRegistry([staged]);
  const bad=reg.validate('save_fiction_profiles',call([iona]));
  const guide=validationRecovery('save_fiction_profiles',bad,[staged]);
  assert.equal(guide.category,'ARGUMENT_CONTRACT');
  assert.deepEqual([...guide.required],['profiles','story']);
  assert.match(guide.nextAction,/no operation/i);
  const unknown=reg.validate('delete_everything',{});
  const unknownGuide=validationRecovery('delete_everything',unknown,[staged]);
  assert.equal(unknownGuide.category,'TOOL_NOT_OFFERED');
  assert.deepEqual([...unknownGuide.availableTools],['save_fiction_profiles']);
  assert.equal(runtimeFailureRecovery('save_fiction_profiles',new Error('Creating story characters was denied.')).category,'PERMISSION');
  assert.equal(runtimeFailureRecovery('save_fiction_profiles',new Error('The saved source quote does not match.')).category,'EVIDENCE');
});


test('the exact rejected callable contract remains available for a corrected turn without granting new tools',()=>{
  const inspect=simple('inspect',{},[]),edit=simple('edit',{value:{type:'string'}},['value']),verify=simple('verify',{},[]);
  assert.deepEqual(Array.from(offerToolCorrection([inspect,verify],edit,[inspect,edit,verify]),x=>x.function.name),['edit','inspect','verify']);
  assert.deepEqual(Array.from(offerToolCorrection([inspect],edit,[inspect]),x=>x.function.name),['inspect'],'revoked tools cannot be restored');
  assert.deepEqual(Array.from(offerToolCorrection([edit,inspect],edit,[edit,inspect]),x=>x.function.name),['edit','inspect']);
  const scoped={...edit,function:{...edit.function,parameters:{...edit.function.parameters,properties:{value:{type:'string',enum:['only-this-safe-value']}}}}};
  assert.equal(offerToolCorrection([inspect],scoped,[edit,inspect])[0].function.parameters.properties.value.enum[0],
    'only-this-safe-value','correction must retain the scoped offered schema rather than widening to registry definition');
});

test('agent dispatch validates exactly currently offered tools, not the full registered catalog',()=>{
  const agent=fs.readFileSync(path.join(root,'src/engine/agent.ts'),'utf8');
  assert.match(agent,/const validationDefinitions: AgentToolDefinition\[\]=currentTools;/);
  assert.match(agent,/fictionProfileToolForStage\(profileTool/);
  assert.match(agent,/nextFictionProfileProgress\(requestedFictionCast/);
  assert.match(agent,/profileAttempts>=3 && profilesPending/,'repeated successful-but-nonprogressing saves must block');
  assert.match(agent,/streamedFictionProfiles\(JSON\.stringify\(args\)\)/,'UI preview must inspect normalized executed arguments');
  assert.match(agent,/streamedProjectFiles\(call\.function\.name,JSON\.stringify\(args\)\)/,'workspace preview must reflect normalized validated edit');
  assert.doesNotMatch(agent,/const validationDefinitions: AgentToolDefinition\[\]=storySetupPending\|\|spica\|\|preparingFiction/);
});
