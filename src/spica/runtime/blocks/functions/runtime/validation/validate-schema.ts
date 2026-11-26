import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Validate required record keys and report exactly which keys are absent. */
export default defineRuntimeBlock({
  id:'spica.runtime.validate_schema',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Validate required record keys and report exactly which keys are absent.",exampleConfig:{"requiredKeys": ["id", "title"]},
  configSchema:{type:'object',properties:{"requiredKeys":{type:"array"}},required:["requiredKeys"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"value",type:{kind:'record',fields:{},open:true},required:true}],outputs:[{id:"valid",type:{kind:'boolean'}},{id:"missing",type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,"requiredKeys");if(!Array.isArray(config.requiredKeys)||config.requiredKeys.length>32)throw Error('requiredKeys must be an array of ≤32');for(const k of config.requiredKeys)safeKey(k,'requiredKey');},
  execute(_ctx,inputs,config){const value=inputs.value as Record<string,unknown>;const missing=(config.requiredKeys as string[]).filter(key=>!Object.hasOwn(value,key));return {valid:missing.length===0,missing};}
});
