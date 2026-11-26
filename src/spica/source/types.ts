/** Dream Construction Engine Phase 02: a source capability is NOT a SPICA graph node. */
export type SourceBlockKind = 'portable-source' | 'source-generator' | 'host-runtime' | 'knowledge-descriptor';
export type SourceTarget = 'typescript-web' | 'typescript-desktop';
export type SourceLanguage = 'typescript';
export interface SourceSymbol { readonly name: string; readonly kind: 'function' | 'type' | 'interface' | 'value'; }
export interface SourceRequirement { readonly id: string; readonly version: string; readonly symbol: string; }
export interface SourceProvenance {
  readonly kind: 'runtime-adaptation' | 'new-implementation' | 'documentation';
  readonly sourcePath?: string;
  readonly runtimeId?: string;
  /** Human-reviewed source code is not assumed to be equivalent to a host adapter. */
  readonly adaptation?: string;
}
export interface SourceBlockBase {
  readonly id: string;
  readonly version: string;
  readonly kind: SourceBlockKind;
  readonly description: string;
  readonly category: string;
  readonly targets: readonly SourceTarget[];
  readonly language: SourceLanguage;
  readonly provenance: SourceProvenance;
}
export interface PortableSourceBlock extends SourceBlockBase {
  readonly kind: 'portable-source';
  /** Canonical source path relative to src/spica/source/. No user-controlled paths. */
  readonly sourcePath: string;
  /** SHA-256 of exact UTF-8 source bytes, checked again on load. */
  readonly sha256: string;
  readonly outputPath: string;
  readonly exports: readonly SourceSymbol[];
  readonly requires: readonly SourceRequirement[];
  readonly validation: { readonly tests: readonly string[]; readonly compilation: 'typescript-strict'; };
}
export interface GeneratedSourceFile { readonly path: string; readonly source: string; }
export interface SourceGeneratorBlock extends SourceBlockBase {
  readonly kind: 'source-generator';
  readonly configSchema: { readonly allowed: readonly string[]; readonly required: readonly string[] };
  readonly exports: readonly SourceSymbol[];
  readonly requires: readonly SourceRequirement[];
  /** Pure deterministic generator: it writes nothing and requires no tool permission. */
  readonly generate: (config: Readonly<Record<string, unknown>>) => readonly GeneratedSourceFile[];
  readonly validation: { readonly tests: readonly string[]; readonly compilation: 'typescript-strict'; };
}
export interface HostRuntimeBlock extends SourceBlockBase {
  readonly kind: 'host-runtime';
  readonly runtimeId: string;
  readonly reason: string;
}
export interface KnowledgeSourceBlock extends SourceBlockBase {
  readonly kind: 'knowledge-descriptor';
  readonly notes: string;
}
export type SourceBlockDefinition = PortableSourceBlock | SourceGeneratorBlock | HostRuntimeBlock | KnowledgeSourceBlock;

export interface LoadedPortableSource { readonly definition: PortableSourceBlock; readonly source: string; }
/** Integrity evidence for a staged, in-memory source file. Future writers must verify
 * the digest against the bytes actually written before confirming construction. */
export interface SourceFileReceipt {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly owner: { readonly id: string; readonly version: string };
}
export interface SourceFileBundle {
  readonly files: readonly GeneratedSourceFile[];
  readonly receipts: readonly SourceFileReceipt[];
  readonly blocks: readonly { id: string; version: string; provenance: SourceProvenance }[];
}
