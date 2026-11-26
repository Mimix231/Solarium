import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';
/** Input events are delivered by the host; this never edits application code. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_search_field',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Interactive search field with named text-change event and optional controlled string value.',
  configSchema:{type:'object',properties:{'eventId': {'type': 'string'}, 'label': {'type': 'string', 'maxLength': 100}},required:['eventId'],additionalProperties:false},
  exampleConfig:{eventId:'search_notes',label:'Search notes'},targets:['desktop','web'],permissions:[],
  inputs:[{id:'value',type:{kind:'string'}}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'eventId','label');safeKey(config.eventId,'eventId');
    if(config.label!==undefined&&(typeof config.label!=='string'||config.label.length>100))throw Error('label must be text <=100 characters.');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_search_field',{eventId:config.eventId,label:config.label??'Search',value:inputs.value??''})};},
});
