import { defineRuntimeBlock } from '../../../../adapter';
import { configKeys } from '../../../../support';

/** Check WCAG contrast ratio for two RGB hex colors. Every block is a separately validated executable module. */
export default defineRuntimeBlock({
  id: 'spica.runtime.contrast_ratio', version: '1', kind: 'pure', trust: 'built-in',
  category: 'professionalism', description: "Check WCAG contrast ratio for two RGB hex colors.", exampleConfig: {"foreground":"#ffffff","background":"#192c45"},
  targets: ['desktop','web'], permissions: [],
  inputs: [], outputs: [{id:'ratio',type:{kind:'number'}}, {id:'passes_aa',type:{kind:'boolean'}}],
  validateConfig(config) { configKeys(config,'foreground','background');for(const v of [config.foreground,config.background])if(typeof v!=='string'||!/^#[0-9a-fA-F]{6}$/.test(v))throw Error('Colors must be #RRGGBB'); },
  execute(_ctx, _inputs, config) { const lum=(hex:string)=>{const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values[0]!*.2126+values[1]!*.7152+values[2]!*.0722;};const x=lum(config.foreground as string),y=lum(config.background as string);const ratio=(Math.max(x,y)+.05)/(Math.min(x,y)+.05);return {ratio,passes_aa:ratio>=4.5}; },
});
