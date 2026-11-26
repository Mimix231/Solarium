import type { ChatSession, CreatorProject } from '../../domain/types';
import { uid } from '../../domain/types';
import { SourceRepository, sourcePromptContext, type RetrievedSource } from '../../sources/repository';
import { StoryRepository } from '../../stories/repository';
import { FictionRepository } from '../../stories/fiction';
import { foundationStore, newRecord } from '../../foundation/store';
import type { StoredRecord, RecordStore } from '../../foundation/types';
import type { VerificationState } from './commands';
import {WritingRepository} from '../../writing/repository';
import {writingContext} from '../../writing/context';
import type {AppPlan} from './app-builder';
import type { WorkMemoryData } from './work-memory';
import type { SpicaTaskPlan } from './spica-task-orchestrator';
import type { ConstructionSession } from '../construction/session';
import type { CanonPoint } from '../../stories/canon';
import { matchesSearchPage } from '../../research/research';
import { wantsWebResearch } from '../task-intent';
import { isWritingRequest } from './brief';
export async function buildTaskContext(session:ChatSession,project:CreatorProject|undefined,store:RecordStore=foundationStore,point?:CanonPoint):Promise<{references:RetrievedSource[];savedWebIds:string[];context:string;storyContext:string}>{
  const access={sessionId:session.id,projectId:project?.id??null};const latest=session.messages.filter(m=>m.role==='user').at(-1)?.content??'';
  const scoped=point&&(point.arc!==undefined||point.chapter!==undefined);
  const freshResearch=!point&&wantsWebResearch(latest);
  const prior=scoped||freshResearch?'':session.messages.filter(m=>m.role==='user').slice(-3,-1).map(m=>m.content.slice(0,300)).join(' ');
  const query=freshResearch?latest:`${latest} ${project?.description??''} ${prior}`;
  const stories=new StoryRepository(access,store);const story=session.storyId?await stories.world(session.storyId):null;
  const category=story&&session.fiction?(await new FictionRepository(stories).selection(story.id,session.fiction)).category:null;
  const boundary=point??{arc:category?.data.arc??story?.data.spoilerArc,
    chapter:category?.data.chapter??story?.data.spoilerChapter,continuity:category?.data.continuity||story?.data.canonAnchor};
  const retrieved=await new SourceRepository(access,store).retrieve(query,{maxChars:2800,...boundary});
  const references=freshResearch?retrieved.filter(source=>matchesSearchPage(latest,{text:source.excerpt,title:source.title})):retrieved;
  const proseReferences=scoped&&isWritingRequest(latest)
    ? references.filter(source=>source.origin.kind!=='web') : references;
  const authored=/\b(write|draft|chapter|story|novel|prose|rewrite|document)\b/i.test(latest)?await writingContext(new WritingRepository(access,store),latest,session.storyId,point):'';
  // Story identity/knowledge has its own retained slot. Including a second full
  // copy among optional sources wastes input and can block the next real turn.
  const context=[sourcePromptContext(proseReferences),authored].filter(Boolean).join('\n\n');
  return {references:proseReferences,savedWebIds:[...new Set(references.filter(source=>source.origin.kind==='web').map(source=>source.sourceId))],
    context,storyContext:story?await stories.contextPack(story.id,latest,true,session.fiction,point):''};
}
export interface TaskData {sessionId:string;requestedOutcome:string;state:'working'|'paused'|'completed'|'failed'|'cancelled'|'blocked';operations:{id:string;tool:string;status:string;files?:string[];archiveId?:string;check?:{command:string;exitCode:number|null}}[];sourceIds:string[];startedAt:string;finishedAt?:string;verification?:VerificationState;workMemory?:WorkMemoryData;appPlan?:AppPlan;spicaPlan?:SpicaTaskPlan;construction?:ConstructionSession;blocker?:string}
export class TaskExecution {
  private record:StoredRecord<TaskData>;
  constructor(session:ChatSession,project:CreatorProject|undefined,sourceIds:string[],private store:RecordStore=foundationStore){this.record=newRecord('task_execution',uid(),project?{kind:'project',id:project.id}:{kind:'chat',id:session.id},'Task result',{sessionId:session.id,requestedOutcome:session.messages.filter(m=>m.role==='user').at(-1)?.content??'',state:'working',operations:[],sourceIds,startedAt:new Date().toISOString()});}
  get id():string{return this.record.id;}
  get data():TaskData{return this.record.data;}
  setSpicaPlan(plan:SpicaTaskPlan):void { this.record={...this.record,updatedAt:new Date().toISOString(),data:{...this.record.data,spicaPlan:structuredClone(plan)}}; }
  /** Construction checkpoints share the task and verification CAS record. */
  setConstructionCheckpoint(checkpoint: ConstructionSession): void {
    if (this.record.scope.kind === 'project' && checkpoint.projectId !== this.record.scope.id) {
      throw Error('Construction checkpoint belongs to another project.');
    }
    if (checkpoint.taskId !== this.id || checkpoint.sessionId !== this.data.sessionId) {
      throw Error('Construction checkpoint does not belong to this task.');
    }
    this.record={...this.record,updatedAt:new Date().toISOString(),data:{...this.record.data,construction:structuredClone(checkpoint)}};
  }
  static async latestConstruction(sessionId:string,projectId:string|null,store:RecordStore=foundationStore):Promise<ConstructionSession|null> {
    const scope=projectId?{kind:'project' as const,id:projectId}:{kind:'chat' as const,id:sessionId};
    const records=await store.list<TaskData>({collection:'task_execution',scopes:[scope]});
    const match=records.filter(r=>r.data.sessionId===sessionId && r.data.construction)
      .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
    return match?.data.construction?structuredClone(match.data.construction):null;
  }
  static async latestSpicaPlan(sessionId:string,projectId:string|null,store:RecordStore=foundationStore):Promise<SpicaTaskPlan|null> {
    const scope=projectId?{kind:'project' as const,id:projectId}:{kind:'chat' as const,id:sessionId};
    const records=await store.list<TaskData>({collection:'task_execution',scopes:[scope]});
    const match=records.filter(r=>r.data.sessionId===sessionId && Boolean(r.data.spicaPlan))
      .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
    return match?.data.spicaPlan?structuredClone(match.data.spicaPlan):null;
  }
  static async updateSpicaStatus(sessionId:string,projectId:string|null,status:'paused'|'cancelled',store:RecordStore=foundationStore):Promise<SpicaTaskPlan|null> {
    const scope=projectId?{kind:'project' as const,id:projectId}:{kind:'chat' as const,id:sessionId};
    const records=await store.list<TaskData>({collection:'task_execution',scopes:[scope]});
    const rec=records.filter(r=>r.data.sessionId===sessionId&&r.data.spicaPlan&&r.data.state!=='completed')
      .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
    if(!rec?.data.spicaPlan)return null;
    const plan:SpicaTaskPlan={...rec.data.spicaPlan,status,checkpointAt:new Date().toISOString()};
    const next={...rec,version:rec.version+1,updatedAt:new Date().toISOString(),data:{...rec.data,state:status,spicaPlan:plan}};
    await store.batch([{record:next,expected:rec.version}]);
    return structuredClone(next.data.spicaPlan!);
  }
  async resume(session:ChatSession):Promise<boolean>{
    const latest=session.messages.filter(m=>m.role==='user').at(-1)?.content??'';
    if(!/^\s*(continue|resume|finish|carry on|keep (?:going|working)|repair the failures)\b/i.test(latest))return false;
    const prior=(await this.store.list<TaskData>({collection:'task_execution',scopes:[this.record.scope]})).filter(r=>r.data.sessionId===session.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
    if(!prior||prior.data.state==='completed'||prior.data.state==='cancelled')return false;this.record={...prior,version:prior.version+1,data:{...prior.data,state:'working',finishedAt:undefined}};return true;
  }
  checkpoint(verification:VerificationState,workMemory?:WorkMemoryData,appPlan?:AppPlan):void{this.record={...this.record,data:{...this.record.data,verification:structuredClone(verification),...(workMemory?{workMemory:structuredClone(workMemory)}:{}),...(appPlan?{appPlan:structuredClone(appPlan)}:{})}};}
  async persist():Promise<void>{const expected=this.record.version===1?null:this.record.version-1;await this.store.batch([{record:this.record,expected}]);this.record={...this.record,version:this.record.version+1};}
  async operation(operation:TaskData['operations'][number]):Promise<void>{this.record={...this.record,data:{...this.record.data,operations:[...this.record.data.operations,operation]},updatedAt:new Date().toISOString()};await this.persist();}
  async finish(state:TaskData['state']):Promise<void>{this.record={...this.record,data:{...this.record.data,state,finishedAt:new Date().toISOString()},updatedAt:new Date().toISOString()};await this.persist();}
}
