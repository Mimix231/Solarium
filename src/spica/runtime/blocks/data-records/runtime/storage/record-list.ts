import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, boundedInteger, safeKey } from '../../../../support';

/** Read a bounded, deterministic list of transaction records for reusable recent-item, list, and table compositions. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_list', version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'List bounded records in a permissioned collection. Connect to array_sort_field, array_take and ui_list to build Recents screens.',
  exampleConfig:{collection:'notes',limit:100},targets:['desktop','web'],permissions:['records.read'],
  inputs:[],outputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,'collection','limit');safeKey(config.collection,'collection');if(config.limit!==undefined)boundedInteger(config.limit,'limit',1,500);},
  async execute(ctx,_inputs,config){ctx.requirePermission('records.read');if(!ctx.storage.list)throw Error('The storage host does not support listing records.');
    const entries=await ctx.storage.list(config.collection as string,Number(config.limit??100));
    return {items:entries.map(({key,value})=>typeof value==='object'&&value!==null&&!Array.isArray(value)?{...value,key}:{key,value})};},
});
