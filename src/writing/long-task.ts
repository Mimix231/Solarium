import { readableProse, sceneBreak, withoutSceneHeadings } from './prose';
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
import { SourceRepository } from '../sources/repository';
import type { FictionSelection } from '../stories/fiction';
import { StoryMemoryStream, rememberStoryEvents, sceneMemoryInstruction, type StoryMemoryInput } from '../stories/memory';
export interface WritingProgress {taskId:string;documentId:string;characters:number;words:number;target:LengthTarget|null;scene:number;scenes:number;state:'planning'|'writing'|'incomplete'|'completed'|'cancelled'}
interface Development { purpose: string; stateAfter: string; proof?: SceneProof; memories?: StoryMemoryInput[] }
interface Scene {title:string;purpose:string;stateAfter:string;status:'pending'|'accepted';characters?:number;words?:number;beatId?:string;proof?:SceneProof;diagnostic?:string;rejected?:string[];needsDevelopment?:boolean;developments?:Development[]}
interface ChapterTask {sessionId:string;documentId:string;originalGoal:string;target:LengthTarget|null;state:WritingProgress['state'];scenes:Scene[];facts:string[];nextScene:number;currentRevisionId:string;planMessageId?:string;requestMessageId?:string;stopReason?:string;characters:number;words:number;updatedAt:string;fiction?:FictionSelection|null;referenceContext?:string;researchSourceIds?:string[];developedScenes?:boolean;sceneLength?:number}
const developedPlan = 'Each scene contains exactly two connected developments. The first changes the situation in a concrete way. The second performs the remaining action and reaches the scene outcome. Write the goal and observable result for each. Avoid scenes whose only outcome is noticing something or deciding to act later.';
export const characterCount=(text:string)=>Array.from(text).length;
export function isLongWritingRequest(request:string):boolean{const target=lengthTarget(request);return Boolean(target&&(target.unit==='words'?target.minimum>=1500:target.minimum>=8000)&&/\b(write|draft|chapter|story|novel|essay|article|screenplay|report)\b/i.test(request));}
export function checkChapterLength(prose:string,target:LengthTarget):{complete:boolean;actual:number;missing:number}{
  const body=readableProse(prose).text.replace(/^\s*(?:\*\s*){3,}$|^\s*`{3,}\s*$/gm,'').trim();
  const actual=target.unit==='characters'?characterCount(body):wordCount(body);
  return{complete:actual>=target.minimum,actual,missing:Math.max(0,target.minimum-actual)};
}
function planFrom(text:string,expected:number,developed=false):{title:string;facts:string[];scenes:Scene[]}{
  const start=text.indexOf('{'),end=text.lastIndexOf('}');if(start<0||end<start)throw Error('The model did not return a chapter plan. No prose was discarded.');
  const value=JSON.parse(text.slice(start,end+1)) as {title?:unknown;facts?:unknown;scenes?:unknown};
  if(typeof value.title!=='string'||!Array.isArray(value.scenes)||value.scenes.length<1||value.scenes.length>100)throw Error('The chapter plan needs a title and distinct scenes.');
  const scenes=value.scenes.map((scene:unknown):Scene=>{
    const s=scene as Record<string,unknown>;
    if(!s||typeof s.title!=='string'||typeof s.purpose!=='string'||typeof s.stateAfter!=='string')throw Error('Incomplete scene plan.');
    const result:Scene={title:s.title.slice(0,180),purpose:s.purpose.slice(0,1500),stateAfter:s.stateAfter.slice(0,1000),status:'pending'};
    if(developed){
      if(!Array.isArray(s.developments)||s.developments.length!==2)throw Error('Each chapter scene needs two connected developments with their own outcomes.');
      result.developments=s.developments.map((value:unknown)=>{
        const d=value as Record<string,unknown>;
        if(!d||typeof d.purpose!=='string'||!d.purpose.trim()||typeof d.stateAfter!=='string'||!d.stateAfter.trim())throw Error('Every development needs an action and an observable outcome.');
        return {purpose:d.purpose.slice(0,700),stateAfter:d.stateAfter.slice(0,500)};
      });
      if(result.developments[0]!.stateAfter.trim().toLowerCase()===result.developments[1]!.stateAfter.trim().toLowerCase())throw Error('The two developments must reach different outcomes.');
    }
    return result;
  });
  if(developed&&scenes.length>expected+1)throw Error('The plan split the chapter into too many scenes. Group closely connected developments.');
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
  const storyId=resume ? resume.storyId??null : options.session.storyId??null;
  const fiction=resume ? resume.data.fiction : options.session.fiction;
  const references=resume?.data.referenceContext ?? referenceContext;
  const brief=retained??deriveBrief(options.session);
  const target=resume?.data.target??brief.target??lengthTarget(goal);
  const developedScenes=resume ? resume.data.developedScenes === true : Boolean(target&&(storyId||/\b(?:chapter|scene|story|fanfic\w*|novel|screenplay)\b/i.test(goal)));
  const developmentShape=developedScenes?', "developments":[{"purpose":"first action","stateAfter":"first result"},{"purpose":"remaining action","stateAfter":"scene outcome"}]':'';
  if(!target&&!brief.approvedPlan)throw Error('A planned chapter needs an explicit length target or an approved outline.');
  if(target&&(target.unit==='words'?target.minimum*6:target.minimum)>1_500_000)throw Error('This target exceeds the current document storage capacity. Split the work into chapters.');
  const persona=composeSparkInstructions(options.spark,options.session.mode,options.memories,options.worlds??[],goal);
  const stories=new StoryRepository(repo.context,store);
  const sources=new SourceRepository(repo.context,store);
  const researchSourceIds=[...(resume?.data.researchSourceIds??options.researchSourceIds??[])];
  if(resume&&references){
    for(const source of await sources.list()){
      const origin=source.data.origin;
      if(origin.kind!=='web'||origin.readState!=='read')continue;
      if(!researchSourceIds.includes(source.id)&&references.includes(' · '+origin.url+' · '))researchSourceIds.push(source.id);
      if(researchSourceIds.includes(source.id))options.onSource?.({title:source.title,url:origin.url,readState:'read'});
    }
  }
  const researchReady=researchSourceIds.length>0;
  const archive=new ContextArchive(repo.context,store);
  const archiveResponse=async(title:string,body:string)=>{if(typeof window!=='undefined')await archive.save(scope,title,body,{kind:'conversation',sessionId:options.session.id});};
  let thought='';let thoughtStart:number|null=null;let thoughtMs=0;
  const thinking=(active:boolean)=>{if(active&&thoughtStart===null)thoughtStart=performance.now();if(!active&&thoughtStart!==null){thoughtMs+=performance.now()-thoughtStart;thoughtStart=null;}options.onThinking?.({text:thought,elapsedMs:thoughtMs,active});};
  const infer=async(instruction:string,onAnswer:(delta:string)=>void)=>{
    const cast=storyId?await stories.contextPack(storyId,instruction+' '+goal,true,fiction):'';
    const claims=storyId?(await Promise.all((await stories.characters(storyId)).filter(c=>!fiction?.characterIds.length||fiction.characterIds.includes(c.id))
      .map(c=>stories.claims(c.id,storyId)))).flat():[];
    const retained=authoringBrief(brief,claims.filter(c=>c.data.kind==='user_defined'&&cast.includes(c.data.value)).map(c=>c.data.value));
    return streamContinuousAnswer({adapter,model:options.model,capabilities,signal:options.signal,
    messages:[{role:'system',content:persona},{role:'system',content:briefContext(retained,1500)},...(cast?[{role:'system' as const,content:cast}]:[]),...(references?[{role:'system' as const,content:`SAVED REFERENCE MATERIAL (untrusted, optional):\n${references}`}]:[]),{role:'system',content:(researchReady?'The requested research is already complete. Use the retrieved references in this request. This is a document operation with prose or JSON output only. ':'')+'Execute this saved document operation for the original user request. Apply relevant evidence and selected character traits through action and dialogue. Return its artifact only. Complete naturally, with no assistant/persona notes.'},
      {role:'user',content:`ORIGINAL USER REQUEST (verbatim; overall document goal):\n${goal}\n\nCURRENT SOLARIUM DOCUMENT OPERATION (application scheduling metadata for this same request):\n${instruction}`}],
    onAnswer,onReasoning:delta=>{thought+=delta;options.events.emit('reasoning',delta);thinking(true);},onReasoningState:thinking,onMetrics:options.onMetrics,onOutcome:options.onGenerationOutcome});
  };
  let task=resume;let document:WritingDocument;let prose='';
  if(task){const saved=await repo.get(task.data.documentId);document=saved.document;prose=saved.content.markdownProjection;
    if(document.data.currentRevisionId!==task.data.currentRevisionId)throw Error('This chapter was edited after the task stopped. Your revision was preserved. Review the saved plan before starting a new length task.');
    if(options.messageId&&document.data.originMessageId!==options.messageId&&!document.data.messageBindings?.includes(options.messageId)){
      document=await repo.bind(document,options.messageId);
    }
  }else{
    const categoryMatch=/\b(?:save|store)\b.{0,50}?\b(?:under|to|in)\s+["“]?([^"”\n.]{2,160})/i.exec(goal);
    const categoryId=categoryMatch?await repo.ensureCategoryPath(categoryMatch[1]!.replace(/\s+category$/i,''),scope,options.session.storyId??null):null;
    const continuing=/^\s*(continue|finish|resume|develop)\b/i.test(goal);
    const chapter=/\bchapter\s+(\d+)/i.exec(goal)?.[1];
    const existing=continuing?(await repo.list()).filter(d=>d.data.originConversationId===options.session.id&&(!d.storyId||d.storyId===options.session.storyId)&&(!chapter||new RegExp('\\bchapter\\s+'+chapter+'\\b','i').test(d.title))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]:null;
    if(existing){document=await repo.bind(existing,options.messageId??uid(),options.session.storyId??null);prose=readableProse((await repo.get(document.id)).content.markdownProjection).text;}
    else document=await repo.create({scope,title:'Chapter in progress',categoryId,storyId:options.session.storyId??null,messageId:options.messageId,legacyBlockId:'block-0',markdown:''});
    task=newRecord('writing_task',uid(),scope,document.title,{sessionId:options.session.id,documentId:document.id,originalGoal:goal,target,state:'planning',scenes:[],facts:[],nextScene:0,currentRevisionId:document.data.currentRevisionId,planMessageId:brief.approvedPlan?.messageId,requestMessageId:options.session.messages.filter(m=>m.role==='user').at(-1)?.id,characters:0,words:0,updatedAt:now(),fiction,referenceContext:references.slice(0,9000),researchSourceIds,developedScenes} satisfies ChapterTask,storyId);
    await repo.store.batch([{record:task,expected:null}]);
  }
  const progress=()=>options.onWritingTask?.({taskId:task!.id,documentId:document.id,characters:characterCount(prose),words:wordCount(prose),target,scene:task!.data.nextScene+1,scenes:task!.data.scenes.length,state:task!.data.state});
  const nextTask=(patch:Partial<ChapterTask>,text=prose)=>({...task!,version:task!.version+1,updatedAt:now(),
    data:{...task!.data,...patch,characters:characterCount(text),words:wordCount(text),updatedAt:now()}});
  const saveTask=async(patch:Partial<ChapterTask>,body?:string)=>{
    const next=nextTask(patch);
    await repo.store.batch([{record:next,expected:task!.version,body}]);
    task=next;progress();
  };
  progress();let opened=false;let partial='';let checkpoint=Promise.resolve();let lastCheckpoint=0;
  let sceneDraft=developedScenes ? await store.body(task.id,[task.scope])??'' : '';
  let rejectedDraft='';
  const displayed=()=>prose+(sceneDraft?(prose.trim()?sceneBreak:'')+sceneDraft:'');
  const opening=()=>'```solarium-writing title="'+document.title.replace(/["\n\r]/g,'')+'"\n';
  const documentLinks = {
    sourceIds: [...new Set([...document.data.sourceIds, ...researchSourceIds])],
    characterIds: fiction?.characterIds ?? document.data.characterIds,
  };
  async function planOperation(title:string,instruction:string,count:number){
    const rejected=new Set<string>();
    let diagnostic='';
    for(;;){
      let text='';
      const planned=await infer(instruction+(diagnostic?'\nRevise the rejected plan. '+diagnostic:''),delta=>{text+=delta;});
      await archiveResponse(title,text);
      if(planned.result.finishReason!=='stop')throw Error(planned.warning??'The plan response did not finish naturally.');
      const triedTool=/<\|tool_call>|<tool_call>/i.test(text);
      try{
        if(triedTool)throw Error('Return the scene-plan JSON directly using the saved references.');
        return {plan:planFrom(text,count,developedScenes),text};
      }catch(error){
        diagnostic=error instanceof Error?error.message:String(error);
        const signature=triedTool?'tool-proposal':text.trim().replace(/\s+/g,' ');
        if(rejected.has(signature))throw Error(diagnostic+' The plan repeated the same unsuccessful proposal.');
        rejected.add(signature);
        await saveTask({stopReason:diagnostic});
        options.onWorkspace?.({operationId:`chapter:${task!.id}`,kind:'writing',status:'running',title:'Revising chapter plan',detail:diagnostic});
      }
    }
  }
  try{
    if(!task.data.scenes.length){
      // The user's accepted outline is already a plan. Re-planning it spends
      // context and can lose approved events before any prose is written.
      if(brief.approvedPlan&&!target&&!prose.trim()){
        const title=/\bchapter\s+\d+/i.exec(goal)?.[0]??'Chapter';
        const scenes:Scene[]=brief.approvedPlan.beats.map(beat=>({title:beat.title,purpose:beat.purpose,stateAfter:`Fulfil the approved beat: ${beat.title}`,beatId:beat.id,status:'pending'}));
        document=await repo.save({...document,title},markdownContent(''),{...documentLinks,metadata:{...document.data.metadata,writingTaskId:task.id}});
        await saveTask({scenes,facts:[],currentRevisionId:document.data.currentRevisionId,state:'writing'});
      }else{
      const count=target?Math.min(60,Math.max(developedScenes?1:2,Math.ceil((target.unit==='words'?target.minimum*6:target.minimum)/(developedScenes?9000:3500)))):brief.approvedPlan!.beats.length;
      options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:'running',title:'Planning chapter scenes',detail:target?`Target: ${target.minimum.toLocaleString()} ${target.unit}. Saving a plan before drafting.`:'Saving the approved chapter beats before drafting.'});
      const approved=brief.approvedPlan;
      const {plan,text:planText}=await planOperation('Chapter plan: '+document.title,`Create a compact JSON scene plan for the user's requested long chapter. About ${count} distinct scenes should develop one coherent chapter. Every scene must change the situation; no recap/padding. ${developedScenes?developedPlan:''} ${prose?`The document already contains ${characterCount(prose)} characters. Continue from it rather than starting over. Existing beginning: ${prose.slice(0,700)}. Existing final passage: ${prose.slice(-1800)}. A covered array may identify approved beat IDs ALREADY performed in this saved prose, with an exact short quote and endState. Do not claim a beat is covered by a plan or by new prose.`:''} ${approved?`The user approved these beats, in order: ${JSON.stringify(approved.beats)}. Cover ALL of them. Give every scene a beatId copied exactly from that outline. A beat may span several scenes; do not repeat its arrival or resolve later beats early.`:''} Preserve user facts, POV and continuity. Return JSON only: {"title":"...","covered":[{"beatId":"already performed ID only","quote":"exact saved prose passage","endState":"actual outcome"}],"facts":["facts/constraints from the user or supplied story"],"scenes":[{"title":"...","purpose":"specific action and emotional development","stateAfter":"concrete changed situation","beatId":"approved ID when supplied"${developmentShape}}]}. This operation plans the document; it does not write the chapter.`,prose&&!developedScenes?1:count);
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
      document=await repo.save({...document,title:prose.trim()?document.title:plan.title},markdownContent(prose),{...documentLinks,metadata:{...document.data.metadata,targetCharacters:target?.unit==='characters'?target.minimum:undefined,targetWordCount:target?.unit==='words'?target.minimum:undefined,writingTaskId:task.id}});
      await saveTask({scenes:plan.scenes,nextScene:plan.scenes.filter(s=>s.status==='accepted').length,facts:plan.facts,
        currentRevisionId:document.data.currentRevisionId,state:'writing',researchSourceIds,stopReason:undefined,
        sceneLength:developedScenes&&target?Math.ceil(target.minimum/plan.scenes.length):undefined});
      }
    }
    options.onAnswer(opening()+displayed());opened=true;
    // The user can explicitly resume after Stop. Recover actual partial prose
    // separately; do not inject or reconstruct the stopped model's reasoning.
    const recovery=resume?await repo.draft(document.id):null;
    const recoveryBase=displayed();
    rejectedDraft=recovery&&recovery.baseRevisionId===document.data.currentRevisionId&&recovery.markdown.startsWith(recoveryBase)
      ? recovery.markdown.slice(recoveryBase.length).replace(/^\s*\*\*\*\s*\r?\n/,'').trim():'';
    if(rejectedDraft)await archiveResponse('Recovered unfinished scene: '+document.title,rejectedDraft);
    while(task.data.nextScene<task.data.scenes.length||target&&!checkChapterLength(prose,target).complete){
      if(options.signal.aborted)throw new DOMException('Stopped','AbortError');
      const next=task.data.nextScene;
      const closing=next===task.data.scenes.length-1?task.data.scenes[next]:undefined;
      const priorSizes=task.data.scenes.slice(0,next).map(scene=>target?.unit==='words'?(scene.words??0):(scene.characters??0)).filter(size=>size>0).sort((a,b)=>a-b);
      const typical=priorSizes[Math.floor(priorSizes.length/2)]??task.data.sceneLength??(target?.unit==='words'?550:3500);
      const missing=target?checkChapterLength(prose,target).missing:0;
      if(target&&!sceneDraft&&(next===task.data.scenes.length||closing&&(closing.needsDevelopment||missing>typical*1.3))){
        const count=Math.max(2,Math.min(8,Math.ceil((missing-typical)/typical)));
        const {plan}=await planOperation('Chapter development plan: '+document.title,`The saved chapter needs about ${missing} more ${target.unit}. Plan about ${count} distinct advancing scenes. ${closing?`Place them BEFORE the reserved conclusion "${closing.title}". Build toward its purpose: ${closing.purpose}. Do not resolve it in these scenes.`:'Continue from the saved ending with a naturally connected final movement.'} ${developedScenes?developedPlan:''} Preserve POV, facts and established outcomes. Return JSON only {"title":"Chapter development","facts":[],"scenes":[{"title":"...","purpose":"new specific action","stateAfter":"concrete changed situation"${developmentShape}}]}. Existing outcomes: ${task.data.scenes.slice(0,next).map(s=>s.proof?.endState??s.stateAfter).join('; ').slice(-2000)}. Exact chapter tail: ${prose.slice(-1400)}.`,count);
        const known=new Set(task.data.scenes.map(scene=>scene.stateAfter.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()));
        for(const scene of plan.scenes){
          const outcome=scene.stateAfter.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
          if(!outcome||known.has(outcome))throw Error('The development plan repeated an existing outcome. Saved scenes remain available.');
          known.add(outcome);
        }
        await saveTask({scenes:[...task.data.scenes.slice(0,next),...plan.scenes,...(closing?[{...closing,needsDevelopment:false}]:[])]});
      }
      const index=task.data.nextScene;const scene=task.data.scenes[index]!;const remaining=target?checkChapterLength(prose,target).missing:0;const scenesLeft=task.data.scenes.length-index;
      const developmentIndex=scene.developments?.findIndex(item=>!item.proof)??0;
      const development=scene.developments?.[developmentIndex];
      const finalDevelopment=!development||developmentIndex===scene.developments!.length-1;
      if(scene.developments&&(developmentIndex<0||(developmentIndex>0)!==Boolean(sceneDraft))) {
        throw Error('The pending scene checkpoint is inconsistent. The saved chapter revision remains available.');
      }
      const proofId=development&&!(finalDevelopment&&scene.beatId)
        ?`${scene.beatId??'scene-'+(index+1)}/development-${developmentIndex+1}`:scene.beatId;
      const isClosing=index===task.data.scenes.length-1;
      const desired=target?Math.max(target.unit==='characters'?2500:400,Math.ceil(remaining/scenesLeft)):3500;
      const baseSceneSize=task.data.sceneLength??desired;
      const sceneFloor=target&&development&&finalDevelopment?Math.max(Math.ceil(baseSceneSize*.8),isClosing?remaining:0):0;
      const stagedSize=target&&sceneDraft?checkChapterLength(sceneDraft,target).actual:0;
      const developTarget=Math.ceil((Math.max(desired,baseSceneSize,sceneFloor)-stagedSize)/(finalDevelopment?1:2));
      const requestedSize=development?developTarget:desired;
      const wordsForSize=Math.ceil(target?.unit==='words'?requestedSize:requestedSize/6);
      const sceneWords=Math.max(350,development?wordsForSize:Math.min(650,wordsForSize));
      const visibleBefore=displayed();
      const separator=sceneDraft?'\n\n':prose.trim()?sceneBreak:'';
      partial='';
      options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:'running',title:`Writing ${document.title}`,
        detail:`Scene ${index+1} of ${task.data.scenes.length}${development?' · Development '+(developmentIndex+1)+' of '+scene.developments!.length:''} · ${characterCount(prose).toLocaleString()} chapter characters saved`});
      const prior=task.data.scenes.slice(Math.max(0,index-2),index).map(s=>`${s.title}: ${s.proof?.endState??s.stateAfter}`).join('\n');
      const later=task.data.scenes.slice(index+1).map(s=>s.title).join('; ').slice(0,400);
      const appendProse=(delta:string)=>{
        if(!delta)return;
        if(!partial&&separator)options.onAnswer(separator);partial+=delta;options.onAnswer(delta);
        if(performance.now()-lastCheckpoint>1500){lastCheckpoint=performance.now();const snapshot=visibleBefore+separator+partial;checkpoint=checkpoint.then(()=>repo.checkpoint(document,snapshot,'generating'));}
      };
      let firstLine='';
      let atOpening=true;
      const visibleScene=(delta:string)=>{
        if(!atOpening){appendProse(delta);return;}
        firstLine+=delta;
        const lead=firstLine.trimStart();
        const word=lead.match(/^\p{L}+/u)?.[0]?.toLowerCase();
        const couldBeHeading=!lead||/^[#*_]/.test(lead)||Boolean(word&&['scene','part'].some(label=>label.startsWith(word)));
        if(!firstLine.includes('\n')&&firstLine.length<180&&couldBeHeading)return;
        atOpening=false;appendProse(withoutSceneHeadings(firstLine));firstLine='';
      };
      const memoryStream=document.storyId?new StoryMemoryStream(visibleScene):null;
      const proofStream=proofId?new MetadataStream<SceneProof>('solarium-scene',delta=>{if(memoryStream)memoryStream.push(delta);else visibleScene(delta);}):null;
      const operation=development
        ? `Write development ${developmentIndex+1} of ${scene.developments!.length} as continuous prose in this same scene. Aim for about ${sceneWords} words. Perform its action and show the consequence before ending the operation. ${finalDevelopment?'Resolve the scene’s action here.':'Leave the next development pending within this same scene: '+scene.developments![developmentIndex+1]!.purpose}`
        : `Write one advancing scene of about ${sceneWords} words.`;
      const result=await infer(`DOCUMENT SCENE OPERATION ${index+1}/${task.data.scenes.length}. The target is cumulative across the chapter. ${operation}
Finish naturally in the requested POV and tense. Use prose without scene headings, separator lines, fences, recap, progress reports or filler. Solarium inserts the scene spacer after a completed scene.
Current scene: ${scene.title}. Action: ${development?.purpose??scene.purpose}. Reach this end state in actual prose: ${development?.stateAfter??scene.stateAfter}.
${isClosing&&finalDevelopment?'Conclude the chapter with a satisfying ending.':'Leave these later scenes pending: '+later}.
${sceneFloor&&target?`This scene needs at least ${sceneFloor.toLocaleString()} ${target.unit} of developed prose in total. ${stagedSize.toLocaleString()} are already saved in this scene. Use action, dialogue and its consequences to develop this part.`:''}
${scene.diagnostic?'Repair this draft before advancing: '+scene.diagnostic:''}
Continuity constraints: ${task.data.facts.join('; ').slice(0,1800)}
Accepted preceding outcomes: ${prior}${developmentIndex>0?'\nIn this scene: '+scene.developments?.[developmentIndex-1]?.proof?.endState:''}
Exact saved ending of the preceding prose (continue after it):
${visibleBefore.slice(-1500)}
${rejectedDraft?`Unaccepted draft excerpt for this operation. Use any sound details in a complete replacement, without restarting the earlier accepted prose:\n${rejectedDraft.slice(-1600)}\n`:''}
${proofId?`After prose append <solarium-scene>{"beatId":${JSON.stringify(proofId)},"quote":"exact short passage near the end where the planned action already happened","endState":"what actually changed"}</solarium-scene>. Plans or intentions are insufficient.`:''}
${memoryStream?sceneMemoryInstruction:''}`,delta=>{if(proofStream)proofStream.push(delta);else if(memoryStream)memoryStream.push(delta);else visibleScene(delta);}).catch(error=>{
        if(firstLine)appendProse(withoutSceneHeadings(firstLine));
        throw error;
      });
      await archiveResponse(`Scene ${index+1}${development?' / development '+(developmentIndex+1):''}: ${scene.title}`,result.answer);
      let proof:SceneProof|null=null;let proofError='';
      if(proofStream)try{proof=proofStream.finish();}catch(error){proofError=String(error);}
      let memories:StoryMemoryInput[]=[];
      if(memoryStream)try{memories=memoryStream.finish();}catch(error){options.onWarning?.(`Scene memory unavailable: ${String(error)}`);}
      if(firstLine)appendProse(withoutSceneHeadings(firstLine));
      const formatted=withoutSceneHeadings(partial);
      if(formatted!==partial){
        partial=formatted;
        options.onAnswerReplace?.(opening()+visibleBefore+separator+partial);
      }
      await checkpoint;await repo.checkpoint(document,visibleBefore+separator+partial,'draft');
      if(result.result.finishReason!=='stop')throw Error(result.warning??`Scene stopped: ${result.result.finishReason}. Partial prose was preserved.`);
      if(!partial.trim())throw Error('The scene response contained no prose; the saved chapter remains available.');
      const fullScene=sceneDraft+(sceneDraft?'\n\n':'')+partial;
      const issues=sceneIssues(partial.trim(),visibleBefore,proofId,proof,Boolean(development));if(proofError)issues.push(proofError);
      if(target&&sceneFloor){
        const length=checkChapterLength(fullScene,{unit:target.unit,minimum:sceneFloor});
        if(!length.complete)issues.push(`This scene has ${length.actual} ${target.unit} and needs ${length.missing} more. Develop the current action fully before ending it.`);
      }
      if(!development&&!issues.length&&isClosing&&target&&!checkChapterLength(visibleBefore+separator+partial,target).complete){
        if(!options.onAnswerReplace)throw Error('The proposed ending is short of the target. The saved chapter can be resumed.');
        await saveTask({scenes:task.data.scenes.map((item,i)=>i===index?{...item,needsDevelopment:true}:item)});
        partial='';options.onAnswerReplace(opening()+displayed());
        continue;
      }
      if(issues.length){
        let hash=2166136261;for(const char of partial.replace(/\s+/g,' ').trim())hash=Math.imul(hash^char.charCodeAt(0),16777619);const signature=(hash>>>0).toString(16);const unchanged=scene.rejected?.includes(signature);
        const scenes=task.data.scenes.map((s,i)=>i===index?{...s,diagnostic:issues.join(' '),rejected:[...(s.rejected??[]),signature]}:s);
        await saveTask({scenes,stopReason:issues.join(' ')});
        if(unchanged||!options.onAnswerReplace)throw Error(issues.join(' ')+' The unchanged proposal was not accepted; recovery is saved.');
        rejectedDraft=partial;partial='';options.onAnswerReplace(opening()+displayed());
        continue;
      }
      const developments=development&&proof ? scene.developments!.map((item,i)=>i===developmentIndex?{...item,proof,memories}:item) : scene.developments;
      const updatedScene={...scene,developments,diagnostic:undefined,rejected:undefined};
      if(development&&!finalDevelopment){
        await saveTask({scenes:task.data.scenes.map((item,i)=>i===index?updatedScene:item),stopReason:undefined},fullScene);
        sceneDraft=fullScene;partial='';rejectedDraft='';
        continue;
      }
      const accepted=visibleBefore+separator+partial;
      const scenes=task.data.scenes.map((s,i)=>i===index?{...updatedScene,status:'accepted' as const,
        characters:characterCount(fullScene.trim()),words:wordCount(fullScene),...(proof?{proof}:{})}:s);
      let committedTask:StoredRecord<ChapterTask>|undefined;
      document=await repo.save(document,markdownContent(accepted),{status:isClosing?'final':'draft'},false,revision=>{
        committedTask=nextTask({scenes,nextScene:index+1,currentRevisionId:revision.data.currentRevisionId,stopReason:result.result.finishReason},accepted);
        return {record:committedTask,expected:task!.version,body:''};
      });
      task=committedTask!;prose=accepted;sceneDraft='';partial='';rejectedDraft='';progress();
      const sceneMemories=developments?.flatMap(item=>item.memories??[])??memories;
      if(sceneMemories.length&&options.preferences.toolPermissions.remember_story_event!=='deny')try{await rememberStoryEvents(stories,repo,document,sceneMemories);}catch(error){options.onWarning?.(`Scene saved, but memory was rejected: ${String(error)}`);}
    }
    const length=target?checkChapterLength(prose,target):{complete:task.data.scenes.every(s=>s.status==='accepted'),actual:characterCount(prose),missing:0};
    await saveTask({state:length.complete?'completed':'incomplete'});
    if(!length.complete&&target)options.onWarning?.(`Chapter saved with ${length.actual.toLocaleString()} of ${target.minimum.toLocaleString()} requested ${target.unit}. The model underwrote its planned scenes; the task remains incomplete. Use Resume chapter to develop it further.`);
    options.onAnswer('\n```');
    options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:length.complete?'completed':'failed',title:document.title,detail:`${characterCount(prose).toLocaleString()} characters · ${wordCount(prose).toLocaleString()} words saved. ${length.complete?(target?'Planned scenes saved and length target reached.':'All approved chapter beats drafted with saved supporting passages.'):'The chapter remains incomplete.'}`});
    return '```solarium-writing title="'+document.title.replace(/["\n\r]/g,'')+'"\n'+prose+'\n```';
  }catch(error){
    try{const recoveryText=partial||rejectedDraft;await checkpoint;await repo.checkpoint(document,displayed()+(recoveryText?(sceneDraft?'\n\n':prose.trim()?sceneBreak:'')+recoveryText:''),options.signal.aborted?'cancelled':'draft');await saveTask({state:options.signal.aborted?'cancelled':'incomplete',stopReason:String(error)});}catch(saveError){options.onWarning?.(`Recovery could not be saved: ${String(saveError)}`);}
    if(opened)options.onAnswer('\n```'); // closes the display artifact; task state remains incomplete
    options.onWarning?.(`Chapter incomplete: ${String(error)}. Accepted scenes and available recovery text remain saved.`);
    throw error;
  }
}
