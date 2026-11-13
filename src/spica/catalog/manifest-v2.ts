/** Versioned warehouse metadata compiler. It does not register or execute code. */
import { warehouseCategories } from './categories';

export type CatalogMaturity = 'draft' | 'deprecated';
export type CatalogKind = 'primitive' | 'profile' | 'composition' | 'recipe';
export interface WarehouseCategoryDefinition { id: number; slug: string; title: string; capacity: number; origin: 'builtin' | 'user' }
export interface WarehouseManifestEntry {
  id: string; version: string; category: number; family: string; kind: CatalogKind; maturity: CatalogMaturity;
  title: string; summary: string; tags: readonly string[]; reference: string;
  dependencies?: readonly { id: string; version: string }[];
  replacedBy?: { id: string; version: string };
}
export interface WarehouseManifestV2 { format: 2; source: string; categories: readonly WarehouseCategoryDefinition[];
  entries: readonly WarehouseManifestEntry[] }
export interface CompiledWarehouseManifest { format: 2; source: string; categories: WarehouseCategoryDefinition[];
  entries: WarehouseManifestEntry[]; orderedIds: string[]; revisionMaterial: string }

const validId = (id: string) => id.length <= 200 && /^spica(?:\.[a-z0-9][a-z0-9_-]*)+$/.test(id);
const validVersion = (version: string) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version);
const validSlug = (slug: string) => /^[a-z][a-z0-9-]{1,59}$/.test(slug);
const limited = (value: string, length: number) => value.trim().length > 0 && value.length <= length && !value.includes('\0');
export function builtInWarehouseCategories(): WarehouseCategoryDefinition[] {
  return warehouseCategories.map(category => ({ id: category.id,
    slug: category.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title: category.title, capacity: category.capacity, origin: 'builtin' }));
}
/** Validates immutable built-in category IDs and disjoint user-defined category namespaces. */
export function validateWarehouseCategories(categories: readonly WarehouseCategoryDefinition[]): WarehouseCategoryDefinition[] {
  if (categories.length < warehouseCategories.length || categories.length > 2000) throw Error('Category registry must retain all 35 built-ins (limit 2000 total).');
  const ids = new Set<number>(); const slugs = new Set<string>();
  for (const category of categories) {
    if (!Number.isSafeInteger(category.id) || category.id < 1 || category.id > 1_000_000 ||
        !validSlug(category.slug) || !limited(category.title, 100) || !Number.isSafeInteger(category.capacity) ||
        category.capacity < 1 || category.capacity > 1_000_000 || !['builtin','user'].includes(category.origin) ||
        ids.has(category.id) || slugs.has(category.slug)) throw Error(`Invalid or duplicate warehouse category ${category.id}.`);
    ids.add(category.id); slugs.add(category.slug);
  }
  const originals = builtInWarehouseCategories();
  for (const original of originals) {
    const matching = categories.find(category => category.id === original.id);
    if (!matching || matching.origin !== 'builtin' || matching.slug !== original.slug || matching.title !== original.title || matching.capacity !== original.capacity) {
      throw Error(`Built-in warehouse category ${original.id} cannot be renumbered or replaced.`);
    }
  }
  if (categories.some(category => category.id <= originals.length && category.origin !== 'builtin')) throw Error('User categories must use a new ID.');
  return [...categories].sort((a,b) => a.id-b.id);
}
export function compileWarehouseManifestV2(manifest: WarehouseManifestV2): CompiledWarehouseManifest {
  if (manifest.format !== 2 || !limited(manifest.source, 120)) throw Error('Expected a versioned warehouse manifest from a named source.');
  const categories = validateWarehouseCategories(manifest.categories);
  const categorySet = new Set(categories.map(category => category.id));
  if (manifest.entries.length > 100_000) throw Error('Split catalogs into bounded manifests (100K entries per manifest).');
  const seen = new Map<string, WarehouseManifestEntry>();
  for (const entry of manifest.entries) {
    if (!validId(entry.id) || !validVersion(entry.version) || !categorySet.has(entry.category) ||
        !validSlug(entry.family) || !limited(entry.title, 220) || !limited(entry.summary, 1600) ||
        !limited(entry.reference, 2000) || !['primitive','profile','composition','recipe'].includes(entry.kind) ||
        !['draft','deprecated'].includes(entry.maturity) || !Array.isArray(entry.tags) || entry.tags.length > 32 ||
        entry.tags.some(tag => typeof tag !== 'string' || !limited(tag, 100)) ||
        (entry.replacedBy !== undefined && entry.maturity !== 'deprecated')) throw Error(`Invalid draft manifest entry ${entry.id}.`);
    const key = `${entry.id}@${entry.version}`;
    if (seen.has(key)) throw Error(`Duplicate metadata ID/version: ${key}.`);
    seen.set(key, entry);
  }
  const orderedIds: string[] = []; const visited = new Set<string>(); const pending = new Set<string>();
  const visit = (key: string): void => {
    if (pending.has(key)) throw Error(`Warehouse metadata dependency cycle at ${key}.`);
    if (visited.has(key)) return;
    const entry = seen.get(key);
    if (!entry) throw Error(`Missing locked warehouse metadata dependency ${key}.`);
    pending.add(key);
    for (const dep of entry.dependencies ?? []) {
      if (!validId(dep.id) || !validVersion(dep.version)) throw Error(`Invalid metadata dependency from ${key}.`);
      visit(`${dep.id}@${dep.version}`);
    }
    if (entry.replacedBy) {
      const replacement = `${entry.replacedBy.id}@${entry.replacedBy.version}`;
      if (replacement === key || !seen.has(replacement)) throw Error(`Missing or self-referential replacement ${replacement}.`);
    }
    pending.delete(key); visited.add(key); orderedIds.push(key);
  };
  [...seen.keys()].sort().forEach(visit);
  const entries = orderedIds.map(key => seen.get(key)!);
  return { format: 2, source: manifest.source, categories, entries, orderedIds,
    revisionMaterial: JSON.stringify({ format: 2, source: manifest.source, categories, entries }) };
}
/** Converts existing checked-in metadata to truthful draft manifests; never promises executable adapters. */
export function fromDraftRecords(records: readonly { id: string; category: number; title: string; summary: string; tags: string; reference: string }[], source: string): WarehouseManifestV2 {
  return { format: 2, source, categories: builtInWarehouseCategories(), entries: records.map(record => ({
    id: record.id, version: '1.0.0', category: record.category,
    family: record.id.includes('research.profile') ? 'research-profiles' :
      record.id.includes('game.') ? 'game-components' : 'candidate-blocks',
    kind: record.id.includes('.profile.') ? 'profile' : 'primitive', maturity: 'draft',
    title: record.title, summary: record.summary,
    tags: record.tags.split(/\s+/).filter(Boolean).slice(0, 32), reference: record.reference,
  })) };
}
