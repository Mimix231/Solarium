import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, finite, safeKey, ui } from '../../../../support';
/** Interactive numeric slider, dispatches selected value as a string event. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_range_slider',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Accessible interactive numeric range slider with validated bounds and change event.',exampleConfig:{min:0,max:100,step:1,value:50,eventId:'slider_change'},
  configSchema:{type:'object',properties:{min:{type:'number'},max:{type:'number'},step:{type:'number'},value:{type:'number'},eventId:{type:'string'}},required:['min','max','step','value','eventId'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'label',type:{kind:'string'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'min','max','step','value','eventId');const min=finite(config.min,'min'),max=finite(config.max,'max'),step=finite(config.step,'step'),value=finite(config.value,'value');if(min>=max||max-min>1000000||step<=0||step>max-min||value<min||value>max)throw Error('Invalid slider bounds, step or value');safeKey(config.eventId,'eventId');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_range_slider',{label:inputs.label,min:config.min,max:config.max,step:config.step,value:config.value,eventId:config.eventId})};}
});
