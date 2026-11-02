import { create } from 'zustand';
import { open } from '@tauri-apps/plugin-dialog';
import { api } from '../integration/api';
import type { FileNode,GitStatus,ProjectIndexSummary,ProjectTask,SearchHit,SymbolLocation } from '../lib/types';
import { useSolarium } from '../../state/useSolarium';
import { now,uid } from '../../domain/types';
import { listProjectCommands } from '../../engine/intelligence/commands';
interface State{root:string;tree:FileNode[];loading:boolean;error:string;index?:ProjectIndexSummary;searchResults:SearchHit[];tasks:ProjectTask[];git?:GitStatus;symbols:SymbolLocation[];choose():Promise<void>;openRoot(root:string):Promise<void>;refresh():Promise<void>;search(query:string):Promise<void>;refreshProjectMeta():Promise<void>;findSymbols(query:string):Promise<void>}
let generation=0;
export const useWorkspaceStore=create<State>((set,get)=>({
  root:'',tree:[],loading:false,error:'',searchResults:[],tasks:[],symbols:[],
  choose:async()=>{const root=await open({directory:true,multiple:false,title:'Open source folder in Solarium'});if(typeof root!=='string')return;const state=useSolarium.getState();let project=state.workspace.projects?.find(p=>p.folder===root);if(!project){project={id:uid(),name:root.split(/[\\/]/).filter(Boolean).at(-1)??'Project',folder:root,description:'',instructions:'',sparkId:state.workspace.selectedSparkId,modelId:state.workspace.models[0]?.id??null,createdAt:now(),updatedAt:now()};state.mutate(w=>{(w.projects??=[]).push(project!);});}state.mutate(w=>{w.activeProjectId=project!.id;w.activeSessionId=null;});state.setView('code');},
  openRoot:async root=>{const run=++generation;set({root,loading:true,error:'',tree:[],index:undefined,searchResults:[],symbols:[],tasks:[],git:undefined});try{const tree=await api.openWorkspace(root);if(run!==generation)return;set({tree});try{const index=await api.setBackendWorkspace(root);if(run!==generation)return;set({index});}catch(error){if(run===generation)set({error:'Project intelligence: '+String(error)});}if(run===generation)await get().refreshProjectMeta();}catch(error){if(run===generation)set({error:String(error)});}finally{if(run===generation)set({loading:false});}},
  refresh:async()=>{const root=get().root;if(!root)return;const run=generation;try{const tree=await api.openWorkspace(root);if(run!==generation)return;set({tree});const index=await api.setBackendWorkspace(root);if(run!==generation)return;set({index});await get().refreshProjectMeta();}catch(error){if(run===generation)set({error:String(error)});}},
  search:async query=>{const root=get().root,run=generation;if(!root||!query.trim()){set({searchResults:[]});return;}try{const searchResults=await api.workspaceSearch(root,query);if(run===generation)set({searchResults});}catch(error){set({error:String(error)});}},
  refreshProjectMeta:async()=>{const root=get().root,run=generation;if(!root)return;const results=await Promise.allSettled([listProjectCommands(root),api.projectGitStatus()]);if(run!==generation)return;const commands=results[0],git=results[1];if(commands.status==='fulfilled')set({tasks:commands.value.map(c=>({id:c.id,label:c.id,command:c.command,kind:c.verification?'verification':'run',cwd:c.cwd,service:c.service,network:c.network,behavioral:c.behavioral})) as ProjectTask[]});if(git.status==='fulfilled')set({git:git.value});},
  findSymbols:async query=>{const run=generation;if(!query.trim()){set({symbols:[]});return;}try{const symbols=await api.projectSymbols(query);if(run===generation)set({symbols});}catch(error){set({error:String(error)});}},
}));
