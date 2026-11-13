import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Negate a boolean. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.boolean_not', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Negate a boolean.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'boolean'},required:true}], outputs: [{id:'result',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {result:!inputs.value}; },
});
