import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Render a visual divider. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_divider', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Render a visual divider.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, _inputs, _config) { return {view:ui('spica.ui.ui_divider',{})}; },
});
