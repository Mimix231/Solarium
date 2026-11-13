import { defineRuntimeBlock } from '../../../../adapter';
import { boundedText, configKeys, nonemptyText } from '../../../../support';

/** Replace literal text (not executable regex). Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_replace', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Replace literal text (not executable regex).", exampleConfig: {"find":"old","replace":"new"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'string'},required:true}], outputs: [{id:'result',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config,'find','replace');nonemptyText(config.find,'find',500);boundedText(config.replace,'replace',500); },
  execute(_ctx, inputs, config) { return {result:(inputs.value as string).split(config.find as string).join(config.replace as string).slice(0,32000)}; },
});
