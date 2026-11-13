import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Build a record containing only configured fields. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.record_pick', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Build a record containing only configured fields.", exampleConfig: {"fields":["title","body"]},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'record',type:{kind:'record',fields:{},open:true},required:true}], outputs: [{id:'record',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config,'fields');if(!Array.isArray(config.fields)||config.fields.length>32||!config.fields.length)throw Error('fields must be 1–32 field keys');config.fields.forEach(k=>safeKey(k)); },
  execute(_ctx, inputs, config) { const source=inputs.record as Record<string,unknown>;const result:Record<string,unknown>={};for(const key of config.fields as string[])if(Object.hasOwn(source,key))result[key]=source[key];return {record:result}; },
});
