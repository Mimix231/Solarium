import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, plain } from '../../../../support';

/** Validate a linked runtime value against a configured JSON primitive type. */
export default defineRuntimeBlock({
  id:'spica.runtime.validate_value',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Validate a linked runtime value against a configured JSON primitive type.",exampleConfig:{"type": "string"},
  configSchema:{type:'object',properties:{"type":{type:"string"}},required:["type"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"value",type:{kind:'unknown'},required:true}],outputs:[{id:"valid",type:{kind:'boolean'}},{id:"message",type:{kind:'string'}}],
  validateConfig(config){configKeys(config,"type");if(!['string','number','boolean','object','array','null'].includes(String(config.type)))throw Error('Unsupported JSON type');},
  execute(_ctx,inputs,config){const value=inputs.value;const valid=config.type==='null'?value===null:config.type==='array'?Array.isArray(value):config.type==='object'?plain(value):typeof value===config.type&&(config.type!=='number'||Number.isFinite(value));return {valid,message:valid?'Valid value':`Expected ${config.type}`};}
});
