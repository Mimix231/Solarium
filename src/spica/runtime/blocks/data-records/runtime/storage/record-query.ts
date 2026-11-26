import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, boundedInteger, plain } from '../../../../support';

/** Query a bounded collection by exact field equality with optional descending timestamp order. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_query',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:"Query a bounded collection by exact field equality with optional descending timestamp order.",exampleConfig:{"collection": "notes", "field": "status", "equals": "active", "orderBy": "updatedAt", "limit": 100},
  configSchema:{type:'object',properties:{"collection":{type:"string"},"field":{type:"string"},"equals":{type:"string"},"orderBy":{type:"string"},"limit":{type:"number"}},required:["collection", "field", "equals"],additionalProperties:false},
  targets:['desktop','web'],permissions:["records.read"],
  inputs:[],outputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,"collection","field","equals","orderBy","limit");safeKey(config.collection,'collection');safeKey(config.field,'field');if(typeof config.equals!=='string')throw Error('equals must be string');if(config.orderBy!==undefined)safeKey(config.orderBy,'orderBy');if(config.limit!==undefined)boundedInteger(config.limit,'limit',1,500);},
  async execute(ctx,_inputs,config){ctx.requirePermission('records.read');if(!ctx.storage.list)throw Error('Storage host does not support listing.');const rows=await ctx.storage.list(config.collection as string,500);let items: Record<string,unknown>[]=rows.map(({key,value}):Record<string,unknown>=>plain(value)?{...value,key}:{key,value}).filter(row=>String(row[config.field as string]??'')===config.equals);if(config.orderBy)items=items.sort((a,b)=>String(b[config.orderBy as string]??'').localeCompare(String(a[config.orderBy as string]??'')));return {items:items.slice(0,Number(config.limit??100))};}
});
