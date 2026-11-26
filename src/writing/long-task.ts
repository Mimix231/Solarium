import { formatSpeakerDialogue, readableProse, sceneBreak, withoutSceneHeadings } from './prose';
import { fictionCraftGuide, speakerDialogueGuide } from './fiction';
import { deriveBrief, briefContext, authoringBrief, mentionedCast, type ConversationBrief } from '../engine/intelligence/brief';
import { MetadataStream } from '../foundation/metadata-stream';
import { ContextArchive } from '../foundation/archive';
import { applySceneCorrections, readSceneAssessment, removeEchoedSceneOpening, repeatedSceneCorrections, repeatedSceneMessage, sceneAssessmentPrompt, sceneCorrectionPrompt, sceneIssues,
  scenePassages, sentenceCheckpoint, type SceneAssessment, type SceneNote, type SceneProof } from './acceptance';
import { lengthTarget, type LengthTarget } from './length';
export { lengthTarget, type LengthTarget } from './length';
import { uid, now } from '../domain/types';
import type { AgentOptions } from '../engine/agent';
import type { InferenceAdapter } from '../engine/backends';
import type { Capabilities } from '../domain/types';
import { streamContinuousAnswer } from '../engine/continuous-generation';
import { composeSparkInstructionParts } from '../domain/persona';
import { foundationStore, newRecord } from '../foundation/store';
import type { StoredRecord, SourceScope, RecordStore } from '../foundation/types';
import { WritingRepository, wordCount } from './repository';
import { markdownContent } from './schema';
import type { WritingDocument } from './types';
import { profileClaimsAt, resolveStoryCharacter, StoryRepository, storyCanonPoint } from '../stories/repository';
import { canonPointLabel, pointIsAvailable, pointMatches, type CanonPoint } from '../stories/canon';
import { effectiveContextSize } from '../engine/context-window';
import { SourceRepository } from '../sources/repository';
import { relevantPagePassage } from '../research/conversation';
import { FictionRepository, hasProfileDetail, type FictionDestination, type FictionSelection, type ProfileText } from '../stories/fiction';
import { StoryMemoryStream, rememberStoryEvents, sceneMemoryInstruction, type StoryMemoryInput } from '../stories/memory';
import { englishDraftPreview, englishFiction, englishFictionEvidence, hasUntranslatedScript } from '../stories/language';
import { activeCastFacts, castContinuityCorrections } from './cast-continuity';
export interface WritingInterlude {
  stage: 'saving' | 'recalling' | 'planning' | 'ready' | 'repairing';
  cause: 'capacity' | 'unfinished' | 'correction';
  title: string;
  characterNames: string[];
  savedCharacters: number;
  facts?: string[];
  nextBeat?: string;
  operation?: 'plan' | 'review';
}
export interface WritingProgress {taskId:string;documentId:string;characters:number;words:number;target:LengthTarget|null;scene:number;scenes:number;state:'planning'|'writing'|'incomplete'|'completed'|'cancelled';interlude?:WritingInterlude}
interface Development { purpose: string; stateAfter: string; proof?: SceneProof; memories?: StoryMemoryInput[] }
interface Scene {title:string;purpose:string;stateAfter:string;status:'pending'|'accepted';characters?:number;words?:number;beatId?:string;proof?:SceneProof;diagnostic?:string;rejected?:string[];needsDevelopment?:boolean;developments?:Development[]}
interface PendingScene { index:number; cause:'capacity'|'unfinished'; nextBeat:string; notes:SceneNote[]; fragment?:string; reachedOutcome?:SceneProof }
interface ChapterTask {sessionId:string;documentId:string;originalGoal:string;target:LengthTarget|null;state:WritingProgress['state'];scenes:Scene[];facts:string[];nextScene:number;currentRevisionId:string;planMessageId?:string;requestMessageId?:string;stopReason?:string;characters:number;words:number;updatedAt:string;fiction?:FictionSelection|null;referenceContext?:string;researchSourceIds?:string[];developedScenes?:boolean;sceneLength?:number;fanfictionChapter?:boolean;dialogueFormat?:string;canonPoint?:CanonPoint;fictionDestination?:FictionDestination;pendingScene?:PendingScene}
const developedPlan = 'Each scene contains exactly two connected developments. The first changes the situation in a concrete way. The second performs the remaining action and reaches the scene outcome. Write the goal and observable result for each. Avoid scenes whose only outcome is noticing something or deciding to act later.';
class ChapterCapacityPause extends Error {}
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
export async function unfinishedWriting(repo:WritingRepository,sessionId:string,documentId?:string, title?:string):Promise<StoredRecord<ChapterTask>|null>{
  const matchingIds = title && !documentId ? new Set((await repo.list()).filter(doc => doc.title === title).map(doc => doc.id)) : null;
  const latest = (await repo.store.list<ChapterTask>({collection:'writing_task',scopes:repo.scopes()}))
    .filter(t => t.data.sessionId === sessionId && (!documentId || t.data.documentId === documentId) && (!matchingIds || matchingIds.has(t.data.documentId)))
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  return latest && latest.data.state !== 'completed' ? latest : null;
}
/** Finished scene operations, each using one uncapped native response and the
 * same loaded model. Never interrupts/replays an active reasoning channel. */
