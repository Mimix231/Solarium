import { defineRuntimeBlock } from '../../../adapter';

/** Appearance descriptor; cannot inject CSS or JavaScript. */
export default defineRuntimeBlock({
  exampleConfig:{background:'#121829',surface:'#20283B',accent:'#20C5BF',text:'#FFFFFF'},
  id:'spica.runtime.theme_palette',version:'1',kind:'pure',trust:'built-in',targets:['desktop','web'],permissions:[],
  inputs:[], outputs:[{id:'palette',type:{kind:'record',fields:{background:{kind:'string'},surface:{kind:'string'},accent:{kind:'string'},text:{kind:'string'}}}}],
  validateConfig(config) {
    const colors=['background','surface','accent','text'];
    if(Object.keys(config).length!==colors.length || colors.some(key=>typeof config[key]!=='string' || !/^#[0-9a-fA-F]{6}$/.test(config[key] as string)))
      throw Error('theme_palette needs exactly four #RRGGBB colors: background, surface, accent, text.');
  },
  execute(_ctx,_inputs,config) { return {palette:{background:config.background,surface:config.surface,accent:config.accent,text:config.text}}; },
});
