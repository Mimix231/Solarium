import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Select the larger numeric input. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.number_max', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Select the larger numeric input.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'a',type:{kind:'number'},required:true}, {id:'b',type:{kind:'number'},required:true}], outputs: [{id:'result',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { const a=inputs.a as number,b=inputs.b as number;const result=Math.max(a,b);if(!Number.isFinite(result))throw Error('Non-finite arithmetic result.');return {result}; },
});
