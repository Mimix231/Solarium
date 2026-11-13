import { atlasBlocks } from './data/atlas.generated';
import { gameComponents } from './data/games.generated';
import { researchDomains, researchIntents, researchPolicies, researchPrimitives } from './data/research.generated';
import { warehouseCategories } from './categories';
import { compileWarehouseManifestV2, fromDraftRecords, builtInWarehouseCategories } from './manifest-v2';

export interface DraftManifest {
  id: string;
  category: number;
  title: string;
  summary: string;
  tags: string;
  reference: string;
}
const slug = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Checked-in metadata. The native index receives records and taxonomy, never document paths to interpret. */
export function catalogManifests() {
  const records: DraftManifest[] = [
    ...atlasBlocks.map(([category, name, purpose, contract, note]) => ({
      id: `spica.atlas.${String(category).padStart(2, '0')}.${slug(name)}`, category, title: name, summary: purpose,
      tags: `${warehouseCategories[category - 1]?.title ?? ''} ${contract}`, reference: `${contract} · ${note}`,
    })),
    ...researchPrimitives.map(([id, purpose, group]) => ({
      id: `spica.${id}`, category: 27, title: id.replace(/^research\./, '').replaceAll('.', ' '), summary: purpose, tags: group,
      reference: 'Proposed research primitive',
    })),
    ...gameComponents.map(([type, name, description, category, source]) => ({
      id: `spica.game.${slug(type)}.${slug(source)}`, category: 28, title: name, summary: description, tags: category,
      reference: `Game editor reference · ${source}`,
    })),
    { id: 'spica.style.token-alias', category: 29, title: 'Token alias', summary: 'Refer to a shared style token by stable ID.', tags: 'style theme tokens', reference: 'Design-system proposal' },
    { id: 'spica.function.format-value', category: 30, title: 'Format value', summary: 'Format a typed input as display text.', tags: 'pure function text', reference: 'Function proposal' },
    { id: 'spica.layout.constraint-grid', category: 31, title: 'Constraint grid', summary: 'Arrange children using typed sizing constraints.', tags: 'responsive grid layout', reference: 'Layout proposal' },
    { id: 'spica.appearance.surface-treatment', category: 32, title: 'Surface treatment', summary: 'Describe layered fills and their fallback appearance.', tags: 'surface appearance style', reference: 'Appearance proposal' },
    { id: 'spica.interface.screen-router', category: 33, title: 'Screen router', summary: 'Connect an app shell to named screen destinations.', tags: 'routes interface screen', reference: 'Interface proposal' },
    { id: 'spica.ui.record-table', category: 34, title: 'Record table', summary: 'Show typed record fields in accessible table columns.', tags: 'ui table records', reference: 'UI component proposal' },
    { id: 'spica.quality.focus-audit', category: 35, title: 'Focus audit', summary: 'Report controls whose keyboard focus state needs inspection.', tags: 'keyboard accessibility audit', reference: 'Quality-check proposal' },
  ];
  const identifiers = new Set<string>();
  for (const record of records) {
    if (!/^spica(?:\.[a-z0-9][a-z0-9_-]*)+$/.test(record.id) || record.id.length > 200 || identifiers.has(record.id) ||
        !warehouseCategories[record.category - 1] || !record.title.trim() || !record.summary.trim()) throw Error(`Invalid catalog manifest ${record.id}.`);
    identifiers.add(record.id);
  }
  // Compile a deterministic metadata contract before the native FTS index receives it.
  const compiled = compileWarehouseManifestV2(fromDraftRecords(records, 'solarium-bundled'));
  return { records, intents: researchIntents, domains: researchDomains, policies: researchPolicies,
    categories: builtInWarehouseCategories(), manifestVersion: compiled.format };
}
