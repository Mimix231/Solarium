import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, boundedInteger, ui } from '../../../../support';

/** Place a child UI descriptor in a bounded-height scrollable content region. */
export default defineRuntimeBlock({
  id:'spica.runtime.layout_scroll',version:'1',kind:'renderer',trust:'built-in',category:'layout',
  description:"Place a child UI descriptor in a bounded-height scrollable content region.",exampleConfig:{"maxHeight": 480},
  configSchema:{type:'object',properties:{"maxHeight":{type:"number"}},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"child",type:{kind:'ui'},required:true}],outputs:[{id:"view",type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,"maxHeight");if(config.maxHeight!==undefined)boundedInteger(config.maxHeight,'maxHeight',100,2500);},
  execute(_ctx,inputs,config){return {view:ui('spica.layout.scroll',{child:inputs.child,maxHeight:config.maxHeight??480})};}
});
