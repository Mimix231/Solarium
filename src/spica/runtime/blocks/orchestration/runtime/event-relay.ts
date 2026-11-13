import { defineRuntimeBlock } from '../../../adapter';

/** Explicitly propagates a typed event; all feedback edges still require finite iteration limits. */
export default defineRuntimeBlock({
  id:'spica.runtime.event_relay', version:'1', kind:'pure', trust:'built-in', targets:['desktop','web'],permissions:[],
  inputs:[{id:'trigger',type:{kind:'event',payload:{kind:'boolean'}},required:true,maxConnections:2}],
  outputs:[{id:'trigger',type:{kind:'event',payload:{kind:'boolean'}}}],
  validateConfig(config) { if (Object.keys(config).length) throw Error('event_relay accepts no configuration.'); },
  execute(_ctx,inputs) { return {trigger:inputs.trigger}; },
});
