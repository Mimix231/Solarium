# Solarium × SPICA — Phase 04 implementation report

**Phase:** 04 — Executable Block Runtime + Graph Tool Repair  
**Canonical input:** `Solarium_SPICA_Phase03_Universal_Graph_and_Spark_Tools.zip`  
**Canonical input SHA-256:** `d75990da361877c0cf5b3c68b94f91a22c6775e93d8a1904336d37effb4e2cf9`  
**Date:** 2026-11-12  
**Status:** Implemented; focused tests pass; full Windows/Tauri build not verified in this environment.

## What changed

1. **Fixed schema-1 Spark tool-call failures.** `edit_spica_graph` screen field objects can be normalized to exact keys; a list screen accepts an optional initial `query`; `add_record_field` appends new typed fields to existing collections, with atomic validation and a specific duplicate-key error. The edit review also reflects field additions and relevant behavior changes. Existing duplicate/invalid fields do not become silently acceptable.
2. **Added a real Graph V2 executor.** Typed ports and locked `id@version` adapters are validated against trusted definitions. Nodes execute in deterministic topological order, with explicit bounded feedback, typed output validation, pure-output cache, cancellation and real trace events. The executor refuses unknown/untrusted adapters and forged port signatures.
3. **Transactional effect isolation.** Runtime blocks get no direct native, network or subprocess APIs. They receive only a narrowly scoped permission-checked storage context; staged writes commit only after successful completion and are rolled back on failure/cancellation. The supplied memory store is *not durable*.
4. **One source file per executable block.** Six real built-in adapters were added under `src/spica/runtime/blocks/<category>/`. A deterministic generator builds a checked-in static `registry.generated.ts`, and registration is checked during the Phase 04 test command.
5. **Spark tool integration.** `list_spica_runtime_blocks`, `inspect_spica_runtime_block`, `run_spica_v2_graph` expose capabilities and real execution evidence to Sparks. Live workspace routes V2 graph inspection/edits and actual runs to appropriate activity kinds. No attempt is made to fake standalone app export or materialized UI.
6. **Preserved existing functionality.** The original 26 source-generating adapters and 35 category definitions, schema-1 exporter, recipes, Graph V2 migration and prior Workbench remain in place. The UI view-model block is not a replacement for the Phase 06 professional component target.

## Main source anchors

- `src/spica/graph.ts` — `GraphEdit` and `changeGraph` including `add_record_field`
- `src/spica/program.ts`, `src/spica/target/{CollectionApp,WorkflowApp}.tsx` — list-screen `query`
- `src/spica/tools.ts` — `normalizeSpicaProposal`, `spicaEditHint`, `reviewSpicaEdit`, `executeSpicaTool`
- `src/spica/runtime/{adapter,executor,permissions,trace,store,value,registry,registry.generated}.ts`
- `src/spica/runtime/blocks/{variables,functions,orchestration,data-records,ui}/*.ts`
- `scripts/generate-spica-runtime-registry.cjs` — static registry generator/check
- `scripts/check-spica-phase04.cjs`, `tests/spica-phase04.test.cjs` — compilation and behavioral regression checks
- `src/engine/{agent,action-permissions,live-workspace}.ts` — Spark routing, permissions and visible execution activity

## Checks conducted

| Check | Result |
| --- | --- |
| Phase 01 regression | 12 / 12 passed |
| Phase 02 regression | 9 / 9 passed |
| Phase 03 regression | 12 / 12 passed |
| Phase 04 runtime/repair regression | 14 / 14 passed |
| Schema-1 registry reproducibility | 26 adapters, 35 categories — passed |
| Graph V2 registry reproducibility | 6 executable source modules — passed |
| Source syntax parse | 316 TS/TSX files — passed |
| Strict TypeScript compilation for new runtime | Passed (`--strict`, `--noUncheckedIndexedAccess`, `--noUnusedLocals`, `--noUnusedParameters`) |
| Full frontend `tsc`/Vite build | **Not verified:** `node_modules` is not installed and Vite types are missing |
| Native Windows Rust/Tauri build | **Not verified:** requires Windows toolchain and app dependencies |
| Live end-to-end GGUF Spark run | **Not verified** |

The focused checks are intentionally reported separately from full application verification. Passing tests does **not** guarantee the deployed desktop app builds without errors in the user's environment.

## Explicit limits / next milestones

- Six runtime adapters are genuinely executable, not 350K. The large categories/catalog remain a **capacity target**, not executable code.
- No arbitrary downloaded scripts or generic dynamic JavaScript/TypeScript evaluation in this runtime.
- The UI adapter produces a typed UI model, not a live materialized MUI component. Phase 06 will cover professional rendering and theming.
- Schema-1 applications still export through the original compiler; Graph V2 standalone target compilation remains future work.
- Runtime record writes use an isolated in-memory transaction for now; there is no durable saved-app database or native OS integration in Phase 04.
- Native build checks should run on the user's Windows system with installed dependencies before release or adopting as a production baseline.

**Next phase:** 05 — Scalable warehouse taxonomy, indexing, lazy capability search and honest provenance for 10K-per-category catalogs.
