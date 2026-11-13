import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';

/** Show a bounded list of data items as Material list rows. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_list', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Show a bounded list of data items as Material list rows.", exampleConfig: {"labelField":"title"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'labelField');if(config.labelField!==undefined)safeKey(config.labelField,'labelField'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_list',{items:inputs.items,labelField:config.labelField})}; },
});
