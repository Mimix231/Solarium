import { defineRuntimeBlock } from '../../../adapter';

const noteType = { kind:'record' as const, fields:{title:{kind:'string' as const},body:{kind:'string' as const}} };
export default defineRuntimeBlock({
  id:'spica.runtime.save_note', version:'1', kind:'effect', trust:'built-in', targets:['desktop','web'], permissions:['records.write'],
  inputs:[{id:'note',type:noteType,required:true},{id:'trigger',type:{kind:'event',payload:{kind:'boolean'}},required:true}],
  outputs:[{id:'saved',type:noteType}],
  validateConfig(config) { if (typeof config.key !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(config.key) || Object.keys(config).length !== 1) throw Error('save_note requires a valid record key.'); },
  async execute(ctx, inputs, config) {
    ctx.requirePermission('records.write');
    if (ctx.signal.aborted) throw new DOMException('Cancelled','AbortError');
    const note = inputs.note as {title:string;body:string};
    await ctx.storage.put('notes',config.key as string,note);
    return {saved:note};
  },
});
