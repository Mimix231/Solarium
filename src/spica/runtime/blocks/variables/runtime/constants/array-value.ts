import { defineRuntimeBlock } from '../../../../adapter';
import { asArray, configKeys } from '../../../../support';

/** Provide an immutable array constant of JSON values. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_value', version: '1', kind: 'pure', trust: 'built-in',
  category: 'variables', description: "Provide an immutable array constant of JSON values.", exampleConfig: {"items":["first","second"]},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config) { configKeys(config,'items');asArray(config.items); },
  execute(_ctx, _inputs, config) { return {items:asArray(config.items)}; },
});
