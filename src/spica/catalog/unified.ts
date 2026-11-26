/** Desktop-backed unified discover/inspect; metadata-only drafts never become runnable. */
import type { Graph } from '../graph';
import type { Target } from '../program';
import { draftCapabilityDescriptor, inspectRegisteredCapability, searchRegisteredSpicaCapabilities,
  spicaRegisteredCapabilityCounts } from '../capabilities';
import { ensureCatalog, inspectCatalog, searchCatalog } from './client';

export async function searchSpicaCapabilities(graph: Graph, request: {
  query: string; target?: Target; category?: number; limit?: number; offset?: number; includeDrafts?: boolean;
}) {
  if (typeof request.query !== 'string' || request.query.length > 200) throw Error('Invalid SPICA search query.');
  const limit = Math.max(1, Math.min(12, request.limit ?? 8));
  const offset = Math.max(0, Math.min(350_000, request.offset ?? 0));
  const registered = searchRegisteredSpicaCapabilities(graph, { ...request, limit, offset });
  const matches = [...registered.candidates];
  let draftStatus: 'available' | 'unavailable' | 'not-requested' = 'not-requested';
  let draftError: string | undefined;
  let draftMatches = 0;
  if (request.includeDrafts !== false) {
    try {
      const drafts = await searchCatalog(request.query, request.category ?? null, offset, limit);
      const known = new Set(matches.map(item => `${item.id}@${item.version}`));
      draftMatches = drafts.total;
      for (const item of drafts.candidates) {
        if (!known.has(`${item.id}@${item.version}`)) matches.push(draftCapabilityDescriptor(item));
      }
      draftStatus = 'available';
    } catch (error) {
      draftStatus = 'unavailable';
      draftError = error instanceof Error ? error.message : String(error);
    }
  }
  return {
    candidates: matches.slice(0, limit), totalRegisteredMatches: registered.totalMatches,
    totalDraftMatches: draftStatus === 'available' ? draftMatches : null,
    draftStatus, ...(draftError ? { draftError } : {}),
  };
}
export async function inspectSpicaCapability(graph: Graph, id: string, version: string, target?: Target) {
  if (id.startsWith('spica.block.') || id.startsWith('spica.recipe.')) {
    return inspectRegisteredCapability(graph, id, version, target);
  }
  return draftCapabilityDescriptor(await inspectCatalog(id, version));
}
export async function spicaCapabilityCounts() {
  let indexedDraftCount: number | null = null;
  try { indexedDraftCount = (await ensureCatalog()).entries; } catch { /* Native service unavailable outside desktop. */ }
  return spicaRegisteredCapabilityCounts(indexedDraftCount);
}

/** DCE source-code capabilities are a distinct opt-in discovery surface. */
export { listSourceCapabilities, inspectSourceCapability } from './source-capabilities';
