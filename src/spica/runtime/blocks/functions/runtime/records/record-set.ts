import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Return a record with one field updated (no in-place mutation). Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_set', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Return a record with one field updated (no in-place mutation).", exampleConfig: {"key":"title"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'record',type:{kind:'record',fields:{},open:true},required:true}, {id:'value',type:{kind:'unknown'},required:true}], outputs: [{id:'record',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config,'key');safeKey(config.key); },
  execute(_ctx, inputs, config) { return {record:{...(inputs.record as Record<string,unknown>),[config.key as string]:inputs.value}}; },
});
