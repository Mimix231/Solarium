import type { LoadedPortableSource, PortableSourceBlock, SourceTarget } from './types';
import type { SourceBlockRegistry } from './registry';
import { validateLoadedSource } from './validator';

/** Provider is supplied by the trusted app bundle or by a sandboxed build runner.
 * No model-provided URL or filesystem path is ever fetched by this class. */
export interface SourceBlockSourceProvider { read(canonicalSourcePath: string): Promise<string>; }
export async function sha256Source(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw Error('Secure SHA-256 provider unavailable');
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
export class SourceBlockLoader {
  constructor(private readonly registry: SourceBlockRegistry, private readonly provider: SourceBlockSourceProvider) {}
  async load(id: string,version='1.0.0',target:SourceTarget='typescript-web'): Promise<LoadedPortableSource> {
    const definition = this.registry.get(id,version);
    if (!definition) throw Error(`Unknown source block: ${id}@${version}`);
    if (definition.kind !== 'portable-source') throw Error(`Block ${id} is ${definition.kind}, not portable source`);
    if (!definition.targets.includes(target)) throw Error(`Unsupported source target ${target} for ${id}`);
    const source = await this.provider.read(definition.sourcePath);
    validateLoadedSource(definition,source);
    if (await sha256Source(source) !== definition.sha256) throw Error(`Source integrity mismatch for ${id}@${version}`);
    return {definition,source};
  }
  /** Strict lookup: metadata alone never authorizes loading host-runtime code. */
  getDefinition(id:string,version='1.0.0'): PortableSourceBlock {
    const block=this.registry.get(id,version);
    if (!block || block.kind!=='portable-source') throw Error(`Source is not portable: ${id}`);
    return block;
  }
}
