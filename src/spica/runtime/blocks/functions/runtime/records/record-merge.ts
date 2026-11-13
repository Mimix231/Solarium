import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Merge two records immutably. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_merge', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Merge two records immutably.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'left',type:{kind:'record',fields:{},open:true},required:true}, {id:'right',type:{kind:'record',fields:{},open:true},required:true}], outputs: [{id:'record',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {record:{...(inputs.left as Record<string,unknown>),...(inputs.right as Record<string,unknown>)}}; },
});
