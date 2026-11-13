import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys } from '../../../../support';

/** Provide heading and body type scale tokens. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.font_scale', version: '1', kind: 'pure', trust: 'built-in',
  category: 'styling', description: "Provide heading and body type scale tokens.", exampleConfig: {"base":14},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'scale',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config,'base');boundedInteger(config.base,'base',10,24); },
  execute(_ctx, _inputs, config) { const body=config.base as number;return {scale:{caption:body*.8,body,subtitle:body*1.2,heading:body*1.8}}; },
});
