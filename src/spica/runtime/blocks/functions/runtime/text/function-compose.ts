import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Apply a configured ordered sequence of safe text transforms to a value. */
export default defineRuntimeBlock({
  id:'spica.runtime.function_compose',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Apply a configured ordered sequence of safe text transforms to a value.",exampleConfig:{"steps": ["trim", "lower"]},
  configSchema:{type:'object',properties:{"steps":{type:"array"}},required:["steps"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"value",type:{kind:'string'},required:true}],outputs:[{id:"value",type:{kind:'string'}}],
  validateConfig(config){configKeys(config,"steps");if(!Array.isArray(config.steps)||!config.steps.length||config.steps.length>8||!config.steps.every(s=>['trim','lower','upper','slug'].includes(s)))throw Error('steps must be 1–8 known transforms');},
  execute(_ctx,inputs,config){let value=String(inputs.value);for(const step of config.steps as string[])value=step==='trim'?value.trim():step==='lower'?value.toLocaleLowerCase():step==='upper'?value.toLocaleUpperCase():value.toLocaleLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return {value};}
});
