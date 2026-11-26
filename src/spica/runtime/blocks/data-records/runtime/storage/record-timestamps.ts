import { defineRuntimeBlock } from '../../../../adapter';
import { asRecord, configKeys } from '../../../../support';
/** Timestamp values come from the real clock, not a user-owned JS string. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_timestamps',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Stamp a record for recent-item sorting while preserving an existing createdAt field.',
  configSchema:{type:'object',properties:{},required:[],additionalProperties:false},
  exampleConfig:{},targets:['desktop','web'],permissions:[],
  inputs:[{id:'record',type:{kind:'unknown'},required:true}],outputs:[{id:'record',type:{kind:'unknown'}}],
  validateConfig(config){configKeys(config);},
  execute(_ctx,inputs){const record=asRecord(inputs.record);const now=new Date().toISOString();
    return {record:{...record,createdAt:typeof record.createdAt==='string'&&record.createdAt?record.createdAt:now,updatedAt:now}};},
});
