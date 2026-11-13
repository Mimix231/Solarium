import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Compare two JSON values for structural equality. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.value_equal', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Compare two JSON values for structural equality.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'a',type:{kind:'unknown'},required:true}, {id:'b',type:{kind:'unknown'},required:true}], outputs: [{id:'equal',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {equal:JSON.stringify(inputs.a)===JSON.stringify(inputs.b)}; },
});
