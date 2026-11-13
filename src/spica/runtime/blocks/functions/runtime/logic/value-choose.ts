import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Select one of two values based on a boolean condition. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.value_choose', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Select one of two values based on a boolean condition.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'condition',type:{kind:'boolean'},required:true}, {id:'yes',type:{kind:'unknown'},required:true}, {id:'no',type:{kind:'unknown'},required:true}], outputs: [{id:'value',type:{kind:'unknown'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {value:inputs.condition?inputs.yes:inputs.no}; },
});
