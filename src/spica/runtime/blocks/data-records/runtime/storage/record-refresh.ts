import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';
/** Explicit refresh event, used to request a new transaction-backed list query. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_refresh',version:'1',kind:'event-source',trust:'built-in',category:'data-records',
  description:'Emit a refresh event only after the matching UI event. Rerunning a query still requires records.read permission.',
  configSchema:{type:'object',properties:{'eventId': {'type': 'string'}},required:['eventId'],additionalProperties:false},
  exampleConfig:{eventId:'refresh_notes'},targets:['desktop','web'],permissions:[],
  inputs:[],outputs:[{id:'trigger',type:{kind:'event',payload:{kind:'string'}}}],
  validateConfig(config){configKeys(config,'eventId');safeKey(config.eventId,'eventId');},
  execute(ctx,_inputs,config){const value=ctx.interaction.event(config.eventId as string);return value===undefined?{}:{trigger:value};},
});
