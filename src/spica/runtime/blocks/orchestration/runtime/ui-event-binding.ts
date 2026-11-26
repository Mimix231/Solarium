import { defineRuntimeBlock } from '../../../adapter';
import { configKeys, safeKey } from '../../../support';
/** Only explicit UI events with exactly this registered ID can trigger downstream work. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_event_binding',version:'1',kind:'event-source',trust:'built-in',category:'orchestration',
  description:'Emit a typed string event only when a preview host delivers the configured UI interaction ID.',
  configSchema:{type:'object',properties:{'eventId': {'type': 'string'}},required:['eventId'],additionalProperties:false},
  exampleConfig:{eventId:'edit_note'},targets:['desktop','web'],permissions:[],
  inputs:[],outputs:[{id:'trigger',type:{kind:'event',payload:{kind:'string'}}}],
  validateConfig(config){configKeys(config,'eventId');safeKey(config.eventId,'eventId');},
  execute(ctx,_inputs,config){const value=ctx.interaction.event(config.eventId as string);return value===undefined?{}:{trigger:value};},
});
