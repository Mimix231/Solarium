import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, plain } from '../../../../support';

/** Return an explicit success flag and normalized error text from a supplied error value. */
export default defineRuntimeBlock({
  id:'spica.runtime.error_capture',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Return an explicit success flag and normalized error text from a supplied error value.",exampleConfig:{},
  configSchema:{type:'object',properties:{},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"error",type:{kind:'unknown'},required:true}],outputs:[{id:"ok",type:{kind:'boolean'}},{id:"message",type:{kind:'string'}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){const value=inputs.error;const message=value instanceof Error?value.message:typeof value==='string'?value:plain(value)&&typeof value.message==='string'?value.message:'';return {ok:!message,message:message.slice(0,4000)};}
});
