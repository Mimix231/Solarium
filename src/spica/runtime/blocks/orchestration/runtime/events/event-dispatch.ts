import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Forward an actual upstream event to two typed event destinations. */
export default defineRuntimeBlock({
  id:'spica.runtime.event_dispatch',version:'1',kind:'pure',trust:'built-in',category:'orchestration',
  description:"Forward an actual upstream event to two typed event destinations.",exampleConfig:{},
  configSchema:{type:'object',properties:{},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"trigger",type:{kind:'event',payload:{kind:'string'}},required:true}],outputs:[{id:"first",type:{kind:'event',payload:{kind:'string'}}},{id:"second",type:{kind:'event',payload:{kind:'string'}}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){return {first:inputs.trigger,second:inputs.trigger};}
});
