import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, nonemptyText } from '../../../../support';
/** Actual runtime assertion used inside verifiable graph compositions. */
export default defineRuntimeBlock({
  id:'spica.runtime.validate_assertion',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Assert a boolean precondition in the runtime; stop execution on failure.',exampleConfig:{message:'Condition must hold'},
  configSchema:{type:'object',properties:{message:{type:'string'}},required:['message'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'condition',type:{kind:'boolean'},required:true}],outputs:[{id:'passed',type:{kind:'boolean'}}],
  validateConfig(config){configKeys(config,'message');nonemptyText(config.message,'message',180);},
  execute(_ctx,inputs,config){if(inputs.condition!==true)throw Error(`Assertion failed: ${config.message}`);return {passed:true};}
});
