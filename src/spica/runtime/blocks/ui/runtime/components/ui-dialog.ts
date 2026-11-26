import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, nonemptyText, ui } from '../../../../support';

/** Display a titled accessible modal dialog containing a linked child UI and explicit close event. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_dialog',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:"Display a titled accessible modal dialog containing a linked child UI and explicit close event.",exampleConfig:{"title": "Edit note", "eventId": "close_dialog", "open": true},
  configSchema:{type:'object',properties:{"title":{type:"string"},"eventId":{type:"string"},"open":{type:"boolean"}},required:["title", "eventId"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"content",type:{kind:'ui'},required:true}],outputs:[{id:"view",type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,"title","eventId","open");nonemptyText(config.title,'title',100);safeKey(config.eventId,'eventId');if(config.open!==undefined&&typeof config.open!=='boolean')throw Error('open must be boolean');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_dialog',{title:config.title,eventId:config.eventId,open:config.open!==false,content:inputs.content})};}
});
