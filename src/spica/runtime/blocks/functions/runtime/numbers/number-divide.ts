import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Divide numeric values with zero protection. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.number_divide', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Divide numeric values with zero protection.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'a',type:{kind:'number'},required:true}, {id:'b',type:{kind:'number'},required:true}], outputs: [{id:'result',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { const a=inputs.a as number,b=inputs.b as number;const result=a/b;if(!Number.isFinite(result))throw Error('Non-finite arithmetic result.');return {result}; },
});
