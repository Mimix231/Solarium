import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey } from '../../../../support';

/** Delete a record inside the current permissioned atomic transaction. */
export default defineRuntimeBlock({
  id:'spica.runtime.record_delete',version:'1',kind:'effect',trust:'built-in',category:'data-records',
  description:'Delete one record by collection and key within a permissioned transaction.',
  exampleConfig:{collection:'notes'},targets:['desktop','web'],permissions:['records.write'],
  inputs:[{id:'key',type:{kind:'string'},required:true}],outputs:[{id:'deleted',type:{kind:'boolean'}}],
  validateConfig(config){configKeys(config,'collection');safeKey(config.collection,'collection');},
  async execute(ctx,inputs,config){ctx.requirePermission('records.write');if(!ctx.storage.delete)throw Error('The storage host does not support record deletion.');
    await ctx.storage.delete(config.collection as string,inputs.key as string);return {deleted:true};},
});
