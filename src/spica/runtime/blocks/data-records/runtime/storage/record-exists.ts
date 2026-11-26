import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';
/** Permissioned read-only existence check in the active transaction. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_exists',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Check whether a record exists in a permissioned transactional collection.',exampleConfig:{collection:'notes',key:'note_001'},
  configSchema:{type:'object',properties:{collection:{type:'string'},key:{type:'string'}},required:['collection','key'],additionalProperties:false},
  targets:['desktop','web'],permissions:['records.read'],inputs:[],outputs:[{id:'exists',type:{kind:'boolean'}}],
  validateConfig(config){configKeys(config,'collection','key');safeKey(config.collection,'collection');safeKey(config.key,'key');},
  async execute(ctx,_inputs,config){ctx.requirePermission('records.read');return {exists:(await ctx.storage.read(config.collection as string,config.key as string))!==undefined};}
});
