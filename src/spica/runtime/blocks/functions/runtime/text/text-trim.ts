import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Trim whitespace from the beginning and end of text. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_trim', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Trim whitespace from the beginning and end of text.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'string'},required:true}], outputs: [{id:'result',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {result: (inputs.value as string).trim()}; },
});
