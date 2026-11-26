#!/usr/bin/env node
/** Deterministic integrity check for the reviewed DCE Source Warehouse.
 * --write is an explicit developer-only metadata update, never an agent tool call. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sourceDir=path.join(root,'src/spica/source/portable');
const manifestPath=path.join(root,'src/spica/source/builtins.ts');
const original=fs.readFileSync(manifestPath,'utf8');
const seen=new Set();const pattern=/sourcePath:'portable\/([a-z][a-z0-9-]*)\.ts',sha256:'([0-9a-f]{64})'/g;
const fixes=[];
let revised=original.replace(pattern,(whole,name,oldHash)=>{
  if(seen.has(name))throw Error(`Duplicate source manifest: ${name}`);
  seen.add(name);
  const sourceFile=path.join(sourceDir,`${name}.ts`);
  if(!fs.existsSync(sourceFile))throw Error(`Manifest source missing: ${name}`);
  const sha=crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex');
  if(sha!==oldHash)fixes.push(name);
  return `sourcePath:'portable/${name}.ts',sha256:'${sha}'`;
});
const sourceFiles=fs.readdirSync(sourceDir).filter(p=>p.endsWith('.ts')).map(p=>p.slice(0,-3));
const missing=sourceFiles.filter(name=>!seen.has(name));
if(missing.length)throw Error(`Unregistered portable sources: ${missing.join(', ')}`);
if(seen.size<10)throw Error(`Insufficient real executable source modules: ${seen.size}`);
if(fixes.length && process.argv.includes('--write')){
  fs.writeFileSync(manifestPath,revised);
  console.log(`DCE warehouse SHA-256 manifests updated: ${fixes.join(', ')}`);
}else if(fixes.length){
  console.error(`DCE source integrity mismatch: ${fixes.join(', ')}. Review edits, then explicitly use --write.`);
  process.exitCode=1;
}else{
  console.log(`DCE source warehouse verified: ${seen.size} portable source implementations, SHA-256 hashes match.`);
}
