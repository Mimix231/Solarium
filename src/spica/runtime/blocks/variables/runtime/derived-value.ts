import { defineRuntimeBlock } from '../../../adapter';

/** A bounded immutable value pass-through; never writes mutable global state. */
export default defineRuntimeBlock({
  id:'spica.runtime.derived_value',version:'1',kind:'pure',trust:'built-in',targets:['desktop','web'],permissions:[],
  inputs:[{id:'value',type:{kind:'unknown'},required:true}],outputs:[{id:'value',type:{kind:'unknown'}}],
  validateConfig(config) {if(Object.keys(config).length) throw Error('derived_value has no configuration.');},
  execute(_ctx,inputs) {return {value:inputs.value};},
});
