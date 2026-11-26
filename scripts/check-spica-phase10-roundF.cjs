#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
function run(cmd,args){const result=spawnSync(cmd,args,{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
run('node',['scripts/generate-spica-registry.cjs','--check']);
run('node',['scripts/generate-spica-runtime-registry.cjs','--check']);
run('node',['scripts/check-syntax.cjs']);
run('node',['scripts/clean-legacy-cosmic-theme.cjs','--check']);
const output=path.join(root,'.spica-phase10-roundF-test');fs.mkdirSync(output,{recursive:true});
run('tsc',['--strict','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess','--skipLibCheck',
 '--module','commonjs','--moduleResolution','node','--target','es2022','--lib','es2022,dom',
 '--outDir','.spica-phase10-roundF-test','--rootDir','src',
 'src/spica/tool-aliases.ts','src/spica/construction-insights.ts','src/spica/runtime/registry.ts',
 'src/spica/runtime/executor.ts','src/spica/runtime/composition.ts','src/spica/tool-intelligence.ts','src/spica/construction-coordinator.ts']);
fs.writeFileSync(path.join(output,'package.json'),'{"type":"commonjs"}\n');
run('node',['--test','tests/spica-phase10-roundF.test.cjs']);
