import { invokeProject } from '../../engine/intelligence/commands';

export interface CatalogEntry {
  id: string; version: string; category: number; kind: 'primitive' | 'profile'; maturity: 'draft';
  title: string; summary: string; tags: string; reference: string;
}
export interface CatalogCounts { revision: string; entries: number; profiles: number }
export interface CatalogCategory { id: number; slug: string; title: string; capacity: number; origin: 'builtin' | 'user' }
export interface CatalogPage { candidates: CatalogEntry[]; total: number }

let ready: Promise<CatalogCounts> | undefined;
export function ensureCatalog(): Promise<CatalogCounts> {
  ready ??= import('./manifests').then(({ catalogManifests }) => invokeProject<CatalogCounts>('spica_catalog_prepare', { seed: catalogManifests() }))
    .catch(error => { ready = undefined; throw error; });
  return ready;
}

export async function searchCatalog(query: string, category: number | null, offset = 0, limit = 8, kind: CatalogEntry['kind'] | null = null) {
  await ensureCatalog();
  return invokeProject<CatalogPage>('spica_catalog_search', { query, category, offset, limit, kind });
}

export async function inspectCatalog(id: string, version: string) {
  await ensureCatalog();
  return invokeProject<CatalogEntry>('spica_catalog_inspect', { id, version });
}

/** Bounded native metadata operations; none of them compile or execute a block. */
export async function listCatalogCategories(): Promise<CatalogCategory[]> {
  await ensureCatalog();
  return invokeProject<CatalogCategory[]>('spica_catalog_categories', {});
}
export async function registerCatalogCategory(input: { slug: string; title: string; capacity?: number }): Promise<CatalogCategory> {
  await ensureCatalog();
  return invokeProject<CatalogCategory>('spica_catalog_register_category', {
    slug: input.slug, title: input.title, capacity: input.capacity ?? 10_000,
  });
}
export async function addCatalogDrafts(category: number, records: readonly {
  id: string; category: number; title: string; summary: string; tags: string; reference: string;
}[]): Promise<number> {
  await ensureCatalog();
  if (records.length < 1 || records.length > 1000 || records.some(entry => entry.category !== category)) {
    throw Error('Import 1–1000 metadata-only entries for one registered user category.');
  }
  return invokeProject<number>('spica_catalog_add_drafts', { category, records });
}
