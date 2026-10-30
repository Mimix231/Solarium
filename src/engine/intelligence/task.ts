import type { ChatSession, CreatorProject } from '../../domain/types';
import { uid } from '../../domain/types';
import { SourceRepository, sourcePromptContext, type RetrievedSource } from '../../sources/repository';
import { StoryRepository } from '../../stories/repository';
import { foundationStore, newRecord } from '../../foundation/store';
import type { StoredRecord } from '../../foundation/types';
export async function buildTaskContext(session:ChatSession,project:CreatorProject|undefined):Promise<{references:RetrievedSource[];context:string}>{
  const access={sessionId:session.id,projectId:project?.id??null};const latest=session.messages.filter(m=>m.role==='user').at(-1)?.content??'';
  const query=`${latest} ${project?.description??''} ${session.messages.filter(m=>m.role==='user').slice(-3,-1).map(m=>m.content.slice(0,300)).join(' ')}`;
  const stories=new StoryRepository(access);const story=session.storyId?await stories.world(session.storyId):null;
  const references=await new SourceRepository(access).retrieve(query,{maxChars:2800,arc:story?.data.spoilerArc,chapter:story?.data.spoilerChapter,continuity:story?.data.canonAnchor});
  const context=[sourcePromptContext(references),...(story?[await stories.contextPack(story.id,latest)]:[])].filter(Boolean).join('\n\n');return {references,context};
}
export interface TaskData {sessionId:string;requestedOutcome:string;state:'working'|'completed'|'failed'|'cancelled';operations:{id:string;tool:string;status:string;files?:string[];check?:{command:string;exitCode:number|null}}[];sourceIds:string[];startedAt:string;finishedAt?:string}
export class TaskExecution {
  private record:StoredRecord<TaskData>;
  constructor(session:ChatSession,project:CreatorProject|undefined,sourceIds:string[]){this.record=newRecord('task_execution',uid(),project?{kind:'project',id:project.id}:{kind:'chat',id:session.id},'Task result',{sessionId:session.id,requestedOutcome:session.messages.filter(m=>m.role==='user').at(-1)?.content??'',state:'working',operations:[],sourceIds,startedAt:new Date().toISOString()});}
  async persist():Promise<void>{const expected=this.record.version===1?null:this.record.version-1;await foundationStore.batch([{record:this.record,expected}]);this.record={...this.record,version:this.record.version+1};}
  async operation(operation:TaskData['operations'][number]):Promise<void>{this.record={...this.record,data:{...this.record.data,operations:[...this.record.data.operations,operation]},updatedAt:new Date().toISOString()};await this.persist();}
  async finish(state:TaskData['state']):Promise<void>{this.record={...this.record,data:{...this.record.data,state,finishedAt:new Date().toISOString()},updatedAt:new Date().toISOString()};await this.persist();}
}
