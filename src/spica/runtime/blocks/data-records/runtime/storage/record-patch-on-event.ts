import { defineRuntimeBlock } from '../../../../adapter';
import { asRecord, configKeys, safeKey } from '../../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.record_patch_on_event',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Merge changed fields into an existing record only on a delivered UI event. Other saved fields remain intact.',
  exampleConfig:{collection:'items'},
  configSchema:{type:'object',properties:{collection:{type:'string'}},required:['collection'],additionalProperties:false},
  targets:['desktop','web'],permissions:['records.read','records.write'],
  inputs:[{id:'key',type:{kind:'string'},required:true},{id:'patch',type:{kind:'record',fields:{},open:true},required:true},
    {id:'trigger',type:{kind:'event',payload:{kind:'string'}},required:true}],
  outputs:[{id:'saved',type:{kind:'boolean'}},{id:'value',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config){configKeys(config,'collection');safeKey(config.collection,'collection');},
  async execute(ctx,inputs,config){
    ctx.requirePermission('records.read');ctx.requirePermission('records.write');
    const collection=config.collection as string,key=String(inputs.key);
    const prior=await ctx.storage.read(collection,key);
    if(prior===undefined)throw Error('The record no longer exists. Reload before editing.');
    const value={...asRecord(prior),...asRecord(inputs.patch)};
    await ctx.storage.put(collection,key,value);
    return {saved:true,value};
  },
});
