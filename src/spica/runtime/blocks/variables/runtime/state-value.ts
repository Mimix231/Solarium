import { defineRuntimeBlock } from '../../../adapter';
import { configKeys, boundedText, safeKey } from '../../../support';
/** Read a string from this explicitly hosted UI session; never from global app state. */
export default defineRuntimeBlock({
  id:'spica.runtime.state_value',version:'1',kind:'event-source',trust:'built-in',category:'variables',
  description:'Read a named reactive string in the current UI session. Bind its output to an editor, query or selected item.',
  configSchema:{type:'object',properties:{'key': {'type': 'string'}, 'initial': {'type': 'string', 'maxLength': 32000}},required:['key'],additionalProperties:false},
  exampleConfig:{key:'draft',initial:''},targets:['desktop','web'],permissions:[],
  inputs:[],outputs:[{id:'value',type:{kind:'string'}}],
  validateConfig(config){configKeys(config,'key','initial');safeKey(config.key,'key');if(config.initial!==undefined)boundedText(config.initial,'initial');},
  execute(ctx,_inputs,config){return {value:ctx.interaction.read(config.key as string)??(config.initial as string??'')};},
});
