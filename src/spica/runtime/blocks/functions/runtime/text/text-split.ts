import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, nonemptyText } from '../../../../support';

/** Split text into a bounded list using a literal separator. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_split', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Split text into a bounded list using a literal separator.", exampleConfig: {"separator":","},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'string'},required:true}], outputs: [{id:'items',type:{kind:'array',element:{kind:'string'}}}],
  validateConfig(config) { configKeys(config,'separator');nonemptyText(config.separator,'separator',100); },
  execute(_ctx, inputs, config) { return {items:(inputs.value as string).split(config.separator as string).slice(0,10000)}; },
});
