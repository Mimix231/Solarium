import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys } from '../../../../support';

/** Round a numeric value to decimal places. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.number_round', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Round a numeric value to decimal places.", exampleConfig: {"places":2},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'number'},required:true}], outputs: [{id:'result',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config,'places');boundedInteger(config.places,'places',0,8); },
  execute(_ctx, inputs, config) { const scale=10**(config.places as number);return {result:Math.round((inputs.value as number)*scale)/scale}; },
});
