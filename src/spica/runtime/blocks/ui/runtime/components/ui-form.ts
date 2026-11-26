import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, nonemptyText, ui } from '../../../../support';

/** Render a field-defined interactive form with an explicit submit event and JSON payload. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_form',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:"Render a field-defined interactive form with an explicit submit event and JSON payload.",exampleConfig:{"title": "Edit note", "fields": ["title", "body"], "eventId": "save_form", "submitLabel": "Save"},
  configSchema:{type:'object',properties:{"title":{type:"string"},"fields":{type:"array"},"eventId":{type:"string"},"submitLabel":{type:"string"}},required:["title", "fields", "eventId"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[],outputs:[{id:"view",type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,"title","fields","eventId","submitLabel");nonemptyText(config.title,'title',100);safeKey(config.eventId,'eventId');if(!Array.isArray(config.fields)||!config.fields.length||config.fields.length>16)throw Error('fields must contain 1–16 keys');for(const key of config.fields)safeKey(key,'field');if(config.submitLabel!==undefined)nonemptyText(config.submitLabel,'submitLabel',40);},
  execute(_ctx,_inputs,config){return {view:ui('spica.ui.ui_form',{title:config.title,fields:config.fields,eventId:config.eventId,submitLabel:config.submitLabel??'Save'})};}
});
