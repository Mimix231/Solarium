import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Display a Material select from provided string options. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_select', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display a Material select from provided string options.", exampleConfig: {"options":["All","Pinned"],"value":"All"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'label',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'options','value');if(!Array.isArray(config.options)||!config.options.length||config.options.length>100||config.options.some(item=>typeof item!=='string'))throw Error('options must contain 1–100 strings');if(typeof config.value!=='string'||!config.options.includes(config.value))throw Error('value must be one of the options'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_select',{label:inputs.label,options:config.options,value:config.value})}; },
});
