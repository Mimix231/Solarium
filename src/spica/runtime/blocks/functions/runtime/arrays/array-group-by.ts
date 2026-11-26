import { defineRuntimeBlock } from '../../../../adapter';
import { asArray, configKeys, plain, safeKey } from '../../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.array_group_by',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Group records by a scalar field into labelled groups containing their original items and counts.',
  exampleConfig:{field:'status'},
  configSchema:{type:'object',properties:{field:{type:'string'}},required:['field'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}],
  outputs:[{id:'groups',type:{kind:'array',element:{kind:'record',fields:{},open:true}}}],
  validateConfig(config){configKeys(config,'field');safeKey(config.field,'field');},
  execute(_ctx,inputs,config){
    const groups=new Map<string,{key:unknown;items:unknown[];count:number}>();
    for(const row of asArray(inputs.items)){
      if(!plain(row))throw Error('array_group_by requires records.');
      const value=row[config.field as string]??null;
      if(typeof value==='object'&&value!==null)throw Error('Group field must be a scalar value.');
      const id=JSON.stringify(value);
      const group=groups.get(id)??{key:value,items:[],count:0};
      group.items.push(row);group.count++;groups.set(id,group);
    }
    return {groups:[...groups.values()]};
  },
});
