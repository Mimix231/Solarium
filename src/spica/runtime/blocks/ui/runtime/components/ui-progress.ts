import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Display a bounded progress bar. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_progress', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display a bounded progress bar.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'number'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {view:ui('spica.ui.ui_progress',{value:Math.max(0,Math.min(100,inputs.value as number))})}; },
});
