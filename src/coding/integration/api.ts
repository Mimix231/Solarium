import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSolarium } from '../../state/useSolarium';
import type { FileNode, CodeWorkspaceSettings, GitStatus, LspStatus, LspDocumentResult, LspRequestResult, LspDiagnosticResult, ProjectIndexSummary, SearchHit, SymbolLocation, TerminalDescriptor, TerminalEvent, WorkspaceFsEvent } from '../lib/types';

export function selectedRoot(): string {
  const workspace = useSolarium.getState().workspace;
  const project = workspace.projects?.find(p => p.id === workspace.activeProjectId);
  if (!project?.folder) throw Error('Select a Solarium project with a linked source folder.');
  return project.folder;
}
export const projectRequest = <T>(method:string, params:Record<string,unknown>={}, root=selectedRoot()):Promise<T> => invoke('glitch_project_request', {root,method,params});
const fileAction = <T>(operation:string,args:Record<string,unknown>,root=selectedRoot()):Promise<T> => invoke('glitch_workspace_action',{root,operation,args});
const document = <T>(method:string,path:string,text?:string,language?:string):Promise<T> => projectRequest(method,{path,text,language});

/** Production Solarium commands. All file operations carry their selected owner. */
export const api = {
  openWorkspace:(root:string)=>fileAction<FileNode[]>('tree',{},root),
  readTextFile:(path:string,root=selectedRoot())=>fileAction<string>('read',{path},root),
  writeTextFile:(path:string,content:string,expected:string,root=selectedRoot())=>fileAction<void>('write',{path,content,expected},root),
  applyReviewedSource:(path:string,content:string,expected:string|null)=>fileAction<void>('write',{path,content,expected}),
  createFile:(path:string)=>fileAction<void>('create.file',{path}),
  createDirectory:(path:string)=>fileAction<void>('create.directory',{path}),
  renamePath:(path:string,name:string)=>fileAction<string>('rename',{path,name}),
  movePath:(path:string,parent:string)=>fileAction<string>('move',{path,parent}),
  deletePath:(path:string)=>fileAction<void>('delete',{path}),
  revealPath:(path:string)=>fileAction<void>('reveal',{path}),
  workspaceSearch:(root:string,query:string)=>fileAction<SearchHit[]>('search',{query},root),
  gitStage:(root:string,path:string)=>fileAction<void>('git.stage',{path},root),
  gitUnstage:(root:string,path:string)=>fileAction<void>('git.unstage',{path},root),
  gitDiscard:(root:string,path:string)=>fileAction<void>('git.discard',{path},root),
  gitCommit:(root:string,message:string)=>fileAction<string>('git.commit',{message},root),
  setBackendWorkspace:(root:string)=>projectRequest<ProjectIndexSummary>('index.refresh',{},root),
  refreshBackendWorkspace:()=>projectRequest<ProjectIndexSummary>('index.refresh'),
  projectGitStatus:()=>projectRequest<GitStatus>('git.status'),
  projectSymbols:async(query:string,limit=100)=>(await projectRequest<{items:SymbolLocation[]}>('project.symbols',{query,limit})).items,
  projectReferences:async(symbol:string,limit=100)=>(await projectRequest<{items:SymbolLocation[]}>('project.references',{symbol,limit})).items,
  lspStatus:()=>projectRequest<LspStatus>('lsp.status'),
  lspOpenDocument:(path:string,text:string,language?:string)=>document<LspDocumentResult>('lsp.open',path,text,language),
  lspChangeDocument:(path:string,text:string,language?:string)=>document<LspDocumentResult>('lsp.change',path,text,language),
  lspSaveDocument:(path:string,text?:string,language?:string)=>document<LspDocumentResult>('lsp.save',path,text,language),
  lspCloseDocument:(path:string,language?:string)=>document<LspDocumentResult>('lsp.close',path,undefined,language),
  lspRequest:<T=unknown>(path:string,lspMethod:string,lspParams:Record<string,unknown>,language?:string)=>projectRequest<LspRequestResult<T>>('lsp.request',{path,lspMethod,lspParams,language}),
  lspDiagnostics:(path:string,language?:string)=>document<LspDiagnosticResult>('lsp.diagnostics',path,undefined,language),
  loadSettings:()=>invoke<Partial<CodeWorkspaceSettings>|null>('glitch_workspace_settings',{value:null}),
  saveSettings:(value:CodeWorkspaceSettings)=>invoke<CodeWorkspaceSettings>('glitch_workspace_settings',{value}),
  startWorkspaceWatch:(root:string)=>invoke<void>('glitch_watch',{root}),
  stopWorkspaceWatch:()=>invoke<void>('glitch_watch',{root:null}),
  createTerminal:(cwd:string,title?:string)=>invoke<TerminalDescriptor>('glitch_terminal_create',{root:selectedRoot(),cwd,title}),
  readTerminal:(terminalId:string,offset:number,root=selectedRoot())=>invoke<{data:string;nextOffset:number;more:boolean;finished:boolean;code:number|null}>('glitch_terminal_read',{root,terminalId,offset}),
  writeTerminal:(terminalId:string,data:string,root=selectedRoot())=>invoke<void>('glitch_terminal_write',{root,terminalId,data}),
  resizeTerminal:(terminalId:string,cols:number,rows:number,root=selectedRoot())=>invoke<void>('glitch_terminal_resize',{root,terminalId,cols,rows}),
  killTerminal:(terminalId:string,root=selectedRoot())=>invoke<void>('glitch_terminal_kill',{root,terminalId}),
};
export const onTerminalEvent=(handler:(event:TerminalEvent)=>void):Promise<UnlistenFn>=>listen<TerminalEvent>('terminal://event',event=>handler(event.payload));
export const onWorkspaceFsEvent=(handler:(event:WorkspaceFsEvent)=>void):Promise<UnlistenFn>=>listen<WorkspaceFsEvent>('workspace://fs-event',event=>handler(event.payload));
