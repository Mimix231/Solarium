import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Select the last available value from two ordered graph dependencies. */
export default defineRuntimeBlock({
  id:'spica.runtime.logic_sequence',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Select the last available value from two ordered graph dependencies.",exampleConfig:{},
  configSchema:{type:'object',properties:{},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"first",type:{kind:'unknown'},required:true},{id:"second",type:{kind:'unknown'},required:true}],outputs:[{id:"value",type:{kind:'unknown'}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){return {value:inputs.second??inputs.first??null};}
});
