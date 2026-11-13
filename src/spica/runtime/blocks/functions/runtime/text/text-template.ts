import { defineRuntimeBlock } from '../../../../adapter';
import { asRecord, boundedText, configKeys } from '../../../../support';

/** Format safe named placeholders in a text template without executing code. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_template', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Format safe named placeholders in a text template without executing code.", exampleConfig: {"template":"Hello {name}"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'values',type:{kind:'record',fields:{},open:true},required:true}], outputs: [{id:'result',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config,'template');boundedText(config.template,'template',4000); },
  execute(_ctx, inputs, config) { const values=asRecord(inputs.values);return {result:(config.template as string).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(_,key:string)=>String(values[key]??'')).slice(0,32000)}; },
});
