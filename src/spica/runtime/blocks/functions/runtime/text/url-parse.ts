import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';
/** Pure URL parsing, never performs a network request. */
export default defineRuntimeBlock({
  id:'spica.runtime.url_parse',version:'1',kind:'pure',trust:'built-in',category:'functions',
  description:'Parse an HTTP(S) URL into protocol, hostname, path and search string without fetching it.',exampleConfig:{},
  configSchema:{type:'object',properties:{},additionalProperties:false},targets:['desktop','web'],permissions:[],
  inputs:[{id:'url',type:{kind:'string'},required:true}],outputs:[{id:'valid',type:{kind:'boolean'}},{id:'hostname',type:{kind:'string'}},{id:'path',type:{kind:'string'}},{id:'protocol',type:{kind:'string'}},{id:'search',type:{kind:'string'}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){try{const parsed=new URL(inputs.url as string);if(!['http:','https:'].includes(parsed.protocol))throw Error('Unsupported scheme');return {valid:true,hostname:parsed.hostname,path:parsed.pathname,protocol:parsed.protocol,search:parsed.search};}catch{return {valid:false,hostname:'',path:'',protocol:'',search:''};}}
});
