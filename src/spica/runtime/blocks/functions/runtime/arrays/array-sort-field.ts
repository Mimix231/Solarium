import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, plain, safeKey } from '../../../../support';

/** Sort records by a selected field, newest or oldest first. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_sort_field', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Sort records by a selected field, newest or oldest first.", exampleConfig: {"field":"updatedAt","descending":true},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config) { configKeys(config,'field','descending');safeKey(config.field,'field');if(config.descending!==undefined&&typeof config.descending!=='boolean')throw Error('descending must be boolean'); },
  execute(_ctx, inputs, config) { const key=config.field as string, desc=config.descending===true;const items=[...(inputs.items as unknown[])];items.sort((a,b)=>{const x=plain(a)?a[key]:null,y=plain(b)?b[key]:null;const cmp=typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''));return desc?-cmp:cmp});return {items}; },
});
