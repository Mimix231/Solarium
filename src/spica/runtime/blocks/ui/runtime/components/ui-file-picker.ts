import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, nonemptyText, safeKey, ui } from '../../../../support';
/** Browser-local file selection; only the name is emitted. No file read. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_file_picker',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Show a native file chooser and emit the selected filename, never the file contents. Reading contents requires a separate authorized host.',exampleConfig:{label:'Choose file',accept:'.txt,.md',eventId:'file_selected'},
  configSchema:{type:'object',properties:{label:{type:'string'},accept:{type:'string'},eventId:{type:'string'}},required:['label','eventId'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'label','accept','eventId');nonemptyText(config.label,'label',80);safeKey(config.eventId,'eventId');if(config.accept!==undefined&&(typeof config.accept!=='string'||config.accept.length>120||/[^a-zA-Z0-9_.,+\-/* ]/.test(config.accept)))throw Error('Invalid file accept filter');},
  execute(_ctx,_inputs,config){return {view:ui('spica.ui.ui_file_picker',{label:config.label,accept:config.accept??'',eventId:config.eventId})};}
});
