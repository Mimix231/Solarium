import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';
/** Semantic navigation breadcrumbs with optional click events. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_breadcrumbs',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Display semantic clickable navigation breadcrumbs.',exampleConfig:{items:['Projects','Notes','Recents'],eventId:'navigate'},
  configSchema:{type:'object',properties:{items:{type:'array',items:{type:'string'}},eventId:{type:'string'}},required:['items'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'items','eventId');if(!Array.isArray(config.items)||!config.items.length||config.items.length>16||config.items.some(item=>typeof item!=='string'||!item.trim()||item.length>80))throw Error('Breadcrumbs require 1–16 labels');if(config.eventId!==undefined)safeKey(config.eventId,'eventId');},
  execute(_ctx,_inputs,config){return {view:ui('spica.ui.ui_breadcrumbs',{items:config.items,eventId:config.eventId})};}
});
