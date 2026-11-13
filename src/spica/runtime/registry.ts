import type { SpicaBlockAdapter } from './adapter';
import { generatedRuntimeAdapters } from './registry.generated';

/** Only tested, trusted executable adapters enter this map. Catalog/draft and schema-1 blocks cannot run here. */
const entries: readonly SpicaBlockAdapter[] = generatedRuntimeAdapters;
const registry = new Map<string, SpicaBlockAdapter>();
for (const adapter of entries) {
  const key = `${adapter.id}@${adapter.version}`;
  if (registry.has(key)) throw Error(`Duplicate SPICA runtime adapter: ${key}`);
  registry.set(key, adapter);
}
export function listRuntimeBlocks(): readonly SpicaBlockAdapter[] { return entries; }
export function getRuntimeBlock(id: string, version: string): SpicaBlockAdapter | undefined { return registry.get(`${id}@${version}`); }
export function isRuntimeBlock(id: string, version: string): boolean { return registry.has(`${id}@${version}`); }
