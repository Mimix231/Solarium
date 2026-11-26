#!/usr/bin/env node
/** Strict, dependency-free Phase 02 TypeScript check including the browser source provider.
 * Separate from the full Vite/Tauri build, which still requires npm dependencies. */
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const sourceRoot=path.join(root,'src/spica/source');
const files=fs.readdirSync(sourceRoot).filter(f=>f.endsWith('.ts')).map(f=>path.join(sourceRoot,f));
files.push(...fs.readdirSync(path.join(sourceRoot,'portable')).filter(f=>f.endsWith('.ts')).map(f=>path.join(sourceRoot,'portable',f)));
files.push(...fs.readdirSync(path.join(sourceRoot,'intelligence')).filter(f=>f.endsWith('.ts')).map(f=>path.join(sourceRoot,'intelligence',f)));
files.push(path.join(root,'src/spica/catalog/source-capabilities.ts'));
files.push(path.join(root,'src/spica/catalog/source-intelligence.ts'));
files.push(path.join(root,'tests/dce-source-importmeta.d.ts'));
try{
  cp.execFileSync('tsc',['--noEmit','--target','ES2022','--module','ESNext','--moduleResolution','bundler',
    '--lib','ES2022,DOM','--strict','--noUnusedLocals','--noUnusedParameters','--noUncheckedIndexedAccess','--skipLibCheck',...files],
  {cwd:root,stdio:'inherit',timeout:120000});
  console.log(`DCE Phase 02 strict TypeScript verified: ${files.length-1} sources and contracts.`);
}catch(error){process.exitCode=error.status||1;}
