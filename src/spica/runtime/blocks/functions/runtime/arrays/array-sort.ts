import { defineRuntimeBlock } from '../../../../adapter';
import { asArray, configKeys, plain, safeKey } from '../../../../support';

export default defineRuntimeBlock({
  id:'spica.runtime.array_sort',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Stable sort of an array by a record field or primitive value, preserving numeric order and placing missing values last.',
  exampleConfig:{field:'priority',direction:'desc'},
  configSchema:{type:'object',properties:{field:{type:'string'},direction:{type:'string',enum:['asc','desc']}},
    additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}],
  outputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){
    configKeys(config,'field','direction');
    if(config.field!==undefined)safeKey(config.field,'field');
    if(config.direction!==undefined&&!['asc','desc'].includes(String(config.direction)))throw Error('direction must be asc or desc.');
  },
  execute(_ctx,inputs,config){
    const field=config.field as string|undefined;
    const value=(item:unknown)=>field?(plain(item)?item[field]:undefined):item;
    const missing=(item:unknown)=>item===undefined||item===null;
    const direction=config.direction==='desc'?-1:1;
    const rows=asArray(inputs.items).map((item,index)=>({item,index,value:value(item)}));
    rows.sort((a,b)=>{
      if(missing(a.value)||missing(b.value))return Number(missing(a.value))-Number(missing(b.value))||a.index-b.index;
      const compared=typeof a.value==='number'&&typeof b.value==='number'
        ? a.value-b.value : String(a.value).localeCompare(String(b.value),undefined,{numeric:true});
      return compared*direction||a.index-b.index;
    });
    return {items:rows.map(row=>row.item)};
  },
});
