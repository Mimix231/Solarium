import type { SpicaBlockAdapter } from './adapter';
import { generatedRuntimeAdapters } from './registry.generated';
import { canonicalRuntimeBlockId, runtimeBlockAliases, installVerifiedRuntimeAliases } from './aliases';

/** Only tested, trusted executable adapters enter this map. Catalog/draft and schema-1 blocks cannot run here. */
const entries: readonly SpicaBlockAdapter[] = generatedRuntimeAdapters;
const registry = new Map<string, SpicaBlockAdapter>();
for (const adapter of entries) {
  const key = `${adapter.id}@${adapter.version}`;
  if (registry.has(key)) throw Error(`Duplicate SPICA runtime adapter: ${key}`);
  registry.set(key, adapter);
}
export function listRuntimeBlocks(): readonly SpicaBlockAdapter[] { return entries; }
export function getRuntimeBlock(id: string, version: string): SpicaBlockAdapter | undefined { return registry.get(`${canonicalRuntimeBlockId(id)}@${version}`); }
export function isRuntimeBlock(id: string, version: string): boolean { return registry.has(`${canonicalRuntimeBlockId(id)}@${version}`); }

// Verify aliases once at startup: no alias may mask a registered real block.
for (const [alias, target] of Object.entries(runtimeBlockAliases)) {
  if (registry.has(`${alias}@1`) || !registry.has(`${target}@1`)) throw Error(`Invalid runtime alias ${alias} → ${target}`);
}

// All generated variants are verified against canonical executable IDs.
installVerifiedRuntimeAliases(entries.map(item=>item.id));
