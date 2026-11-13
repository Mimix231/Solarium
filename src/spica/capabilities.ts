/** Truthful shared capability descriptors. Catalog proposals are never executable modules. */
import type { Graph } from './graph';
import { warehouseCategories, warehouseCapacity } from './catalog/categories';
import { browseSpicaWarehouse, inspectSpicaComponent, registeredWarehouseCounts } from './warehouse';
import type { Capability, Target } from './program';

export type SpicaCapabilityOrigin = 'registered-block' | 'registered-recipe' | 'catalog-draft';
export type SpicaImplementationStatus = 'registered-adapter' | 'registered-recipe' | 'metadata-only';
export interface SpicaDraftCatalogEntry {
  id: string; version: string; category: number; kind: 'primitive' | 'profile'; maturity: 'draft';
  title: string; summary: string; tags: string; reference: string;
}
export interface SpicaCapabilityDescriptor {
  id: string;
  version: string;
  title: string;
  summary: string;
  categoryId: number;
  origin: SpicaCapabilityOrigin;
  maturity: 'draft' | 'prototype' | 'beta' | 'stable' | 'deprecated' | 'blocked';
  implementationStatus: SpicaImplementationStatus;
  targetSupport: readonly Target[];
  permissions: readonly Capability[];
  sourceRef: string;
  testEvidence: readonly string[];
  /** No source-file presence or test-suite name is proof of an actually verified executable. */
  verifiedExecutable: boolean;
}
export function draftCapabilityDescriptor(entry: SpicaDraftCatalogEntry): SpicaCapabilityDescriptor {
  return {
    id: entry.id, version: entry.version, title: entry.title, summary: entry.summary,
    categoryId: entry.category, origin: 'catalog-draft', maturity: 'draft',
    implementationStatus: 'metadata-only', targetSupport: [], permissions: [],
    sourceRef: entry.reference, testEvidence: [], verifiedExecutable: false,
  };
}
export function inspectRegisteredCapability(graph: Graph, id: string, version: string, target?: Target): SpicaCapabilityDescriptor {
  const entry = inspectSpicaComponent(graph, id, version, target);
  const isRecipe = entry.kind === 'recipe';
  return {
    id: entry.id, version: entry.version, title: entry.title, summary: entry.summary,
    categoryId: entry.primaryCategoryId, origin: isRecipe ? 'registered-recipe' : 'registered-block',
    maturity: entry.maturity, implementationStatus: isRecipe ? 'registered-recipe' : 'registered-adapter',
    targetSupport: entry.targets, permissions: entry.permissions, sourceRef: entry.docsRef,
    testEvidence: [], verifiedExecutable: false,
  };
}
/** Pure registered search; the native indexed catalog is composed in catalog/unified.ts. */
export function searchRegisteredSpicaCapabilities(graph: Graph, request: {
  query: string; target?: Target; category?: number; offset?: number; limit?: number;
}) {
  const page = browseSpicaWarehouse(graph, request);
  return {
    candidates: page.candidates.map(item => inspectRegisteredCapability(graph, item.id, item.version, request.target)),
    totalMatches: page.totalMatches,
  };
}
export function spicaRegisteredCapabilityCounts(indexedDraftCount: number | null = null) {
  return {
    categoryCount: warehouseCategories.length,
    plannedCapacity: warehouseCapacity,
    indexedDraftCount,
    registeredBlockCount: registeredWarehouseCounts.adapters,
    registeredRecipeCount: registeredWarehouseCounts.recipes,
    verifiedExecutableCount: 0,
  };
}
