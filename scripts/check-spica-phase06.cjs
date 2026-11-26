#!/usr/bin/env node
'use strict';
const {spawnSync}=require('./spica-test-process.cjs');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const out=path.join(root,'.spica-phase06-test');fs.mkdirSync(out,{recursive:true});
const registry=spawnSync(process.execPath,['scripts/generate-spica-runtime-registry.cjs','--check'],{cwd:root,stdio:'inherit'});
if(registry.status!==0)process.exit(registry.status??1);
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
const blocks=findUnifiedRuntimeSources();
const sources=[
  'src/spica/professionalism.ts','src/spica/runtime/adapter.ts','src/spica/runtime/permissions.ts','src/spica/runtime/store.ts',
  'src/spica/runtime/value.ts','src/spica/runtime/trace.ts','src/spica/runtime/registry.ts','src/spica/runtime/executor.ts',
  'src/spica/graph-v2/types.ts','src/spica/graph-v2/validation.ts','src/spica/graph-v2/serialization.ts',
  'src/spica/runtime/blocks/standalone.ts','src/spica/graph.ts','src/spica/program.ts','src/spica/appearance.ts','src/spica/game.ts','src/spica/data.ts',...blocks];
const args=['--strict','--skipLibCheck','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess',
  '--target','es2022','--module','commonjs','--moduleResolution','node','--lib','es2022,dom',
  '--outDir','.spica-phase06-test','--rootDir','src',...sources];
const tsc=spawnSync('tsc',args,{cwd:root,stdio:'inherit'});
if(tsc.status!==0)process.exit(tsc.status??1);
fs.writeFileSync(path.join(out,'package.json'),'{"type":"commonjs"}\n');
const tests=spawnSync(process.execPath,['--test','tests/spica-phase06.test.cjs'],{cwd:root,stdio:'inherit'});
process.exit(tests.status??1);
