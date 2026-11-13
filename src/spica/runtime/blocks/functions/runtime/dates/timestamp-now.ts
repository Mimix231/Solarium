import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Read current Unix time in milliseconds (time-dependent value). Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.timestamp_now', version: '1', kind: 'event-source', trust: 'built-in',
  category: 'functions', description: "Read current Unix time in milliseconds (time-dependent value).", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'timestamp',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, _inputs, _config) { return {timestamp:Date.now()}; },
});
