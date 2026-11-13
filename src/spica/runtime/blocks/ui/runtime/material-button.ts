import { defineRuntimeBlock } from '../../../adapter';

/** Renderer descriptor resolves to the approved Material UI button. */
export default defineRuntimeBlock({
  id:'spica.runtime.material_button',version:'1',kind:'renderer',trust:'built-in',targets:['desktop','web'],permissions:[],
  inputs:[{id:'label',type:{kind:'string'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config) {if(Object.keys(config).some(key=>key!=='variant')||
    !['contained','outlined','text'].includes(config.variant as string))throw Error('material_button variant must be contained, outlined or text.');},
  execute(_ctx,inputs,config) {return {view:{renderer:'spica.ui.material_button',label:String(inputs.label).slice(0,100),variant:config.variant}};},
});
