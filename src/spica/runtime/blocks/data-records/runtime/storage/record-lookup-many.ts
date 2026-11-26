import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';
/** Permissioned bounded multi-key read from one transaction. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_lookup_many',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Read a bounded list of record keys from one authorized transaction.',exampleConfig:{collection:'notes',keys:['first','second']},
  configSchema:{type:'object',properties:{collection:{type:'string'},keys:{type:'array',items:{type:'string'}}},required:['collection','keys'],additionalProperties:false},
  targets:['desktop','web'],permissions:['records.read'],inputs:[],outputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,'collection','keys');safeKey(config.collection,'collection');if(!Array.isArray(config.keys)||config.keys.length<1||config.keys.length>64)throw Error('keys must contain 1–64 values');for(const key of config.keys)safeKey(key,'record key');},
  async execute(ctx,_inputs,config){ctx.requirePermission('records.read');const items=[];for(const key of config.keys as string[]){const value=await ctx.storage.read(config.collection as string,key);items.push({key,found:value!==undefined,value:value??null});}return {items};}
});
