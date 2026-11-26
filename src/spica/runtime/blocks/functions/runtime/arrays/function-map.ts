import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, plain, asArray } from '../../../../support';

/** Map a bounded record array into a list of values from one configured field. */
export default defineRuntimeBlock({
  id:'spica.runtime.function_map',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Map a bounded record array into a list of values from one configured field.",exampleConfig:{"field": "title"},
  configSchema:{type:'object',properties:{"field":{type:"string"}},required:["field"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,"field");safeKey(config.field,'field');},
  execute(_ctx,inputs,config){return {items:asArray(inputs.items).map(row=>plain(row)?row[config.field as string]??null:null)};}
});
