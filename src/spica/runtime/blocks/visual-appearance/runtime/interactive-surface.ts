import { defineRuntimeBlock } from '../../../adapter';
import { boundedInteger, configKeys, ui } from '../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.interactive_surface',version:'1',kind:'renderer',trust:'built-in',category:'visual-appearance',
  description:'Add hover elevation and a pressed response to an existing interactive subtree, respecting reduced motion.',
  exampleConfig:{lift:2,duration:160},
  configSchema:{type:'object',properties:{lift:{type:'integer'},duration:{type:'integer'}},additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'child',type:{kind:'ui'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'lift','duration');if(config.lift!==undefined)boundedInteger(config.lift,'lift',0,6);
    if(config.duration!==undefined)boundedInteger(config.duration,'duration',0,400);},
  execute(_ctx,inputs,config){return {view:ui('spica.appearance.interactive_surface',{lift:config.lift??2,duration:config.duration??160,child:inputs.child})};},
});
