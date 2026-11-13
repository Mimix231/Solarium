import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Use fallback configuration when a value is null. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.fallback_value', version: '1', kind: 'pure', trust: 'built-in',
  category: 'variables', description: "Use fallback configuration when a value is null.", exampleConfig: {"fallback":"No value"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'unknown'},required:true}], outputs: [{id:'value',type:{kind:'unknown'}}],
  validateConfig(config) { configKeys(config,'fallback'); if(config.fallback===undefined)throw Error('fallback is required'); },
  execute(_ctx, inputs, config) { return {value: inputs.value === null ? config.fallback : inputs.value}; },
});
