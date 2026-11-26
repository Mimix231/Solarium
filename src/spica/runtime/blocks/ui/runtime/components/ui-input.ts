import { defineRuntimeBlock } from '../../../../adapter';
import { boundedText, configKeys, safeKey, ui } from '../../../../support';

/** Display a labeled Material text field. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_input', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display a labeled Material text field.", exampleConfig: {"value":"","multiline":false},
  configSchema:{type:'object',properties:{value:{type:'string',maxLength:16000},multiline:{type:'boolean'},eventId:{type:'string'}},required:['value'],additionalProperties:false},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'label',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'value','multiline','eventId');if(config.eventId!==undefined)safeKey(config.eventId,'eventId');boundedText(config.value,'value',16000);if(config.multiline!==undefined&&typeof config.multiline!=='boolean')throw Error('multiline must be boolean'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_input',{label:inputs.label,value:config.value,multiline:config.multiline,eventId:config.eventId})}; },
});
