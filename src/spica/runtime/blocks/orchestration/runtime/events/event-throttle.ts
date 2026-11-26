import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, boundedInteger } from '../../../../support';

/** Limit repeated host-supplied events by an interval persisted only in the UI interaction session. */
export default defineRuntimeBlock({
  id:'spica.runtime.event_throttle',version:'1',kind:'effect',trust:'built-in',category:'orchestration',
  description:"Limit repeated host-supplied events by an interval persisted only in the UI interaction session.",exampleConfig:{"key": "saveThrottle", "intervalMs": 250},
  configSchema:{type:'object',properties:{"key":{type:"string"},"intervalMs":{type:"number"}},required:["key", "intervalMs"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"trigger",type:{kind:'event',payload:{kind:'string'}},required:true}],outputs:[{id:"trigger",type:{kind:'event',payload:{kind:'string'}}}],
  validateConfig(config){configKeys(config,"key","intervalMs");safeKey(config.key,'key');boundedInteger(config.intervalMs,'intervalMs',0,60000);},
  execute(ctx,inputs,config){const last=Number(ctx.interaction.read(config.key as string)??0);const now=Date.now();if(last&&now-last<(config.intervalMs as number))return {};ctx.interaction.write(config.key as string,String(now));return {trigger:inputs.trigger};}
});
