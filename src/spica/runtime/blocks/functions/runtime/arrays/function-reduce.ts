import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, asArray } from '../../../../support';

/** Reduce a bounded list of finite numbers using sum, product, minimum or maximum. */
export default defineRuntimeBlock({
  id:'spica.runtime.function_reduce',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Reduce a bounded list of finite numbers using sum, product, minimum or maximum.",exampleConfig:{"operation": "sum"},
  configSchema:{type:'object',properties:{"operation":{type:"string"}},required:["operation"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:"value",type:{kind:'number'}}],
  validateConfig(config){configKeys(config,"operation");if(!['sum','product','min','max'].includes(String(config.operation)))throw Error('Unknown reducer');},
  execute(_ctx,inputs,config){const items=asArray(inputs.items);if(!items.every(x=>typeof x==='number'&&Number.isFinite(x)))throw Error('Reducer requires finite numbers');const nums=items as number[];const result=config.operation==='sum'?nums.reduce((a,b)=>a+b,0):config.operation==='product'?nums.reduce((a,b)=>a*b,1):config.operation==='min'?(nums.length?Math.min(...nums):0):(nums.length?Math.max(...nums):0);if(!Number.isFinite(result))throw Error('Reducer overflow');return {value:result};}
});
