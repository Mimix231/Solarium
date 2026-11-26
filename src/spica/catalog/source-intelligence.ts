import {createSourceBlockRegistry} from '../source';
import {indexedCapability,WarehouseIndexer,CapabilitySearchEngine,SourceDependencyResolver,
  CompositionRecipeRegistry,builtInCompositionRecipes} from '../source/intelligence';
import type {CapabilitySearchQuery} from '../source/intelligence';

const sourceRegistry=createSourceBlockRegistry();
const dependencyResolver=new SourceDependencyResolver(sourceRegistry);
const recipes=new CompositionRecipeRegistry(builtInCompositionRecipes,sourceRegistry);
let localSearch:Promise<CapabilitySearchEngine>|undefined;
/** Phase 03 search indexes PUBLIC CONTRACTS only; never imports executable block source. */
function getLocalSearch():Promise<CapabilitySearchEngine>{
  localSearch??=WarehouseIndexer.build(sourceRegistry.list().map(indexedCapability)).then(({manifest,shards})=>{
    const byId=new Map(shards.map(shard=>[shard.id,shard]));
    return new CapabilitySearchEngine(manifest,{async readShard(id){
      const shard=byId.get(id);
      if(!shard)throw Error(`Unknown indexed shard ${id}`);
      return shard;
    }});
  }).catch(error=>{localSearch=undefined;throw error;});
  return localSearch;
}
export async function searchSourceWarehouse(query:CapabilitySearchQuery){
  return (await getLocalSearch()).search(query);
}
export async function inspectIndexedSourceCapability(id:string,version='1.0.0'){
  return (await getLocalSearch()).exact(id,version);
}
export function resolveSourceDependencies(selections:Parameters<SourceDependencyResolver['resolve']>[0],
  target:Parameters<SourceDependencyResolver['resolve']>[1]){
  return dependencyResolver.resolve(selections,target);
}
export function listSourceCompositionRecipes(){return recipes.list();}
export function searchSourceCompositionRecipes(query:string,target:'typescript-web'|'typescript-desktop',limit=10){return recipes.search(query,target,limit);}
export function resolveSourceCompositionRecipe(id:string,target:'typescript-web'|'typescript-desktop'){
  return recipes.resolve(id,target);
}
