import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, plain, asArray } from '../../../../support';

/** Project selected safe record fields into new bounded records, without mutating the original collection. */
export default defineRuntimeBlock({
  id:'spica.runtime.array_project',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Project selected safe record fields into new bounded records, without mutating the original collection.",exampleConfig:{"fields": ["id", "title"]},
  configSchema:{type:'object',properties:{"fields":{type:"array"}},required:["fields"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,"fields");if(!Array.isArray(config.fields)||!config.fields.length||config.fields.length>24)throw Error('fields must contain 1–24 keys');for(const field of config.fields)safeKey(field,'field');},
  execute(_ctx,inputs,config){const fields=config.fields as string[];return {items:asArray(inputs.items).map(item=>plain(item)?Object.fromEntries(fields.filter(field=>Object.hasOwn(item,field)).map(field=>[field,item[field]])):null)};}
});
