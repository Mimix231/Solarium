import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, plain } from '../../../../support';

/** Detect empty strings, arrays, null and empty records. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.value_is_empty', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Detect empty strings, arrays, null and empty records.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'unknown'},required:true}], outputs: [{id:'empty',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { const v=inputs.value;return {empty:v===null||(typeof v==='string'&&v.length===0)||(Array.isArray(v)&&v.length===0)||(plain(v)&&Object.keys(v).length===0)}; },
});
