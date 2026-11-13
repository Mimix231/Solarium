import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Format Unix milliseconds using a constrained Intl.DateTimeFormat style. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.date_format', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Format Unix milliseconds using a constrained Intl.DateTimeFormat style.", exampleConfig: {"style":"medium"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'timestamp',type:{kind:'number'},required:true}], outputs: [{id:'formatted',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config,'style');if(!['short','medium','long'].includes(config.style as string))throw Error('style must be short, medium or long'); },
  execute(_ctx, inputs, config) { const value=inputs.timestamp as number;const formatted=new Intl.DateTimeFormat('en-GB',{dateStyle:config.style as 'short'|'medium'|'long',timeZone:'UTC'}).format(new Date(value));return {formatted}; },
});
