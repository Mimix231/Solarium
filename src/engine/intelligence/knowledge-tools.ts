import type { AgentToolDefinition } from '../tools';
import type { ChatSession, CreatorProject, Preferences } from '../../domain/types';
import { WritingRepository } from '../../writing/repository';
import { markdownContent } from '../../writing/schema';
import { StoryRepository, claimKinds, claimSections, type ClaimData } from '../../stories/repository';
import { SourceRepository } from '../../sources/repository';
import { researchTopic, nativeSearchProvider } from '../../research/research';
const str={type:'string',minLength:1,maxLength:1000};
const define=(name:string,description:string,properties:Record<string,unknown>,required:string[]=[]):AgentToolDefinition=>({type:'function',function:{name,description,parameters:{type:'object',properties,required,additionalProperties:false}}});
export const knowledgeToolDefinitions:AgentToolDefinition[]=[
  define('search_saved_sources','Search only this conversation and its project sources, entirely offline.',{query:str},['query']),
  define('list_writing_categories','List categories and Story Worlds available to this conversation.',{}),
  define('create_writing_category','Create a named category in this conversation/project Writing Library.',{name:str,parent_id:{type:['string','null']}},['name']),
  define('create_writing_document','Create a durable draft with a stable ID. Then write the actual prose in one solarium-writing fence in your normal response. No large JSON prose argument.',{title:str,category_id:{type:['string','null']},kind:{type:'string',enum:['chapter','scene','short_story','outline','screenplay','dialogue','article','essay','report','note','lore_document','other']}},['title']),
  define('finalize_writing_document','Commit an existing generated recovery draft as a new document revision. Cannot overwrite a changed revision.',{document_id:str},['document_id']),
  define('move_writing_document','Move an authored document to a category inside the same project/story.',{document_id:str,category_id:{type:['string','null']}},['document_id','category_id']),
  define('create_story_world','Create a separate story continuity; never changes the assistant Spark persona.',{title:str,origin_kind:{type:'string',enum:['original','fanfiction','mixed']},franchise:str,canon_anchor:str,divergence:str},['title','origin_kind']),
  define('create_story_character','Create one story character dossier, deduplicating names and aliases. Blank fields remain unknown.',{name:str,aliases:{type:'array',items:str,maxItems:30},kind:{type:'string',enum:['canon','original','adapted']}},['name']),
  define('research_character','Research the named character at the active story point; read actual pages and save concise evidence in this project/chat Sources. No invented profile.',{name:str,section:{type:'string',enum:claimSections}},['name']),
  define('update_character_claims','Save sectioned claims with short exact supporting excerpts; locked fields are preserved.',{
    character_id:str,
    claims:{type:'array',minItems:1,maxItems:15,items:{
      type:'object',additionalProperties:false,
      properties:{
        section:{type:'string',enum:claimSections},field:str,value:{type:'string',maxLength:5000},kind:{type:'string',enum:claimKinds},
        sourceLinks:{type:'array',maxItems:10,items:{type:'object',additionalProperties:false,
          properties:{sourceId:str,locator:str,synopsis:{type:'string',maxLength:1000},quote:{type:'string',maxLength:500},confidence:{type:'string',enum:['high','medium','low']}},
          required:['sourceId','locator','synopsis','quote','confidence']}}
      },required:['section','field','value','kind','sourceLinks']
    }}
  },['character_id','claims']),
  define('search_specific_scene','Find exact scene sources, re-rank candidates, read actual relevant passages, and report verification/ambiguity. Web permission required.',{query:str},['query']),
  define('suggest_story_consistency_issues','Review a saved document against explicit story constraints. Returns suggestions; never silently rewrites prose.',{document_id:str},['document_id']),
];
export const knowledgeNames=knowledgeToolDefinitions.map(t=>t.function.name);
export const knowledgeWebNames=['research_character','search_specific_scene'];
export function selectKnowledgeTools(allowed:readonly AgentToolDefinition[],request:string,lastTool:string|null,storyId?:string|null):AgentToolDefinition[]{
  let names:string[];
  if(/\b(research|find|search|scene)\b/i.test(request)&&!/\b(write|draft)\b/i.test(request))names=['search_specific_scene','search_saved_sources',...(storyId?['research_character']:[])];
  else if(/\b(character|dossier|profile|cast)\b/i.test(request))names=!storyId?['create_story_world','list_writing_categories']:lastTool==='create_story_character'||lastTool==='research_character'?['update_character_claims','research_character','create_story_character']:['create_story_character','research_character','update_character_claims'];
  else if(/\b(story world|story bible|continuity)\b/i.test(request)&&!storyId)names=['create_story_world','list_writing_categories'];
  else if(/\b(write|draft|chapter|document|essay|article|story|poem|screenplay)\b/i.test(request))names=['list_writing_categories','create_writing_document','create_writing_category'];
  else names=['search_saved_sources','get_current_time','calculate','search_memories'];
  return names.flatMap(name=>{const t=allowed.find(t=>t.function.name===name);return t?[t]:[];});
}
export interface KnowledgeExecution {webEnabled:boolean;signal:AbortSignal;preferences:Preferences;messageId?:string;onStory?:(id:string)=>void;onResearch?:(data:import('../../research/research').ResearchCandidate[])=>void}
export async function executeKnowledgeTool(name:string,args:Record<string,unknown>,session:ChatSession,projects:CreatorProject[],execution:KnowledgeExecution):Promise<string>{
  const context={sessionId:session.id,projectId:projects.some(p=>p.id===session.projectId)?session.projectId??null:null};const sourceRepo=new SourceRepository(context),writing=new WritingRepository(context),stories=new StoryRepository(context);
  const scope=context.projectId?{kind:'project' as const,id:context.projectId}:{kind:'chat' as const,id:session.id};const storyId=session.storyId??null;
  const mustStory=()=>{if(!storyId)throw Error('Choose or create a Story World in Story Bible first.');return storyId;};
  switch(name){
    case 'search_saved_sources':return JSON.stringify(await sourceRepo.retrieve(String(args.query)));
    case 'list_writing_categories':return JSON.stringify({categories:await writing.categories(),stories:await stories.list(),activeStoryId:storyId});
    case 'create_writing_category':return JSON.stringify(await writing.category(String(args.name),scope,args.parent_id as string|null??null,storyId));
    case 'create_writing_document':return JSON.stringify(await writing.create({scope,title:String(args.title),categoryId:args.category_id as string|null,storyId,kind:args.kind as import('../../writing/types').WritingKind,messageId:execution.messageId}));
    case 'finalize_writing_document':{const {document}=await writing.get(String(args.document_id));const draft=await writing.draft(document.id);if(!draft||draft.status==='generating'||draft.status==='cancelled')throw Error('No completed draft is available to finalize.');if(draft.baseRevisionId!==document.data.currentRevisionId)throw Error('Document changed since draft generation.');return JSON.stringify(await writing.save(document,markdownContent(draft.markdown)));}
    case 'move_writing_document':{const {document,content}=await writing.get(String(args.document_id));return JSON.stringify(await writing.save(document,content,{categoryId:args.category_id as string|null}));}
    case 'create_story_world':{const world=await stories.create(String(args.title),scope,{originKind:args.origin_kind as 'original'|'fanfiction'|'mixed',franchiseName:String(args.franchise??''),canonAnchor:String(args.canon_anchor??''),divergenceNote:String(args.divergence??'')});session.storyId=world.id;execution.onStory?.(world.id);return JSON.stringify(world);}
    case 'create_story_character':return JSON.stringify(await stories.character(mustStory(),String(args.name),args.aliases as string[]??[],args.kind as 'canon'|'original'|'adapted'??'canon'));
    case 'update_character_claims':{const character=(await stories.characters(mustStory())).find(c=>c.id===args.character_id);if(!character)throw Error('Character is outside this Story World.');return JSON.stringify(await stories.saveClaims(character,(args.claims as ClaimData[]).map(c=>({...c,characterId:character.id,locked:false,reviewed:false})),false));}
    case 'research_character':case 'search_specific_scene':{
      const world=storyId?await stories.world(storyId):null;const project=projects.find(p=>p.id===context.projectId);
      const request=name==='research_character'?`${args.name} ${args.section??'identity appearance personality history'} ${world?.data.franchiseName??''} ${world?.data.continuityPoint??''}`:String(args.query);
      const result=await researchTopic(request,world?`${world.data.franchiseName} ${world.data.canonAnchor} ${world.data.continuityPoint}`:project?.description??'',await nativeSearchProvider(execution.preferences.searchProvider??{kind:'bing'},execution.webEnabled),execution.webEnabled,execution.signal,execution.onResearch);
      const evidence=[];
      if(name==='research_character')for(const c of result.candidates.filter(c=>c.page)){const page=c.page!;const source=await sourceRepo.create({scope,title:page.title,content:page.text,kind:'webpage',origin:{kind:'web',url:page.url,title:page.title,accessedAt:page.retrievedAt,readState:'read'}}).catch(async error=>{if(error?.sourceId)return(await sourceRepo.get(error.sourceId)).source;throw error;});evidence.push({sourceId:source.id,title:page.title,locator:page.locator,excerpt:page.text});}
      return JSON.stringify({material:result.context,evidence,candidates:result.candidates});
    }
    case 'suggest_story_consistency_issues':{const {document,content}=await writing.get(String(args.document_id));if(document.storyId!==mustStory())throw Error('Document belongs to another Story World.');return JSON.stringify({review:'Deterministic checks of saved constraints; human review remains necessary.',issues:await stories.review(storyId!,content.markdownProjection)});}
    default:throw Error('Unsupported knowledge tool.');
  }
}
