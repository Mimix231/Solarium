#!/usr/bin/env node
'use strict';
/* When a new archive is extracted over a previous Phase 10 checkout, remove
 * ONLY byte-identical stale Cosmic files. Never delete a unique or modified
 * user source. New canonical theme root: src/ui-themes/cosmic. */
const fs=require('node:fs');const path=require('node:path');
const root=process.env.SOLARIUM_SOURCE_ROOT?path.resolve(process.env.SOLARIUM_SOURCE_ROOT):path.resolve(__dirname,'..');
const oldDir=path.join(root,'src','themes','cosmic');
const newDir=path.join(root,'src','ui-themes','cosmic');
const checkOnly=process.argv.includes('--check');
function visit(dir){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(entry.isSymbolicLink())throw Error(`Refusing a symlink in obsolete Cosmic tree: ${entry.name}`);
    const full=path.join(dir,entry.name);
    return entry.isDirectory()?visit(full):[full];
  });
}
const oldFiles=visit(oldDir);
for(const file of oldFiles){
  const relative=path.relative(oldDir,file);
  const canonical=path.join(newDir,relative);
  if(!fs.existsSync(canonical)||!fs.statSync(canonical).isFile()||
     !fs.readFileSync(file).equals(fs.readFileSync(canonical))) {
    throw Error(`Obsolete Cosmic source differs or lacks a canonical replacement: ${relative}. Resolve manually; nothing was deleted.`);
  }
}
if(oldFiles.length && !checkOnly)fs.rmSync(oldDir,{recursive:true,force:false});
if(oldFiles.length && checkOnly)throw Error(`Old Cosmic theme remains: ${oldFiles.length} byte-identical files. Run npm run ui:cosmic:cleanup.`);
console.log(`Cosmic theme cleanup ${oldFiles.length?'removed '+oldFiles.length+' identical files':'clean'}.`);
