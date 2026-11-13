import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Reverse an array without modifying the source. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_reverse', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Reverse an array without modifying the source.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {items:[...(inputs.items as unknown[])].reverse()}; },
});
