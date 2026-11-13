#!/usr/bin/env node
'use strict';
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const out=path.join(root,'.spica-phase07-test');
fs.mkdirSync(out,{recursive:true});
const registry=spawnSync(process.execPath,['scripts/generate-spica-runtime-registry.cjs','--check'],{cwd:root,stdio:'inherit'});
if(registry.status!==0)process.exit(registry.status??1);
const sources=[
 'src/spica/intent.ts','src/spica/tool-intelligence.ts',
 'src/spica/runtime/adapter.ts','src/spica/runtime/registry.ts','src/spica/runtime/executor.ts',
 'src/spica/runtime/composition.ts','src/spica/runtime/discovery.ts',
 'src/spica/graph-v2/types.ts','src/spica/graph-v2/validation.ts','src/spica/graph-v2/serialization.ts',
];
const args=['--strict','--skipLibCheck','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess',
 '--target','es2022','--module','commonjs','--moduleResolution','node','--lib','es2022,dom',
 '--outDir','.spica-phase07-test','--rootDir','src',...sources];
const build=spawnSync('tsc',args,{cwd:root,stdio:'inherit'});if(build.status!==0)process.exit(build.status??1);
fs.writeFileSync(path.join(out,'package.json'),'{"type":"commonjs"}\n');
const tests=spawnSync(process.execPath,['--test','tests/spica-phase07.test.cjs','tests/spica-phase07-tools.test.cjs'],{cwd:root,stdio:'inherit'});
process.exit(tests.status??1);
