import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, nonemptyText, ui } from '../../../../support';

/** Reusable live-preview Markdown editor with independently managed host input. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_markdown_editor', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Reusable live-preview Markdown editor with independently managed host input.", exampleConfig: {"label":"Body"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'text',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'label');nonemptyText(config.label,'label',100); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_markdown_editor',{text:inputs.text,label:config.label})}; },
});
