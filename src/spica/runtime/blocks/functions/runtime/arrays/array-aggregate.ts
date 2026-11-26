import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, plain, asArray } from '../../../../support';

/** Compute count, sum or average over finite numeric fields in a bounded record array. */
export default defineRuntimeBlock({
  id:'spica.runtime.array_aggregate',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Compute count, sum or average over finite numeric fields in a bounded record array.",exampleConfig:{"field": "amount", "operation": "sum"},
  configSchema:{type:'object',properties:{"field":{type:"string"},"operation":{type:"string"}},required:["field", "operation"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:"value",type:{kind:'number'}},{id:"count",type:{kind:'number'}}],
  validateConfig(config){configKeys(config,"field","operation");safeKey(config.field,'field');if(!['sum','average','count'].includes(String(config.operation)))throw Error('operation must be sum, average or count');},
  execute(_ctx,inputs,config){const rows=asArray(inputs.items);const nums=rows.flatMap(item=>{const value=plain(item)?item[config.field as string]:undefined;return typeof value==='number'&&Number.isFinite(value)?[value]:[];});const count=nums.length;const sum=nums.reduce((a,b)=>a+b,0);return {value:config.operation==='count'?count:config.operation==='average'?(count?sum/count:0):sum,count};}
});
