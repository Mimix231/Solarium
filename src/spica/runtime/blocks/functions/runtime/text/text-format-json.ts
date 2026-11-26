import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys } from '../../../../support';
/** JSON.stringify data with stable escaping and explicit size limit. */
export default defineRuntimeBlock({
  id:'spica.runtime.text_format_json',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Format a structured value into bounded JSON text without executing its contents.',exampleConfig:{indent:2},
  configSchema:{type:'object',properties:{indent:{type:'integer'}},additionalProperties:false},targets:['desktop','web'],permissions:[],
  inputs:[{id:'value',type:{kind:'unknown'},required:true}],outputs:[{id:'text',type:{kind:'string'}}],
  validateConfig(config){configKeys(config,'indent');if(config.indent!==undefined)boundedInteger(config.indent,'indent',0,4);},
  execute(_ctx,inputs,config){const value=JSON.stringify(inputs.value,null,(config.indent as number|undefined)??0);if(value===undefined||value.length>100000)throw Error('JSON output is missing or exceeds 100 KB');return {text:value};}
});
