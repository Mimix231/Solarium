import {withLocalWork} from './work-lifecycle';
import { foundationStore } from '../foundation/store';
import type { RecordStore } from '../foundation/types';
import { runAgent, type AgentOptions } from './agent';
import { now, uid, type ChatMessage, type ChatSource, type TerminalRun } from '../domain/types';
import { WritingRepository } from '../writing/repository';
import { WritingDraftStream } from '../writing/stream';
import { StoryRepository } from '../stories/repository';
import { rememberStoryEvents, type StoryMemoryInput } from '../stories/memory';
import { containsWritingPassage } from '../writing/schema';
import { evolveVisualAction, type VisualAction } from './visual-actions';
import type { LiveWorkspaceUpdate } from './live-workspace';
import type { GenerationOutcome } from './continuous-generation';
import { CodeRepository } from '../coding/artifacts/repository';
import { GeneratedCodeStream } from '../coding/artifacts/stream';

export interface ConversationSink {
  appendMessage(sessionId:string,message:ChatMessage):void;
  updateSession(sessionId:string,patch:{storyId:string}):void;
  upsertVisualAction(action:VisualAction):void;
}
/** The normal chat controller. Quality checks invoke this exact same save/stream/recovery path. */
export async function runConversation(options:AgentOptions,sink:ConversationSink,initialSources:ChatSource[]=[],store:RecordStore=foundationStore):Promise<string>{
  return withLocalWork(options.messageId??uid(),options.session.title,options.model.ggufPath,options.signal,signal=>runConversationInner({...options,signal},sink,initialSources,store));
}
async function runConversationInner(options:AgentOptions,sink:ConversationSink,initialSources:ChatSource[],store:RecordStore):Promise<string>{
  const session={...options.session};const messageId=options.messageId??uid();
  const repo=new WritingRepository({sessionId:session.id,projectId:session.projectId??null},store);
  const scope=session.projectId?{kind:'project' as const,id:session.projectId}:{kind:'chat' as const,id:session.id};
  const actions=new Map<string,VisualAction>();const terminals:TerminalRun[]=[],memories:StoryMemoryInput[]=[],outcomes:GenerationOutcome[]=[];
  const sources=new Map(initialSources.map(s=>[s.url,s]));let savedSources:{id:string;title:string}[]=[];
  let answer='',warning:string|undefined,thought:{text:string;elapsedMs:number}|null=null,managed=false,progress=0,lastDocumentUpdate=0;
  const warn=(text:string)=>{warning=text;options.onWarning?.(text);};
  const stream=new WritingDraftStream(repo,scope,messageId,session.storyId??null,error=>warn(`Draft checkpoint failed: ${String(error)}`));
  const codeRepo=new CodeRepository({sessionId:session.id,projectId:session.projectId??null},store);
  const codeStream=new GeneratedCodeStream(codeRepo,{sessionId:session.id,messageId,sparkId:options.spark.id},error=>warn(`Generated code recovery failed: ${String(error)}`));
  const workspace=(update:LiveWorkspaceUpdate)=>{const id=update.operationId??uid();actions.set(id,evolveVisualAction(actions.get(id),{...update,operationId:id},session.id,messageId,now()));options.onWorkspace?.(update);};
  const writingStatus=(final=false)=>{
    for(const part of stream.parts()){
      if(part.type!=='block'||part.block.kind!=='writing')continue;
      workspace({operationId:`document:${messageId}:${part.block.id}`,kind:'writing',status:final?'failed':'running',title:part.block.title,detail:final?'Generation ended without a confirmed current document revision. Recovery remains available.':'Writing prose · saving the actual draft',output:part.block.content});
    }
  };
  try{
    await runAgent({...options,session,messageId,
      onAnswer:delta=>{answer+=delta;codeStream.push(delta);if(!managed){stream.push(delta);if(performance.now()-lastDocumentUpdate>180){lastDocumentUpdate=performance.now();writingStatus();}}options.onAnswer(delta);},
      onAnswerReplace:text=>{answer=text;codeStream.replace(text);if(!managed)stream.replaceVisible(text);options.onAnswerReplace?.(text);},
      onWorkUpdate:text=>{answer=answer.slice(0,-text.length);codeStream.replace(answer);stream.replaceVisible(answer);workspace({operationId:`progress:${messageId}:${progress++}`,kind:'inspect',status:'completed',title:'Progress update',detail:text,output:text});options.onWorkUpdate?.(text);},
      onStory:id=>{session.storyId=id;sink.updateSession(session.id,{storyId:id});stream.setStory(id);options.onStory?.(id);},
      onStoryMemories:input=>{memories.push(...input);options.onStoryMemories?.(input);},
      beforeTool:async name=>{if(['finalize_writing_document','remember_story_event'].includes(name))await stream.flush();await options.beforeTool?.(name);},
      onWritingTask:state=>{managed=true;options.onWritingTask?.(state);},
      onThinking:state=>{thought=state;options.onThinking?.(state);},
      onWarning:warn,onTerminal:run=>{terminals.push(run);options.onTerminal?.(run);},
      onSource:source=>{sources.set(source.url,source);options.onSource?.(source);},
      onSavedSources:references=>{savedSources=references.map(r=>({id:r.sourceId,title:r.title}));options.onSavedSources?.(references);},
      onGenerationOutcome:outcome=>{outcomes.push(outcome);options.onGenerationOutcome?.(outcome);},
    });
    return answer;
  }finally{
    try{
      await codeStream.finish(outcomes.at(-1)?.reason==='natural_eos',options.signal.aborted);
      for(const artifact of(await codeRepo.list()).filter(a=>a.data.origin.messageId===messageId))workspace({operationId:`code:${artifact.id}`,kind:'generate',status:artifact.data.state==='ready'?'completed':'failed',title:artifact.title,detail:artifact.data.state==='ready'?'Generated source saved locally · available in Code Studio.':'Incomplete generated source retained for recovery.'});
    }catch(error){warn(`Generated code could not be saved: ${String(error)}. Original code remains in this chat.`);}
    try{if(!managed){
      let category:string|null|undefined;const request=session.messages.filter(m=>m.role==='user').at(-1)?.content??'';
      if(!options.signal.aborted&&/\b(save|store)\b/i.test(request)&&/\b(chapter|document|story|essay|article)\b/i.test(request)){
        const path=/\b(?:save|store)\b.{0,50}?\b(?:under|to|in)\s+["“]?([^"”\n.]{2,160})/i.exec(request);
        try{category=path?await repo.ensureCategoryPath(path[1]!.replace(/\s+category$/i,''),scope,session.storyId??null):null;}catch(error){warn(String(error));}
      }
      await stream.finish(options.signal.aborted,category);
      const documents=(await repo.list()).filter(d=>d.data.originMessageId===messageId||d.data.messageBindings?.includes(messageId));
      if(!options.signal.aborted&&memories.length&&options.preferences.toolPermissions.remember_story_event!=='deny')for(const document of documents.filter(d=>d.storyId))try{
        const saved=await repo.get(document.id);const relevant=memories.filter(m=>typeof m.quote==='string'&&containsWritingPassage(saved.content,m.quote));
        if(relevant.length)await rememberStoryEvents(new StoryRepository(repo.context),repo,saved.document,relevant);
      }catch(error){warn(`Chapter saved; story memory could not be saved: ${String(error)}`);}
      writingStatus(true);
      for(const part of stream.parts())if(part.type==='block'&&part.block.kind==='writing'){
        const document=documents.find(d=>d.data.legacyBlockId===part.block.id||!d.data.legacyBlockId&&d.title===part.block.title);
        const saved=document?await repo.get(document.id):null;
        if(!options.signal.aborted&&part.block.status==='complete'&&saved&&saved.content.markdownProjection===part.block.content)workspace({operationId:`document:${messageId}:${part.block.id}`,kind:'writing',status:'completed',title:saved.document.title,detail:'Current prose revision confirmed in local storage.',output:part.block.content});
      }
    }
    }catch(error){warn(`Writing recovery or finalization failed: ${String(error)}. The actual response is preserved in this chat.`);}
    const snapshot=thought as {text:string;elapsedMs:number}|null;
    if(answer.trim()||snapshot?.text||actions.size)sink.appendMessage(session.id,{id:messageId,role:'assistant',content:answer,sparkId:options.spark.id,sources:[...sources.values()],terminalRuns:terminals,generationOutcomes:outcomes,savedSourceRefs:savedSources,...(warning?{generationWarning:warning}:{}),...(snapshot?.text?{reasoning:snapshot.text,reasoningMs:snapshot.elapsedMs}:{}),createdAt:now()});
    for(const action of actions.values())sink.upsertVisualAction(action.status==='running'?{...action,status:'failed',detail:action.detail+'\nNo completed result was confirmed.'}:action);
  }
}
