import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, boundedInteger } from '../../../../support';

/** Count records in a bounded permissioned collection list (up to 500 entries). */
export default defineRuntimeBlock({
  id:'spica.runtime.record_count',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:"Count records in a bounded permissioned collection list (up to 500 entries).",exampleConfig:{"collection": "notes", "limit": 500},
  configSchema:{type:'object',properties:{"collection":{type:"string"},"limit":{type:"number"}},required:["collection"],additionalProperties:false},
  targets:['desktop','web'],permissions:["records.read"],
  inputs:[],outputs:[{id:"count",type:{kind:'number'}}],
  validateConfig(config){configKeys(config,"collection","limit");safeKey(config.collection,'collection');if(config.limit!==undefined)boundedInteger(config.limit,'limit',1,500);},
  async execute(ctx,_inputs,config){ctx.requirePermission('records.read');if(!ctx.storage.list)throw Error('Storage host does not support listing.');const rows=await ctx.storage.list(config.collection as string,Number(config.limit??500));return {count:rows.length};}
});
