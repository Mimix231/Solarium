import { defineRuntimeBlock } from '../../../../adapter';
import { asArray, configKeys, plain, safeKey } from '../../../../support';
/** Index a sequence of records by a validated property; reject collisions. */
export default defineRuntimeBlock({
  id:'spica.runtime.array_index_by',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Index an array of records by one field, rejecting missing or duplicate keys.',exampleConfig:{field:'id'},
  configSchema:{type:'object',properties:{field:{type:'string'}},required:['field'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:'index',type:{kind:'record',fields:{},open:true}}],
  validateConfig(config){configKeys(config,'field');safeKey(config.field,'field');},
  execute(_ctx,inputs,config){const result:Record<string,unknown>=Object.create(null);for(const entry of asArray(inputs.items)){if(!plain(entry))throw Error('Every item must be a data record');const key=safeKey(entry[config.field as string],config.field as string);if(Object.hasOwn(result,key))throw Error(`Duplicate index key ${key}`);result[key]=entry;}return {index:result};}
});
