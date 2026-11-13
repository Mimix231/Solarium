import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys } from '../../../../support';

/** Generate spacing values on a consistent base unit. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.spacing_scale', version: '1', kind: 'pure', trust: 'built-in',
  category: 'styling', description: "Generate spacing values on a consistent base unit.", exampleConfig: {"base":8},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'scale',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config) { configKeys(config,'base');boundedInteger(config.base,'base',2,24); },
  execute(_ctx, _inputs, config) { const base=config.base as number;return {scale:{xs:base/2,sm:base,md:base*2,lg:base*3,xl:base*4}}; },
});
