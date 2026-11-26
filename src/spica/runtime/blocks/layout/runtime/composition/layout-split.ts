import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Compose two actual UI components into a responsive two-column split layout. */
export default defineRuntimeBlock({
  id:'spica.runtime.layout_split',version:'1',kind:'renderer',trust:'built-in',category:'layout',
  description:"Compose two actual UI components into a responsive two-column split layout.",exampleConfig:{},
  configSchema:{type:'object',properties:{},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"left",type:{kind:'ui'},required:true},{id:"right",type:{kind:'ui'},required:true}],outputs:[{id:"view",type:{kind:'ui'}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){return {view:ui('spica.layout.responsive_split',{left:inputs.left,right:inputs.right})};}
});
