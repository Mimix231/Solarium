import { defineRuntimeBlock } from '../../../../adapter';
/** Package 2 Material descriptor views into a typed list for layout composition. */
export default defineRuntimeBlock({
  id:'spica.runtime.ui_group_2',version:'1',kind:'pure',trust:'built-in',
  category:'ui',description:'Combine 2 child views into a UI array for a stack, grid or toolbar.',
  exampleConfig:{},targets:['desktop','web'],permissions:[],
  inputs:[{id:'child1',type:{kind:'ui'},required:true},
    {id:'child2',type:{kind:'ui'},required:true}],outputs:[{id:'children',type:{kind:'array',element:{kind:'ui'}}}],
  validateConfig(config){if(Object.keys(config).length)throw Error('UI grouping has no configuration.')},
  execute(_ctx,inputs){return {children:[inputs.child1, inputs.child2]};},
});
