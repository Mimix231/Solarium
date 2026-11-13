import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Count elements in an array. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_length', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Count elements in an array.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'count',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {count:(inputs.items as unknown[]).length}; },
});
