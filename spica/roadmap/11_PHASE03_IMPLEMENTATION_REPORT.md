# Phase 03 — Universal Graph V2 + Real Spark-to-SPICA Tool Routing

**Date:** 2026-11-11  
**Input canon:** `Solarium_SPICA_Phase02_Dream_Workbench.zip`  
**Input SHA-256:** `76982bc020b98ebe1a1e77f1d2a6e95974121d999522fcd7322c951f22af3e85`  
**Status:** Implemented with passing focused offline tests. **Full desktop and frontend build not certified.**

## Problem reproduced from user's November 11 screenshots

A request of the form “Dona, I want you to build a fully functional application using SPICA's internal block warehouse. Application: SPICA Notes Demo” previously fell through a narrow Spica intent classifier and reached ordinary prose generation. The executable Spica tools **were already exported through the coding-tool registry**; simply adding a second registry would have created duplicate tools. This round fixes actual classification and tool selection, plus a permission-gated execution path when a supported starter request cannot use GGUF structured tool calling.

## Changes

| Component | Action | Result |
|---|---|---|
| `src/spica/tools.ts` | Extend `isSpicaCreationRequest`, `isSpicaProgramRequest`, `spicaRequestedRecipe` | Recognizes natural Spark-addressed build requests; rejects conceptual “what if” prompts. |
| `src/spica/tools.ts` | Expand real tools | `create_spica_app` accepts only existing supported starter recipes (`blank`, `notes`, `tasks`, `settings`, `models`); added `inspect_spica_build`, `read_spica_v2_graph`, `migrate_spica_v2_graph`, `edit_spica_v2_graph`, `history_spica_v2_graph` with typed revision preconditions. |
| `src/spica/agent-build.ts` | Add deterministic fallback | Existing registered create/export/prepare/verify implementation is called through authorization gates; tool-disabled/ignored-tool local models can complete the supported starter workflow without fabricating results. Unsupported custom features remain explicitly unsupported. |
| `src/engine/agent.ts::runAgent` | Connect intent, tool selection, fallback and receipts | Uses current project/revision, action permissions, real command-output callbacks and truthful verification. Keeps normal structured tool-call path first for supported models. |
| `src/views/Chat.tsx` | Extend `beforeTool` handling | Centered Workbench opens on Spica create/edit/export/prepare/verify/V2 graph edits, without adding a new app tab. |
| `src/components/SpicaWorkbench.tsx` | Fix TS18047 on old line 252 | Explicitly checks `sourceSnapshot != null` before accessing `.changes`, preserves review fallback. |
| `src/spica/graph-v2/types.ts` | Add schema-2 types | Typed nodes, block locks, ports, edges, nested scopes, metadata, migration provenance and graph edit union. |
| `src/spica/graph-v2/validation.ts` | Add bounded validator | Structural checks, type assignability, fan-in/fan-out, port kind, nested scope rules, data/reference cycle prevention, bounded event feedback and optional authoritative block resolver. |
| `src/spica/graph-v2/{serialization,transactions,migration}.ts` | Add canonical serialization, atomic editing and read-only v1 projection | Deterministic JSON + SHA-256, transactional edits, and non-destructive migration for existing settings/records/program graph contents. |
| `src/spica/repository.ts::SpicaRepository` | Extend storage without overwriting v1 | Add `migrateV2`, `updateV2`, `v2OriginIsCurrent`, revision guards, V2 undo/redo/rollback and persisted validation. Existing v1 apps remain exportable from original schema. |
| `scripts/check-spica-phase03.cjs`, `tests/spica-phase03.test.cjs` | Add 12 focused test cases | Strict GraphV2 TypeScript compilation, negative validation, atomic transactions, deterministic hash, migration/provenance, repository history, routing and denied/allowed fallback. |
| `package.json` | Add `test:spica:phase03` | One-command focused verification without changing dependency versions. |

## What V2 DOES and DOES NOT do

**Implemented now:** authoring a durable typed graph with version-locked registered blocks or explicitly non-runnable placeholders, scope boundaries, validated connections, deterministic persistence and safe schema-1 migration.

**Not implemented yet:** executing arbitrary GraphV2 nodes, automatically lowering V2 to a native or web application, arbitrary local LLM invention of executable blocks, cross-scope interface ports, or binding the V2 graph directly to the Graph Preview. Those belong to Phase 04 (runtime), Phase 05 (large index), Phase 06 (professional UI) and Phase 07 (general-purpose Spark orchestration). `read_spica_v2_graph` explicitly reports `exported: false`. Never mistake a placeholder for working functionality.

**Deterministic starter fallback:** Works only for real built-in schema-1 recipes when the project folder/permissions/verification permit it. It does not bypass Ask/Auto/YOLO controls and does not silently overwrite an existing Spica app or user source. A failed or blocked native build remains reported as such.

## Actual verification from this container

| Command | Result | Boundaries |
|---|---|---|
| `node scripts/generate-spica-registry.cjs --check` | **PASS** — 26 modules, 35 categories | Registry identity and metadata only. |
| `node scripts/check-spica-phase01.cjs` | **PASS 12/12** | Original Phase 1 semantics. |
| `node scripts/check-spica-phase02.cjs` | **PASS 9/9** | Phase 2 build-event/wiring behaviors, isolated tests. |
| `node scripts/check-spica-phase03.cjs` | **PASS 12/12** | GraphV2 core strict compile and focused test cases. |
| `node scripts/check-syntax.cjs` | **PASS 302 source files** | TypeScript/TSX parsing, not a complete semantic build. |
| `tsc -p tsconfig.test.json --noEmit` | **BLOCKED BY ENVIRONMENT** | Missing existing npm packages (`@tauri-apps`, `zustand`, etc.). No changed-module diagnostics were emitted in the available compilation pass. |
| Full `npm run check`, `npm run build`, `npm run lint`, `cargo check`, native Windows executable, real GUI integration | **NOT CERTIFIED** | `node_modules` and complete Windows/Tauri toolchain unavailable here. |

## Manual Windows release gate

From a newly extracted copy (never overwrite your stable project in place):

```powershell
npm ci
npm run spica:registry:check
npm run test:spica:phase01
npm run test:spica:phase02
npm run test:spica:phase03
npm run check
npm run lint
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Then launch the app and issue the original Notes Demo build prompt inside a **linked, appropriate Solarium project**. In Ask mode, approve each real operation. Verify the centered SpicaWorkbench, code changes and real logs, failed/denied state behavior, and no invented “test passed” claim. Repeat with a model that lacks tool calls: supported starter apps should use the deterministic fallback, while unsupported features must be described as incomplete. For V2 specifically, test migration/atomic edit/undo/read and confirm the v1 export still works unchanged.

## Checkpoint and next phase

**Rollback ZIP:** `Solarium_SPICA_Phase02_Dream_Workbench.zip` (SHA-256 above).  
**Next:** Phase 04 — Block Execution Runtime, adapter SDK and sandbox, using Graph V2 as an authoring contract rather than claiming it is already executable.
