import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';
/** Safe bounded JSON parser. Parsing never evaluates code. */
export default defineRuntimeBlock({
  id:'spica.runtime.text_parse_json',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Parse bounded JSON text into structured data with an explicit success/error output.',exampleConfig:{},
  configSchema:{type:'object',properties:{},additionalProperties:false},targets:['desktop','web'],permissions:[],
  inputs:[{id:'text',type:{kind:'string'},required:true}],outputs:[{id:'ok',type:{kind:'boolean'}},{id:'value',type:{kind:'unknown'}},{id:'error',type:{kind:'string'}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){const text=inputs.text as string;if(text.length>100000)throw Error('JSON input exceeds 100 KB');try{return {ok:true,value:JSON.parse(text) as unknown,error:''};}catch{return {ok:false,value:null,error:'Invalid JSON document'};}}
});
