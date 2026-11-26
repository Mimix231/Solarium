import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';
/** Bounded keyboard shortcut for user action only; never arbitrary JS. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_keyboard_shortcut',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Send a named UI event on an explicit Ctrl/Meta + key shortcut when this component is mounted.',exampleConfig:{key:'k',modifier:'ctrl',eventId:'search_focus'},
  configSchema:{type:'object',properties:{key:{type:'string'},modifier:{type:'string',enum:['ctrl','meta','alt']},eventId:{type:'string'}},required:['key','modifier','eventId'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'child',type:{kind:'ui'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'key','modifier','eventId');if(typeof config.key!=='string'||! /^[a-z0-9]$/.test(config.key))throw Error('Shortcut key must be one lowercase letter or digit');if(!['ctrl','meta','alt'].includes(String(config.modifier)))throw Error('Invalid modifier');safeKey(config.eventId,'eventId');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_keyboard_shortcut',{child:inputs.child,key:config.key,modifier:config.modifier,eventId:config.eventId})};}
});
