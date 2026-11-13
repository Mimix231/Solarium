import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Display an accessible text label. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_text', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display an accessible text label.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'text',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {view:ui('spica.ui.ui_text',{text:inputs.text})}; },
});
