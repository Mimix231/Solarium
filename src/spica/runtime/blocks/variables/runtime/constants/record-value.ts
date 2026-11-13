import { defineRuntimeBlock } from '../../../../adapter';
import { asRecord, configKeys } from '../../../../support';

/** Provide a configurable data record. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_value', version: '1', kind: 'pure', trust: 'built-in',
  category: 'variables', description: "Provide a configurable data record.", exampleConfig: {"record":{"title":"Demo","updatedAt":123}},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'record',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config,'record');asRecord(config.record); },
  execute(_ctx, _inputs, config) { return {record:asRecord(config.record)}; },
});
