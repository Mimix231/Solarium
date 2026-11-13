import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Display a Material typography heading. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_heading', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display a Material typography heading.", exampleConfig: {"level":2},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'text',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'level');if(![1,2,3,4,5,6].includes(config.level as number))throw Error('level must be 1–6'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_heading',{text:inputs.text,level:config.level})}; },
});
