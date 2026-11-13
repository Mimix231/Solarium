import { defineRuntimeBlock } from '../../../adapter';

/** Declarative split panel; target renderer owns actual resizing and responsive behavior. */
export default defineRuntimeBlock({
  id:'spica.runtime.responsive_split',version:'1',kind:'renderer',trust:'built-in',targets:['desktop','web'],permissions:[],
  inputs:[{id:'left',type:{kind:'ui'},required:true},{id:'right',type:{kind:'ui'},required:true}],
  outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config) {
    if(Object.keys(config).some(key=>key!=='ratio') || typeof config.ratio!=='number'||!Number.isFinite(config.ratio)||
      config.ratio<0.2||config.ratio>0.8)throw Error('responsive_split needs ratio from 0.2 to 0.8.');
  },
  execute(_ctx,inputs,config) {return {view:{renderer:'spica.layout.responsive_split',ratio:config.ratio,left:inputs.left,right:inputs.right}};},
});
