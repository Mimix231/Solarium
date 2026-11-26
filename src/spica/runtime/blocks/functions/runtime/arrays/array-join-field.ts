import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, plain, asArray } from '../../../../support';

/** Join two bounded record arrays on configured safe key fields, never by executing arbitrary predicates. */
export default defineRuntimeBlock({
  id:'spica.runtime.array_join_field',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:"Join two bounded record arrays on configured safe key fields, never by executing arbitrary predicates.",exampleConfig:{"leftKey": "id", "rightKey": "noteId"},
  configSchema:{type:'object',properties:{"leftKey":{type:"string"},"rightKey":{type:"string"}},required:["leftKey", "rightKey"],additionalProperties:false},
  targets:['desktop','web'],permissions:[],
  inputs:[{id:"left",type:{kind:'array',element:{kind:'unknown'}},required:true},{id:"right",type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:"items",type:{kind:'array',element:{kind:'unknown'}}}],
  validateConfig(config){configKeys(config,"leftKey","rightKey");safeKey(config.leftKey,'leftKey');safeKey(config.rightKey,'rightKey');},
  execute(_ctx,inputs,config){const left=asArray(inputs.left),right=asArray(inputs.right),index=new Map<string,Record<string,unknown>[]>();for(const row of right){if(!plain(row))continue;const key=JSON.stringify(row[config.rightKey as string]);const values=index.get(key)??[];if(values.length<100)values.push(row);index.set(key,values);}const items:unknown[]=[];for(const row of left){if(!plain(row))continue;for(const match of index.get(JSON.stringify(row[config.leftKey as string]))??[]){if(items.length>=5000)throw Error('Join output exceeds 5,000 items');items.push({...row,...match});}}return {items};}
});