export async function runLongWriting(options:AgentOptions,adapter:InferenceAdapter,capabilities:Capabilities,referenceContext:string,resume?:StoredRecord<ChapterTask>|null,store:RecordStore=foundationStore,retained?:ConversationBrief):Promise<string>{
  const repo=new WritingRepository({sessionId:options.session.id,projectId:options.session.projectId??null},store);
  const scope:SourceScope=options.session.projectId?{kind:'project',id:options.session.projectId}:{kind:'chat',id:options.session.id};
  const goal=resume?.data.originalGoal??options.session.messages.filter(m=>m.role==='user').at(-1)?.content??'';
  const storyId=resume ? resume.storyId??null : options.session.storyId??null;
  const fiction=resume ? resume.data.fiction : options.session.fiction;
  const fictionDestination=resume?resume.data.fictionDestination:options.fictionDestination;
  const castStoryId=fictionDestination?.storyId??storyId;
  const castSelection=fictionDestination&&(fictionDestination.storyId!==storyId||fictionDestination.categoryId!==fiction?.categoryId)
    ? {categoryId:fictionDestination.categoryId,characterIds:[]} : fiction;
  let references=resume?.data.referenceContext ?? referenceContext;
  const brief=retained??deriveBrief(options.session);
  const target=resume ? resume.data.target : brief.target??lengthTarget(goal);
  const fanfiction = resume ? resume.data.fanfictionChapter === true : options.fanfictionChapter === true;
  const singleScene=fanfiction&&/\b(?:one|a single)\s+(?:continuous\s+)?scene\b/i.test(goal);
  const englishProse=fanfiction&&englishFiction(goal);
  const dialogueFormat = resume?.data.dialogueFormat ?? brief.dialogueFormat;
  const speakerLayout = Boolean(dialogueFormat);
  const developedScenes=resume ? resume.data.developedScenes === true : !fanfiction && Boolean(target&&(storyId||/\b(?:chapter|scene|story|fanfic\w*|novel|screenplay)\b/i.test(goal)));
  const developmentShape=developedScenes?', "developments":[{"purpose":"first action","stateAfter":"first result"},{"purpose":"remaining action","stateAfter":"scene outcome"}]':'';
  if(!target&&!brief.approvedPlan)throw Error('A planned chapter needs an explicit length target or an approved outline.');
  if(target&&(target.unit==='words'?target.minimum*6:target.minimum)>1_500_000)throw Error('This target exceeds the current document storage capacity. Split the work into chapters.');
  const persona=composeSparkInstructionParts(options.spark,options.session.mode,options.memories,options.worlds??[],goal);
  const stories=new StoryRepository(repo.context,store);
  const sourceStory=castStoryId?await stories.world(castStoryId):null;
  const authorChoices=[goal,sourceStory?.data.divergenceNote,sourceStory?.data.storyBrief].filter(Boolean).join('\n');
  const canonPoint = resume?.data.canonPoint ?? options.canonPoint ?? (storyId ? storyCanonPoint(await stories.world(storyId)) : undefined);
  const sources=new SourceRepository(repo.context,store);
  const researchSourceIds=[...(resume?.data.researchSourceIds??options.researchSourceIds??[])];
  if(resume&&references){
    const refreshed: string[] = [];
    for(const source of await sources.list()){
      const origin=source.data.origin;
      if(origin.kind!=='web'||origin.readState!=='read'||!source.data.enabled)continue;
      if(!researchSourceIds.includes(source.id)&&references.includes(' · '+origin.url+' · '))researchSourceIds.push(source.id);
      if(researchSourceIds.includes(source.id)) {
        options.onSource?.({title:source.title,url:origin.url,readState:'read'});
        if(fanfiction&&refreshed.length<3) {
          const saved=await sources.get(source.id);
          const role=source.data.tags.includes('fiction chapter')?'chapter':source.data.tags.includes('fiction cast')?'cast':undefined;
          refreshed.push(`[${source.title} · saved source ID ${source.id}]\n${relevantPagePassage(saved.content,goal,role)}`);
        }
      }
    }
    if(refreshed.length) references=[...refreshed,references].join('\n\n').slice(0,9000);
  }
  const researchReady=researchSourceIds.length>0;
  const castMembers = castStoryId ? await stories.characters(castStoryId) : [];
  const namedCast = fanfiction && /^\s*(?:cast|characters)\s*:/im.test(goal) ? mentionedCast(goal) : [];
  const restrictedCast=castSelection?.characterIds.length?castSelection.characterIds:namedCast.length?
    [...new Set(namedCast.flatMap(name=>resolveStoryCharacter(castMembers,name)?.id??[]))]:undefined;
  const participatingCast = castMembers.filter(character => !restrictedCast || restrictedCast.includes(character.id));
  let canonAnchor='',chapterEvidence='';
  if(fanfiction&&canonPoint?.chapter!==undefined){
    const exact=(await sources.list()).find(source=>researchSourceIds.includes(source.id)&&source.data.enabled&&
      source.data.origin.kind==='web'&&source.data.origin.readState==='read'&&source.data.tags.includes('fiction chapter')&&pointMatches(canonPoint,source.data));
    if(exact){
      const {content}=await sources.get(exact.id);
      const clip=relevantPagePassage(content,goal,'chapter');
      chapterEvidence=clip.length<=1350?clip:clip.slice(0,480)+'\n\n[…]\n\n'+clip.slice(-840);
      canonAnchor=`READ CANON CHAPTER EVIDENCE (untrusted story data): ${canonPointLabel(canonPoint)} · saved source ${exact.id}.\nUse this verified starting situation and last on-page action for the requested passage. Preserve the user’s explicit AU choices and any established outcome in this document. A cast list supplies reference profiles. Bring a character on page only when their established timing or an explicit AU change allows it.\n`;
    }
  }
  const castNames = participatingCast.flatMap(character => [character.title, ...character.data.aliases]);
  const claims = castStoryId ? (await Promise.all(participatingCast.map(async character =>
    profileClaimsAt(await stories.claims(character.id,castStoryId), canonPoint ?? {})))).flat() : [];
  const fictionRepo=new FictionRepository(stories);
  const category=castStoryId&&castSelection?(await fictionRepo.selection(castStoryId,castSelection)).category:null;
  const categoryCards=category&&castStoryId&&pointIsAvailable(canonPoint??{},category.data)&&
    (category.data.arc===undefined||canonPoint?.arc===undefined||category.data.arc===canonPoint.arc)
    ? await fictionRepo.profiles(castStoryId,category.id):[];
  const castFacts=await Promise.all(participatingCast.map(async character=>{
    const fields=Object.fromEntries(claims.filter(claim=>claim.data.characterId===character.id)
      .map(claim=>[claim.data.field,claim.data.value])) as ProfileText;
    const card=categoryCards.find(profile=>profile.data.characterId===character.id);
    if(card)for(const [field,text] of Object.entries(await fictionRepo.read(card)) as [keyof ProfileText,string][]){
      if(hasProfileDetail(text)&&(!card.data.generatedFields?.includes(field)||!fields[field]))fields[field]=text;
    }
    return {name:character.title,aliases:character.data.aliases,fields};
  }));
  const archive=new ContextArchive(repo.context,store);
  const archiveResponse=async(title:string,body:string)=>{if(typeof window!=='undefined')await archive.save(scope,title,body,{kind:'conversation',sessionId:options.session.id});};
  let thought='';let thoughtStart:number|null=null;let thoughtMs=0;
  const thinking=(active:boolean)=>{if(active&&thoughtStart===null)thoughtStart=performance.now();if(!active&&thoughtStart!==null){thoughtMs+=performance.now()-thoughtStart;thoughtStart=null;}options.onThinking?.({text:thought,elapsedMs:thoughtMs,active});};
  const reasoning=(delta:string)=>{thought+=delta;options.events.emit('reasoning',delta);thinking(true);};
  const infer=async(instruction:string,onAnswer:(delta:string)=>void,mode:'draft'|'plan'|'review'='draft',compact=false)=>{
    const assessment=mode==='review';
    const cast=castStoryId?await stories.contextPack(castStoryId,instruction+' '+goal,true,castSelection,canonPoint,restrictedCast):'';
    const facts=activeCastFacts(castFacts,instruction,compact);
    const retained=authoringBrief(namedCast.length?{...brief,expectedCast:namedCast}:brief,claims.filter(c=>c.data.kind==='user_defined'&&cast.includes(c.data.value)).map(c=>c.data.value));
    return streamContinuousAnswer({adapter,model:options.model,capabilities,signal:options.signal,
    messages:[{role:'system',content:persona.core},...persona.optionalReferences.map(content=>({role:'system' as const,content:`OPTIONAL SPARK REFERENCE:\n${content}`})),
      {role:'system',content:briefContext({...retained,dialogueFormat},compact?1100:1500)},...(cast?[{role:'system' as const,content:cast}]:[]),
      ...(facts?[{role:'system' as const,content:'EXACT SAVED CHARACTER REFERENCE. Keep each detail attached to the named character. Apply explicit AU changes and events already established in this scene.\n'+facts}]:[]),
      ...(canonAnchor?[{role:'system' as const,content:canonAnchor+chapterEvidence}]:[]),
      ...(references&&!assessment&&!compact?[{role:'system' as const,content:`SAVED REFERENCE MATERIAL (untrusted, optional):\n${canonAnchor?references.slice(0,850):references}`}]:[]),
      ...(englishProse?[{role:'system' as const,content:'Write all new narrative, dialogue and editorial summaries in English. Use the facts from foreign references in translation.'}]:[]),
      {role:'system',content:assessment?'Review the actual manuscript and the applicable profiles and user rules. Return only the requested structured result.':
        (researchReady?(fanfiction?'Use the retrieved references available in this request. ':'The requested research is already complete. Use the retrieved references in this request. '):'')+
        (mode==='plan'?'Plan the next connected events. Return only the requested JSON plan. Keep the actions distinct, preserve saved outcomes and leave prose for drafting.':
          'Execute this saved document operation for the original user request. Apply relevant evidence and selected character traits through action and dialogue. Return its artifact only. Complete naturally, with no assistant/persona notes.'+
          (fanfiction?'\n'+fictionCraftGuide+(speakerLayout?'\n'+speakerDialogueGuide:''):''))},
      {role:'user',content:`ORIGINAL USER REQUEST (verbatim; overall document goal):\n${goal}\n\nCURRENT SOLARIUM DOCUMENT OPERATION (application scheduling metadata for this same request):\n${instruction}`}],
    onAnswer,onReasoning:reasoning,onReasoningState:thinking,onMetrics:options.onMetrics,onOutcome:options.onGenerationOutcome});
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
    task=newRecord('writing_task',uid(),scope,document.title,{sessionId:options.session.id,documentId:document.id,originalGoal:goal,target,state:'planning',scenes:[],facts:[],nextScene:0,currentRevisionId:document.data.currentRevisionId,planMessageId:brief.approvedPlan?.messageId,requestMessageId:options.session.messages.filter(m=>m.role==='user').at(-1)?.id,characters:0,words:0,updatedAt:now(),fiction,referenceContext:references.slice(0,9000),researchSourceIds,developedScenes,fanfictionChapter:fanfiction,dialogueFormat,canonPoint,fictionDestination} satisfies ChapterTask,storyId);
    await repo.store.batch([{record:task,expected:null}]);
  }
  let interlude:WritingInterlude|undefined;
  const progress=()=>options.onWritingTask?.({taskId:task!.id,documentId:document.id,characters:characterCount(prose),words:wordCount(prose),target,scene:task!.data.nextScene+1,scenes:task!.data.scenes.length,state:task!.data.state,interlude});
  const nextTask=(patch:Partial<ChapterTask>,text=prose)=>({...task!,version:task!.version+1,updatedAt:now(),
    data:{...task!.data,...patch,characters:characterCount(text),words:wordCount(text),updatedAt:now()}});
  const saveTask=async(patch:Partial<ChapterTask>,body?:string)=>{
    const next=nextTask(patch);
    await repo.store.batch([{record:next,expected:task!.version,body}]);
    task=next;progress();
  };
  progress();let opened=false;let partial='';let checkpoint=Promise.resolve();let lastCheckpoint=0;
  let sceneDraft=developedScenes||task.data.pendingScene ? await store.body(task.id,[task.scope])??'' : '';
  let rejectedDraft='';
  const displayed=()=>prose+(sceneDraft?(prose.trim()?sceneBreak:'')+sceneDraft:'');
  const opening=()=>'```solarium-writing title="'+document.title.replace(/["\n\r]/g,'')+'"\n';
  const documentLinks = {
    sourceIds: [...new Set([...document.data.sourceIds, ...researchSourceIds])],
    characterIds: [...new Set([...document.data.characterIds, ...(castStoryId===storyId?participatingCast.map(character => character.id):[])])],
  };
  const updateInterlude=(stage:WritingInterlude['stage'],cause:WritingInterlude['cause'],savedCharacters:number,notes:SceneNote[]=[],nextBeat?:string,
    operation?:WritingInterlude['operation'])=>{
    interlude={stage,cause,title:task!.data.scenes[task!.data.nextScene]?.title??document.title,characterNames:participatingCast.map(c=>c.title),savedCharacters,
      facts:notes.map(note=>note.change),nextBeat,operation};
    progress();
  };
  const clearInterlude=()=>{if(interlude){interlude=undefined;progress();}};
  const reportModel=async(title:string,instruction:string,compactInstruction=instruction)=>{
    for (const compact of [false,true]) {
      const response=await infer(compact?compactInstruction:instruction,()=>{},'review',compact);
      const text=response.answer;
      await archiveResponse(title,text);
      if(options.signal.aborted)throw new DOMException('Stopped','AbortError');
      if(response.result.finishReason==='stop')return text;
      if(!fanfiction||response.result.finishReason!=='length')throw Error(response.warning??'The scene check could not finish. The draft was preserved.');
      if(compact)throw new ChapterCapacityPause('The scene check needs more model context. The draft is saved.');
      updateInterlude('planning','capacity',characterCount(displayed()+partial),[],undefined,'review');
    }
    throw Error('The scene check did not run.');
  };
  const assessScene=async(text:string,outcome:string,proofId:string,closing:boolean,context:string,quotes:readonly string[]=[]):Promise<SceneAssessment|null>=>{
    const budget=Math.min(8_000,Math.floor(effectiveContextSize(options.model,capabilities)*.95));
    const passages=scenePassages(text,budget,quotes);
    const shortPassages=scenePassages(text,Math.min(4200,Math.floor(budget*.6)),quotes);
    const assessment=readSceneAssessment(await reportModel('Scene assessment: '+document.title,sceneAssessmentPrompt(passages,outcome,closing,context),
      sceneAssessmentPrompt(shortPassages,outcome,closing,context.slice(-400))),
      [...passages,...shortPassages.filter(item=>!passages.some(passage=>passage.id===item.id))],proofId);
    if(assessment)return assessment;
    updateInterlude('planning','unfinished',characterCount(displayed()+partial),[],undefined,'review');
    const prompt=sceneAssessmentPrompt(shortPassages,outcome,closing,context.slice(-400))+
      '\nThe previous assessment did not identify a usable passage. Put the actual numbered passage ID in outcome, or null if the action has not happened. Put the explanation in stateAfter. Use the numbered excerpts for issue IDs as well.';
    return readSceneAssessment(await reportModel('Checking the exact scene passages: '+document.title,prompt),shortPassages,proofId);
  };
  async function planOperation(title:string,instruction:string,count:number){
    const rejected=new Set<string>();
    let diagnostic='';
    let compact=false;
    for(;;){
      let text='';
      const planned=await infer(instruction+(compact?'\nReturn the required JSON now. Use one short action and consequence per scene.':'')+
        (diagnostic?'\nRevise the rejected plan. '+diagnostic:''),delta=>{text+=delta;},'plan',compact);
      await archiveResponse(title,text);
      const capacity=fanfiction&&planned.result.finishReason==='length';
      if(!capacity&&planned.result.finishReason!=='stop')throw Error(planned.warning??'The plan response did not finish naturally.');
      const triedTool=/<\|tool_call>|<tool_call>/i.test(text);
      try{
        if(triedTool)throw Error('Return the scene-plan JSON directly using the saved references.');
        const plan=planFrom(text,count,developedScenes);
        if(singleScene&&plan.scenes.length!==1)throw Error('The request specifies one continuous scene. Return one scene with its action and outcome.');
        if(interlude?.operation==='plan')clearInterlude();
        return {plan,text};
      }catch(error){
        if(capacity){
          if(compact)throw new ChapterCapacityPause('Chapter planning needs more model context. The request and draft are saved.');
          compact=true;
          diagnostic='';
          await saveTask({stopReason:'Preparing a shorter chapter planning request.'});
          updateInterlude('planning','capacity',characterCount(displayed()),[],undefined,'plan');
          continue;
        }
        diagnostic=error instanceof Error?error.message:String(error);
        const signature=triedTool?'tool-proposal':text.trim().replace(/\s+/g,' ');
        if(rejected.has(signature))throw Error(diagnostic+' The plan repeated the same unsuccessful proposal.');
        if(fanfiction&&rejected.size>=2)throw Error(diagnostic+' The chapter plan is saved.');
        rejected.add(signature);
        await saveTask({stopReason:diagnostic});
        options.onWorkspace?.({operationId:`chapter:${task!.id}`,kind:'writing',status:'running',title:'Revising chapter plan',detail:diagnostic});
      }
    }
  }
  try{
    if(englishProse&&hasUntranslatedScript(chapterEvidence)){
      const operationId=`chapter:${task.id}:translation`;
      options.onWorkspace?.({operationId,kind:'writing',status:'running',title:'Translating chapter evidence',detail:canonPointLabel(canonPoint??{})});
      const translated=await englishFictionEvidence({adapter,model:options.model,capabilities,signal:options.signal,
        onReasoning:reasoning,onReasoningState:thinking,onMetrics:options.onMetrics,onOutcome:options.onGenerationOutcome},
        persona.core,goal,chapterEvidence,'Summarize the opening situation and the last event actually shown in no more than seven short sentences.');
      if(translated){
        await archiveResponse('English chapter evidence',translated);
        chapterEvidence=translated;
      }
      options.onWorkspace?.({operationId,kind:'writing',status:translated?'completed':'failed',title:'Translating chapter evidence',
        detail:translated?'English summary prepared from the saved chapter.':'The English summary did not finish. The original reference is still available.'});
    }
    if(resume&&task.data.scenes.length)await saveTask({state:'writing',stopReason:undefined,canonPoint});
    if(!task.data.scenes.length){
      // The user's accepted outline is already a plan. Re-planning it spends
      // context and can lose approved events before any prose is written.
      if(brief.approvedPlan&&!target&&!prose.trim()){
        const title=/\bchapter\s+\d+/i.exec(goal)?.[0]??'Chapter';
        const scenes:Scene[]=brief.approvedPlan.beats.map(beat=>({title:beat.title,purpose:beat.purpose,stateAfter:`Fulfil the approved beat: ${beat.title}`,beatId:beat.id,status:'pending'}));
        document=await repo.save({...document,title},markdownContent(''),{...documentLinks,metadata:{...document.data.metadata,writingTaskId:task.id,dialogueLayout:speakerLayout?'speaker':undefined,canonPoint}});
        await saveTask({scenes,facts:[],currentRevisionId:document.data.currentRevisionId,state:'writing'});
      }else{
      const count=singleScene?1:target?Math.min(60,Math.max(developedScenes||fanfiction?1:2,Math.ceil((target.unit==='words'?target.minimum*6:target.minimum)/(developedScenes?9000:fanfiction?8200:3500)))):brief.approvedPlan!.beats.length;
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
      document=await repo.save({...document,title:prose.trim()?document.title:plan.title},markdownContent(prose),{...documentLinks,metadata:{...document.data.metadata,targetCharacters:target?.unit==='characters'?target.minimum:undefined,targetWordCount:target?.unit==='words'?target.minimum:undefined,writingTaskId:task.id,dialogueLayout:speakerLayout?'speaker':fanfiction?'prose':undefined,canonPoint}});
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
    let reuseDraft = fanfiction && Boolean(rejectedDraft) && (resume?.data.state==='cancelled' ||
      /solarium-scene|outcome quote|scene check|revised passages|scene still needs review|exact passage corrections/i.test(resume?.data.stopReason??''));
    const compactScenes=new Set<number>();
    while(task.data.nextScene<task.data.scenes.length||target&&!checkChapterLength(prose,target).complete){
      if(options.signal.aborted)throw new DOMException('Stopped','AbortError');
      const next=task.data.nextScene;
      const closing=next===task.data.scenes.length-1?task.data.scenes[next]:undefined;
      const priorSizes=task.data.scenes.slice(0,next).map(scene=>target?.unit==='words'?(scene.words??0):(scene.characters??0)).filter(size=>size>0).sort((a,b)=>a-b);
      const typical=priorSizes[Math.floor(priorSizes.length/2)]??task.data.sceneLength??(target?.unit==='words'?550:3500);
      const missing=target?checkChapterLength(prose,target).missing:0;
      if(target&&!sceneDraft&&(next===task.data.scenes.length||!singleScene&&closing&&(closing.needsDevelopment||missing>typical*1.3))){
        const count=Math.max(2,Math.min(8,Math.ceil((missing-typical)/typical)));
        const {plan}=await planOperation('Chapter development plan: '+document.title,`The saved chapter needs about ${missing} more ${target.unit}. Plan about ${count} distinct advancing scenes. ${closing?`Place them BEFORE the reserved conclusion "${closing.title}". Build toward its purpose: ${closing.purpose}. Do not resolve it in these scenes.`:'Continue from the saved ending with a naturally connected final movement. Show new consequences, without repeating the ending.'} ${developedScenes?developedPlan:''} Preserve POV, facts and established outcomes. Return JSON only {"title":"Chapter development","facts":[],"scenes":[{"title":"...","purpose":"new specific action","stateAfter":"concrete changed situation"${developmentShape}}]}. Existing outcomes: ${task.data.scenes.slice(0,next).map(s=>s.proof?.endState??s.stateAfter).join('; ').slice(-2000)}. Exact chapter tail: ${prose.slice(-1400)}.`,count);
        const known=new Set(task.data.scenes.map(scene=>scene.stateAfter.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()));
        for(const scene of plan.scenes){
          const outcome=scene.stateAfter.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
          if(!outcome||known.has(outcome))throw Error('The development plan repeated an existing outcome. Saved scenes remain available.');
          known.add(outcome);
        }
        await saveTask({scenes:[...task.data.scenes.slice(0,next),...plan.scenes,...(closing?[{...closing,needsDevelopment:false}]:[])]});
      }
      const index=task.data.nextScene;const scene=task.data.scenes[index]!;const remaining=target?checkChapterLength(prose,target).missing:0;const scenesLeft=task.data.scenes.length-index;
      const pending=task.data.pendingScene;
      if(pending&&(pending.index!==index||!sceneDraft.trim()))throw Error('The saved continuation does not match the pending scene.');
      if(pending&&!interlude)updateInterlude('ready',pending.cause,characterCount(displayed()),pending.notes,pending.nextBeat);
      const developmentIndex=scene.developments?.findIndex(item=>!item.proof)??0;
      const development=scene.developments?.[developmentIndex];
      const finalDevelopment=!development||developmentIndex===scene.developments!.length-1;
      if(scene.developments&&(developmentIndex<0||(developmentIndex>0)!==Boolean(sceneDraft))) {
        throw Error('The pending scene checkpoint is inconsistent. The saved chapter revision remains available.');
      }
      const proofId=development&&!(finalDevelopment&&scene.beatId)
        ?`${scene.beatId??'scene-'+(index+1)}/development-${developmentIndex+1}`:scene.beatId??(fanfiction?`scene-${index+1}`:undefined);
      const isClosing=index===task.data.scenes.length-1;
      const desired=target?Math.max(target.unit==='characters'?2500:400,Math.ceil(remaining/scenesLeft)):3500;
      const baseSceneSize=task.data.sceneLength??desired;
      const sceneFloor=target&&development&&finalDevelopment?Math.max(Math.ceil(baseSceneSize*.8),isClosing?remaining:0):0;
      const stagedSize=target&&sceneDraft?checkChapterLength(sceneDraft,target).actual:0;
      const developTarget=Math.ceil((Math.max(desired,baseSceneSize,sceneFloor)-stagedSize)/(finalDevelopment?1:2));
      const requestedSize=development?developTarget:Math.max(target?.unit==='words'?300:1600,desired-(pending?stagedSize:0));
      const wordsForSize=Math.ceil(target?.unit==='words'?requestedSize:requestedSize/6);
      const sceneWords=Math.max(350,development||fanfiction?wordsForSize:Math.min(650,wordsForSize));
      let visibleBefore=displayed();
      const separator=sceneDraft?'\n\n':prose.trim()?sceneBreak:'';
      partial='';
      options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:'running',title:`Writing ${document.title}`,
        detail:`Scene ${index+1} of ${task.data.scenes.length}${development?' · Development '+(developmentIndex+1)+' of '+scene.developments!.length:''} · ${characterCount(prose).toLocaleString()} chapter characters saved`});
      const recentStart = Math.max(0, index - 3);
      const prior=task.data.scenes.slice(fanfiction?recentStart:Math.max(0,index-2),index).map(s=>`${s.title}: ${s.proof?.endState??s.stateAfter}`).join('\n');
      const earlier = fanfiction ? task.data.scenes.slice(0, recentStart).filter(s=>s.status==='accepted')
        .map(s=>`${s.title}: ${(s.proof?.endState??s.stateAfter).slice(0,130)}`).join(' · ').slice(0,700) : '';
      const later=task.data.scenes.slice(index+1).map(s=>s.title).join('; ').slice(0,400);
      const appendProse=(delta:string)=>{
        if(!delta)return;
        clearInterlude();
        if(!partial&&separator)options.onAnswer(separator);partial+=delta;options.onAnswer(englishProse?englishDraftPreview(delta):delta);
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
      const memoryStream=document.storyId&&castStoryId===storyId?new StoryMemoryStream(visibleScene):null;
      const proofStream=proofId?new MetadataStream<SceneProof>('solarium-scene',delta=>{if(memoryStream)memoryStream.push(delta);else visibleScene(delta);}):null;
      const targetMet=Boolean(target&&checkChapterLength(visibleBefore,target).complete);
      const operation=pending
        ? `Continue within this same scene immediately after the exact saved ending. Start from the next action: ${pending.nextBeat}. Keep the current time, place and viewpoint. Carry forward the existing choices and results. Do not undo an established outcome or restart the same conflict. ${targetMet?'Finish the unresolved action and its immediate consequence, then stop the scene.':`Aim for about ${sceneWords} further words if the action needs them.`} Restart only the interrupted clause if present: ${pending.fragment??''}`
        : development
        ? `Write development ${developmentIndex+1} of ${scene.developments!.length} as continuous prose in this same scene. Aim for about ${sceneWords} words. Perform its action and show the consequence before ending the operation. ${finalDevelopment?'Resolve the scene’s action here.':'Leave the next development pending within this same scene: '+scene.developments![developmentIndex+1]!.purpose}`
        : `Write one advancing scene of about ${sceneWords} words${fanfiction&&target?.unit==='characters'?` (${requestedSize.toLocaleString()} characters)`:''}.`;
      const outcome=pending?.reachedOutcome?'Show the new consequence of this established result: '+pending.reachedOutcome.endState:
        development?.stateAfter??scene.stateAfter;
      const fromRecovery=reuseDraft;
      reuseDraft=false;
      if(fromRecovery)appendProse(rejectedDraft);
      const result=fromRecovery?null:await infer(`DOCUMENT SCENE OPERATION ${index+1}/${task.data.scenes.length}. The target is cumulative across the chapter. ${operation}
Finish naturally in the requested POV and tense. Use prose without scene headings, separator lines, fences, recap, progress reports or filler. Solarium inserts the scene spacer after a completed scene.
Current scene: ${scene.title}. Action: ${development?.purpose??scene.purpose}. Reach this end state in actual prose: ${outcome}.
Start with a new on-page action. The saved ending is context only. Do not reproduce any of its paragraphs.
${isClosing&&finalDevelopment?'Conclude the chapter with a satisfying ending.':'Leave these later scenes pending: '+later}.
${sceneFloor&&target?`This scene needs at least ${sceneFloor.toLocaleString()} ${target.unit} of developed prose in total. ${stagedSize.toLocaleString()} are already saved in this scene. Use action, dialogue and its consequences to develop this part.`:''}
${scene.diagnostic?'Repair this draft before advancing: '+scene.diagnostic:''}
Continuity constraints: ${task.data.facts.join('; ').slice(0,1800)}
Accepted preceding outcomes: ${prior}${developmentIndex>0?'\nIn this scene: '+scene.developments?.[developmentIndex-1]?.proof?.endState:''}
${earlier?'Earlier consequences in this chapter: '+earlier:''}
${pending?.notes.length?'Occurred in this scene: '+pending.notes.map(note=>note.change+' [passage: '+note.quote+']'+(note.knowledge?.length?' [knowledge: '+note.knowledge.map(entry=>entry.character+'='+entry.state).join(', ')+']':'')).join(' · '):''}
Exact saved ending of the preceding prose (continue after it):
${visibleBefore.slice(-1500)}
${rejectedDraft?`Unaccepted draft excerpt for this operation. Use any sound details in a complete replacement, without restarting the earlier accepted prose:\n${rejectedDraft.slice(-1600)}\n`:''}
${proofId?`After prose append <solarium-scene>{"beatId":${JSON.stringify(proofId)},"quote":"exact short passage near the end where the planned action already happened","endState":"what actually changed"}</solarium-scene>. Plans or intentions are insufficient.`:''}
${memoryStream?sceneMemoryInstruction:''}`,delta=>{if(proofStream)proofStream.push(delta);else if(memoryStream)memoryStream.push(delta);else visibleScene(delta);},
        'draft',compactScenes.has(index)).catch(error=>{
        if(firstLine)appendProse(withoutSceneHeadings(firstLine));
        throw error;
      });
      if(result)await archiveResponse(`Scene ${index+1}${development?' / development '+(developmentIndex+1):''}: ${scene.title}`,result.answer);
      const finishReason=result?.result.finishReason??'stop';
      const capacityStop=fanfiction&&finishReason==='length';
      let proof:SceneProof|null=null;let proofError='';
      if(proofStream)try{proof=proofStream.finish(capacityStop);}catch(error){proofError=String(error);}
      let memories:StoryMemoryInput[]=[];
      if(memoryStream)try{memories=memoryStream.finish(capacityStop);}catch(error){options.onWarning?.(`Scene memory unavailable: ${String(error)}`);}
      if(firstLine)appendProse(withoutSceneHeadings(firstLine));
      if(capacityStop&&!partial.trim()){
        if(compactScenes.has(index))throw new ChapterCapacityPause('The current scene needs more model context. The chapter is saved.');
        compactScenes.add(index);
        await saveTask({stopReason:'Preparing a shorter request for the current scene.'});
        updateInterlude('planning','capacity',characterCount(visibleBefore),[],pending?.nextBeat??scene.purpose);
        continue;
      }
      const atCapacity=capacityStop&&Boolean(partial.trim());
      if(atCapacity)updateInterlude('saving','capacity',characterCount(visibleBefore));
      const showCandidate=async(candidate:string)=>{
        partial=candidate;
        options.onAnswerReplace?.(opening()+visibleBefore+separator+(englishProse?englishDraftPreview(partial):partial));
        await checkpoint;await repo.checkpoint(document,visibleBefore+separator+partial,'draft');
      };
      const formatCandidate=(candidate:string)=>{
        const cleaned=withoutSceneHeadings(candidate);
        const manuscript=fanfiction?cleaned.replace(/^[ \t]*(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})\r?$/gm,''):cleaned;
        return fanfiction||storyId?formatSpeakerDialogue(manuscript,castNames,false,speakerLayout):manuscript;
      };
      const formatted = formatCandidate(partial);
      await showCandidate(fanfiction?removeEchoedSceneOpening(formatted,visibleBefore):formatted);
      if(options.signal.aborted)throw new DOMException('Stopped','AbortError');
      if(finishReason!=='stop'&&!atCapacity)throw Error(result?.warning??`Scene stopped: ${finishReason}. Partial prose was preserved.`);
      if(result?.result.calls.length)throw Error('The scene requested a tool during prose generation. The draft remains saved.');
      if(!partial.trim())throw Error('The scene response contained no prose; the saved chapter remains available.');
      let fragment='';
      if(atCapacity||fromRecovery&&resume?.data.state==='cancelled'){
        const sentence=sentenceCheckpoint(partial);
        if(!sentence.prose.trim()&&atCapacity)throw Error('The engine reached capacity before a complete sentence. The draft is saved.');
        if(sentence.prose.trim()){
          fragment=sentence.fragment;
          await showCandidate(sentence.prose);
        }
        updateInterlude('recalling',atCapacity?'capacity':'unfinished',characterCount(visibleBefore+separator+partial));
      }
      const proofRequired=Boolean(development)||fanfiction;
      const asScene=()=>sceneDraft+(sceneDraft?'\n\n':'')+partial;
      const checkpointBoundary=sceneDraft?sceneDraft.length+2:0;
      const evidenceQuotes=[...(pending?.notes??[]).map(note=>note.quote),pending?.reachedOutcome?.quote??'',proof?.quote??'',
        ...scenePassages(sceneDraft,Infinity).slice(-2).map(passage=>passage.text)];
      const issues=sceneIssues(partial.trim(),visibleBefore);
      const repeatIndex=issues.indexOf(repeatedSceneMessage);
      const repeated=fanfiction&&repeatIndex!==-1?repeatedSceneCorrections(partial,visibleBefore)
        .map(correction=>({...correction,passage:{...correction.passage,start:correction.passage.start+checkpointBoundary}})):[];
      if(repeated.length)issues.splice(repeatIndex,1);
      const untranslated=englishProse?scenePassages(asScene(),Infinity).filter(passage=>hasUntranslatedScript(passage.text)).slice(0,3)
        .map(passage=>({passage,reason:'Translate this passage to idiomatic English. Preserve its speakers, facts and action.'})):[];
      const continuity=castContinuityCorrections(asScene(),castFacts,authorChoices);
      let assessment:SceneAssessment|null=null;
      const proofIsValid=()=>proofId&&sceneIssues(asScene().trim(),'',proofId,proof,proofRequired&&!assessment).length===0;
      if((fanfiction||continuity.length)&&proofId&&!issues.length&&(atCapacity||repeated.length||untranslated.length||continuity.length||participatingCast.length>0||!proofIsValid()||/\b(?:predator(?:y)?|pinned|pinning|cornered|cornering|prey)\b/i.test(partial))){
        if(atCapacity)updateInterlude('planning','capacity',characterCount(visibleBefore+separator+partial));
        const context=[prior.slice(-450),...((pending?.notes??[]).map(note=>note.change)),
          pending?'These excerpts include saved prose and its continuation in the same scene. Evaluate the established action in both parts.':visibleBefore.slice(-700)].filter(Boolean).join('\n');
        assessment=await assessScene(asScene(),outcome,proofId,isClosing,context,evidenceQuotes);
        if(!assessment)issues.push('Use a numbered draft passage to verify the actual scene outcome.');
        const corrections=[...continuity,...untranslated,...repeated,...(assessment?.corrections??[])].reduce<typeof continuity>((selected,correction)=>{
          const {passage}=correction;
          if(selected.length<3&&!selected.some(item=>item.passage.start<passage.start+passage.text.length&&passage.start<item.passage.start+item.passage.text.length))selected.push(correction);
          return selected;
        },[]);
        if(corrections.length){
          updateInterlude('repairing','correction',characterCount(visibleBefore+separator+partial));
          const original=asScene();
          const nearby=original.length<=4000?original:corrections.map(({passage})=>
            original.slice(Math.max(0,passage.start-450),passage.start+passage.text.length+450)).join('\n\n');
          const repairPrompt=sceneCorrectionPrompt(corrections,nearby);
          let corrected=applySceneCorrections(original,await reportModel('Live scene corrections: '+document.title,repairPrompt),corrections,checkpointBoundary);
          if(!corrected)corrected=applySceneCorrections(original,await reportModel('Checking exact replacement passages: '+document.title,
            repairPrompt+'\nUse only those passage IDs. Return exactly one replacement per listed original span.'),corrections,checkpointBoundary);
          if(corrected){
            if(pending&&checkpointBoundary){
              const revisedDraft=formatCandidate(corrected.text.slice(0,corrected.boundary-2));
              if(revisedDraft!==sceneDraft){
                sceneDraft=revisedDraft;
                visibleBefore=displayed();
                await saveTask({pendingScene:{...pending,notes:pending.notes.filter(note=>sceneDraft.includes(note.quote))}},sceneDraft);
              }
            }
            await showCandidate(formatCandidate(corrected.text.slice(corrected.boundary)));
            assessment=await assessScene(asScene(),outcome,proofId,isClosing,context,evidenceQuotes);
            if(assessment)issues.push(...assessment.corrections.map(c=>c.reason),...sceneIssues(partial.trim(),visibleBefore));
            else issues.push('Recheck the revised passages against the actual numbered draft.');
          }else issues.push('Apply each correction only to its exact original passage.');
        }
        proof=assessment?.proof??pending?.reachedOutcome??null;
        proofError='';
      }
      const fullScene=asScene();
      issues.push(...castContinuityCorrections(fullScene,castFacts,authorChoices).map(correction=>correction.reason));
      if(englishProse&&hasUntranslatedScript(fullScene))issues.push('Translate the remaining untranslated passages into English before accepting this scene.');
      const shortClosing=fanfiction&&isClosing&&target&&!checkChapterLength(visibleBefore+separator+partial,target).complete;
      if(fanfiction&&!issues.length&&(shortClosing||assessment&&!proofIsValid())){
        const notes=[...(pending?.notes??[]),...(assessment?.notes??[])].filter(note=>fullScene.includes(note.quote)).slice(-4);
        const nextBeat=shortClosing&&proofIsValid()?`Develop a new concrete consequence of the current action before closing this scene. Saved outcome: ${proof?.endState??outcome}`:
          assessment?.nextBeat || (pending?.nextBeat??scene.purpose);
        if(partial.trim().length<60||nextBeat===pending?.nextBeat&&partial.trim().length<280&&
          notes.every(note=>pending.notes.some(old=>old.quote===note.quote))) {
          throw Error('The continuation did not make enough new progress. The current scene is saved as a draft.');
        }
        const cause=atCapacity?'capacity':'unfinished';
        const savedCharacters=characterCount(visibleBefore+separator+partial);
        updateInterlude('saving',cause,savedCharacters);
        const reachedOutcome=shortClosing&&proofIsValid()?proof??undefined:pending?.reachedOutcome;
        await saveTask({pendingScene:{index,cause,notes,nextBeat,fragment,reachedOutcome},stopReason:undefined},fullScene);
        sceneDraft=fullScene;partial='';rejectedDraft='';
        updateInterlude('recalling',cause,savedCharacters,notes);
        updateInterlude('ready',cause,savedCharacters,notes,nextBeat);
        continue;
      }
      if(proofId)issues.push(...sceneIssues(fullScene.trim(),'',proofId,proof,proofRequired&&!assessment).filter(issue=>!issues.includes(issue)));
      if(proofError)issues.push(proofError);
      if(target&&sceneFloor){
        const length=checkChapterLength(fullScene,{unit:target.unit,minimum:sceneFloor});
        if(!length.complete)issues.push(`This scene has ${length.actual} ${target.unit} and needs ${length.missing} more. Develop the current action fully before ending it.`);
      }
      if(!fanfiction&&!development&&!issues.length&&isClosing&&target&&!checkChapterLength(visibleBefore+separator+partial,target).complete){
        if(!options.onAnswerReplace)throw Error('The proposed ending is short of the target. The saved chapter can be resumed.');
        await saveTask({scenes:task.data.scenes.map((item,i)=>i===index?{...item,needsDevelopment:true}:item)});
        partial='';options.onAnswerReplace(opening()+displayed());
        continue;
      }
      if(issues.length){
        let hash=2166136261;for(const char of partial.replace(/\s+/g,' ').trim())hash=Math.imul(hash^char.charCodeAt(0),16777619);const signature=(hash>>>0).toString(16);const unchanged=scene.rejected?.includes(signature);
        const scenes=task.data.scenes.map((s,i)=>i===index?{...s,diagnostic:issues.join(' '),rejected:[...(s.rejected??[]),signature]}:s);
        await saveTask({scenes,stopReason:issues.join(' ')});
        if(unchanged||!options.onAnswerReplace||fanfiction&&(scene.rejected?.length??0)>=2)throw Error(issues.join(' ')+' The scene remains saved as a draft.');
        rejectedDraft=partial;partial='';options.onAnswerReplace(opening()+displayed());
        if(fanfiction)updateInterlude('planning','unfinished',characterCount(displayed()+rejectedDraft),[],scene.purpose,'review');
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
      const finalDocument=isClosing&&(!target||checkChapterLength(accepted,target).complete);
      document=await repo.save(document,markdownContent(accepted),{status:finalDocument?'final':'draft',
        metadata:{...document.data.metadata,canonPoint}},false,revision=>{
        committedTask=nextTask({scenes,nextScene:index+1,currentRevisionId:revision.data.currentRevisionId,stopReason:undefined,pendingScene:undefined},accepted);
        return {record:committedTask,expected:task!.version,body:''};
      });
      task=committedTask!;prose=accepted;sceneDraft='';partial='';rejectedDraft='';interlude=undefined;progress();
      const rememberedNotes: StoryMemoryInput[]=(pending?.notes??[]).map(note=>({
        summary:note.change,quote:note.quote,knowledge:(note.knowledge??[]).filter(entry=>resolveStoryCharacter(participatingCast,entry.character)),
      }));
      const sceneMemories=[...rememberedNotes,...(developments?.flatMap(item=>item.memories??[])??memories)];
      const provenMemories=sceneMemories.filter(memory=>typeof memory.quote==='string'&&fullScene.includes(memory.quote));
      if(document.storyId&&castStoryId===storyId&&provenMemories.length&&options.preferences.toolPermissions.remember_story_event!=='deny')try{await rememberStoryEvents(stories,repo,document,provenMemories);}catch(error){options.onWarning?.(`Scene saved, but memory was rejected: ${String(error)}`);}
    }
    const savedChapter=await repo.get(document.id);
    prose=savedChapter.content.markdownProjection;
    const length=target?checkChapterLength(prose,target):{complete:task.data.scenes.every(s=>s.status==='accepted'),actual:characterCount(prose),missing:0};
    const complete=length.complete&&task.data.scenes.every(scene=>scene.status==='accepted')&&
      savedChapter.document.data.status==='final'&&savedChapter.document.data.currentRevisionId===task.data.currentRevisionId;
    await saveTask({state:complete?'completed':'incomplete'});
    if(!length.complete&&target)options.onWarning?.(`Chapter saved with ${length.actual.toLocaleString()} of ${target.minimum.toLocaleString()} requested ${target.unit}.`);
    if(complete)options.onAnswer('\n```');
    options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:complete?'completed':'failed',title:document.title,detail:`${characterCount(prose).toLocaleString()} characters · ${wordCount(prose).toLocaleString()} words saved. ${complete?(target?'Planned scenes saved and length target reached.':'All approved chapter beats drafted with saved supporting passages.'):'The chapter is saved as a draft.'}`});
    return opening()+prose+(complete?'\n```':'');
  }catch(error){
    interlude=undefined;
    try{const recoveryText=partial||rejectedDraft;await checkpoint;await repo.checkpoint(document,displayed()+(recoveryText?(sceneDraft?'\n\n':prose.trim()?sceneBreak:'')+recoveryText:''),options.signal.aborted?'cancelled':'draft');await saveTask({state:options.signal.aborted?'cancelled':'incomplete',stopReason:String(error)});}catch(saveError){options.onWarning?.(`Recovery could not be saved: ${String(saveError)}`);}
    if(!opened&&fanfiction)options.onAnswer(opening()+displayed());
    if(error instanceof ChapterCapacityPause){
      options.onWorkspace?.({operationId:`chapter:${task.id}`,kind:'writing',status:'failed',title:'Chapter paused',detail:error.message});
      return opening()+displayed();
    }
    if(!options.signal.aborted)options.onWarning?.(`Chapter incomplete: ${String(error)}. Accepted scenes and available recovery text remain saved.`);
    throw error;
  }
}
