import { defineRuntimeBlock } from '../../../adapter';

/** Visual appearance is a typed effect descriptor, not executable CSS. */
export default defineRuntimeBlock({
  exampleConfig:{strength:'regular'},
  id:'spica.runtime.glass_surface',version:'1',kind:'renderer',trust:'built-in',targets:['desktop','web'],permissions:[],
  inputs:[{id:'content',type:{kind:'ui'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config) {if(Object.keys(config).some(key=>key!=='strength')||
    !['subtle','regular','strong'].includes(config.strength as string))throw Error('glass_surface strength: subtle, regular or strong.');},
  execute(_ctx,inputs,config) {return {view:{renderer:'spica.appearance.glass_surface',strength:config.strength,content:inputs.content}};},
});
