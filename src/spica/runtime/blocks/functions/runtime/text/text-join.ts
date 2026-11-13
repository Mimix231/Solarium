import { defineRuntimeBlock } from '../../../../adapter';
import { boundedText, configKeys } from '../../../../support';

/** Join an array of text with a separator. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_join', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Join an array of text with a separator.", exampleConfig: {"separator":", "},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'string'}},required:true}], outputs: [{id:'result',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config,'separator');boundedText(config.separator,'separator',100); },
  execute(_ctx, inputs, config) { return {result:(inputs.items as string[]).join(config.separator as string).slice(0,32000)}; },
});
