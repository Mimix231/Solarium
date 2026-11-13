# 02 — Phase 01: Canon Registry, One File per Block, and Compatibility

**Scope for the next implementation round ONLY.** This is an implementation specification, **not** a claim that it has been executed against the user's Solarium source. Read `AGENTS.md` and the canon contract docs first. Preserve Solarium v0.1 and every current Spica app. Do not implement universal graph v2, redesigned UI, or new block families in this phase.

## Why this phase goes first

Current source locations:
- `src/spica/program.ts::blockRegistry` is one central array containing **26** block contracts. It also exposes `recipeCatalog` with **3** recipe descriptors. Existing `Program`, `executeFlow`, validations and scenario fixtures depend on existing IDs.
- `src/spica/warehouse.ts` maps `blockRegistry` and `recipeCatalog` into warehouse entries and exposes `searchSpicaWarehouse`, `browseSpicaWarehouse`, `inspectSpicaComponent`, and `registeredWarehouseCounts`.
- `src/spica/catalog/{categories,manifests,client}.ts` implements draft/descriptor indexing separately from registered blocks; `src-tauri/src/spica_catalog.rs` provides native catalog indexing.
- `src/spica/tools.ts` exposes selected warehouse/Spark tools.
- `tests/spica.test.cjs` is the primary regression suite for this work.

The goal is **source separation + truthful registration**, not changing what existing blocks do.

## Work order, in one round

### Batch 1 — Establish an honest baseline and migration fixtures

1. Record source/archive identity and existing `blockRegistry` IDs in a deterministic fixture; also record recipe IDs. Capture all existing IDs, versions, targets and permissions.
2. Read `AGENTS.md`, `docs/info/INFERENCE_ARCHITECTURE.md`, and `docs/info/SOURCE_AND_ACTION_ARCHITECTURE.md` before modifying tools or agent code.
3. Record checks **before changes**, with actual pass/fail/unavailable statuses: `npm test`, `npm run check`, `npm run lint`, `npm run build`, `npm run test:glitch`, Rust checks where available. No `node_modules` were present in the review archive; do not present skipped tests as passed.
4. Create fixture graphs and Spica export manifests from existing tests without modifying user project directories.

### Batch 2 — Introduce typed block definitions and canonical identifiers

Proposed new modules:

- `src/spica/blocks/contracts.ts`: `SpicaBlockDefinition`, `SpicaBlockTarget`, `SpicaBlockMaturity`, port, permission, dependency and implementation contracts.
- `src/spica/blocks/defineBlock.ts`: `defineSpicaBlock()` with compile-time typing and runtime invariants.
- `src/spica/blocks/categories.ts`: canonical category ID mapping that uses the **existing** 35 IDs; no renumbering.
- `src/spica/blocks/registry.ts`: public `getBlock`, `listBlocks`, `loadBlock`, `inspectBlock`, `isExecutableBlock` facade.
- `src/spica/blocks/registry.generated.ts`: **tool-generated and checked** mapping of registered module entrypoints, not manually maintained large arrays.
- `scripts/generate-spica-registry.*`: developer-time scan + validation; exact script extension depends on current repo tooling (Node CJS is already used in `scripts/`).

Each block must have a stable `id`, `version`, `categoryId`, `kind`, supported targets, declared permissions, an input/output contract and an actual module implementation locator. File path and ID must agree. Detect duplicate keys, missing implementations, invalid categories, circular imports and stale generated registry entries. **Import executable modules lazily**; catalog-only entries must not become bundled executable imports.

### Batch 3 — Move the existing 26 contracts into one-file-per-block category folders

Each original entry moves to one source file in its owning category. Preserve the original block ID exactly. An illustrative layout (final subcategory names are decided by actual ownership):

