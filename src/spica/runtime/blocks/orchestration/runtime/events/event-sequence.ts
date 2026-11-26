import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Compose two delivered event payloads in their explicit graph dependency order. */
export default defineRuntimeBlock({
  id:'spica.runtime.event_sequence',version:'1',kind:'pure',trust:'built-in',category:'orchestration',
  description:"Compose two delivered event payloads in their explicit graph dependency order.",exampleConfig:{"separator": ","},
  configSchema:{type:'object',properties:{"separator":{type:"string"}},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"first",type:{kind:'event',payload:{kind:'string'}},required:true},{id:"second",type:{kind:'event',payload:{kind:'string'}},required:true}],outputs:[{id:"trigger",type:{kind:'event',payload:{kind:'string'}}}],
  validateConfig(config){configKeys(config,"separator");if(config.separator!==undefined&&typeof config.separator!=='string')throw Error('separator must be text');},
  execute(_ctx,inputs,config){return {trigger:String(inputs.first)+(config.separator as string??',')+String(inputs.second)};}
});
