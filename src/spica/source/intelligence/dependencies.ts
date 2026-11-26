import type { SourceTarget } from '../types';
import {validateGeneratorConfig} from '../validator';
import type { SourceBlockRegistry } from '../registry';
import type { SourceSelection } from '../emitter';

export type CapabilityIssueCode = 'UNKNOWN_BLOCK' | 'NON_EXECUTABLE' | 'UNSUPPORTED_TARGET' |
  'MISSING_SYMBOL' | 'CYCLIC_DEPENDENCY' | 'GENERATOR_CONFIG_REQUIRED' | 'SELECTION_CONFLICT' |
  'TOO_MANY_MODULES' | 'INVALID_CONFIG';
export interface CapabilityIssue {readonly code:CapabilityIssueCode;readonly block:string;readonly detail:string;}
export interface CapabilityResolution {
  readonly ok:boolean;
  readonly ordered:readonly SourceSelection[];
  readonly addedDependencies:readonly string[];
  readonly errors:readonly CapabilityIssue[];
}
const MAX_RESOLVED=128;
function identity(id:string,version:string){return `${id}@${version}`;}
/** Only registered, exact and target-compatible implementations may enter emission. */
export class CapabilityCompatibilityChecker {
  constructor(private readonly registry:SourceBlockRegistry){}
  resolve(selections:readonly SourceSelection[],target:SourceTarget):CapabilityResolution{
    if(!Array.isArray(selections)||!selections.length||selections.length>MAX_RESOLVED){
      return {ok:false,ordered:[],addedDependencies:[],errors:[{code:'TOO_MANY_MODULES',block:'selection',detail:`Select 1–${MAX_RESOLVED} modules`} ]};
    }
    const errors:CapabilityIssue[]=[];
    const ordered:SourceSelection[]=[];const added:string[]=[];
    const selected=new Map<string,SourceSelection>();const visiting=new Set<string>();const finished=new Set<string>();
    for(const item of selections){
      if(!item||typeof item.id!=='string'){
        errors.push({code:'UNKNOWN_BLOCK',block:'selection',detail:'Malformed source selection'});continue;
      }
      const key=identity(item.id,item.version??'1.0.0');
      if(selected.has(key))errors.push({code:'SELECTION_CONFLICT',block:key,detail:'Repeated source selection'});
      selected.set(key,item);
    }
    const walk=(id:string,version:string,owner?:string):void=>{
      const key=identity(id,version);
      if(finished.has(key))return;
      if(visiting.has(key)){errors.push({code:'CYCLIC_DEPENDENCY',block:key,detail:`Cycle reached from ${owner??key}`});return;}
      if(finished.size+visiting.size>=MAX_RESOLVED){
        errors.push({code:'TOO_MANY_MODULES',block:key,detail:'Source dependency graph exceeds module bound'});return;
      }
      const block=this.registry.get(id,version);
      if(!block){errors.push({code:'UNKNOWN_BLOCK',block:key,detail:`Required by ${owner??'request'}`});return;}
      if(block.kind!=='portable-source'&&block.kind!=='source-generator'){
        errors.push({code:'NON_EXECUTABLE',block:key,detail:`${block.kind} has no independently reusable source`});return;
      }
      if(!block.targets.includes(target)){
        errors.push({code:'UNSUPPORTED_TARGET',block:key,detail:`${target} is not supported`});return;
      }
      const selection=selected.get(key);
      if(block.kind==='source-generator'){
        const config=selection?.config;
        if(block.configSchema.required.length && (!config || typeof config!=='object'||Array.isArray(config)||
          block.configSchema.required.some(field=>!Object.hasOwn(config,field)))){
          errors.push({code:'GENERATOR_CONFIG_REQUIRED',block:key,detail:`Required configuration: ${block.configSchema.required.join(', ')}`});return;
        }
        try{validateGeneratorConfig(block,config??{});}
        catch(error){errors.push({code:'INVALID_CONFIG',block:key,detail:String(error)});return;}
      }else if(selection?.config && Object.keys(selection.config).length){
        errors.push({code:'INVALID_CONFIG',block:key,detail:'Portable source blocks do not accept generator config'});return;
      }
      visiting.add(key);
      for(const dep of block.requires){
        const required=this.registry.get(dep.id,dep.version);
        if(required && (required.kind==='portable-source'||required.kind==='source-generator') &&
          !required.exports.some(symbol=>symbol.name===dep.symbol)){
          errors.push({code:'MISSING_SYMBOL',block:key,detail:`${dep.id}@${dep.version} does not export ${dep.symbol}`});
        } else walk(dep.id,dep.version,key);
      }
      visiting.delete(key);finished.add(key);
      if(!selection)added.push(key);
      ordered.push(Object.freeze(selection?{
        id,version,...(selection.config?{config:Object.freeze({...selection.config})}:{}),
      }:{id,version}));
    };
    for(const item of selections){if(item&&typeof item.id==='string')walk(item.id,item.version??'1.0.0');}
    return {ok:errors.length===0,ordered:errors.length?[]:ordered,addedDependencies:errors.length?[]:added,errors};
  }
}
export class SourceDependencyResolver extends CapabilityCompatibilityChecker {}
