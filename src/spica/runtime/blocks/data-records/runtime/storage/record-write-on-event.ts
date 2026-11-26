import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';
/** Interaction-triggered transaction write; unlike unconditional record_write,
 * does not persist anything merely because a graph is opened or re-rendered. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_write_on_event',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Save one record only after an explicitly bound UI interaction event, using normal records.write permission.',
  configSchema:{type:'object',properties:{'collection': {'type': 'string'}},required:['collection'],additionalProperties:false},
  exampleConfig:{collection:'notes'},targets:['desktop','web'],permissions:['records.write'],
  inputs:[{id:'key',type:{kind:'string'},required:true},
    {id:'value',type:{kind:'unknown'},required:true},
    {id:'trigger',type:{kind:'event',payload:{kind:'string'}},required:true}],
  outputs:[{id:'saved',type:{kind:'boolean'}}],
  validateConfig(config){configKeys(config,'collection');safeKey(config.collection,'collection');},
  async execute(ctx,inputs,config){ctx.requirePermission('records.write');
    await ctx.storage.put(config.collection as string,inputs.key as string,inputs.value);return {saved:true};},
});
