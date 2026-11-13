import { defineRuntimeBlock } from '../../../../adapter';
import { boundedText, configKeys, ui } from '../../../../support';

/** Display a raised Material surface around one child view. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_card', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display a raised Material surface around one child view.", exampleConfig: {"title":"Card"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'child',type:{kind:'ui'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'title');if(config.title!==undefined)boundedText(config.title,'title',120); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_card',{child:inputs.child,title:config.title})}; },
});
