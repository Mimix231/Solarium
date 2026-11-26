#!/usr/bin/env node
'use strict';
/** Audit the exact SPICA registry against executable dispatch, work-log kinds,
 * graph prerequisites, write authorization and operation-level edit contracts.
 * This is static provenance checking; integration tests exercise behavior. */
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
let ts;try{ts=require('typescript')}catch{ts=require(path.join(execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'))}
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const toolSource=read('src/spica/tools.ts');const actionSource=read('src/engine/action-permissions.ts');
const workSource=read('src/engine/live-workspace.ts');const stageSource=read('src/spica/tool-intelligence.ts');
const codingSource=read('src/engine/intelligence/coding-tools.ts');
const compilerSource=read('src/spica/edit-schemas.ts');
const source=ts.createSourceFile('tools.ts',toolSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const names=[];
function visit(node){
 if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='define'
   && node.arguments.length>0&&ts.isStringLiteral(node.arguments[0]))names.push(node.arguments[0].text);
 ts.forEachChild(node,visit);
}
visit(source);
function assert(ok,details){if(!ok)throw Error(`SPICA Round A registry audit: ${details}`)}
assert(names.length>20,'missing SPICA tool declarations');
assert(new Set(names).size===names.length,'duplicate callable tool names');
assert(!names.includes('edit_spica_v2_graph')&&!names.includes('read_spica_v2_graph'),'duplicate graph API');
assert(names.includes('edit_spica_graph')&&names.includes('read_spica_graph'),'missing canonical graph API');
const dispatched=new Set();
const execute=source.statements.find(statement=>ts.isFunctionDeclaration(statement)&&statement.name?.text==='executeSpicaTool');
assert(execute?.body,'executeSpicaTool must have a real handler');
function scanHandlers(node){
  if(ts.isBinaryExpression(node) &&
    (node.operatorToken.kind===ts.SyntaxKind.EqualsEqualsEqualsToken || node.operatorToken.kind===ts.SyntaxKind.ExclamationEqualsEqualsToken)){
    if(ts.isIdentifier(node.left)&&node.left.text==='name'&&ts.isStringLiteral(node.right))dispatched.add(node.right.text);
    if(ts.isIdentifier(node.right)&&node.right.text==='name'&&ts.isStringLiteral(node.left))dispatched.add(node.left.text);
  }
  if(ts.isSwitchStatement(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='name')
    for(const clause of node.caseBlock.clauses)if(ts.isCaseClause(clause)&&ts.isStringLiteral(clause.expression))dispatched.add(clause.expression.text);
  ts.forEachChild(node,scanHandlers);
}
scanHandlers(execute.body);
const missing=names.filter(name=>!dispatched.has(name));const missingWork=[];const missingStages=[];
for(const name of names){
 if(!new RegExp(`\\b${name}\\s*:\\s*['"]`).test(workSource))missingWork.push(name);
 if(!new RegExp(`\\b${name}\\s*:\\s*['"]`).test(stageSource))missingStages.push(name);
}
assert(!missing.length,`declarations absent from dispatcher: ${missing.join(', ')}`);
assert(!missingWork.length,`declared tools lack work-log kind: ${missingWork.join(', ')}`);
assert(!missingStages.length,`declared tools lack toolchain stage: ${missingStages.join(', ')}`);
assert(codingSource.includes('...spicaTools')&&codingSource.includes('executeSpicaTool('),'SPICA tools not registered with main coding dispatcher');
assert(actionSource.includes('...codingNames.filter('),'permissions known-tool set missing registered SPICA names');
for(const name of ['create_spica_app','edit_spica_graph','migrate_spica_v2_graph','compose_spica_v2_graph','history_spica_v2_graph','export_spica_app','run_spica_v2_graph'])
 assert(actionSource.includes(`'${name}'`),`write grant missing: ${name}`);
for(const name of ['verify_spica_app','prepare_spica_app'])assert(actionSource.includes(`'${name}'`),`check grant missing: ${name}`);
assert(compilerSource.includes('verifiedSpicaEditScope')&&compilerSource.includes('editScopeFromArguments'), 'scoped schema must validate proposed operations');
assert(!compilerSource.includes("throw Error('Unknown edit operation in scoped contract.')"), 'fatal scoped-edit exception survived');
// Every Spark receives the same shared global catalog. Audit the other
// declaration families as well: coding, knowledge, research, and base tools.
const toolFamilies=[
  ['spica',names],
  ['spica_research',read('src/spica/research-tools.ts').match(/define\('([^']+)'/g)?.map(x=>x.slice(8,-1))??[]],
  ['coding',read('src/engine/intelligence/coding-tools.ts').match(/define\('([^']+)'/g)?.map(x=>x.slice(8,-1))??[]],
  ['knowledge',read('src/engine/intelligence/knowledge-tools.ts').match(/define\('([^']+)'/g)?.map(x=>x.slice(8,-1))??[]],
  ['base',(read('src/engine/tools.ts').match(/function:\s*\{\s*name:\s*'[^']+'/g)??[]).map(x=>x.match(/name:\s*'([^']+)'/)[1])],
];
const toolOwners=new Map();
for(const [family,entries]of toolFamilies){for(const name of entries){
  assert(!toolOwners.has(name),`tool ${name} appears in both ${family} and ${toolOwners.get(name)}`);
  toolOwners.set(name,family);
}}
assert(toolOwners.size>75,`expected all global tool declaration families; found ${toolOwners.size}`);
assert(read('src/engine/tools.ts').includes('...codingToolDefinitions')&&read('src/engine/tools.ts').includes('...knowledgeToolDefinitions'),
  'global catalog must include coding and knowledge declarations');
assert(read('src/spica/tools.ts').includes('...spicaResearchTools'), 'SPICA research declarations must share the SPICA tool registry');
for(const [family,file,handler] of [
  ['coding','src/engine/intelligence/coding-tools.ts','executeCodingTool'],
  ['knowledge','src/engine/intelligence/knowledge-tools.ts','executeKnowledgeTool'],
  ['spica_research','src/spica/research-tools.ts','executeSpicaResearchTool'],
])assert(read(file).includes(`function ${handler}(`),`${family} dispatcher missing ${handler}`);
const familyCounts=Object.fromEntries(toolFamilies.map(([family,entries])=>[family,entries.length]));

/** Verify all directly authored required-property declarations rather than
 * trusting written documentation. Dynamic schemas are verified by runtime
 * ToolContractRegistry tests and reported separately. */
function props(object) {
  if(!object||!ts.isObjectLiteralExpression(object))return null;
  return new Set(object.properties.flatMap(entry=>{
    if((ts.isPropertyAssignment(entry)||ts.isShorthandPropertyAssignment(entry))&&entry.name){
      return [ts.isIdentifier(entry.name)||ts.isStringLiteral(entry.name)?entry.name.text:entry.name.getText()];
    } return [];
  }));
}
function attribute(object,key){
  if(!object||!ts.isObjectLiteralExpression(object))return null;
  const entry=object.properties.find(item=>ts.isPropertyAssignment(item)&&
    (ts.isIdentifier(item.name)||ts.isStringLiteral(item.name))&&item.name.text===key);
  return entry?.initializer??null;
}
function strings(array){
  return array&&ts.isArrayLiteralExpression(array)&&array.elements.every(entry=>ts.isStringLiteral(entry))
    ? array.elements.map(entry=>entry.text):null;
}
let checkedStaticContracts=0;let deferredDynamicContracts=0;
for(const filename of ['src/spica/tools.ts','src/engine/intelligence/coding-tools.ts',
  'src/engine/intelligence/knowledge-tools.ts','src/spica/research-tools.ts']){
  const ast=ts.createSourceFile(filename,read(filename),ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  function checkDefines(node){
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='define'&&node.arguments.length>2){
      const name=ts.isStringLiteral(node.arguments[0])?node.arguments[0].text:'<dynamic name>';
      const available=props(node.arguments[2]);const required=strings(node.arguments[3]);
      if(available&&required){
        for(const key of required)assert(available.has(key),`${name} requires missing public parameter ${key}`);
        checkedStaticContracts++;
      }else deferredDynamicContracts++;
    }
    ts.forEachChild(node,checkDefines);
  }
  checkDefines(ast);
}
const baseAst=ts.createSourceFile('src/engine/tools.ts',read('src/engine/tools.ts'),ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
function checkBase(node){
  if(ts.isObjectLiteralExpression(node)){
    const name=attribute(node,'name'), params=attribute(node,'parameters');
    if(name&&ts.isStringLiteral(name)&&params){
      const available=props(attribute(params,'properties')),required=strings(attribute(params,'required'));
      if(available&&required){for(const key of required)assert(available.has(key),`base tool ${name.text} requires missing parameter ${key}`);checkedStaticContracts++;}
      else deferredDynamicContracts++;
    }
  }
  ts.forEachChild(node,checkBase);
}
checkBase(baseAst);
assert(checkedStaticContracts>60,`only ${checkedStaticContracts} literal parameter contracts audited`);

const all=names.sort();const stageCount=Object.fromEntries(['discover','inspect','validate','edit','execute','export','verify'].map(stage=>[stage, (stageSource.match(new RegExp(`:'${stage}'`,'g'))??[]).length]));
const report={registeredSpicaTools:all.length,allGlobalToolDeclarations:toolOwners.size,familyCounts,checkedStaticContracts,deferredDynamicContracts, names:all, workLogKindsVerified:true,toolchainStagesVerified:true,
  centralDispatchVerified:true, permissionGrantSourcesVerified:true, canonicalGraphNamesVerified:true,
  scopedEditGuardVerified:true,stageCount,
  note:'Static source audit. Run behavioral tests and full compilation for runtime evidence.'};
const filename=process.argv.includes('--json')?null:path.join(root,'spica/roadmap/46_PHASE10_ROUND_A_REGISTRY_AUDIT.json');
if(filename)fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');
console.log(`SPICA Round A: ${names.length} registered callable tools; work-stage/dispatcher/grant checks passed.`);
