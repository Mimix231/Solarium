import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Map a supplied error message into a safe, prefixed user-facing diagnostic. */
export default defineRuntimeBlock({
  id:'spica.runtime.error_map',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Map a supplied error message into a safe, prefixed user-facing diagnostic.",exampleConfig:{"prefix": "Error: "},
  configSchema:{type:'object',properties:{"prefix":{type:"string"}},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"message",type:{kind:'string'},required:true}],outputs:[{id:"message",type:{kind:'string'}}],
  validateConfig(config){configKeys(config,"prefix");if(config.prefix!==undefined&&typeof config.prefix!=='string')throw Error('prefix must be text');},
  execute(_ctx,inputs,config){return {message:(String(config.prefix??'')+String(inputs.message)).slice(0,4000)};}
});
