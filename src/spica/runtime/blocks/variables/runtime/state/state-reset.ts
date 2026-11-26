import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Reset a named UI-session value when the linked event actually fires. */
export default defineRuntimeBlock({
  id:'spica.runtime.state_reset',version:'1',kind:'effect',trust:'built-in',category:'variables',
  description:"Reset a named UI-session value when the linked event actually fires.",exampleConfig:{"key": "draft", "initial": ""},
  configSchema:{type:'object',properties:{"key":{type:"string"},"initial":{type:"string"}},required:["key"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"trigger",type:{kind:'event',payload:{kind:'string'}},required:true}],outputs:[{id:"value",type:{kind:'string'}}],
  validateConfig(config){configKeys(config,"key","initial");safeKey(config.key,'key');if(config.initial!==undefined&&typeof config.initial!=='string')throw Error('initial must be text');},
  execute(ctx,_inputs,config){const value=String(config.initial??'');ctx.interaction.write(config.key as string,value);return {value};}
});
