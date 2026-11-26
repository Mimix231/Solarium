import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';
/** A trusted, finite screen list; there is no arbitrary router/URL evaluation. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_screen_router',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Show a bounded list of app screens and emit explicit navigation events when selected.',
  configSchema:{type:'object',properties:{'eventId': {'type': 'string'}, 'screens': {'type': 'array', 'minItems': 1, 'maxItems': 16, 'items': {'type': 'object', 'properties': {'id': {'type': 'string'}, 'label': {'type': 'string'}}, 'required': ['id', 'label'], 'additionalProperties': false}}},required:['eventId', 'screens'],additionalProperties:false},
  exampleConfig:{eventId:'navigate',screens:[{id:'notes',label:'Notes'},{id:'recents',label:'Recents'}]},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'current',type:{kind:'string'}},{id:'content',type:{kind:'ui'}}],
  outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'eventId','screens');safeKey(config.eventId,'eventId');
    if(!Array.isArray(config.screens)||!config.screens.length||config.screens.length>16||config.screens.some((row:unknown)=>{
      if(!row||typeof row!=='object'||Array.isArray(row))return true;
      const item=row as Record<string,unknown>;
      try{safeKey(item.id,'screen');}catch{return true;}
      return typeof item.label!=='string'||!item.label.trim()||item.label.length>80||Object.keys(item).some(key=>!['id','label'].includes(key));
    }))throw Error('screens requires 1–16 {id,label} entries.');
    const ids=(config.screens as Array<{id:string}>).map(row=>row.id);
    if(new Set(ids).size!==ids.length)throw Error('screen IDs must be unique.');},
  execute(_ctx,inputs,config){const screens=config.screens as Array<{id:string;label:string}>;
    const selected=typeof inputs.current==='string'&&screens.some(row=>row.id===inputs.current)?inputs.current:screens[0]!.id;
    return {view:ui('spica.ui.ui_screen_router',{eventId:config.eventId,screens,selected,content:inputs.content??null})};},
});
