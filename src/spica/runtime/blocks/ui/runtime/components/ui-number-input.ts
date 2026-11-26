import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, finite, nonemptyText, safeKey, ui } from '../../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.ui_number_input',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Editable numeric field with a real input event, min/max validation and a labelled control.',
  exampleConfig:{label:'Quantity',eventId:'quantity_changed',min:0,step:1},
  configSchema:{type:'object',properties:{label:{type:'string'},eventId:{type:'string'},min:{type:'number'},max:{type:'number'},step:{type:'number'}},
    required:['label','eventId'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'value',type:{kind:'number'}}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){
    configKeys(config,'label','eventId','min','max','step');nonemptyText(config.label,'label');safeKey(config.eventId,'eventId');
    for(const key of ['min','max','step'])if(config[key]!==undefined)finite(config[key],key);
    if(config.step!==undefined&&Number(config.step)<=0)throw Error('step must be positive.');
    if(config.min!==undefined&&config.max!==undefined&&Number(config.min)>Number(config.max))throw Error('min exceeds max.');
  },
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_number_input',{...config,value:inputs.value??''})};},
});
