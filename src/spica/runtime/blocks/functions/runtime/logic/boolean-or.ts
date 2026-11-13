import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Boolean disjunction. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.boolean_or', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Boolean disjunction.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'a',type:{kind:'boolean'},required:true}, {id:'b',type:{kind:'boolean'},required:true}], outputs: [{id:'value',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {value:(inputs.a as boolean)||(inputs.b as boolean)}; },
});
