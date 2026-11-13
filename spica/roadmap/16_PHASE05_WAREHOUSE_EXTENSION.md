# SPICA warehouse Phase 05 — category and metadata operations

## Catalog boundaries

- **35 stable built-in categories** are defined in `src/spica/catalog/categories.ts` and validated by `builtInWarehouseCategories()`.
- A **user metadata category** is a new ID greater than 35 with a unique lowercase `slug`, an immutable capacity, and `origin:'user'`. It does not register source code.
- The standard capacity is **10,000 entries/category**. This is an organizational target, not a claim of 350K executable blocks.
- **Registered adapters** (26 legacy schema-1 source adapters + 6 V2 executable blocks) stay in their existing per-block source folder registries; metadata-only entries never enter those registries.

## Native API

| Tauri command | Purpose | Writes? |
| --- | --- | --- |
| `spica_catalog_prepare` | Initialize/migrate the bundled seed and stable categories | Yes, metadata only |
| `spica_catalog_categories` | Read stored built-in and user categories | No |
| `spica_catalog_register_category` | Add a user category namespace | Yes, metadata only |
| `spica_catalog_add_drafts` | Add bounded unique user descriptor records | Yes, metadata only |
| `spica_catalog_search` | Indexed, paginated, category/family-type-faceted metadata search | No |
| `spica_catalog_inspect` | Read exact ID/version metadata | No |

`spica_catalog_add_drafts` accepts 1–1,000 records per transaction. Record IDs must start with the chosen user's category namespace (`spica.user.<slug>.*`, with hyphens normalized to underscores). The server enforces category capacity, unique IDs and text bounds. `spica_catalog_prepare` leaves user category IDs and descriptors intact when bundled metadata changes.

## TypeScript API

`ensureCatalog`, `searchCatalog`, `inspectCatalog`, `listCatalogCategories`, `registerCatalogCategory`, `addCatalogDrafts` in `src/spica/catalog/client.ts`. `compileWarehouseManifestV2` and `validateWarehouseCategories` in `manifest-v2.ts` validate IDs, version locks, dependency order, cycles, deprecations and stable built-in metadata before index ingestion.

`searchSpicaCapabilities` in `src/spica/catalog/unified.ts` merges honest **source-backed registered** results with **catalog-only drafts** in small bounded responses; `inspectSpicaCapability` can distinguish these. An unavailable native catalog should not silently transform drafts into executable blocks.

## Authoring real new executable blocks

A draft entry is a **proposal**. Promote a new capability only by implementing a real module under `src/spica/blocks/<category>/<subfamily>/` (schema 1) or `src/spica/runtime/blocks/<category>/` (V2), providing typed inputs/outputs, supported targets, permission declarations, deterministic registration, and positive/negative tests. Verify source ownership, compatibility and native target behavior. Games will be rendered in dedicated game targets, not through generic MUI form blocks.

## Scale benchmark

Run `npm run spica:catalog:benchmark` (uses Python 3's stdlib `sqlite3`) or run `python -X utf8 scripts/benchmark-spica-catalog.py --entries 350000 --rounds 4 --output spica/roadmap/local-benchmark.json`. The fixture DB lives in a temporary directory, is deleted on completion, and **never** ships 350K synthetic entries. Track p50/p95 search latency, indexing time, result pages and index size. Broad FTS queries currently have higher tail latency; consider result-count caching/bounded count queries if measurements on user hardware require it. This is *not* a Rust/Tauri performance result.

## Next steps

Phase 06 converts app-related Styling, Layout, Appearance, Interface, UI and Professionalism blocks into actual library-backed, tested renderers with shared theme tokens. Only verified adapters are eligible for model-directed execution or standalone application export.
