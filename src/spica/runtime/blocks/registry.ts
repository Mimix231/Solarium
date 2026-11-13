import { blockCategoryValid } from './categories';
import type { SpicaBlockDefinition, SpicaBlockMetadata, SpicaLegacyCapability, SpicaLegacyTarget } from './contracts';
import { generatedSpicaBlockMetadata, generatedSpicaBlockLoaders } from './registry.generated';

const byKey = new Map<string, SpicaBlockMetadata>();
for (const block of generatedSpicaBlockMetadata) {
  const key = `${block.id}@${block.version}`;
  if (byKey.has(key) || !blockCategoryValid(block) || !generatedSpicaBlockLoaders[key]) {
    throw Error(`Invalid or duplicate registered SPICA block ${key} at ${block.sourcePath}.`);
  }
  byKey.set(key, block);
}

function normalId(value: string): string {
  return value.startsWith('spica.block.') ? value.slice('spica.block.'.length) : value;
}

/** Read-only metadata lookup: does not import any executable block module. */
export function getBlock(id: string, version: string | number = 1): SpicaBlockMetadata | undefined {
  return byKey.get(`${normalId(id)}@${version}`);
}

/** Original schema-1 registration order is preserved for legacy callers. */
export function listBlocks(): readonly SpicaBlockMetadata[] { return generatedSpicaBlockMetadata; }

export function isExecutableBlock(id: string, version: string | number = 1): boolean {
  const block = getBlock(id, version);
  return block?.implementation.kind === 'program-v1-adapter';
}

/** Explicitly authorize a legacy target and capability grants before importing its adapter contract.
 * This does not execute a graph step; schema-1 execution remains in program.ts.
 */
export async function loadBlock(id: string, version: string | number, options: {
  target: SpicaLegacyTarget;
  grants: readonly SpicaLegacyCapability[];
}): Promise<SpicaBlockDefinition> {
  const metadata = getBlock(id, version);
  if (!metadata) throw Error(`Unknown SPICA registered block ${id}@${version}.`);
  if (!metadata.targets.includes(options.target)) throw Error(`Unsupported SPICA target for ${id}: ${options.target}.`);
  const missing = metadata.permissions.filter(permission => !options.grants.includes(permission));
  if (missing.length) throw Error(`Missing SPICA permission for ${id}: ${missing.join(', ')}.`);
  const loader = generatedSpicaBlockLoaders[`${metadata.id}@${metadata.version}`];
  if (!loader) throw Error(`Missing SPICA module for ${id}@${version}.`);
  const loaded = (await loader()).default;
  if (loaded.id !== metadata.id || loaded.version !== metadata.version ||
      loaded.implementation.ref !== metadata.implementation.ref ||
      loaded.categoryId !== metadata.categoryId) throw Error(`SPICA loaded contract mismatch for ${id}@${version}.`);
  return loaded;
}

export function inspectBlock(id: string, version: string | number = 1) {
  const block = getBlock(id, version);
  return block ? { ...block, implementationStatus: 'registered-adapter' as const,
    verifiedExecutable: false, testEvidence: [] as readonly string[] } : undefined;
}
