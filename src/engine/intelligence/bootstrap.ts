import { applyProjectChanges, type AppliedChange, type ProjectFileChange } from '../creator';
import { inspectEnvironment } from './project';
import { videoEditorTemplate } from './recipes';

/** A real source blueprint selected by the model. No inference or simulated writes. */
export async function createVideoEditorProject(project:{id:string;name:string;folder:string},signal?:AbortSignal,onApplied?:(files:ProjectFileChange[],applied:AppliedChange[])=>void){
  const environment=await inspectEnvironment(project.id,project.folder);
  if(environment.rootEntryCount!==0)throw Error('This starter requires a verified empty directory. Existing files were preserved; use ordinary file edits for an existing project.');
  const files=videoEditorTemplate(project.name),applied:AppliedChange[]=[];
  try{
    for(let offset=0;offset<files.length;offset+=12){
      if(signal?.aborted)throw new DOMException('Stopped','AbortError');
      const batch=files.slice(offset,offset+12),result=await applyProjectChanges(project.folder,batch);applied.push(...result);onApplied?.(batch,result);
    }
    return{ok:true,files:applied,stack:'Tauri 2, React, TypeScript, Material UI',next:'Run install_project_dependencies, then the current manifest commands. This operation created files; it did not install, build, test or launch the project.'};
  }catch(error){return{ok:false,files:applied,error:String(error),next:'Preserve the confirmed files and inspect the remaining paths. No incomplete batch is treated as saved.'};}
}
