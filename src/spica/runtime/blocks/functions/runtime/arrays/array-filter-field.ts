import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, plain, safeKey } from '../../../../support';

/** Keep records whose selected field matches a chosen value. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_filter_field', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Keep records whose selected field matches a chosen value.", exampleConfig: {"field":"pinned","equals":true},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config) { configKeys(config,'field','equals');safeKey(config.field,'field');if(config.equals===undefined)throw Error('equals is required'); },
  execute(_ctx, inputs, config) { const field=config.field as string;return {items:(inputs.items as unknown[]).filter(item=>plain(item)&&JSON.stringify(item[field])===JSON.stringify(config.equals))}; },
});
