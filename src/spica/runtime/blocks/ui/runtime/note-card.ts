import { defineRuntimeBlock } from '../../../adapter';

export default defineRuntimeBlock({
  id:'spica.runtime.note_card', version:'1', kind:'renderer', trust:'built-in', targets:['desktop','web'], permissions:[],
  inputs:[{id:'note',type:{kind:'record',fields:{title:{kind:'string'},body:{kind:'string'}}},required:true}],
  outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { if (Object.keys(config).length) throw Error('note_card accepts no configuration.'); },
  execute(_ctx, inputs) {
    const note=inputs.note as {title:string;body:string};
    // A typed view model for target renderers; not a claim that MUI has mounted here.
    return {view:{renderer:'spica.note_card',title:note.title,body:note.body}};
  },
});
