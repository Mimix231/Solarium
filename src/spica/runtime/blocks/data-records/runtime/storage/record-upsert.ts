import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, plain } from '../../../../support';

/** Merge a new data record with an existing key using the permissioned atomic read/write transaction. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_upsert',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:"Merge a new data record with an existing key using the permissioned atomic read/write transaction.",exampleConfig:{"collection": "notes"},
  configSchema:{type:'object',properties:{"collection":{type:"string"}},required:["collection"],additionalProperties:false},
  targets:['desktop','web'],permissions:["records.read", "records.write"],
  inputs:[{id:"key",type:{kind:'string'},required:true},{id:"value",type:{kind:'record',fields:{},open:true},required:true}],outputs:[{id:"saved",type:{kind:'boolean'}},{id:"value",type:{kind:'record',fields:{},open:true}}],
  validateConfig(config){configKeys(config,"collection");safeKey(config.collection,'collection');},
  async execute(ctx,inputs,config){ctx.requirePermission('records.read');ctx.requirePermission('records.write');const prior=await ctx.storage.read(config.collection as string,inputs.key as string);const merged={...(plain(prior)?prior:{}),...inputs.value as Record<string,unknown>};await ctx.storage.put(config.collection as string,inputs.key as string,merged);return {saved:true,value:merged};}
});
