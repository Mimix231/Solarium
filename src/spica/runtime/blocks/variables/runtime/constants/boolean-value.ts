import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Provide a boolean constant. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.boolean_value', version: '1', kind: 'pure', trust: 'built-in',
  category: 'variables', description: "Provide a boolean constant.", exampleConfig: {"value":true},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'value',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config,'value');if(typeof config.value!=='boolean')throw Error('value must be boolean'); },
  execute(_ctx, _inputs, config) { return {value:config.value}; },
});
