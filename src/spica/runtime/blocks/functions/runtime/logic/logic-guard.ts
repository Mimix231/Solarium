import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Pass a linked value only when a boolean condition is true, otherwise emit no output. */
export default defineRuntimeBlock({
  id:'spica.runtime.logic_guard',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Pass a linked value only when a boolean condition is true, otherwise emit no output.",exampleConfig:{},
  configSchema:{type:'object',properties:{},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"allowed",type:{kind:'boolean'},required:true},{id:"value",type:{kind:'unknown'},required:true}],outputs:[{id:"value",type:{kind:'unknown'}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){return inputs.allowed===true?{value:inputs.value}:{};}
});
