const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const generated='src/quality/source-identity.generated.ts';
function files(root,directory){
 const result=[];const full=path.join(root,directory);if(!fs.existsSync(full))return result;
 for(const item of fs.readdirSync(full,{withFileTypes:true})){if(item.isSymbolicLink()||['__pycache__','target','node_modules'].includes(item.name))continue;const relative=path.posix.join(directory,item.name);if(item.isDirectory())result.push(...files(root,relative));else if(relative!==generated&&(!relative.startsWith('backend/')||relative.endsWith('.py')))result.push(relative);}
 return result;
}
function sourceIdentity(root=path.resolve(__dirname,'..')){
 const entries=[...files(root,'src'),...files(root,'tests'),...files(root,'scripts'),...files(root,'backend'),...files(root,'src-tauri/src'),...files(root,'src-tauri/capabilities'),...['package.json','package-lock.json','tsconfig.json','vite.config.ts','src-tauri/tauri.conf.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src-tauri/build.rs','scripts/source-identity.cjs'].filter(f=>fs.existsSync(path.join(root,f)))];const unique=[...new Set(entries)].sort();
 const digest=crypto.createHash('sha256');for(const relative of unique){const bytes=fs.readFileSync(path.join(root,relative));digest.update(relative+'\0'+bytes.length+'\0');digest.update(bytes);}
 let commit=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,stdio:['ignore','pipe','ignore'],encoding:'utf8',windowsHide:true}).trim();}catch{/* Source archives can be built without a Git checkout. */}
 return{schemaVersion:1,sha256:digest.digest('hex'),files:unique.length,commit};
}
function writeSourceIdentity(root=path.resolve(__dirname,'..')){const identity=sourceIdentity(root),content='// Generated from actual source bytes; never hand edited.\nexport const sourceIdentity='+JSON.stringify(identity)+' as const;\n';const target=path.join(root,generated);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content)fs.writeFileSync(target,content);return identity;}
function isSourceInput(file,root){const relative=path.relative(root,file).split(path.sep).join('/');return relative!==generated&&!relative.includes('__pycache__')&&(/^(src\/|tests\/|scripts\/|backend\/.*\.py$|src-tauri\/(src|capabilities)\/)/.test(relative)||['package.json','package-lock.json','vite.config.ts','src-tauri/tauri.conf.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','scripts/source-identity.cjs'].includes(relative));}
module.exports={sourceIdentity,writeSourceIdentity,isSourceInput};
if(require.main===module){const identity=writeSourceIdentity();process.stdout.write(`Source identity ${identity.sha256.slice(0,12)} · ${identity.files} files\n`);}
