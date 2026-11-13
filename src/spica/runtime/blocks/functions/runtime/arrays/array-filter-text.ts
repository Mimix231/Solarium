import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, plain, safeKey } from '../../../../support';

/** Search string values or a named record field, case-insensitively. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_filter_text', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Search string values or a named record field, case-insensitively.", exampleConfig: {"field":"title"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}, {id:'query',type:{kind:'string'},required:true}], outputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config) { configKeys(config,'field');if(config.field!==undefined)safeKey(config.field,'field'); },
  execute(_ctx, inputs, config) { const field=config.field as string|undefined,query=(inputs.query as string).toLocaleLowerCase();return {items:(inputs.items as unknown[]).filter(item=>String(field&&plain(item)?item[field]??'':typeof item==='string'?item:'').toLocaleLowerCase().includes(query))}; },
});
