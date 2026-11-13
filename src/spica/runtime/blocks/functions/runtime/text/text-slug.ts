import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Convert text to a safe human-readable URL slug. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_slug', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Convert text to a safe human-readable URL slug.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'string'},required:true}], outputs: [{id:'result',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {result: (inputs.value as string).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,240)}; },
});
