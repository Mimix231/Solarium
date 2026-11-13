import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, finite } from '../../../../support';

/** Provide a finite numeric constant. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.number_value', version: '1', kind: 'pure', trust: 'built-in',
  category: 'variables', description: "Provide a finite numeric constant.", exampleConfig: {"value":42},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'value',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config,'value');finite(config.value,'value'); },
  execute(_ctx, _inputs, config) { return {value:finite(config.value,'value')}; },
});
