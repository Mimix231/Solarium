import type { SourceSelection } from '../emitter';
import type { SourceTarget } from '../types';
import type { SourceBlockRegistry } from '../registry';
import { SourceDependencyResolver } from './dependencies';

export interface CompositionRecipe {
  readonly id:string;
  readonly description:string;
  readonly targets:readonly SourceTarget[];
  readonly selections:readonly SourceSelection[];
}
/** Recipes name real, registered implementations. They are not executable tools. */
export class CompositionRecipeRegistry {
  private readonly recipes=new Map<string,CompositionRecipe>();
  constructor(recipes:readonly CompositionRecipe[],private readonly registry:SourceBlockRegistry){
    for(const recipe of recipes){
      if(!/^recipe\.[a-z0-9-]+$/.test(recipe.id)||this.recipes.has(recipe.id)||!recipe.targets.length)throw Error(`Invalid recipe: ${recipe.id}`);
      for(const target of recipe.targets){
        const result=new SourceDependencyResolver(registry).resolve(recipe.selections,target);
        if(!result.ok)throw Error(`Invalid recipe ${recipe.id}: ${result.errors.map(e=>e.detail).join('; ')}`);
      }
      this.recipes.set(recipe.id,Object.freeze({...recipe,
        targets:Object.freeze([...recipe.targets]),
        selections:Object.freeze(recipe.selections.map(s=>Object.freeze({id:s.id,version:s.version,
          ...(s.config?{config:Object.freeze({...s.config})}:{})}))),
      }));
    }
  }
  /** Recipes remain distinct from source modules: a recipe is an assembly plan,
   * not an executable block or proof that an entire game has been built. */
  search(query:string,target:SourceTarget,limit=10):readonly {id:string;description:string}[]{
    if(typeof query!=='string'||query.length>256||!Number.isInteger(limit)||limit<1||limit>50)throw Error('Invalid recipe search');
    const words=query.toLowerCase().match(/[a-z0-9]+/g)??[];
    return [...this.recipes.values()].filter(recipe=>recipe.targets.includes(target))
      .map(recipe=>({recipe,score:words.filter(word=>(recipe.id+' '+recipe.description).toLowerCase().includes(word)).length}))
      .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.recipe.id.localeCompare(b.recipe.id))
      .slice(0,limit).map(({recipe})=>({id:recipe.id,description:recipe.description}));
  }
  list():readonly {id:string;description:string;targets:readonly SourceTarget[]}[]{
    return [...this.recipes.values()].map(({id,description,targets})=>({id,description,targets}));
  }
  resolve(id:string,target:SourceTarget){
    const recipe=this.recipes.get(id);
    if(!recipe)throw Error(`Unknown source recipe: ${id}`);
    if(!recipe.targets.includes(target))throw Error(`Unsupported recipe target: ${target}`);
    return new SourceDependencyResolver(this.registry).resolve(recipe.selections,target);
  }
}
export const builtInCompositionRecipes:readonly CompositionRecipe[]=[
  {id:'recipe.platformer-core',description:'Platformer core: movement, gravity, jumping, landing, input, collision, camera and collectibles',
    targets:['typescript-web','typescript-desktop'],selections:[
      {id:'source.game-movement'},{id:'source.game-gravity'},{id:'source.game-jump'},
      {id:'source.game-platform-landing'},{id:'source.game-input'},
      {id:'source.game-aabb-collision'},{id:'source.game-camera'},{id:'source.game-collectibles'},
    ]},
  {id:'recipe.notes-core',description:'Notes core: record access, sorting, state and basic UI',
    targets:['typescript-web','typescript-desktop'],selections:[
      {id:'source.record-get'},{id:'source.record-set'},{id:'source.array-sort-field'},
      {id:'source.state-store'},{id:'source.ui-button'},{id:'source.ui-heading'},
    ]},
];
