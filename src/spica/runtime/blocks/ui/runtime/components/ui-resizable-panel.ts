import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys, ui } from '../../../../support';
/** Resizable panel using native CSS resize; no external drag library. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_resizable_panel',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Display child UI in a horizontally resizable panel with bounded width.',exampleConfig:{minWidth:220,maxWidth:720},
  configSchema:{type:'object',properties:{minWidth:{type:'integer'},maxWidth:{type:'integer'}},required:['minWidth','maxWidth'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'child',type:{kind:'ui'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'minWidth','maxWidth');const min=boundedInteger(config.minWidth,'minWidth',100,1600),max=boundedInteger(config.maxWidth,'maxWidth',100,2000);if(min>max)throw Error('minWidth cannot exceed maxWidth');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_resizable_panel',{child:inputs.child,minWidth:config.minWidth,maxWidth:config.maxWidth})};}
});
