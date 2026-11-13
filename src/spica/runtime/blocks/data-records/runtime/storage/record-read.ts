import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Read one record by collection and key from a permissioned transaction. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_read', version: '1', kind: 'effect', trust: 'built-in',
  category: 'data-records', description: "Read one record by collection and key from a permissioned transaction.", exampleConfig: {"collection":"notes"},
  targets: ['desktop','web'], permissions: ["records.read"],
  inputs: [{id:'key',type:{kind:'string'},required:true}], outputs: [{id:'value',type:{kind:'unknown'}}],
  validateConfig(config) { configKeys(config,'collection');safeKey(config.collection,'collection'); },
  async execute(_ctx, inputs, config) { _ctx.requirePermission('records.read');return {value:(await _ctx.storage.read(config.collection as string,inputs.key as string))??null}; },
});
