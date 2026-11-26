import type { SourceGeneratorBlock } from './types';
/** A small, deterministic, safe generator proving a second type of executable source capability. */
export const themeTokensGenerator: SourceGeneratorBlock = {
  id:'source.theme-tokens',version:'1.0.0',kind:'source-generator',category:'ui',
  description:'Generate strongly typed, static theme colors from validated hex input',
  language:'typescript',targets:['typescript-web','typescript-desktop'],
  provenance:{kind:'new-implementation',adaptation:'Pure source generator independent of the SPICA runtime'},
  exports:[{name:'themeTokens',kind:'value'}],requires:[],
  configSchema:{allowed:['background','foreground','accent'],required:['background','foreground','accent']},
  validation:{compilation:'typescript-strict',tests:['tests/dream-construction-phase02.test.cjs']},
  generate(config) {
    const keys=['background','foreground','accent'] as const;
    const tokens: Record<string,string>={};
    for(const key of keys){const value=config[key];if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))throw Error(`Invalid theme token ${key}`);tokens[key]=value;}
    return [{path:'src/warehouse/theme-tokens.ts',source:`/** Generated using source.theme-tokens@1.0.0 */\nexport const themeTokens = ${JSON.stringify(tokens,null,2)} as const;\n`}];
  },
};
