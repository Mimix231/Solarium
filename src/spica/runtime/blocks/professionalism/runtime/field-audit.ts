import { defineRuntimeBlock } from '../../../adapter';

/** Deterministic accessible field checks, with actionable findings. */
export default defineRuntimeBlock({
  id:'spica.runtime.field_audit',version:'1',kind:'pure',trust:'built-in',targets:['desktop','web'],permissions:[],
  inputs:[{id:'label',type:{kind:'string'},required:true}],outputs:[{id:'passed',type:{kind:'boolean'}},
    {id:'findings',type:{kind:'array',element:{kind:'string'}}}],
  validateConfig(config) {if(Object.keys(config).length)throw Error('field_audit accepts no configuration.');},
  execute(_ctx,inputs) {
    const label=(inputs.label as string).trim();const findings:string[]=[];
    if(!label)findings.push('Provide a visible accessible label.');
    if(label.length>80)findings.push('Shorten label to 80 characters or less.');
    if(/^click (here|this)$/i.test(label))findings.push('Use a descriptive action rather than click here.');
    return {passed:findings.length===0,findings};
  },
});
