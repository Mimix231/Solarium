import { defineRuntimeBlock } from '../../../../adapter';
import { asArray, boundedInteger, configKeys } from '../../../../support';
/** Split an array into stable groups with a bounded chunk size. */
export default defineRuntimeBlock({
  id:'spica.runtime.array_chunk',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Split an array into sequential chunks of a configured maximum size.',exampleConfig:{size:10},
  configSchema:{type:'object',properties:{size:{type:'integer'}},required:['size'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:'chunks',type:{kind:'array',element:{kind:'array',element:{kind:'unknown'}}}}],
  validateConfig(config){configKeys(config,'size');boundedInteger(config.size,'size',1,1000);},
  execute(_ctx,inputs,config){const items=asArray(inputs.items),size=config.size as number;const chunks:unknown[][]=[];for(let i=0;i<items.length;i+=size)chunks.push(items.slice(i,i+size));return {chunks};}
});
