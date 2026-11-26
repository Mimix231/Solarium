import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';

/** Display a labeled Material checkbox. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_checkbox', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display a labeled Material checkbox.", exampleConfig: {"checked":false},
  configSchema:{type:'object',properties:{checked:{type:'boolean'},eventId:{type:'string'}},required:['checked'],additionalProperties:false},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'label',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'checked','eventId');if(typeof config.checked!=='boolean')throw Error('checked must be boolean');if(config.eventId!==undefined)safeKey(config.eventId,'eventId'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_checkbox',{label:inputs.label,checked:config.checked,...(config.eventId?{eventId:config.eventId}:{})})}; },
});
