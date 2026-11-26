#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function check(bin,args){const result=spawnSync(bin,args,{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
const out=path.join(root,'.spica-phase10-test');fs.mkdirSync(out,{recursive:true});
check('tsc',['--strict','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess',
 '--skipLibCheck','--module','commonjs','--moduleResolution','node','--target','es2022','--lib','es2022,dom',
 '--outDir','.spica-phase10-test','--rootDir','src',
 'src/engine/intelligence/spica-task-orchestrator.ts',
 'src/engine/intelligence/agent-budget.ts']);
// Context window imports the desktop inference type graph. Transpile its runtime
// code separately; the pure planner above is checked with strict tsc flags.
const ts=require('typescript');
const input=fs.readFileSync(path.join(root,'src/engine/context-window.ts'),'utf8');
const js=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
fs.mkdirSync(path.join(out,'engine'),{recursive:true});
fs.writeFileSync(path.join(out,'engine','context-window.js'),js);
fs.writeFileSync(path.join(out,'package.json'),'{"type":"commonjs"}\n');
check('node',['--test','tests/spica-phase10-persistent-agent.test.cjs']);
