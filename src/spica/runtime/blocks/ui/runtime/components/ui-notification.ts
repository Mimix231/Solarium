import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';
/** Declarative status UI; never implies that a save or verification succeeded. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_notification',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Display the supplied status text as a nonblocking notification without pretending an operation succeeded.',
  configSchema:{type:'object',properties:{'severity': {'type': 'string', 'enum': ['info', 'success', 'warning', 'error']}},required:[],additionalProperties:false},
  exampleConfig:{severity:'info'},targets:['desktop','web'],permissions:[],
  inputs:[{id:'message',type:{kind:'string'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'severity');if(config.severity!==undefined&&!['info','success','warning','error'].includes(config.severity as string))throw Error('Invalid notification severity.');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_notification',{text:inputs.message,severity:config.severity??'info'})};},
});
