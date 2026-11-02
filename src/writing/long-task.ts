import { readableProse } from './prose';
import { deriveBrief, briefContext, authoringBrief, type ConversationBrief } from '../engine/intelligence/brief';
import { MetadataStream } from '../foundation/metadata-stream';
import { ContextArchive } from '../foundation/archive';
import { sceneIssues, type SceneProof } from './acceptance';
import { lengthTarget, type LengthTarget } from './length';
export { lengthTarget, type LengthTarget } from './length';
import { uid, now } from '../domain/types';
import type { AgentOptions } from '../engine/agent';
import type { InferenceAdapter } from '../engine/backends';
import type { Capabilities } from '../domain/types';
import { streamContinuousAnswer } from '../engine/continuous-generation';
import { composeSparkInstructions } from '../domain/persona';
import { foundationStore, newRecord } from '../foundation/store';
import type { StoredRecord, SourceScope, RecordStore } from '../foundation/types';
import { WritingRepository, wordCount } from './repository';
import { markdownContent } from './schema';
import type { WritingDocument } from './types';
import { StoryRepository } from '../stories/repository';
import { StoryMemoryStream, rememberStoryEvents, sceneMemoryInstruction, type StoryMemoryInput } from '../stories/memory';
export interface WritingProgress {taskId:string;documentId:string;characters:number;words:number;target:LengthTarget|null;scene:number;scenes:number;state:'planning'|'writing'|'incomplete'|'completed'|'cancelled'}
interface Scene {title:string;purpose:string;stateAfter:string;status:'pending'|'accepted';characters?:number;beatId?:string;proof?:SceneProof;diagnostic?:string;rejected?:string[]}
interface ChapterTask {sessionId:string;documentId:string;originalGoal:string;target:LengthTarget|null;state:WritingProgress['state'];scenes:Scene[];facts:string[];nextScene:number;currentRevisionId:string;planMessageId?:string;requestMessageId?:string;stopReason?:string;characters:number;words:number;updatedAt:string}
export const characterCount=(text:string)=>Array.from(text).length;
export function isLongWritingRequest(request:string):boolean{const target=lengthTarget(request);return Boolean(target&&(target.unit==='words'?target.minimum>=1500:target.minimum>=8000)&&/\b(write|draft|chapter|story|novel|essay|article|screenplay|report)\b/i.test(request));}
export function checkChapterLength(prose:string,target:LengthTarget):{complete:boolean;actual:number;missing:number}{const actual=target.unit==='characters'?characterCount(prose):wordCount(prose);return{complete:actual>=target.minimum,actual,missing:Math.max(0,target.minimum-actual)};}
function planFrom(text:string,expected:number):{title:string;facts:string[];scenes:Scene[]}{
  const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start<0||end<start)throw Error('The model did not return a chapter plan. No prose was discarded.');
  const value=JSON.parse(text.slice(start,end+1)) as {title?:unknown;facts?:unknown;scenes?:unknown};
  if(typeof value.title!=='string'||!Array.isArray(value.scenes)||value.scenes.length<1||value.scenes.length>100)throw Error('The chapter plan needs a title and distinct scenes.');
  const scenes=value.scenes.map((scene:unknown)=>{const s=scene as Record<string,unknown>;if(!s||typeof s.title!=='string'||typeof s.purpose!=='string'||typeof s.stateAfter!=='string')throw Error('Incomplete scene plan.');return{title:s.title.slice(0,180),purpose:s.purpose.slice(0,1500),stateAfter:s.stateAfter.slice(0,1000),status:'pending' as const};});
  if(scenes.length<Math.min(2,expected))throw Error('The scene plan is too short.');return{title:value.title.slice(0,150),facts:Array.isArray(value.facts)?value.facts.filter((s):s is string=>typeof s==='string').slice(0,20):[],scenes};
}
export async function unfinishedWriting(repo:WritingRepository,sessionId:string):Promise<StoredRecord<ChapterTask>|null>{
  return (await repo.store.list<ChapterTask>({collection:'writing_task',scopes:repo.scopes()})).filter(t=>t.data.sessionId===sessionId&&t.data.state!=='completed').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]??null;
}
/** Finished scene operations, each using one uncapped native response and the
 * same loaded model. Never interrupts/replays an active reasoning channel. */
