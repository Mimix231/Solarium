import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Forward a typed event only when it matches the configured exact string. */
export default defineRuntimeBlock({
  id:'spica.runtime.event_filter',version:'1',kind:'pure',trust:'built-in',category:'orchestration',
  description:"Forward a typed event only when it matches the configured exact string.",exampleConfig:{"equals": "save"},
  configSchema:{type:'object',properties:{"equals":{type:"string"}},required:["equals"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"trigger",type:{kind:'event',payload:{kind:'string'}},required:true}],outputs:[{id:"trigger",type:{kind:'event',payload:{kind:'string'}}}],
  validateConfig(config){configKeys(config,"equals");if(typeof config.equals!=='string')throw Error('equals must be text');},
  execute(_ctx,inputs,config){return inputs.trigger===config.equals?{trigger:inputs.trigger}:{};}
});
