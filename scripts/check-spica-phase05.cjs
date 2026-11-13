#!/usr/bin/env node
'use strict';
const path=require('node:path');const fs=require('node:fs');const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');const out=path.join(root,'.spica-phase05-test');fs.mkdirSync(out,{recursive:true});
const sources=['src/spica/catalog/manifest-v2.ts','src/spica/catalog/manifests.ts','src/spica/inspect-params.ts',
  'src/spica/graph.ts','src/spica/program.ts','src/spica/appearance.ts','src/spica/game.ts'];
const result=spawnSync('tsc',['--strict','--skipLibCheck','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess',
  '--target','es2022','--module','commonjs','--moduleResolution','node','--lib','es2022,dom',
  '--outDir','.spica-phase05-test','--rootDir','src',...sources],{cwd:root,stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
fs.writeFileSync(path.join(out,'package.json'),'{"type":"commonjs"}\n');
const tests=spawnSync(process.execPath,['--test','tests/spica-phase05.test.cjs'],{cwd:root,stdio:'inherit'});
process.exit(tests.status??1);
