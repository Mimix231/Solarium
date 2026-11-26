import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, ui } from '../../../../support';

/** Render an accessible loading indicator with an optional status label. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_loading_state',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:"Render an accessible loading indicator with an optional status label.",exampleConfig:{"label": "Loading notes"},
  configSchema:{type:'object',properties:{"label":{type:"string"}},required:[],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[],outputs:[{id:"view",type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,"label");if(config.label!==undefined&&typeof config.label!=='string')throw Error('label must be text');},
  execute(_ctx,_inputs,config){return {view:ui('spica.ui.ui_loading_state',{label:config.label??'Loading'})};}
});
