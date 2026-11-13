import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Provide a validated color palette token set. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.color_palette', version: '1', kind: 'pure', trust: 'built-in',
  category: 'styling', description: "Provide a validated color palette token set.", exampleConfig: {"primary":"#74dfd1","surface":"#192c45","text":"#ffffff"},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'palette',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config,'primary','surface','text');for(const color of [config.primary,config.surface,config.text])if(typeof color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(color))throw Error('Colors must be #RRGGBB'); },
  execute(_ctx, _inputs, config) { return {palette:{primary:config.primary,surface:config.surface,text:config.text}}; },
});
