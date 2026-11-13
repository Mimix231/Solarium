import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Parse an ISO-8601 datetime string into Unix milliseconds. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.date_parse', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Parse an ISO-8601 datetime string into Unix milliseconds.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'string'},required:true}], outputs: [{id:'timestamp',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { const timestamp=Date.parse(inputs.value as string);if(!Number.isFinite(timestamp))throw Error('Invalid ISO date');return {timestamp}; },
});
