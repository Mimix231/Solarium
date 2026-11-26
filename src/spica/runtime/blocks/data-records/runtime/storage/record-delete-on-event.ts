import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.record_delete_on_event',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Delete a selected record only when its explicit UI event is delivered. Returns whether it existed.',
  exampleConfig:{collection:'items'},
  configSchema:{type:'object',properties:{collection:{type:'string'}},required:['collection'],additionalProperties:false},
  targets:['desktop','web'],permissions:['records.read','records.write'],
  inputs:[{id:'key',type:{kind:'string'},required:true},{id:'trigger',type:{kind:'event',payload:{kind:'string'}},required:true}],
  outputs:[{id:'deleted',type:{kind:'boolean'}}],
  validateConfig(config){configKeys(config,'collection');safeKey(config.collection,'collection');},
  async execute(ctx,inputs,config){
    ctx.requirePermission('records.read');ctx.requirePermission('records.write');
    if(!ctx.storage.delete)throw Error('Storage host does not support deletion.');
    const collection=String(config.collection),key=String(inputs.key);
    const exists=await ctx.storage.read(collection,key)!==undefined;
    if(exists)await ctx.storage.delete(collection,key);
    return {deleted:exists};
  },
});
