import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Show a descriptive empty state for an empty list. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_empty_state', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Show a descriptive empty state for an empty list.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'text',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {view:ui('spica.ui.ui_empty_state',{text:inputs.text})}; },
});
