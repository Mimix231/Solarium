# SPICA Phase 05 — Scalable Warehouse and Spark Parameter Inspection

**Canonical input:** `Solarium_SPICA_Phase04_Runtime_and_Graph_Fixes.zip`  
**Canonical SHA-256:** `41edcea97616cf15838da3b9a065367dd6f4365ddf03f14e2084b10b71ff53c3`  
**Date:** 2026-11-12  
**State:** Source implementation complete; focused tests pass; desktop build/native runtime not verified on Windows.

## Why the graph edits failed

The user-provided Dona work log shows real attempted graph operations, but the model guessed unsupported record types (`date`, `string_array`), invented a `settings` screen view, and supplied invalid or duplicate fields. The old model-facing schema was too permissive or only partly described the current graph; existing graph IDs and operation-specific constraints were not discoverable before edits. The graph engine correctly rejected those unsafe proposals, but Dona was not reliably given the information needed to recover.

## Implemented: inspect → preflight → save

- `inspect_params` is a **read-only** Spark tool returning the current graph revision, real collections/fields/screens/flows, supported operations and types, known IDs, operation-specific constraints, and a batch-edit example derived from the current graph. If prerequisites do not exist, it reports `available:false`, `blockers`, and `example:null` rather than supplying invalid JSON.
- `validate_spica_edit` is a **read-only atomic preflight**. It uses the same graph validation as `edit_spica_graph`, returns actionable failures or an approved-to-submit proposal, and never updates the revision.
- `edit_spica_graph` remains the only graph-write operation. It requires the correct revision and existing project write authorization. It does not bypass duplicate/invalid-field checks or scenario protection.
- The Spark routing prioritizes `read_spica_graph → inspect_params → validate_spica_edit → edit_spica_graph`, returns to the inspector on invalid edits, and preserves the tool errors as visible evidence rather than pretending they passed.
- Both validate and edit operations share the same advertised schema and alias-normalization rules. Settings actions (`add_page`, `add_setting`, `label_setting`, `remove_setting`) are exposed through the programming tool contract; settings screens are **not** a new view type.
- Examples are exercised in tests against actual schema-1 graph validators, including graphs with and without installed recipes. Missing prerequisites are reported explicitly.

### Source anchors

- `src/spica/inspect-params.ts` — `inspectSpicaParameters` / state-aware examples
- `src/spica/tools.ts` — `spicaToolContract`, `normalizeSpicaProposal`, `reviewSpicaEdit`, `selectSpicaTools`, `executeSpicaTool`
- `src/engine/agent.ts` — validate-before-edit model guidance, feedback/recovery, bounded retry routing
- `src/engine/tools.ts` — same argument validation at dispatch
- `src/engine/live-workspace.ts` — real read/check activity mapping

## Implemented: scalable catalog

- Existing category IDs **1–35 remain stable**, including Variables (05), Web Research (27), Styling (29), Functions (30), Layout (31), Visual Appearance (32), Interface (33), UI (34), and Professionalism (35).
- `src/spica/catalog/manifest-v2.ts` defines versioned catalog-only metadata, deterministic dependency-order checks, cycle and missing-dependency rejection, replacement validation, and truthful `draft`/`deprecated` maturity.
- Native SQLite adds a category table, preserves user-added categories and metadata when the bundled seed changes, and supports transactional bulk draft insertion (1–1,000 per batch) with explicit namespace/capacity validation and incremental FTS5 updates.
- Metadata search remains paginated (max 12 entries per page), with category/kind filtering, bounded query length, offset and exact ID inspection. Registered source-backed capabilities are discovered separately and keep their runtime provenance. Drafts are never executable.
- The existing `SpicaWarehouse` adds an MUI-based `New category` flow. A category reserves **up to 10K descriptive slots by default**, but creates no code automatically.
- The Spark tools `search_spica_catalog`, `inspect_spica_catalog`, and `list_spica_categories` provide truthful counts and bounded retrieval rather than dumping 350K definitions into the model context.

### Source anchors

- `src/spica/catalog/{manifest-v2,manifests,client,unified,categories}.ts`
- `src-tauri/src/spica_catalog.rs`, `src-tauri/src/lib.rs`
- `src/components/SpicaWarehouse.tsx`
- `scripts/benchmark-spica-catalog.py`

## What was measured

Synthetic SQLite FTS5 fixture: **350,000 non-executable descriptors across 35 category IDs (10K/category)**. Index build around **5.8 seconds**, footprint around **418 MiB**, median of the sampled searches around **51 ms**, with broad queries taking substantially longer (recorded p95 ~447 ms). Machine- and fixture-specific values are in `13_PHASE05_BENCHMARK_RESULTS.json`. The synthetic records **are not shipped in the runtime catalog**. This benchmark is neither a frontend memory test nor a native Rust/Tauri runtime test. Do not extrapolate these measurements to every Windows PC or every query.

Shipped baseline remains **26 schema-1 source adapters, 6 Graph V2 executable runtime adapters, 3 known recipes**, and a separately indexed draft catalog with 10,000 web-research profiles and existing checked-in descriptors. The **350,000 figure is catalog capacity, not working blocks**.

## Validation record

| Check | Result |
| --- | --- |
| Phase 01 regression | 12/12 passed |
| Phase 02 regression | 9/9 passed |
| Phase 03 regression | 12/12 passed |
| Phase 04 regression | 14/14 passed |
| Phase 05 tests (inspector, edit dry-run/save, manifest, category IDs, staged tools, exports) | 10/10 passed |
| Legacy adapter registry generator | 26 sources, 35 category definitions — passed |
| Graph V2 executable registry generator | 6 runtime sources — passed |
| TS/TSX syntax parse | 318 source files — passed |
| Strict TypeScript Phase05 subsystem compilation | Passed via `scripts/check-spica-phase05.cjs` |
| Synthetic FTS5 350K benchmark | Completed, results above |
| Full Vite/React/MUI build | **Unverified**: npm dependencies absent; `vite/client` types missing |
| Native Rust/Tauri compile and Windows desktop launch | **Unverified**: Rust/Windows toolchain unavailable here |
| Live local GGUF/Dona tool-calling test | **Unverified**: not executed on user's desktop |

The implemented preflight prevents the observed **invalid graph writes**, but cannot guarantee every small local model will always choose the correct next tool. Actual production integration must be verified on the user's Windows system.

**Next phase:** 06 — professional MUI-backed application design system and target-specific rendering, while keeping game blocks separate.