export async function runLongWriting(options:AgentOptions,adapter:InferenceAdapter,capabilities:Capabilities,referenceContext:string,resume?:StoredRecord<ChapterTask>|null,store:RecordStore=foundationStore,retained?:ConversationBrief):Promise<string>{
  const repo=new WritingRepository({sessionId:options.session.id,projectId:options.session.projectId??null},store);
  const scope:SourceScope=options.session.projectId?{kind:'project',id:options.session.projectId}:{kind:'chat',id:options.session.id};
  const goal=resume?.data.originalGoal??options.session.messages.filter(m=>m.role==='user').at(-1)?.content??'';
  const brief=retained??deriveBrief(options.session);
  const target=resume?.data.target??brief.target??lengthTarget(goal);
  if(!target&&!brief.approvedPlan)throw Error('A planned chapter needs an explicit length target or an approved outline.');
  if(target&&(target.unit==='words'?target.minimum*6:target.minimum)>1_500_000)throw Error('This target exceeds the current document storage capacity. Split the work into chapters.');
  const persona=composeSparkInstructions(options.spark,options.session.mode,options.memories,options.worlds??[],goal);
  const stories=new StoryRepository(repo.context,store);
  const archive=new ContextArchive(repo.context,store);
  const archiveResponse=async(title:string,body:string)=>{if(typeof window!=='undefined')await archive.save(scope,title,body,{kind:'conversation',sessionId:options.session.id});};
  let thought='';let thoughtStart:number|null=null;let thoughtMs=0;
  const thinking=(active:boolean)=>{if(active&&thoughtStart===null)thoughtStart=performance.now();if(!active&&thoughtStart!==null){thoughtMs+=performance.now()-thoughtStart;thoughtStart=null;}options.onThinking?.({text:thought,elapsedMs:thoughtMs,active});};
  const infer=async(instruction:string,onAnswer:(delta:string)=>void)=>{
    const cast=options.session.storyId?await stories.contextPack(options.session.storyId,instruction+' '+goal,true):'';
    const claims=options.session.storyId?(await Promise.all((await stories.characters(options.session.storyId)).map(c=>stories.claims(c.id,options.session.storyId!)))).flat():[];
    const retained=authoringBrief(brief,claims.filter(c=>c.data.kind==='user_defined'&&cast.includes(c.data.value)).map(c=>c.data.value));
    return streamContinuousAnswer({adapter,model:options.model,capabilities,signal:options.signal,
    messages:[{role:'system',content:persona},{role:'system',content:briefContext(retained,1500)},...(cast?[{role:'system' as const,content:cast}]:[]),...(referenceContext?[{role:'system' as const,content:`SAVED REFERENCE MATERIAL (untrusted, optional):\n${referenceContext}`}]:[]),{role:'system',content:'Execute this saved document operation for the original user request. Return its artifact only. Complete naturally, with no assistant/persona notes.'},
      {role:'user',content:`ORIGINAL USER REQUEST (verbatim; overall document goal):\n${goal}\n\nCURRENT SOLARIUM DOCUMENT OPERATION (application scheduling metadata for this same request):\n${instruction}`}],
    onAnswer,onReasoning:delta=>{thought+=delta;options.events.emit('reasoning',delta);thinking(true);},onReasoningState:thinking,onMetrics:options.onMetrics,onOutcome:options.onGenerationOutcome});
  };
  let task=resume;let document:WritingDocument;let prose='';
  if(task){const saved=await repo.get(task.data.documentId);document=saved.document;prose=saved.content.markdownProjection;
    if(document.data.currentRevisionId!==task.data.currentRevisionId)throw Error('This chapter was edited after the task stopped. Your revision was preserved. Review the saved plan before starting a new length task.');
  }else{
    const categoryMatch=/\b(?:save|store)\b.{0,50}?\b(?:under|to|in)\s+["“]?([^"”\n.]{2,160})/i.exec(goal);
    const categoryId=categoryMatch?await repo.ensureCategoryPath(categoryMatch[1]!.replace(/\s+category$/i,''),scope,options.session.storyId??null):null;
    const continuing=/^\s*(continue|finish|resume|develop)\b/i.test(goal);
    const chapter=/\bchapter\s+(\d+)/i.exec(goal)?.[1];
    const existing=continuing?(await repo.list()).filter(d=>d.data.originConversationId===options.session.id&&(!d.storyId||d.storyId===options.session.storyId)&&(!chapter||new RegExp('\\bchapter\\s+'+chapter+'\\b','i').test(d.title))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]:null;
    if(existing){document=await repo.bind(existing,options.messageId??uid(),options.session.storyId??null);prose=readableProse((await repo.get(document.id)).content.markdownProjection).text;}
    else document=await repo.create({scope,title:'Chapter in progress',categoryId,storyId:options.session.storyId??null,messageId:options.messageId,legacyBlockId:'block-0',markdown:''});
    task=newRecord('writing_task',uid(),scope,document.title,{sessionId:options.session.id,documentId:document.id,originalGoal:goal,target,state:'planning',scenes:[],facts:[],nextScene:0,currentRevisionId:document.data.currentRevisionId,planMessageId:brief.approvedPlan?.messageId,requestMessageId:options.session.messages.filter(m=>m.role==='user').at(-1)?.id,characters:0,words:0,updatedAt:now()} satisfies ChapterTask,options.session.storyId);
    await repo.store.batch([{record:task,expected:null}]);
  }
  const progress=()=>options.onWritingTask?.({taskId:task!.id,documentId:document.id,characters:characterCount(prose),words:wordCount(prose),target,scene:task!.data.nextScene+1,scenes:task!.data.scenes.length,state:task!.data.state});
  const saveTask=async(patch:Partial<ChapterTask>)=>{const next={...task!,version:task!.version+1,updatedAt:now(),data:{...task!.data,...patch,characters:characterCount(prose),words:wordCount(prose),updatedAt:now()}};await repo.store.batch([{record:next,expected:task!.version}]);task=next;progress();};
  progress();let opened=false;let partial='';let checkpoint=Promise.resolve();let lastCheckpoint=0;
  try{
    if(!task.data.scenes.length){
      // The user's accepted outline is already a plan. Re-planning it spends
      // context and can lose approved events before any prose is written.
      if(brief.approvedPlan&&!target&&!prose.trim()){
        const title=/\bchapter\s+\d+/i.exec(goal)?.[0]??'Chapter';
        const scenes:Scene[]=brief.approvedPlan.beats.map(beat=>({title:beat.title,purpose:beat.purpose,stateAfter:`Fulfil the approved beat: ${beat.title}`,beatId:beat.id,status:'pending'}));
        document=await repo.save({...document,title},markdownContent(''),{metadata:{...document.data.metadata,writingTaskId:task.id}});
        await saveTask({scenes,facts:[],currentRevisionId:document.data.currentRevisionId,state:'writing'});
      }else{
      const count=target?Math.min(60,Math.max(2,Math.ceil((target.unit==='words'?target.minimum*6:target.minimum)/3500))):brief.approvedPlan!.beats.length;let planText='';
      options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:'running',title:'Planning chapter scenes',detail:target?`Target: ${target.minimum.toLocaleString()} ${target.unit}. Saving a plan before drafting.`:'Saving the approved chapter beats before drafting.'});
      const approved=brief.approvedPlan;
      const planned=await infer(`Create a compact JSON scene plan for the user's requested long chapter. About ${count} distinct scenes should develop one coherent chapter. Every scene must change the situation; no recap/padding. ${prose?`The document already contains ${characterCount(prose)} characters. Continue from it rather than starting over. Existing beginning: ${prose.slice(0,700)}. Existing final passage: ${prose.slice(-1800)}. A covered array may identify approved beat IDs ALREADY performed in this saved prose, with an exact short quote and endState. Do not claim a beat is covered by a plan or by new prose.`:''} ${approved?`The user approved these beats, in order: ${JSON.stringify(approved.beats)}. Cover ALL of them. Give every scene a beatId copied exactly from that outline. A beat may span several scenes; do not repeat its arrival or resolve later beats early.`:''} Preserve user facts, POV and continuity. Return JSON only: {"title":"...","covered":[{"beatId":"already performed ID only","quote":"exact saved prose passage","endState":"actual outcome"}],"facts":["facts/constraints from the user or supplied story"],"scenes":[{"title":"...","purpose":"specific action and emotional development","stateAfter":"concrete changed situation","beatId":"approved ID when supplied"}]}. This operation plans the document; it does not write the chapter.`,d=>{planText+=d;});
      await archiveResponse('Chapter plan: '+document.title,planText);
      if(planned.result.finishReason!=='stop')throw Error(planned.warning??'The planning response did not finish naturally.');
      const plan=planFrom(planText,prose?1:count);
      if(approved){
        const raw=JSON.parse(planText.slice(planText.indexOf('{'),planText.lastIndexOf('}')+1)) as {scenes:{beatId?:string}[];covered?:SceneProof[]};
        const recovered:Scene[]=[];let recoveredPosition=-1;
        for(const proof of raw.covered??[]){const position=approved.beats.findIndex(b=>b.id===proof.beatId);if(position<0||position<=recoveredPosition||sceneIssues(prose,'',proof.beatId,proof).length)throw Error('Existing chapter coverage must use actual saved passages in outline order.');recoveredPosition=position;recovered.push({title:approved.beats[position]!.title,purpose:'Previously drafted in this saved chapter.',stateAfter:proof.endState,status:'accepted',beatId:proof.beatId,proof});}
        let previous=recoveredPosition;
        for(const [i,scene]of plan.scenes.entries()){
          scene.beatId=raw.scenes[i]?.beatId;
          const position=approved.beats.findIndex(b=>b.id===scene.beatId);
          if(position<0||position<previous)throw Error('The scene plan omitted or reordered an approved chapter beat. The original plan was archived.');previous=position;
        }
        if(approved.beats.some(b=>![...recovered,...plan.scenes].some(scene=>scene.beatId===b.id)))throw Error('The scene plan did not cover the entire approved outline.');
        plan.scenes.unshift(...recovered);
      }
      document=await repo.save({...document,title:prose.trim()?document.title:plan.title},markdownContent(prose),{metadata:{...document.data.metadata,targetCharacters:target?.unit==='characters'?target.minimum:undefined,targetWordCount:target?.unit==='words'?target.minimum:undefined,writingTaskId:task.id}});
      await saveTask({scenes:plan.scenes,nextScene:plan.scenes.filter(s=>s.status==='accepted').length,facts:plan.facts,currentRevisionId:document.data.currentRevisionId,state:'writing'});
      }
    }
    options.onAnswer('```solarium-writing title="'+document.title.replace(/["\n\r]/g,'')+'"\n'+prose);opened=true;
    // The user can explicitly resume after Stop. Recover actual partial prose
    // separately; do not inject or reconstruct the stopped model's reasoning.
    const recovery=resume?await repo.draft(document.id):null;
    if(recovery&&recovery.markdown.startsWith(prose)&&recovery.markdown.length>prose.length){const extra=recovery.markdown.slice(prose.length);prose=recovery.markdown;options.onAnswer(extra);}
    while(task.data.nextScene<task.data.scenes.length||target&&!checkChapterLength(prose,target).complete){
      if(options.signal.aborted)throw new DOMException('Stopped','AbortError');
      if(target&&task.data.nextScene===task.data.scenes.length){
        const missing=checkChapterLength(prose,target).missing;let extension='';
        const planned=await infer(`The completed, saved scene operations produced ${target.unit==='characters'?characterCount(prose):wordCount(prose)} of the requested ${target.minimum} ${target.unit}. Plan meaningful further development to meet the remaining ${missing} ${target.unit} without repetition or filler. Preserve the story and existing ending's facts; add a naturally connected final movement. Return compact JSON {"title":"${document.title.replaceAll('"','')} already in progress","facts":[],"scenes":[{"title":"...","purpose":"new specific action","stateAfter":"changed situation"}]}, at least two scenes. Existing outcomes: ${task.data.scenes.map(s=>s.stateAfter).join('; ').slice(-2000)}. Exact chapter tail: ${prose.slice(-1400)}.`,d=>{extension+=d;});
        if(planned.result.finishReason!=='stop')throw Error('The development plan did not finish naturally.');
        const plan=planFrom(extension,2);await saveTask({scenes:[...task.data.scenes,...plan.scenes]});
      }
      const index=task.data.nextScene;const scene=task.data.scenes[index]!;const remaining=target?checkChapterLength(prose,target).missing:0;const scenesLeft=task.data.scenes.length-index;
      const desired=target?Math.max(target.unit==='characters'?2500:400,Math.ceil(remaining/scenesLeft)):3500;
      const sceneWords=Math.max(350,Math.min(650,Math.ceil(target?.unit==='words'?desired:desired/6)));
      const separator=prose.trim()?'\n\n***\n\n':'';partial='';await saveTask({state:'writing'});
      options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:'running',title:`Writing ${document.title}`,detail:`Scene ${index+1} of ${task.data.scenes.length} · ${characterCount(prose).toLocaleString()} characters saved`});
      const prior=task.data.scenes.slice(Math.max(0,index-2),index).map(s=>`${s.title}: ${s.stateAfter}`).join('\n');
      const later=task.data.scenes.slice(index+1).map(s=>s.title).join('; ').slice(0,400);
      const visibleScene=(delta:string)=>{
        if(!partial&&separator)options.onAnswer(separator);partial+=delta;options.onAnswer(delta);
        if(performance.now()-lastCheckpoint>1500){lastCheckpoint=performance.now();const snapshot=prose+separator+partial;checkpoint=checkpoint.then(()=>repo.checkpoint(document,snapshot,'generating'));}
      };
      const memoryStream=document.storyId?new StoryMemoryStream(visibleScene):null;
      const proofStream=scene.beatId?new MetadataStream<SceneProof>('solarium-scene',delta=>{if(memoryStream)memoryStream.push(delta);else visibleScene(delta);}):null;
      const result=await infer(`DOCUMENT SCENE OPERATION ${index+1}/${task.data.scenes.length}. The user's length target is cumulative across the saved chapter, not the length of this one response. Write ONE advancing scene of about ${sceneWords} words. Finish its last sentence and end naturally. Keep chapter/POV/tense. Prose only: no fences, recap, status report or padding. ${scene.diagnostic?`This is a planned repair of a naturally completed rejected scene. Fix this diagnostic: ${scene.diagnostic}. Its original response is archived; do not replay its reasoning.`:''} Current scene: ${scene.title}. Action: ${scene.purpose}. Reach this specific end state and stop: ${scene.stateAfter}. ${index===task.data.scenes.length-1?'Conclude the chapter with a satisfying ending.':'Do not conclude the whole chapter; later scenes: '+later}.\nContinuity constraints: ${task.data.facts.join('; ').slice(0,1800)}\nAccepted preceding scene outcomes: ${prior}\nExact final passage already saved (do not repeat it):\n${prose.slice(-1000)}\nThis is a new planned scene after completed, saved work. ${scene.beatId?`After prose append <solarium-scene>{"beatId":"${scene.beatId}","quote":"exact short passage that shows this scene reached its end state","endState":"what actually changed"}</solarium-scene>. Never claim an unperformed action.`:''} ${memoryStream?sceneMemoryInstruction:''}`,delta=>{if(proofStream)proofStream.push(delta);else if(memoryStream)memoryStream.push(delta);else visibleScene(delta);});
      await archiveResponse(`Scene ${index+1}: ${scene.title}`,result.answer);
      let proof:SceneProof|null=null;let proofError='';
      if(proofStream)try{proof=proofStream.finish();}catch(error){proofError=String(error);}
      let memories:StoryMemoryInput[]=[];
      if(memoryStream)try{memories=memoryStream.finish();}catch(error){options.onWarning?.(`Scene memory unavailable: ${String(error)}`);}
      await checkpoint;await repo.checkpoint(document,prose+separator+partial,'draft');
      if(result.result.finishReason!=='stop')throw Error(result.warning??`Scene stopped: ${result.result.finishReason}. Partial prose was preserved.`);
      if(!partial.trim())throw Error('The scene response contained no prose; the saved chapter remains available.');
      const sceneText=partial.trim();const issues=sceneIssues(sceneText,prose,scene.beatId,proof);if(proofError)issues.push(proofError);
      if(issues.length){
        let hash=2166136261;for(const char of sceneText.replace(/\s+/g,' ').trim())hash=Math.imul(hash^char.charCodeAt(0),16777619);const signature=(hash>>>0).toString(16);const unchanged=scene.rejected?.includes(signature);
        const scenes=task.data.scenes.map((s,i)=>i===index?{...s,diagnostic:issues.join(' '),rejected:[...(s.rejected??[]),signature]}:s);
        await saveTask({scenes,stopReason:issues.join(' ')});
        if(unchanged||!options.onAnswerReplace)throw Error(issues.join(' ')+' The unchanged proposal was not accepted; recovery is saved.');
        partial='';options.onAnswerReplace('```solarium-writing title="'+document.title.replace(/["\n\r]/g,'')+'"\n'+prose);
        continue;
      }
      prose+=separator+partial;partial='';
      document=await repo.save(document,markdownContent(prose),{status:'draft'});
      if(memories.length&&options.preferences.toolPermissions.remember_story_event!=='deny')try{await rememberStoryEvents(stories,repo,document,memories);}catch(error){options.onWarning?.(`Scene saved, but memory was rejected: ${String(error)}`);}
      const scenes=task.data.scenes.map((s,i)=>i===index?{...s,status:'accepted' as const,characters:characterCount(sceneText),...(proof?{proof}:{}),diagnostic:undefined,rejected:undefined}:s);
      await saveTask({scenes,nextScene:index+1,currentRevisionId:document.data.currentRevisionId,stopReason:result.result.finishReason});
    }
    const length=target?checkChapterLength(prose,target):{complete:task.data.scenes.every(s=>s.status==='accepted'),actual:characterCount(prose),missing:0};
    await saveTask({state:length.complete?'completed':'incomplete'});
    if(!length.complete&&target)options.onWarning?.(`Chapter saved with ${length.actual.toLocaleString()} of ${target.minimum.toLocaleString()} requested ${target.unit}. The model underwrote its planned scenes; the task remains incomplete. Use Resume chapter to develop it further.`);
    options.onAnswer('\n```');
    options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:length.complete?'completed':'failed',title:document.title,detail:`${characterCount(prose).toLocaleString()} characters · ${wordCount(prose).toLocaleString()} words saved. ${length.complete?(target?'Planned scenes saved and length target reached.':'All approved chapter beats drafted with saved supporting passages.'):'The chapter remains incomplete.'}`});
    return '```solarium-writing title="'+document.title.replace(/["\n\r]/g,'')+'"\n'+prose+'\n```';
  }catch(error){
    try{await checkpoint;await repo.checkpoint(document,prose+(partial?(prose.trim()?'\n\n***\n\n':'')+partial:''),options.signal.aborted?'cancelled':'draft');await saveTask({state:options.signal.aborted?'cancelled':'incomplete',stopReason:String(error)});}catch(saveError){options.onWarning?.(`Recovery could not be saved: ${String(saveError)}`);}
    if(opened)options.onAnswer('\n```'); // closes the display artifact; task state remains incomplete
    options.onWarning?.(`Chapter incomplete: ${String(error)}. Accepted scenes and available recovery text remain saved.`);
    throw error;
  }
}
