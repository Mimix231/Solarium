import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys, safeKey, ui } from '../../../../support';
/** Bounded tree of nested records; selection is a real UI event. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_tree_view',version:'1',kind:'renderer',trust:'built-in',category:'ui',
  description:'Render nested record navigation with expand/collapse and selectable nodes.',exampleConfig:{labelField:'title',childrenField:'children',eventId:'select_tree'},
  configSchema:{type:'object',properties:{labelField:{type:'string'},childrenField:{type:'string'},eventId:{type:'string'}},required:['labelField','childrenField','eventId'],additionalProperties:false},
  targets:['desktop','web'],permissions:[],inputs:[{id:'items',type:{kind:'array',element:{kind:'unknown'}},required:true}],outputs:[{id:'view',type:{kind:'ui'}}],
  validateConfig(config){configKeys(config,'labelField','childrenField','eventId');safeKey(config.labelField,'labelField');safeKey(config.childrenField,'childrenField');safeKey(config.eventId,'eventId');},
  execute(_ctx,inputs,config){return {view:ui('spica.ui.ui_tree_view',{items:inputs.items,labelField:config.labelField,childrenField:config.childrenField,eventId:config.eventId})};}
});
