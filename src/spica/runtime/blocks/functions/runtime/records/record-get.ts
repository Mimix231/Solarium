import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Read a property of a record, returning null when absent. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_get', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Read a property of a record, returning null when absent.", exampleConfig: {"key":"title"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'record',type:{kind:'record',fields:{},open:true},required:true}], outputs: [{id:'value',type:{kind:'unknown'}}],
  validateConfig(config) { configKeys(config,'key');safeKey(config.key); },
  execute(_ctx, inputs, config) { return {value:(inputs.record as Record<string,unknown>)[config.key as string]??null}; },
});
