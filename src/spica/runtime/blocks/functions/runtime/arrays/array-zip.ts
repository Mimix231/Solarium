import { defineRuntimeBlock } from '../../../../adapter';
import { asArray, configKeys } from '../../../../support';
/** Pair two arrays by index, no dynamic callback code. */
export default defineRuntimeBlock({
  id:'spica.runtime.array_zip',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Pair two arrays into a bounded list of records with left and right fields.',exampleConfig:{},
  configSchema:{type:'object',properties:{},additionalProperties:false},targets:['desktop','web'],permissions:[],
  inputs:[{id:'left',type:{kind:'array',element:{kind:'unknown'}},required:true},{id:'right',type:{kind:'array',element:{kind:'unknown'}},required:true}],
  outputs:[{id:'items',type:{kind:'array',element:{kind:'record',fields:{left:{kind:'unknown'},right:{kind:'unknown'}}}}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){const left=asArray(inputs.left),right=asArray(inputs.right);return {items:left.slice(0,right.length).map((value,i)=>({left:value,right:right[i]}))};}
});
