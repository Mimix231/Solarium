import type { RecordStore, SourceScope } from '../../foundation/types';
import { foundationStore, newRecord } from '../../foundation/store';
export interface WorkspaceSnapshot {root:string;activePath?:string;documents:{path:string;name:string;content:string;savedContent:string;pinned?:boolean;viewState?:unknown}[]}
export const normalizedRoot=(path:string)=>{const value=path.replace(/^\\\\\?\\/,'').replaceAll('\\','/').replace(/\/$/,'');return /^[A-Za-z]:/.test(value)?value.toLowerCase():value;};
export function sourceFileUri(path:string):string {
  const value=path.replace(/^\\\\\?\\/,'').replaceAll('\\','/');
  return 'file://'+(value.startsWith('/')?'':'/')+encodeURI(value).replace(/[?#]/g,encodeURIComponent);
}
export function validateWorkspaceSnapshot(value:WorkspaceSnapshot,root:string):void {
  const inside=(path:unknown)=>typeof path==='string'&&!path.includes('\0')&&!path.replaceAll('\\','/').split('/').some(part=>part==='.'||part==='..')&&normalizedRoot(path).startsWith(normalizedRoot(root)+'/');
  if(!value||typeof value.root!=='string'||normalizedRoot(value.root)!==normalizedRoot(root)||!Array.isArray(value.documents)||value.documents.some(d=>!d||!inside(d.path)||typeof d.name!=='string'||typeof d.content!=='string'||typeof d.savedContent!=='string')||value.activePath!==undefined&&!inside(value.activePath))throw Error('Workspace recovery contains an invalid or foreign document.');
  if(new Set(value.documents.map(d=>normalizedRoot(d.path))).size!==value.documents.length)throw Error('Workspace recovery contains duplicate document paths.');
}
export class WorkspaceSessionRepository {
  private scope:SourceScope;
  constructor(private projectId:string,private root:string,private store:RecordStore=foundationStore){this.scope={kind:'project',id:projectId};}
  async read():Promise<WorkspaceSnapshot|null>{
    const record=(await this.store.list<{root:string}>({scopes:[this.scope],collection:'code_workspace_state'})).find(r=>r.id==='code-workspace:'+this.projectId);
    if(!record||normalizedRoot(record.data.root)!==normalizedRoot(this.root))return null;
    const body=await this.store.body(record.id,[this.scope]);if(!body)throw Error('Saved workspace recovery content is missing.');
    const value=JSON.parse(body) as WorkspaceSnapshot;
    validateWorkspaceSnapshot(value,this.root);
    return value;
  }
  async save(value:WorkspaceSnapshot):Promise<void>{
    validateWorkspaceSnapshot(value,this.root);
    const id='code-workspace:'+this.projectId;const old=(await this.store.list({scopes:[this.scope],collection:'code_workspace_state'})).find(r=>r.id===id);
    const record={...newRecord('code_workspace_state',id,this.scope,'Code workspace',{root:this.root,openDocuments:value.documents.length,dirtyDocuments:value.documents.filter(d=>d.content!==d.savedContent).length}),version:(old?.version??0)+1};
    await this.store.batch([{record,expected:old?.version??null,body:JSON.stringify(value)}]);
  }
}
