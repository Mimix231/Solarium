import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Compare two numeric values. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.number_compare', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Compare two numeric values.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'a',type:{kind:'number'},required:true}, {id:'b',type:{kind:'number'},required:true}], outputs: [{id:'greater',type:{kind:'boolean'}}, {id:'equal',type:{kind:'boolean'}}, {id:'less',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { const a=inputs.a as number,b=inputs.b as number;return {greater:a>b,equal:a===b,less:a<b}; },
});
