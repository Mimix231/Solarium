import type { ChatSession, CreatorProject } from '../../domain/types';
import { uid } from '../../domain/types';
import { SourceRepository, sourcePromptContext, type RetrievedSource } from '../../sources/repository';
import { StoryRepository } from '../../stories/repository';
import { foundationStore, newRecord } from '../../foundation/store';
import type { StoredRecord, RecordStore } from '../../foundation/types';
import type { VerificationState } from './commands';
import {WritingRepository} from '../../writing/repository';
import {writingContext} from '../../writing/context';
import type {AppPlan} from './app-builder';
import type { WorkMemoryData } from './work-memory';
export async function buildTaskContext(session:ChatSession,project:CreatorProject|undefined,store:RecordStore=foundationStore):Promise<{references:RetrievedSource[];context:string;storyContext:string}>{
  const access={sessionId:session.id,projectId:project?.id??null};const latest=session.messages.filter(m=>m.role==='user').at(-1)?.content??'';
  const query=`${latest} ${project?.description??''} ${session.messages.filter(m=>m.role==='user').slice(-3,-1).map(m=>m.content.slice(0,300)).join(' ')}`;
  const stories=new StoryRepository(access,store);const story=session.storyId?await stories.world(session.storyId):null;
  const references=await new SourceRepository(access,store).retrieve(query,{maxChars:2800,arc:story?.data.spoilerArc,chapter:story?.data.spoilerChapter,continuity:story?.data.canonAnchor});
  const authored=/\b(write|draft|chapter|story|novel|prose|rewrite|document)\b/i.test(latest)?await writingContext(new WritingRepository(access,store),latest,session.storyId):'';
  // Story identity/knowledge has its own retained slot. Including a second full
  // copy among optional sources wastes input and can block the next real turn.
  const context=[sourcePromptContext(references),authored].filter(Boolean).join('\n\n');return {references,context,storyContext:story?await stories.contextPack(story.id,latest,true):''};
}
export interface TaskData {sessionId:string;requestedOutcome:string;state:'working'|'completed'|'failed'|'cancelled'|'blocked';operations:{id:string;tool:string;status:string;files?:string[];archiveId?:string;check?:{command:string;exitCode:number|null}}[];sourceIds:string[];startedAt:string;finishedAt?:string;verification?:VerificationState;workMemory?:WorkMemoryData;appPlan?:AppPlan;blocker?:string}
export class TaskExecution {
  private record:StoredRecord<TaskData>;
  constructor(session:ChatSession,project:CreatorProject|undefined,sourceIds:string[],private store:RecordStore=foundationStore){this.record=newRecord('task_execution',uid(),project?{kind:'project',id:project.id}:{kind:'chat',id:session.id},'Task result',{sessionId:session.id,requestedOutcome:session.messages.filter(m=>m.role==='user').at(-1)?.content??'',state:'working',operations:[],sourceIds,startedAt:new Date().toISOString()});}
  get id():string{return this.record.id;}
  get data():TaskData{return this.record.data;}
  async resume(session:ChatSession):Promise<boolean>{
    const latest=session.messages.filter(m=>m.role==='user').at(-1)?.content??'';
    if(!/^\s*(continue|resume|finish|carry on|keep (?:going|working)|repair the failures)\b/i.test(latest))return false;
    const prior=(await this.store.list<TaskData>({collection:'task_execution',scopes:[this.record.scope]})).filter(r=>r.data.sessionId===session.id&&r.data.state!=='completed').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
    if(!prior)return false;this.record={...prior,version:prior.version+1,data:{...prior.data,state:'working',finishedAt:undefined}};return true;
  }
  checkpoint(verification:VerificationState,workMemory?:WorkMemoryData,appPlan?:AppPlan):void{this.record={...this.record,data:{...this.record.data,verification:structuredClone(verification),...(workMemory?{workMemory:structuredClone(workMemory)}:{}),...(appPlan?{appPlan:structuredClone(appPlan)}:{})}};}
  async persist():Promise<void>{const expected=this.record.version===1?null:this.record.version-1;await this.store.batch([{record:this.record,expected}]);this.record={...this.record,version:this.record.version+1};}
  async operation(operation:TaskData['operations'][number]):Promise<void>{this.record={...this.record,data:{...this.record.data,operations:[...this.record.data.operations,operation]},updatedAt:new Date().toISOString()};await this.persist();}
  async finish(state:TaskData['state']):Promise<void>{this.record={...this.record,data:{...this.record.data,state,finishedAt:new Date().toISOString()},updatedAt:new Date().toISOString()};await this.persist();}
}
