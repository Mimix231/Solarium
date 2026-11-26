import { defineRuntimeBlock } from '../../../adapter';

/** Concrete typed data source, not a generic code-evaluation block. */
export default defineRuntimeBlock({
  exampleConfig:{title:'Sample note',body:'Sample content'},
  id: 'spica.runtime.note_record', version: '1', kind: 'pure', trust: 'built-in', targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{ id: 'note', type: { kind: 'record', fields: { title: { kind:'string' }, body: { kind:'string' } } } }],
  validateConfig(config) {
    if (typeof config.title !== 'string' || !config.title.trim() || config.title.length > 120 ||
        typeof config.body !== 'string' || config.body.length > 16000 ||
        Object.keys(config).some(key => key !== 'title' && key !== 'body')) throw Error('note_record needs title (1–120 chars) and body (≤16,000 chars).');
  },
  execute(_ctx, _inputs, config) { return { note: { title: config.title, body: config.body } }; },
});
