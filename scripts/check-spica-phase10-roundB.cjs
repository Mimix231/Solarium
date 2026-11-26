#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function run(bin,args){const result=spawnSync(bin,args,{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
fs.mkdirSync(path.join(root,'.spica-phase10-test'),{recursive:true});
run('tsc',['--strict','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess','--skipLibCheck',
 '--module','commonjs','--moduleResolution','node','--target','es2022','--lib','es2022,dom',
 '--outDir','.spica-phase10-test','--rootDir','src',
 'src/engine/intelligence/spark-thought.ts','src/engine/intelligence/spica-task-orchestrator.ts',
 'src/engine/intelligence/agent-budget.ts','src/engine/intelligence/tool-contract-intelligence.ts',
 'src/spica/inspect-tool-view.ts']);
// Round B must run from a clean archive: the legacy Phase 10 tests import
// context-window.js, which is transpiled (not typechecked) separately because
// it depends on the desktop inference adapter's runtime-only interfaces.
// Do not depend on artifacts left by a different phase runner.
const ts=require('typescript');
const contextSource=fs.readFileSync(path.join(root,'src/engine/context-window.ts'),'utf8');
const contextJs=ts.transpileModule(contextSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
fs.mkdirSync(path.join(root,'.spica-phase10-test','engine'),{recursive:true});
fs.writeFileSync(path.join(root,'.spica-phase10-test','engine','context-window.js'),contextJs);
fs.writeFileSync(path.join(root,'.spica-phase10-test','package.json'),JSON.stringify({type:'commonjs'})+'\n');
run('node',['--test','tests/spica-phase10-thought-blocks.test.cjs','tests/spica-phase10-persistent-agent.test.cjs']);
