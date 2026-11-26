import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Derive a reusable string by joining two linked string values. */
export default defineRuntimeBlock({
  id:'spica.runtime.state_derive',version:'1',kind:'pure',trust:'built-in',category:'variables',
  description:"Derive a reusable string by joining two linked string values.",exampleConfig:{"separator": " "},
  configSchema:{type:'object',properties:{"separator":{type:"string"}},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"left",type:{kind:'string'},required:true},{id:"right",type:{kind:'string'},required:true}],outputs:[{id:"value",type:{kind:'string'}}],
  validateConfig(config){configKeys(config,"separator");if(config.separator!==undefined&&typeof config.separator!=='string')throw Error('separator must be text');},
  execute(_ctx,inputs,config){return {value:String(inputs.left)+(config.separator as string??'')+String(inputs.right)};}
});
