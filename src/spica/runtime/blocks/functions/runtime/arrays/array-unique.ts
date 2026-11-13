import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Remove duplicate values using structural JSON equality. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_unique', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Remove duplicate values using structural JSON equality.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { const seen=new Set<string>();return {items:(inputs.items as unknown[]).filter(item=>{const key=JSON.stringify(item);if(seen.has(key))return false;seen.add(key);return true;})}; },
});
