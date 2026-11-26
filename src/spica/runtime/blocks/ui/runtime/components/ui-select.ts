import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';

/** Display a Material select from provided string options. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_select', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display a Material select from provided string options.", exampleConfig: {"options":["All","Pinned"],"value":"All"},
  configSchema:{type:'object',properties:{options:{type:'array',items:{type:'string'}},value:{type:'string'},eventId:{type:'string'}},
    required:['options','value'],additionalProperties:false},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'label',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'options','value','eventId');if(!Array.isArray(config.options)||!config.options.length||config.options.length>100||config.options.some(item=>typeof item!=='string'))throw Error('options must contain 1–100 strings');if(typeof config.value!=='string'||!config.options.includes(config.value))throw Error('value must be one of the options');if(config.eventId!==undefined)safeKey(config.eventId,'eventId'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_select',{label:inputs.label,options:config.options,value:config.value,...(config.eventId?{eventId:config.eventId}:{})})}; },
});
