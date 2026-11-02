import { listProjectCommands, type ProjectCommand } from './commands';
import { inspectProjectEnvironment, type ProjectInspection } from '../creator';
export interface ProjectEnvironment extends ProjectInspection { projectId:string;inspectedAt:string;detected:{tauri:boolean;react:boolean;typescript:boolean;mui:boolean;rust:boolean;ffmpeg:boolean;packageManager:'npm'|'pnpm'|'yarn'|'bun'};checks:string[];commands:ProjectCommand[] }
export async function inspectEnvironment(projectId:string,root:string):Promise<ProjectEnvironment>{
  const inspection=await inspectProjectEnvironment(root);const contents=new Map(inspection.manifests.map(m=>[m.path,m.content]));
  let pkg:Record<string,unknown>={};try{pkg=JSON.parse(contents.get('package.json')??'{}') as Record<string,unknown>;}catch{inspection.errors.push('package.json could not be parsed.');}
  const deps={...(pkg.dependencies as object??{}),...(pkg.devDependencies as object??{})} as Record<string,unknown>;const scripts=pkg.scripts as Record<string,unknown>|undefined;
  const checks=['check','test','build'].flatMap(s=>typeof scripts?.[s]==='string'?[`npm_${s}`]:[]);
  const rust=contents.has('Cargo.toml')||contents.has('src-tauri/Cargo.toml');if(rust)checks.push('cargo_check');if(inspection.hasGit)checks.push('git_status','git_diff');
  const commands=await listProjectCommands(root);
  return {...inspection,commands,projectId,inspectedAt:new Date().toISOString(),checks,detected:{tauri:Boolean(deps['@tauri-apps/api'])||contents.has('src-tauri/tauri.conf.json'),react:Boolean(deps.react),typescript:Boolean(deps.typescript),mui:Boolean(deps['@mui/material']),rust,ffmpeg:Object.keys(deps).some(k=>k.includes('ffmpeg')),packageManager:inspection.files.some(f=>f==='pnpm-lock.yaml')?'pnpm':inspection.files.includes('yarn.lock')?'yarn':inspection.files.some(f=>/^bun\.lock/.test(f))?'bun':'npm'}};
}
