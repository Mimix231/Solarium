# SPICA schema-1 block registry — Phase 01

Each registered *existing* schema-1 block has exactly one canonical source module under its home `category/subcategory/` directory. The 26 checked-in modules preserve their original `program.ts` IDs, descriptions, target support and permission requirements. They declare the **existing Program v1 adapter**, not an independently implemented Graph V2 node runtime.

## Source of truth

- `category-folders.json`: all 35 published category IDs; never silently renumber them.
- `category/subcategory/block-name.ts`: the one canonical `defineSpicaBlock({...})` declaration for a supported implementation.
- `registry.generated.ts`: deterministic **generated** metadata and dynamic import locators, checked into source.
- `registry.ts`: metadata-only `getBlock`/`listBlocks`/`inspectBlock`; `loadBlock(id, version, {target, grants})` authorizes and lazy-loads the selected registered module.
- `../program.ts::blockRegistry`: compatibility projection; do not add definitions to this file.
- `../warehouse.ts`: legacy registered warehouse adapter, now backed by canonical metadata.
- `../capabilities.ts` and `../catalog/unified.ts`: normalized capability descriptors; native draft proposals remain non-executable, without guessed target or verification evidence.
- `standalone.ts`: embeds the legacy registry in exported standalone source so exported apps do not depend on Solarium internal loaders.

## Checks

`npm run spica:registry` re-generates the runtime manifest. `npm run spica:registry:check` detects stale generated metadata and invalid contracts. `npm run test:spica:phase01` checks ID parity, permission and target safety, lazy imports, catalog truthfulness, source generation and strict TypeScript compilation of actual standalone graph source without needing the UI packages.

The generator refuses **new arbitrary `program-v1-adapter` IDs** until the underlying runtime truly supports them. Later phases must add genuine runtime modes and associated behavioral tests before extending the manifest. A registry entry is **registered**, not verified executable: versioned build and behavioral evidence must be earned separately.

Schema-1 target IDs remain `desktop` and `web`. Dedicated game runtime targets, material components, typed ports and Graph V2 are separate later phases. Keep `src/spica/target/` export compatibility and linked project ownership intact.

See `spica/roadmap/09_PHASE01_IMPLEMENTATION_REPORT.md` for the applied changes and validation limitations.

## Unified category library (2026-11-12)

Both the 26 schema-1 adapter descriptions and 103 independently executable V2 blocks now live in **this directory**, grouped by category. Existing legacy modules remain at `<category>/<subcategory>/<block>.ts`; V2 implementations live at `<category>/runtime/<subcategory>/<block>.ts`. The two compatibility registries continue to expose their unchanged ID/version contracts, and are generated from this **single physical block tree**. V2 adapter runtime mechanics (`../runtime/adapter.ts`, `executor.ts`, `support.ts`, etc.) are NOT a second block catalog. They remain infrastructure.

`npm run spica:registry:check` and `npm run spica:runtime:registry:check` validate the corresponding manifests; no duplicate block source directory remains.
