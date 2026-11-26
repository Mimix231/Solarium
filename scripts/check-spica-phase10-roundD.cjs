#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function run(command,args){const result=spawnSync(command,args,{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
run('node',['scripts/generate-spica-registry.cjs','--check']);
run('node',['scripts/generate-spica-runtime-registry.cjs','--check']);
run('node',['scripts/check-syntax.cjs']);
const out=path.join(root,'.spica-phase10-roundD-test');fs.mkdirSync(out,{recursive:true});
run('tsc',['--strict','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess','--skipLibCheck',
  '--module','commonjs','--moduleResolution','node','--target','es2022','--lib','es2022,dom',
  '--outDir','.spica-phase10-roundD-test','--rootDir','src',
  'src/engine/intelligence/spica-task-orchestrator.ts',
  'src/spica/construction-coordinator.ts',
  'src/spica/runtime/executor.ts','src/spica/runtime/discovery.ts',
  'src/spica/runtime/composition.ts']);
fs.writeFileSync(path.join(out,'package.json'),' {"type":"commonjs"}\n');
run('node',['--test','tests/spica-phase10-roundD.test.cjs']);
