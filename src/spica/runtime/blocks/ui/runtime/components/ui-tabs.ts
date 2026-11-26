import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';

/** Show tab labels with optional child panel views. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_tabs', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Show tab labels with optional child panel views.", exampleConfig: {},
  configSchema:{type:'object',properties:{eventId:{type:'string'}},additionalProperties:false},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'tabs',type:{kind:'array',element:{kind:'string'}},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'eventId');if(config.eventId!==undefined)safeKey(config.eventId,'eventId'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_tabs',{tabs:inputs.tabs,...(config.eventId?{eventId:config.eventId}:{})})}; },
});