```text
src/spica/blocks/
  contracts.ts
  defineBlock.ts
  categories.ts
  registry.ts
  registry.generated.ts
  ui/
    forms/
      form.tsx
      record-number.tsx
      record-choice.tsx
  layout/
    responsive/
      layout-split.tsx
      form-grid.tsx
  variables/
    records/
      set.ts
  functions/
    flow/
      when.ts
      format.ts
  professionalism/
    audits/
      layout-audit.ts
  storage/
    records/
      save.ts
  game-2d/
    scenes/
      game.ts
  ...other categories and each existing block exactly once
```

**Naming rule:** One distinct executable block definition per file, one unique registered ID per definition. Blocks can import shared algorithms from `src/spica/runtime/` or `src/spica/shared/`; shared helpers are **not** secretly counted as separate blocks. `.tsx` is appropriate for a React renderer and `.ts` for pure/command logic. Game code stays under target-specific game categories.

Keep the legacy public `blockRegistry` accessible during the transition as a **compatibility projection** generated from canonical metadata. Do not rewrite all `Program` execution code until Phase 04; do not change schema-1 serialization or exported app semantics in Phase 01.

### Batch 4 — Unified truthful discovery

1. Add normalized `SpicaCapabilityDescriptor` with `origin`, `maturity`, `implementationStatus`, `targetSupport`, and `testEvidence`.
2. Bridge canonical block files + 3 recipes to `src/spica/warehouse.ts`, retaining the original APIs as adapters.
3. Integrate the existing metadata-only catalog through a single query/inspect facade, but keep catalog drafts **non-runnable**.
4. Expose `plannedCapacity`, `indexedDraftCount`, `registeredBlockCount`, `registeredRecipeCount`, `verifiedExecutableCount` separately; do not infer verified count from file presence.
5. Require explicit block `id@version` locks when a graph/app refers to an executable component.

### Batch 5 — Tests, parity, and safe migration

Add tests for:
- Exactly 26 legacy block IDs and 3 recipe IDs still resolve at their original versions; no accidental rename or duplicate.
- All 26 block files expose precisely one canonical definition, discoverable by ID and valid category.
- `registry.generated.ts` has no stale/missing entries; order-independent, byte-stable generation.
- Bad category, duplicate ID, unknown permission, missing implementation and mismatched target fail with clear diagnostics.
- Draft-only catalog entries are **never** executable or accidentally installed.
- Existing `Program` validation, `executeFlow`, saved Notes Organizer graphs, exported code and tests remain behaviorally compatible.
- Runtime imports are not loaded to answer a metadata-only warehouse search.
- Web Search OFF, project scoping and Ask/Auto/YOLO permission rules remain unchanged.

## Phase 01 deliverable checklist

- [ ] Every one of the 26 existing block contracts is in a category/subcategory **individual file**.
- [ ] Exactly one generated canonical runtime registry; no second hand-edited array with conflicting data.
- [ ] `blockRegistry`, `recipeCatalog`, Spica tools and warehouse callers still work through compatibility interfaces.
- [ ] The 35 category IDs remain stable, with 10K **capacity** each, not fabricated 350K executable implementations.
- [ ] Proposals/drafts are never marked registered or verified.
- [ ] Regression tests execute and results are recorded accurately.
- [ ] A documented complete checkpoint contains changed file list, ID parity, failing/unavailable checks and rollback instructions.

## Copilot-ready first-round instruction

> Implement **Phase 01 only** from this plan against the current Solarium repository. Read AGENTS.md and the inference and sources architecture contracts first. Keep the existing `Graph` schema 1 and all public Spica APIs compatible. Split each of the 26 registered block definitions from `src/spica/program.ts::blockRegistry` into exactly one typed source file in a category/subcategory directory, preserving IDs, versions, permissions, and behavior. Build a generated validated lazy registry, adapt warehouse discovery to it, preserve the 3 recipes, and distinguish catalog-only descriptors from executable blocks. Add automated parity and compatibility tests. Run actual relevant checks and report exact results; do not implement later phases or claim success on skipped checks.
