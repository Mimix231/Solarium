import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Show tab labels with optional child panel views. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_tabs', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Show tab labels with optional child panel views.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'tabs',type:{kind:'array',element:{kind:'string'}},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {view:ui('spica.ui.ui_tabs',{tabs:inputs.tabs})}; },
});
