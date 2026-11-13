import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Render untrusted Markdown as text safely; raw HTML is never evaluated. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_markdown', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Render untrusted Markdown as text safely; raw HTML is never evaluated.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'text',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {view:ui('spica.ui.ui_markdown',{text:inputs.text})}; },
});
