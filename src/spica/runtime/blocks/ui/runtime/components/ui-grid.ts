import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys, ui } from '../../../../support';

/** Arrange child views in responsive columns. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_grid', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Arrange child views in responsive columns.", exampleConfig: {"columns":2},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'children',type:{kind:'array',element:{kind:'ui'}},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'columns');boundedInteger(config.columns,'columns',1,12); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_grid',{children:inputs.children,columns:config.columns})}; },
});
