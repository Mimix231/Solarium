import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Stage one record for atomic transaction commit. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_write', version: '1', kind: 'effect', trust: 'built-in',
  category: 'data-records', description: "Stage one record for atomic transaction commit.", exampleConfig: {"collection":"notes"},
  targets: ['desktop','web'], permissions: ["records.write"],
  inputs: [{id:'key',type:{kind:'string'},required:true}, {id:'value',type:{kind:'unknown'},required:true}], outputs: [{id:'saved',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config,'collection');safeKey(config.collection,'collection'); },
  async execute(_ctx, inputs, config) { _ctx.requirePermission('records.write');await _ctx.storage.put(config.collection as string,inputs.key as string,inputs.value);return {saved:true}; },
});
