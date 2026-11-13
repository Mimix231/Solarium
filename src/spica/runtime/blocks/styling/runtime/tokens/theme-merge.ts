import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Merge visual token dictionaries without mutating originals. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.theme_merge', version: '1', kind: 'pure', trust: 'built-in',
  category: 'styling', description: "Merge visual token dictionaries without mutating originals.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'base',type:{kind:'record',fields:{},open:true},required:true}, {id:'override',type:{kind:'record',fields:{},open:true},required:true}], outputs: [{id:'tokens',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {tokens:{...(inputs.base as Record<string,unknown>),...(inputs.override as Record<string,unknown>)}}; },
});
