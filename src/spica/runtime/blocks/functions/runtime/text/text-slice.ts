import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys } from '../../../../support';

/** Extract a bounded text substring. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.text_slice', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Extract a bounded text substring.", exampleConfig: {"start":0,"end":30},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'value',type:{kind:'string'},required:true}], outputs: [{id:'result',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config,'start','end');boundedInteger(config.start,'start',0,32000);boundedInteger(config.end,'end',0,32000); },
  execute(_ctx, inputs, config) { return {result:(inputs.value as string).slice(config.start as number,config.end as number)}; },
});
