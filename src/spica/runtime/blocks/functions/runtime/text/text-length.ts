import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Count UTF-16 code units in text. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_length', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Count UTF-16 code units in text.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'string'},required:true}], outputs: [{id:'length',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {length:(inputs.value as string).length}; },
});
