import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, plain, safeKey } from '../../../../support';

/** Group records by a selected field into a dictionary. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.array_group_field', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Group records by a selected field into a dictionary.", exampleConfig: {"field":"category"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}], outputs: [{id:'groups',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config,'field');safeKey(config.field,'field'); },
  execute(_ctx, inputs, config) { const groups:Record<string,unknown[]>={};for(const item of inputs.items as unknown[]){const k=String(plain(item)?item[config.field as string]??'unknown':'unknown').slice(0,100);const key=['__proto__','constructor','prototype'].includes(k)?'other':k;(groups[key]??=[]).push(item)}return {groups}; },
});
