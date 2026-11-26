import { defineRuntimeBlock } from '../../../adapter';
import { boundedInteger, configKeys, ui } from '../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.styled_surface',version:'1',kind:'renderer',trust:'built-in',category:'visual-appearance',
  description:'Style a reusable UI subtree with validated colors, spacing, corner radius, typography and elevation.',
  exampleConfig:{background:'#182338',color:'#f5f7ff',accent:'#8eced1',radius:18,padding:24,elevation:2,font:'sans'},
  configSchema:{type:'object',properties:{background:{type:'string'},color:{type:'string'},accent:{type:'string'},
    radius:{type:'integer'},padding:{type:'integer'},elevation:{type:'integer'},font:{type:'string',enum:['sans','serif','mono']}},
    additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'child',type:{kind:'ui'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){
    configKeys(config,'background','color','accent','radius','padding','elevation','font');
    for(const key of ['background','color','accent'])if(config[key]!==undefined&&!/^#[a-f0-9]{6}$/i.test(String(config[key])))throw Error(key+' needs a #RRGGBB color.');
    for(const key of ['radius','padding'])if(config[key]!==undefined)boundedInteger(config[key],key,0,64);
    if(config.elevation!==undefined)boundedInteger(config.elevation,'elevation',0,6);
    if(config.font!==undefined&&!['sans','serif','mono'].includes(String(config.font)))throw Error('Unsupported font family.');
  },
  execute(_ctx,inputs,config){return {view:ui('spica.appearance.styled_surface',{...config,child:inputs.child})};},
});
