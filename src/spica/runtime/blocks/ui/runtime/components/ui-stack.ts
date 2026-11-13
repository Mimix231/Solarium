import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys, ui } from '../../../../support';

/** Arrange child views vertically or horizontally. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_stack', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Arrange child views vertically or horizontally.", exampleConfig: {"direction":"column","spacing":2},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'children',type:{kind:'array',element:{kind:'ui'}},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'direction','spacing');if(!['row','column'].includes(config.direction as string))throw Error('direction must be row or column');boundedInteger(config.spacing,'spacing',0,8); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_stack',{children:inputs.children,direction:config.direction,spacing:config.spacing})}; },
});
