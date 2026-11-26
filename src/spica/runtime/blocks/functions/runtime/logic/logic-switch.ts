import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, plain } from '../../../../support';

/** Select a configured value by exact string case, with a defined fallback. */
export default defineRuntimeBlock({
  id:'spica.runtime.logic_switch',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Select a configured value by exact string case, with a defined fallback.",exampleConfig:{"cases": {"draft": "Draft", "published": "Published"}, "fallback": "Unknown"},
  configSchema:{type:'object',properties:{"cases":{type:"object"},"fallback":{type:"string"}},required:["cases"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"value",type:{kind:'string'},required:true}],outputs:[{id:"result",type:{kind:'unknown'}}],
  validateConfig(config){configKeys(config,"cases","fallback");if(!plain(config.cases)||Object.keys(config.cases).length>32)throw Error('cases must be a bounded record');for(const k of Object.keys(config.cases))safeKey(k,'case');},
  execute(_ctx,inputs,config){const cases=config.cases as Record<string,unknown>;return {result:Object.hasOwn(cases,inputs.value as string)?cases[inputs.value as string]:config.fallback??null};}
});
