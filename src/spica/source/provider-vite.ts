import type { SourceBlockSourceProvider } from './loader';
/** Bundler-owned source map: paths come from the reviewed warehouse, never from user input.
 * Importing ?raw files at build time makes the editor/renderer able to inspect source without fs. */
const sourceImports=import.meta.glob('./portable/*.ts',{query:'?raw',import:'default'});
export const viteSourceBlockProvider:SourceBlockSourceProvider={
  async read(path) {
    const loader=sourceImports[`./${path}`];
    if(!loader)throw Error(`Unknown bundled source asset: ${path}`);
    const result=await loader();
    if(typeof result!=='string')throw Error(`Invalid bundled source asset: ${path}`);
    return result;
  },
};
