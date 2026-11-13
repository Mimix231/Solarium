import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';

/** Show object data as a Material table. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_data_table', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Show object data as a Material table.", exampleConfig: {"columns":["title","updatedAt"]},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'columns');if(!Array.isArray(config.columns)||!config.columns.length||config.columns.length>12)throw Error('columns needs 1–12 keys');config.columns.forEach(v=>safeKey(v)); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_data_table',{items:inputs.items,columns:config.columns})}; },
});
