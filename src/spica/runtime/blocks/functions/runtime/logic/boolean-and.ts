import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Boolean conjunction. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.boolean_and', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Boolean conjunction.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'a',type:{kind:'boolean'},required:true}, {id:'b',type:{kind:'boolean'},required:true}], outputs: [{id:'value',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {value:(inputs.a as boolean)&&(inputs.b as boolean)}; },
});
