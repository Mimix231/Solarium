import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Read current state and emit a change event only for an explicit host change event ID. */
export default defineRuntimeBlock({
  id:'spica.runtime.state_subscribe',version:'1',kind:'event-source',trust:'built-in',category:'variables',
  description:"Read current state and emit a change event only for an explicit host change event ID.",exampleConfig:{"key": "draft", "eventId": "draft_changed"},
  configSchema:{type:'object',properties:{"key":{type:"string"},"eventId":{type:"string"}},required:["key", "eventId"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[],outputs:[{id:"value",type:{kind:'string'}},{id:"changed",type:{kind:'event',payload:{kind:'string'}}}],
  validateConfig(config){configKeys(config,"key","eventId");safeKey(config.key,'key');safeKey(config.eventId,'eventId');},
  execute(ctx,_inputs,config){const change=ctx.interaction.event(config.eventId as string);return {value:ctx.interaction.read(config.key as string)??'',...(change===undefined?{}:{changed:change})};}
});
