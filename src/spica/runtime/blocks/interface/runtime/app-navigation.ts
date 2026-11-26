import { defineRuntimeBlock } from '../../../adapter';

/** Navigation structure is validated; no arbitrary URL or script is accepted. */
export default defineRuntimeBlock({
  exampleConfig:{title:'Notes',items:['All Notes','Recents']},
  id:'spica.runtime.app_navigation',version:'1',kind:'renderer',trust:'built-in',targets:['desktop','web'],permissions:[],
  inputs:[{id:'body',type:{kind:'ui'},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config) {
    if(Object.keys(config).some(key=>!['title','items'].includes(key)))
      throw Error('app_navigation accepts title and items only.');
    if(typeof config.title!=='string'||!config.title.trim()||config.title.length>100||!Array.isArray(config.items)||config.items.length>16||
      config.items.some((item:unknown)=>typeof item!=='string'||!item.trim()||(item as string).length>80))
      throw Error('app_navigation needs title and up to 16 nonempty navigation labels.');
  },
  execute(_ctx,inputs,config) {return {view:{renderer:'spica.interface.navigation',title:config.title,items:config.items,body:inputs.body}};},
});
