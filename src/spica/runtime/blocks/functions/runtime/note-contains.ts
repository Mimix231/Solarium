import { defineRuntimeBlock } from '../../../adapter';

const noteType = { kind: 'record' as const, fields: { title: { kind: 'string' as const }, body: { kind: 'string' as const } } };
export default defineRuntimeBlock({
  id:'spica.runtime.note_contains', version:'1', kind:'pure', trust:'built-in', targets:['desktop','web'], permissions:[],
  inputs:[{ id:'note', type:noteType, required:true }], outputs:[{ id:'matched', type:{kind:'boolean'} }],
  validateConfig(config) { if (typeof config.query !== 'string' || !config.query.trim() || config.query.length > 120 || Object.keys(config).length !== 1) throw Error('note_contains requires a nonempty query.'); },
  execute(_ctx, inputs, config) {
    const note = inputs.note as { title:string; body:string };
    const needle = (config.query as string).toLocaleLowerCase();
    return { matched: `${note.title}\n${note.body}`.toLocaleLowerCase().includes(needle) };
  },
});
