import { FictionRepository, type FictionDestination, type StoryCategory } from './fiction';
import type { StoryRepository, StoryWorld } from './repository';

const titleKey=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const pathPattern=/(?:\b(?:to|under|in|into)\s+)?\[\s*([^\u005B\u005D\r\n>›]{1,180})\s*[>›]\s*([^\u005B\u005D\r\n>›]{1,100})\s*\]/u;

/** A typed path selects existing records. The model never chooses the write scope. */
export async function resolveFictionDestination(
  stories:StoryRepository, request:string, preferred?:FictionDestination|null, selected?:FictionDestination|null,
):Promise<{explicit:boolean;request:string;destination?:FictionDestination;world?:StoryWorld;category?:StoryCategory}> {
  const fiction=new FictionRepository(stories);
  const path=pathPattern.exec(request);
  if(path){
    const group=path[1]!.trim(), category=path[2]!.trim();
    const worlds=(await stories.list()).filter(world=>titleKey(world.title)===titleKey(group));
    const matches=(await Promise.all(worlds.map(async world=>(await fiction.categories(world.id))
      .filter(item=>titleKey(item.title)===titleKey(category)).map(item=>({world,category:item}))))).flat();
    const configured=matches.find(match=>match.world.id===preferred?.storyId&&match.category.id===preferred.categoryId) ??
      matches.find(match=>match.world.id===selected?.storyId&&match.category.id===selected.categoryId);
    const originals=matches.filter(match=>!matches.some(parent=>parent.world.scope.kind==='library'&&parent.world.id===match.world.data.parentStoryId));
    if(originals.length>1&&!configured)throw Error(`More than one fiction destination is named “${group} › ${category}”. Select the intended group in Story Cast first.`);
    const match=configured??originals[0];
    if(!match)throw Error(`Fiction destination “${group} › ${category}” could not be found. Choose an existing group and category in Settings → Fiction.`);
    return {...match,explicit:true,request:request.replace(path[0],' ').trim(),
      destination:{storyId:match.world.id,categoryId:match.category.id} satisfies FictionDestination};
  }
  for(const destination of [preferred,selected]){
    if(!destination)continue;
    const world=(await stories.list()).find(item=>item.id===destination.storyId);
    if(!world)continue;
    const category=(await fiction.categories(world.id)).find(item=>item.id===destination.categoryId);
    if(category)return {world,category,explicit:false,request,destination};
  }
  return {explicit:false,request};
}
