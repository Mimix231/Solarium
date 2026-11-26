import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, boundedInteger, plain } from '../../../../support';

/** Read a bounded page of collection records, with an exact hasMore result for the requested window. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_pagination',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:"Read a bounded page of collection records, with an exact hasMore result for the requested window.",exampleConfig:{"collection": "notes", "limit": 20},
  configSchema:{type:'object',properties:{"collection":{type:"string"},"limit":{type:"number"}},required:["collection", "limit"],additionalProperties:false},
  targets:['desktop','web'],permissions:["records.read"],
  inputs:[{id:"offset",type:{kind:'number'},required:true}],outputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}}},{id:"has_more",type:{kind:'boolean'}},{id:"next_offset",type:{kind:'number'}}],
  validateConfig(config){configKeys(config,"collection","limit");safeKey(config.collection,'collection');boundedInteger(config.limit,'limit',1,100);},
  async execute(ctx,inputs,config){ctx.requirePermission('records.read');if(!ctx.storage.list)throw Error('Storage host does not support listing.');const offset=boundedInteger(inputs.offset,'offset',0,400);const limit=config.limit as number;const rows=await ctx.storage.list(config.collection as string,Math.min(500,offset+limit+1));const items=rows.slice(offset,offset+limit).map(({key,value})=>plain(value)?{...value,key}:{key,value});return {items,has_more:rows.length>offset+limit,next_offset:offset+items.length};}
});
