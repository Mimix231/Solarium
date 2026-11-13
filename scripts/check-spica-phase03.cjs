#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname,'..');
const out = path.join(root,'.spica-phase03-test');
fs.mkdirSync(out,{recursive:true});
const args = ['--strict','--skipLibCheck','--target','es2022','--module','commonjs','--moduleResolution','node','--lib','es2022,dom','--outDir','.spica-phase03-test','--rootDir','src',
  'src/spica/graph-v2/types.ts','src/spica/graph-v2/serialization.ts','src/spica/graph-v2/validation.ts','src/spica/graph-v2/transactions.ts','src/spica/graph-v2/migration.ts'];
for(const [bin,command] of [['tsc',args], [process.execPath,['--test','tests/spica-phase03.test.cjs']]]){
  const result=spawnSync(bin,command,{cwd:root,stdio:'inherit'});
  if(result.status!==0){process.exit(result.status??1);}
  if(bin==='tsc')fs.writeFileSync(path.join(out,'package.json'),'\u007b"type":"commonjs"\u007d\n');
}
