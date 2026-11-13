import { defineRuntimeBlock } from '../../../adapter';

export default defineRuntimeBlock({
  id:'spica.runtime.format_label',version:'1',kind:'pure',trust:'built-in',targets:['desktop','web'],permissions:[],
  inputs:[{id:'text',type:{kind:'string'},required:true}],outputs:[{id:'text',type:{kind:'string'}}],
  validateConfig(config) {
    if(Object.keys(config).some(key=>!['prefix','suffix'].includes(key)) ||
       (config.prefix!==undefined&&(typeof config.prefix!=='string'||config.prefix.length>80)) ||
       (config.suffix!==undefined&&(typeof config.suffix!=='string'||config.suffix.length>80)))
      throw Error('format_label accepts optional prefix/suffix strings of at most 80 characters.');
  },
  execute(_ctx,inputs,config) {return {text:`${config.prefix??''}${inputs.text}${config.suffix??''}`.slice(0,4000)};},
});
