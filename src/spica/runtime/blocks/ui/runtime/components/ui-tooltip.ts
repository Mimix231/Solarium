import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, nonemptyText, ui } from '../../../../support';
/** Accessible tooltip wrapping an existing interactive UI descriptor. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_tooltip',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Show a tooltip for an existing UI control on hover and keyboard focus.',exampleConfig:{text:'Open notes',placement:'top'},
  configSchema:{type:'object',properties:{text:{type:'string'},placement:{type:'string',enum:['top','bottom','left','right']}},required:['text'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'child',type:{kind:'ui'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'text','placement');nonemptyText(config.text,'text',200);if(config.placement!==undefined&&!['top','bottom','left','right'].includes(String(config.placement)))throw Error('Invalid tooltip placement');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_tooltip',{text:config.text,placement:config.placement??'top',child:inputs.child})};}
});
