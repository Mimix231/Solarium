import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, finite } from '../../../../support';

/** Clamp a value to inclusive configuration bounds. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.number_clamp', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Clamp a value to inclusive configuration bounds.", exampleConfig: {"min":0,"max":100},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'number'},required:true}], outputs: [{id:'result',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config,'min','max');finite(config.min,'min');finite(config.max,'max');if((config.min as number)>(config.max as number))throw Error('min must not exceed max'); },
  execute(_ctx, inputs, config) { return {result:Math.max(config.min as number,Math.min(config.max as number,inputs.value as number))}; },
});
