import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Check whether text ends with a suffix. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_ends_with', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Check whether text ends with a suffix.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'string'},required:true}, {id:'query',type:{kind:'string'},required:true}], outputs: [{id:'matched',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {matched:(inputs.value as string).endsWith(inputs.query as string)}; },
});
