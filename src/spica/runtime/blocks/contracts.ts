/** Phase 01 preserves schema-1 Program targets and published capabilities exactly. */
export type SpicaLegacyTarget = 'desktop' | 'web';
export type SpicaLegacyCapability = 'records.write' | 'files.open' | 'files.export' | 'custom.transform';
export type SpicaBlockKind = 'screen' | 'action';
export type SpicaBlockMaturity = 'draft' | 'prototype' | 'beta' | 'stable' | 'deprecated';

export interface SpicaBlockPort {
  id: string;
  /** Schema 1 has prose contracts; precise data types arrive in Graph V2. */
  type: 'legacy-descriptor';
  description: string;
}
export interface SpicaBlockDependency { id: string; version: string }
export interface SpicaBlockDefinition {
  id: string;
  version: 1;
  categoryId: number;
  subcategory: string;
  kind: SpicaBlockKind;
  label: string;
  inputs: string;
  outputs: string;
  targets: readonly SpicaLegacyTarget[];
  permissions: readonly SpicaLegacyCapability[];
  tags: readonly string[];
  maturity: Exclude<SpicaBlockMaturity, 'draft'>;
  ports: {
    inputs: readonly SpicaBlockPort[];
    outputs: readonly SpicaBlockPort[];
  };
  dependencies: readonly SpicaBlockDependency[];
  /** This is a real existing schema-1 adapter, NOT a new per-node execution engine. */
  implementation: { kind: 'program-v1-adapter'; ref: string };
}
export interface SpicaBlockMetadata extends SpicaBlockDefinition { sourcePath: string }
export interface SpicaLegacyBlockContract {
  id: string;
  version: 1;
  kind: SpicaBlockKind;
  label: string;
  inputs: string;
  outputs: string;
  targets: readonly SpicaLegacyTarget[];
  capability?: SpicaLegacyCapability;
}
