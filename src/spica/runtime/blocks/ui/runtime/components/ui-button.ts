import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';

/** Display a Material button (event handling is bound by the host). Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_button', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display a Material button (event handling is bound by the host).", exampleConfig: {"variant":"contained"},
  configSchema:{type:'object',properties:{variant:{type:'string',enum:['contained','outlined','text']},eventId:{type:'string'}},required:['variant'],additionalProperties:false},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'label',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'variant','eventId');if(config.eventId!==undefined)safeKey(config.eventId,'eventId');if(!['contained','outlined','text'].includes(config.variant as string))throw Error('variant must be contained, outlined or text'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_button',{label:inputs.label,variant:config.variant,eventId:config.eventId})}; },
});
