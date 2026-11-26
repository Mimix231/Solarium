import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, plain, asArray } from '../../../../support';

/** Filter a linked record array by a dynamic case-insensitive search query. */
export default defineRuntimeBlock({
  id:'spica.runtime.function_filter',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Filter a linked record array by a dynamic case-insensitive search query.",exampleConfig:{"field": "title"},
  configSchema:{type:'object',properties:{"field":{type:"string"}},required:["field"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}},required:true},{id:"query",type:{kind:'string'},required:true}],outputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,"field");safeKey(config.field,'field');},
  execute(_ctx,inputs,config){const q=String(inputs.query).toLocaleLowerCase();return {items:asArray(inputs.items).filter(row=>plain(row)&&String(row[config.field as string]??'').toLocaleLowerCase().includes(q))};}
});
