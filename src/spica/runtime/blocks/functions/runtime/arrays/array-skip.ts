import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys } from '../../../../support';

/** Skip N elements from an array. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_skip', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Skip N elements from an array.", exampleConfig: {"count":10},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config) { configKeys(config,'count');boundedInteger(config.count,'count'); },
  execute(_ctx, inputs, config) { return {items:(inputs.items as unknown[]).slice(config.count as number)}; },
});
