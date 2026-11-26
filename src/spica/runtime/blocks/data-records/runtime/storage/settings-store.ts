import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';
/** Settings are real records and require the same explicit write permission. */
export default defineRuntimeBlock({
  id:'spica.runtime.settings_store',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Persist one named preference in the permissioned settings collection after an explicit string UI event.',
  configSchema:{type:'object',properties:{'key': {'type': 'string'}},required:['key'],additionalProperties:false},
  exampleConfig:{key:'view_mode'},targets:['desktop','web'],permissions:['records.write'],
  inputs:[{id:'trigger',type:{kind:'event',payload:{kind:'string'}},required:true}],
  outputs:[{id:'saved',type:{kind:'boolean'}}],
  validateConfig(config){configKeys(config,'key');safeKey(config.key,'key');},
  async execute(ctx,inputs,config){ctx.requirePermission('records.write');await ctx.storage.put('settings',config.key as string,{value:inputs.trigger});return {saved:true};},
});
