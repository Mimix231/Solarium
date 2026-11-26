#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const path=require('node:path');const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
function exec(cmd,args){const result=spawnSync(cmd,args,{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
exec('node',['scripts/generate-spica-registry.cjs','--check']);
exec('node',['scripts/generate-spica-runtime-registry.cjs','--check']);
const out=path.join(root,'.spica-phase95-test');fs.mkdirSync(out,{recursive:true});
exec('tsc',['--strict','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess',
 '--skipLibCheck','--module','commonjs','--moduleResolution','node','--target','es2022','--lib','es2022,dom',
 '--outDir','.spica-phase95-test','--rootDir','src',
 'src/spica/tool-aliases.ts','src/spica/construction-insights.ts',
 'src/spica/edit-schemas.ts','src/spica/graph-v2/transactions.ts',
 'src/spica/graph-v2/edit-adapter.ts','src/spica/inspect-params-v2.ts',
 'src/engine/intelligence/tool-validation.ts','src/spica/graph.ts','src/spica/runtime/discovery.ts']);
fs.writeFileSync(path.join(out,'package.json'),'\u007b"type":"commonjs"\u007d\n');
exec('node',['--test','tests/spica-phase95-unified-edit.test.cjs']);
