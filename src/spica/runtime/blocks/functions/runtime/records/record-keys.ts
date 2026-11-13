import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Extract field names from a record. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_keys', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Extract field names from a record.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'record',type:{kind:'record',fields:{},open:true},required:true}], outputs: [{id:'items',type:{kind:'array',element:{kind:'string'}}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {items:Object.keys(inputs.record as Record<string,unknown>)}; },
});
