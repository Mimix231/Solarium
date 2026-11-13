import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Get last value, or null when the array is empty. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_last', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Get last value, or null when the array is empty.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'value',type:{kind:'unknown'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {value:(inputs.items as unknown[]).at(-1)??null}; },
});
