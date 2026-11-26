#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function run(command,args){const result=spawnSync(command,args,{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
run('node',['scripts/generate-spica-registry.cjs','--check']);
run('node',['scripts/generate-spica-runtime-registry.cjs','--check']);
run('tsc',['--strict','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess','--skipLibCheck',
  '--module','commonjs','--moduleResolution','node','--target','es2022','--lib','es2022,dom',
  '--outDir','.spica-phase10-test','--rootDir','src',
  'src/engine/intelligence/spark-action-batches.ts','src/engine/intelligence/spica-task-orchestrator.ts',
  'src/spica/edit-schemas.ts','src/spica/graph.ts','src/spica/runtime/registry.ts',
  'src/spica/tool-intelligence.ts']);
fs.writeFileSync(path.join(root,'.spica-phase10-test','package.json'),'{"type":"commonjs"}\n');
run('node',['--test','tests/spica-phase10-roundC.test.cjs']);
