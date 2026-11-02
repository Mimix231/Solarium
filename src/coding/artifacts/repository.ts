import { foundationStore,newRecord } from '../../foundation/store';
import { accessibleScopes,assertScope,validateBody,type AccessContext,type RecordStore,type LibraryScope,type StoredRecord } from '../../foundation/types';
import { uid } from '../../domain/types';
import type { ContentBlock } from '../../blocks/protocol';
import { codeArtifactEvents } from './events';

export interface CodeAccessContext extends AccessContext {personal?:boolean}
export interface CodeOrigin {sessionId:string;messageId:string;blockId:string;sparkId?:string}
export interface CodeArtifactData {
  origin:CodeOrigin;language:string;pathHint:string|null;state:'streaming'|'ready'|'incomplete';
  naturalEnd:boolean;currentRevisionId:string|null;characters:number;userEdited:boolean;
  applied?:{root:string;path:string;revisionId:string;at:string};
}
export type CodeArtifact=StoredRecord<CodeArtifactData>;
export interface CodeRevisionData {artifactId:string;origin:'model'|'user';previousId:string|null}
export const generatedPath=(artifactId:string)=>'generated:'+artifactId;
export function sourcePathHint(block:ContentBlock):string|null {
  const candidate=(block.fileName??block.title).replace(/\\/g,'/').trim();
  return /\.[A-Za-z\d]{1,12}$/.test(candidate)&&!candidate.startsWith('/')&&!/^[A-Za-z]:/.test(candidate)&&!candidate.split('/').some(p=>!p||p==='.'||p==='..')&&!/[\0:*?"<>|]/.test(candidate)?candidate:null;
}
export function validateCodeArtifact(value:unknown):asserts value is CodeArtifactData {
  const d=value as CodeArtifactData;
  if(!d||!d.origin||!['sessionId','messageId','blockId'].every(k=>typeof d.origin[k as keyof CodeOrigin]==='string'&&Boolean(d.origin[k as keyof CodeOrigin]))||typeof d.language!=='string'||!['streaming','ready','incomplete'].includes(d.state)||typeof d.naturalEnd!=='boolean'||typeof d.userEdited!=='boolean'||!Number.isSafeInteger(d.characters)||d.characters<0||d.currentRevisionId!==null&&typeof d.currentRevisionId!=='string'||d.pathHint!==null&&typeof d.pathHint!=='string')throw Error('Invalid generated-code metadata.');
  if(d.pathHint!==null&&sourcePathHint({title:d.pathHint} as ContentBlock)!==d.pathHint)throw Error('Generated code contains an unsafe suggested path.');
}
/** Generated source is durable authored content. Only native project writes prove application. */
export class CodeRepository {
  constructor(readonly access:CodeAccessContext,readonly store:RecordStore=foundationStore){}
  private scopes(){return accessibleScopes(this.access,Boolean(this.access.personal));}
  private scope():LibraryScope {if(this.access.personal)return{kind:'library',id:'personal'};if(this.access.projectId)return{kind:'project',id:this.access.projectId};if(this.access.sessionId)return{kind:'chat',id:this.access.sessionId};throw Error('Generated code needs a conversation or project owner.');}
  async list():Promise<CodeArtifact[]>{return(await this.store.list<CodeArtifactData>({collection:'code_artifact',scopes:this.scopes()})).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  async get(id:string):Promise<{artifact:CodeArtifact;content:string}>{
    const artifact=(await this.list()).find(r=>r.id===id);if(!artifact)throw Error('Generated code is unavailable in this conversation or project.');
    validateCodeArtifact(artifact.data);
    const content=await this.store.body(artifact.data.currentRevisionId??artifact.id,this.scopes());
    if(content===null)throw Error('Generated-code content is missing.');return{artifact,content};
  }
  async capture(block:ContentBlock,origin:CodeOrigin,ended=false,cancelled=false,finished=ended||cancelled):Promise<CodeArtifact>{
    if(block.kind!=='code'&&block.kind!=='preview')throw Error('Only actual source/preview fences become generated code.');
    if(origin.sessionId!==this.access.sessionId)throw Error('Code origin belongs to another conversation.');
    validateBody(block.content);
    const id=`code:${origin.sessionId}:${origin.messageId}:${origin.blockId}`;
    if(id.length>180)throw Error('Generated-code identity is too long.');
    const existing=(await this.list()).find(r=>r.id===id);
    if(existing?.data.currentRevisionId)return existing; // Reopening a chat cannot overwrite user revisions.
    const final=finished;
    const state=final?(ended&&!cancelled&&block.status==='complete'?'ready':'incomplete'):'streaming';
    if(existing&&existing.data.state===state&&await this.store.body(id,this.scopes())===block.content)return existing;
    const revisionId=final?uid():null;
    const artifact:CodeArtifact={...newRecord('code_artifact',id,existing?.scope??this.scope(),block.title,{origin,language:block.kind==='preview'?'html':block.language,pathHint:sourcePathHint(block),state,naturalEnd:ended&&!cancelled,currentRevisionId:revisionId,characters:block.content.length,userEdited:false} satisfies CodeArtifactData),version:(existing?.version??0)+1};
    assertScope(artifact.scope,this.access,Boolean(this.access.personal));
    await this.store.batch([{record:artifact,expected:existing?.version??null,body:block.content},...(revisionId?[{record:newRecord<CodeRevisionData>('code_revision',revisionId,artifact.scope,artifact.title,{artifactId:id,origin:'model',previousId:null}),expected:null,body:block.content}]:[])]);
    codeArtifactEvents.changed();return artifact;
  }
  async edit(id:string,content:string,expectedVersion:number):Promise<CodeArtifact>{
    validateBody(content);const current=await this.get(id);
    if(current.artifact.version!==expectedVersion)throw Error('Generated-code revision conflict; your edited buffer is retained.');
    if(current.artifact.data.state==='streaming')throw Error('Wait for generation to finish or Stop before editing this draft.');
    if(current.content===content)return current.artifact;
    const revisionId=uid();const artifact={...current.artifact,version:expectedVersion+1,updatedAt:new Date().toISOString(),data:{...current.artifact.data,currentRevisionId:revisionId,characters:content.length,userEdited:true,applied:undefined}};
    await this.store.batch([{record:newRecord<CodeRevisionData>('code_revision',revisionId,artifact.scope,artifact.title,{artifactId:id,origin:'user',previousId:current.artifact.data.currentRevisionId}),expected:null,body:content},{record:artifact,expected:expectedVersion}]);
    codeArtifactEvents.changed();return artifact;
  }
  async recoverInterrupted(id:string,expectedVersion:number):Promise<CodeArtifact>{
    const {artifact,content}=await this.get(id);
    if(artifact.version!==expectedVersion)throw Error('The generated draft changed; refresh it before recovery.');
    if(artifact.data.state!=='streaming')return artifact;
    if(codeArtifactEvents.isStreaming(artifact.data.origin.sessionId,artifact.data.origin.messageId))throw Error('This source is still generating. Stop or wait before recovering it.');
    const revisionId=uid();const recovered={...artifact,version:artifact.version+1,updatedAt:new Date().toISOString(),data:{...artifact.data,state:'incomplete' as const,naturalEnd:false,currentRevisionId:revisionId}};
    await this.store.batch([{record:newRecord<CodeRevisionData>('code_revision',revisionId,artifact.scope,artifact.title,{artifactId:id,origin:'model',previousId:null}),expected:null,body:content},{record:recovered,expected:artifact.version}]);
    codeArtifactEvents.changed();return recovered;
  }
  async revisions(id:string){await this.get(id);return(await this.store.list<CodeRevisionData>({collection:'code_revision',scopes:this.scopes()})).filter(r=>r.data.artifactId===id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  async markApplied(id:string,revisionId:string,root:string,path:string):Promise<void>{
    const {artifact}=await this.get(id);if(artifact.data.currentRevisionId!==revisionId)throw Error('Source was applied, but the artifact changed before its receipt could be attached.');
    await this.store.batch([{record:{...artifact,version:artifact.version+1,updatedAt:new Date().toISOString(),data:{...artifact.data,applied:{root,path,revisionId,at:new Date().toISOString()}}},expected:artifact.version}]);codeArtifactEvents.changed();
  }
  async read(id:string,offset=0){
    if(!Number.isSafeInteger(offset)||offset<0)throw Error('Use a nonnegative source offset.');
    const {artifact,content}=await this.get(id);if(offset>content.length)throw Error('Source offset is past the end of this revision.');const end=Math.min(content.length,offset+1600);
    return{artifactId:id,title:artifact.title,language:artifact.data.language,state:artifact.data.state,version:artifact.version,content:content.slice(offset,end),offset,nextOffset:end,hasMore:end<content.length,totalCharacters:content.length,provenance:'generated source; project application requires its own native result'};
  }
}
