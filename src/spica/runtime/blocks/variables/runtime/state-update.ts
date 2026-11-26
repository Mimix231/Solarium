import { defineRuntimeBlock } from '../../../adapter';
import { configKeys, safeKey } from '../../../support';
/** Mutate only the explicit transaction-scoped UI session after a real event. */
export default defineRuntimeBlock({
  id:'spica.runtime.state_update',version:'1',kind:'effect',trust:'built-in',category:'variables',
  description:'Apply an explicit text event to named session state. No database write occurs.',
  configSchema:{type:'object',properties:{'key': {'type': 'string'}},required:['key'],additionalProperties:false},
  exampleConfig:{key:'draft'},targets:['desktop','web'],permissions:[],
  inputs:[{id:'trigger',type:{kind:'event',payload:{kind:'string'}},required:true}],
  outputs:[{id:'value',type:{kind:'string'}}],
  validateConfig(config){configKeys(config,'key');safeKey(config.key,'key');},
  execute(ctx,inputs,config){ctx.interaction.write(config.key as string,inputs.trigger as string);return {value:inputs.trigger};},
});
