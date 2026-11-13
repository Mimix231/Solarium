import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Calculate elapsed milliseconds between two timestamps. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.date_elapsed', version: '1', kind: 'pure', trust: 'built-in',
  category: 'functions', description: "Calculate elapsed milliseconds between two timestamps.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'from',type:{kind:'number'},required:true}, {id:'to',type:{kind:'number'},required:true}], outputs: [{id:'duration',type:{kind:'number'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { return {duration:Math.max(0,(inputs.to as number)-(inputs.from as number))}; },
});
