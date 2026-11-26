import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, nonemptyText, safeKey, ui } from '../../../../support';

/** Reusable live-preview Markdown editor with independently managed host input. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.ui_markdown_editor', version: '1', kind: 'renderer', trust: 'built-in',
  category: 'ui', description: "Reusable live-preview Markdown editor with independently managed host input.", exampleConfig: {"label":"Body"},
  configSchema:{type:'object',properties:{label:{type:'string',minLength:1,maxLength:100},eventId:{type:'string'}},required:['label'],additionalProperties:false},
  targets: ['desktop','web'], permissions: [],
  inputs: [{id:'text',type:{kind:'string'},required:true}], outputs: [{id:'view',type:{kind:'ui'}}],
  validateConfig(config) { configKeys(config,'label','eventId');if(config.eventId!==undefined)safeKey(config.eventId,'eventId');nonemptyText(config.label,'label',100); },
  execute(_ctx, inputs, config) { return {view:ui('spica.ui.ui_markdown_editor',{text:inputs.text,label:config.label,eventId:config.eventId})}; },
});
