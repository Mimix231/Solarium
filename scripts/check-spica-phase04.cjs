#!/usr/bin/env node
'use strict';
const { spawnSync } = require('./spica-test-process.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const out=path.join(root,'.spica-phase04-test');
fs.mkdirSync(out,{recursive:true});
const check=spawnSync(process.execPath,['scripts/generate-spica-runtime-registry.cjs','--check'],{cwd:root,stdio:'inherit'});
if(check.status!==0) process.exit(check.status??1);
function findUnifiedRuntimeSources() {
  const base=path.join(root,'src/spica/runtime/blocks');const found=[];
  function visit(folder) {
    for (const dirent of fs.readdirSync(folder,{withFileTypes:true})) {
      const file=path.join(folder,dirent.name);
      if(dirent.isDirectory())visit(file);
      else if(dirent.isFile()&&dirent.name.endsWith('.ts'))found.push(path.relative(root,file).replaceAll(path.sep,'/'));
    }
  }
  for(const category of fs.readdirSync(base,{withFileTypes:true}).filter(d=>d.isDirectory())) {
    const runtime=path.join(base,category.name,'runtime');if(fs.existsSync(runtime))visit(runtime);
  }
  return found.sort();
}
const sourceFiles = [
  'src/spica/runtime/adapter.ts', 'src/spica/runtime/permissions.ts', 'src/spica/runtime/store.ts',
  'src/spica/runtime/value.ts','src/spica/runtime/trace.ts','src/spica/runtime/registry.ts','src/spica/runtime/executor.ts',
  ...findUnifiedRuntimeSources(),
  'src/spica/graph-v2/types.ts','src/spica/graph-v2/validation.ts','src/spica/graph-v2/serialization.ts',
  'src/spica/tool-aliases.ts','src/spica/construction-insights.ts',
  'src/spica/graph.ts','src/spica/program.ts','src/spica/appearance.ts','src/spica/game.ts',
];
const args=['--strict','--skipLibCheck','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess','--target','es2022','--module','commonjs','--moduleResolution','node','--lib','es2022,dom','--outDir','.spica-phase04-test','--rootDir','src',...sourceFiles];
for(const [bin,cmd] of [['tsc',args],[process.execPath,['--test','tests/spica-phase04.test.cjs']]]) {
  if(bin!== 'tsc') fs.writeFileSync(path.join(out,'package.json'),'{"type":"commonjs"}\n');
  const res=spawnSync(bin,cmd,{cwd:root,stdio:'inherit'});if(res.status!==0)process.exit(res.status??1);
}
