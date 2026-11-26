import { defineRuntimeBlock } from '../../../../adapter';
import { asArray, configKeys, plain, safeKey } from '../../../../support';
/** Real transactional batch writes, never a visual-only descriptor. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_bulk_upsert',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Write 1–50 keyed records atomically within an authorized storage transaction.',exampleConfig:{collection:'notes'},
  configSchema:{type:'object',properties:{collection:{type:'string'}},required:['collection'],additionalProperties:false},
  targets:['desktop','web'],permissions:['records.write'],inputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:'count',type:{kind:'number'}}],
  validateConfig(config){configKeys(config,'collection');safeKey(config.collection,'collection');},
  async execute(ctx,inputs,config){ctx.requirePermission('records.write');const items=asArray(inputs.items);if(!items.length||items.length>50)throw Error('Expected 1–50 records');const keys=new Set<string>();for(const entry of items){if(!plain(entry))throw Error('Every record must be a plain object with key and value');const key=safeKey(entry.key,'key');if(keys.has(key))throw Error('Duplicate keys are not permitted');keys.add(key);if(!Object.hasOwn(entry,'value'))throw Error('Record must provide value');}for(const entry of items){const rec=entry as Record<string,unknown>;await ctx.storage.put(config.collection as string,rec.key as string,rec.value);}return {count:items.length};}
});
