import { defineRuntimeBlock } from '../../../../adapter';
import { boundedText, configKeys } from '../../../../support';

/** Provide a configurable text constant to a graph. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_value', version: '1', kind: 'pure', trust: 'built-in',
  category: 'variables', description: "Provide a configurable text constant to a graph.", exampleConfig: {"value":"Welcome"},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'value',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config,'value');boundedText(config.value,'value'); },
  execute(_ctx, _inputs, config) { return {value:boundedText(config.value,'value')}; },
});
