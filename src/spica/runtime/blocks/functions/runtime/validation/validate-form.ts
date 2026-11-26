import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, plain } from '../../../../support';

/** Validate a form record against configured primitive field types and return field-specific errors. */
export default defineRuntimeBlock({
  id:'spica.runtime.validate_form',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Validate a form record against configured primitive field types and return field-specific errors.",exampleConfig:{"fields": {"title": "string", "pinned": "boolean"}},
  configSchema:{type:'object',properties:{"fields":{type:"object"}},required:["fields"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"value",type:{kind:'record',fields:{},open:true},required:true}],outputs:[{id:"valid",type:{kind:'boolean'}},{id:"errors",type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,"fields");if(!plain(config.fields)||Object.keys(config.fields).length>32)throw Error('fields must be a bounded object');for(const [k,v] of Object.entries(config.fields)){safeKey(k,'field');if(!['string','boolean','number'].includes(String(v)))throw Error('Unsupported form field type');}},
  execute(_ctx,inputs,config){const data=inputs.value as Record<string,unknown>;const errors=Object.entries(config.fields as Record<string,string>).filter(([key,type])=>!Object.hasOwn(data,key)||typeof data[key]!==type||(type==='number'&&!Number.isFinite(data[key] as number))).map(([key,type])=>`${key}: expected ${type}`);return {valid:errors.length===0,errors};}
});
