import { defineRuntimeBlock } from '../../../adapter';

export default defineRuntimeBlock({
  id:'spica.runtime.when_true', version:'1', kind:'pure', trust:'built-in', targets:['desktop','web'], permissions:[],
  inputs:[{id:'condition',type:{kind:'boolean'},required:true}],
  outputs:[{id:'trigger',type:{kind:'event',payload:{kind:'boolean'}}}],
  validateConfig(config) { if (Object.keys(config).length) throw Error('when_true accepts no configuration.'); },
  execute(_ctx, inputs) { return inputs.condition === true ? {trigger:true} : {}; },
});
