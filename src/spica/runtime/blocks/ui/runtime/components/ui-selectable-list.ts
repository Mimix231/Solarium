import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';
/** List selection is an explicit UI event; records stay inert until clicked. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_selectable_list',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Display selectable record rows; clicking emits a selected key via a named interaction event.',
  configSchema:{type:'object',properties:{'eventId': {'type': 'string'}, 'labelField': {'type': 'string'}, 'keyField': {'type': 'string'}},required:['eventId'],additionalProperties:false},
  exampleConfig:{eventId:'select_note',labelField:'title',keyField:'key'},targets:['desktop','web'],permissions:[],
  inputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true},
    {id:'selected',type:{kind:'string'}}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'eventId','labelField','keyField');safeKey(config.eventId,'eventId');
    if(config.labelField!==undefined)safeKey(config.labelField,'labelField');
    if(config.keyField!==undefined)safeKey(config.keyField,'keyField');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_selectable_list',{items:inputs.items,selected:inputs.selected??'',
    eventId:config.eventId,labelField:config.labelField??'title',keyField:config.keyField??'key'})};},
});
