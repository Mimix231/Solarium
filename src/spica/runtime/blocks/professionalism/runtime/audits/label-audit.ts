import { defineRuntimeBlock } from '../../../../adapter';
import { asRecord, configKeys } from '../../../../support';

/** Check a UI descriptor has an accessible label or text. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.label_audit', version: '1', kind: 'pure', trust: 'built-in',
  category: 'professionalism', description: "Check a UI descriptor has an accessible label or text.", exampleConfig: {},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'view',type:{kind:'ui'},required:true}], outputs: [{id:'valid',type:{kind:'boolean'}}, {id:'diagnostic',type:{kind:'string'}}],
  validateConfig(config) { configKeys(config); },
  execute(_ctx, inputs, _config) { const view=asRecord(inputs.view);const valid=Object.values(view).some(value=>typeof value==='string'&&value.trim().length>0&&value!==view.renderer);return {valid,diagnostic:valid?'Accessible text present':'View needs visible text or an accessible label'}; },
});
