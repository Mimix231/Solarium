import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';
/** Right-click context menu; emits only the user-selected option event. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_context_menu',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Interactive context menu bound to a child element; dispatches an approved UI event when an option is selected.',
  exampleConfig:{options:['Open','Rename','Delete'],eventId:'menu_action'},
  configSchema:{type:'object',properties:{options:{type:'array',items:{type:'string'}},eventId:{type:'string'}},required:['options','eventId'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'child',type:{kind:'ui'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'options','eventId');safeKey(config.eventId,'eventId');if(!Array.isArray(config.options)||config.options.length<1||config.options.length>16||config.options.some(item=>typeof item!=='string'||!item.trim()||item.length>80))throw Error('options requires 1–16 option labels');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_context_menu',{child:inputs.child,options:config.options,eventId:config.eventId})};}
});
