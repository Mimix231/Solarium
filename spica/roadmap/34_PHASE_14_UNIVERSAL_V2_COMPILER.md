# Phase 14 — Universal Graph V2 Application Renderer & Compiler

**Goal:** Fix the documented export limitation: Graph V2 block compositions can run in an isolated SPICA runtime but **arbitrary V2 apps cannot yet be exported**. Build a consistent, typed lowering pipeline for supported UI/data/event/storage compositions, with explicit reasons for unsupported blocks.

## Supported-first compiler architecture

Proposed stages: `GraphV2` → `GraphValidator` → `BlockCapabilityResolver` → `TypedApplicationIR` → `TargetLowerer(web|desktop)` → `SourceEmitter` → `BuildVerifier`.

- Compile only capabilities with verified target support and code-generation implementations. Do not imply that all 103 runtime blocks can magically export.
- `TypedApplicationIR` describes screens, routes, widgets, state, events, data collections, effects, styles, permissions and module dependencies independent of a specific React/MUI or Tauri target.
- Provide a per-block export contract: `supportsTarget`, `lower`, `requiredImports`, `requiredPackages`, `runtimePermissions`, `testFixture`. Keep one source file per block under `src/spica/runtime/blocks/`; shared lowering modules may live under `src/spica/compiler/`, not duplicate block definitions.
- Produce **explicit diagnostics** when a V2 block has no exporter, a type mismatch, a cycle, or a forbidden side effect.
- Preserve schema-1 exporter behavior and existing app data. Prefer a migration/adapter surface rather than deleting old emitters before parity.

## Implementation steps

1. Inventory current `emitTauri`, `emitWeb`, existing `src/spica/target/` component set and Graph V2 runtime.
2. Define versioned intermediate representation and deterministic code-generation contract.
3. Lower a small, end-to-end subset: note records, filtered/sorted list, form, navigation, state, Markdown editor/preview, shared style/layout tokens.
4. Connect graph event flow to generated runtime handlers and storage; include permission metadata and real target dependencies.
5. Ensure browser export uses browser storage and downloads, desktop export uses approved Tauri bridges, and unsupported target behavior is not silently replaced.
6. Add emitter ownership receipts, content hashes, reproducible lockfile expectations, build/test reports and user-file conflict checks.
7. Make Phase 13 Workbench preview and generated app share component implementation or formally specified render semantics; report any preview/export differences.
8. Expand the target-lowering test fixtures block by block, not by merely marking `executable: true`.

## Minimum working proof

Dona creates a note application graph with a searchable Recents list and Markdown editor through **generic blocks**; SPICA compiles the supported graph to a browser app and a Tauri desktop app, each with functional create/edit/save/delete operations and persistent storage. Actual exports launch independently of Solarium. No hardcoded “make notes recents” feature builder is allowed.

## Acceptance gate

- Typecheck and run the exported browser application in a browser test; run Tauri/native verification on the actual Windows toolchain.
- Round-trip graph serialization and deterministic emission are proven.
- Unsupported V2 block ID produces exact target-specific error, not partial “passed” export.
- Preview and exported UI semantics match on navigation/state/validation/keyboard behavior.
- Previous schema-1 project output and user-owned code still build.
