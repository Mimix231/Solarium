import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, nonemptyText, ui } from '../../../../support';

/** Render a named window or surface holding one view. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_surface', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Render a named window or surface holding one view.", exampleConfig: {"title":"Workspace"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'child',type:{kind:'ui'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'title');nonemptyText(config.title,'title',120); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_surface',{child:inputs.child,title:config.title})}; },
});
