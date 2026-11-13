import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Render an accessible toolbar containing child components. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_toolbar', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Render an accessible toolbar containing child components.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'children',type:{kind:'array',element:{kind:'ui'}},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {view:ui('spica.ui.ui_toolbar',{children:inputs.children})}; },
});
