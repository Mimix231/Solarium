#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function run(bin,args){const child=spawnSync(bin,args,{cwd:root,stdio:'inherit'});if(child.status!==0)process.exit(child.status??1);}
run('node',['scripts/generate-spica-registry.cjs','--check']);
run('node',['scripts/generate-spica-runtime-registry.cjs','--check']);
run('node',['scripts/check-syntax.cjs']);
run('node',['scripts/clean-legacy-cosmic-theme.cjs','--check']);
const dist=path.join(root,'.spica-phase10-roundE-test');
fs.mkdirSync(dist,{recursive:true});
run('tsc',['--strict','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess','--skipLibCheck',
  '--module','commonjs','--moduleResolution','node','--target','es2022','--lib','es2022,dom',
  '--outDir','.spica-phase10-roundE-test','--rootDir','src',
  'src/engine/intelligence/spark-thought.ts','src/spica/runtime/registry.ts',
  'src/spica/construction-coordinator.ts','src/spica/edit-schemas.ts']);
// The context fitter imports the desktop inference adapter TYPES only. Compile
// its runtime bytes in isolation so unavailable Tauri/npm providers cannot mask
// actual Round E behavior regressions.
const ts=require('typescript');
const source=fs.readFileSync(path.join(root,'src/engine/context-window.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
if(compiled.diagnostics?.length)throw Error('Context fitter TypeScript transpile has errors.');
fs.mkdirSync(path.join(dist,'engine'),{recursive:true});
fs.writeFileSync(path.join(dist,'engine/context-window.js'),compiled.outputText);
fs.writeFileSync(path.join(dist,'package.json'),' {"type":"commonjs"}\n');
run('node',['--test','tests/spica-phase10-roundE.test.cjs']);
