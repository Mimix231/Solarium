import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, nonemptyText, safeKey, ui } from '../../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.ui_date_input',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Labelled calendar date field emitting an ISO date string through its bound UI event.',
  exampleConfig:{label:'Due date',eventId:'due_changed'},
  configSchema:{type:'object',properties:{label:{type:'string'},eventId:{type:'string'}},required:['label','eventId'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'value',type:{kind:'string'}}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'label','eventId');nonemptyText(config.label,'label');safeKey(config.eventId,'eventId');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_date_input',{...config,value:inputs.value??''})};},
});
