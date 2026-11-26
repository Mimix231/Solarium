import { defineRuntimeBlock } from '../../../../adapter';
import { boundedInteger, configKeys, nonemptyText, plain, safeKey, ui } from '../../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.ui_typed_form',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Form with labelled text, number, choice, checkbox, date and multiline fields. Validated submit emits typed JSON.',
  exampleConfig:{title:'Add item',eventId:'item_submit',fields:[{key:'name',label:'Name',type:'text',required:true},
    {key:'quantity',label:'Quantity',type:'number',min:0}]},
  configSchema:{type:'object',properties:{title:{type:'string'},eventId:{type:'string'},submitLabel:{type:'string'},
    fields:{type:'array',minItems:1,maxItems:20,items:{type:'object',properties:{key:{type:'string'},label:{type:'string'},
      type:{type:'string',enum:['text','multiline','number','boolean','choice','date']},required:{type:'boolean'},
      min:{type:'number'},max:{type:'number'},choices:{type:'array',items:{type:'string'}},maxLength:{type:'integer'}},
      required:['key','label','type'],additionalProperties:false}}},
    required:['title','eventId','fields'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'values',type:{kind:'record',fields:{},open:true}}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){
    configKeys(config,'title','eventId','submitLabel','fields');nonemptyText(config.title,'title');safeKey(config.eventId,'eventId');
    if(config.submitLabel!==undefined)nonemptyText(config.submitLabel,'submitLabel',60);
    if(!Array.isArray(config.fields)||!config.fields.length||config.fields.length>20)throw Error('Provide 1–20 typed fields.');
    const keys=new Set<string>();
    for(const field of config.fields){
      if(!plain(field))throw Error('Each form field must be an object.');
      configKeys(field,'key','label','type','required','min','max','choices','maxLength');
      const key=safeKey(field.key);if(keys.has(key))throw Error('Duplicate form field.');keys.add(key);
      nonemptyText(field.label,'label');
      if(!['text','multiline','number','boolean','choice','date'].includes(String(field.type)))throw Error('Unsupported form field type.');
      if(field.required!==undefined&&typeof field.required!=='boolean')throw Error('required must be boolean.');
      for(const bound of ['min','max'])if(field[bound]!==undefined&&(field.type!=='number'||typeof field[bound]!=='number'||!Number.isFinite(field[bound])))throw Error('Numeric bounds require a number field.');
      if(field.min!==undefined&&field.max!==undefined&&Number(field.min)>Number(field.max))throw Error('Field min exceeds max.');
      if(field.maxLength!==undefined)boundedInteger(field.maxLength,'maxLength',1,16000);
      if(field.type==='choice'){
        if(!Array.isArray(field.choices)||!field.choices.length||field.choices.length>50||new Set(field.choices).size!==field.choices.length)throw Error('A choice field needs distinct choices.');
        field.choices.forEach(value=>nonemptyText(value,'choice',100));
      }else if(field.choices!==undefined)throw Error('choices requires a choice field.');
    }
  },
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_typed_form',{...config,values:inputs.values??{}})};},
});
