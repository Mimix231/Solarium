import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys, ui } from '../../../../support';

/** Arrange views in a responsive row. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.layout_row', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'layout', description: "Arrange views in a responsive row.", exampleConfig: {"spacing":2},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'children',type:{kind:'array',element:{kind:'ui'}},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'spacing');boundedInteger(config.spacing,'spacing',0,8); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_stack',{children:inputs.children,direction:'row',spacing:config.spacing})}; },
});
