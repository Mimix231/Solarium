import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Display an accessible status or warning message. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_alert', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Display an accessible status or warning message.", exampleConfig: {"severity":"info"},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'text',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'severity');if(!['info','success','warning','error'].includes(config.severity as string))throw Error('severity required'); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_alert',{text:inputs.text,severity:config.severity})}; },
});
