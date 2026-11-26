import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Render a clear validation error message using the existing safe alert renderer. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_validation_error',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:"Render a clear validation error message using the existing safe alert renderer.",exampleConfig:{},
  configSchema:{type:'object',properties:{},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"message",type:{kind:'string'},required:true}],outputs:[{id:"view",type:{kind:'ui'}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){return {view:ui('spica.ui.ui_alert',{text:inputs.message,severity:'error'})};}
});
