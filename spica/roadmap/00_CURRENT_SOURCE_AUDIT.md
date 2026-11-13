# 00 — Current Solarium/SPICA Source Audit

## Evidence scope

Inspected the 11 November 2026 `Solarium[Bak].zip` source archive. The ZIP contains **777 entries**, approximately **31 MB uncompressed**, with `src/`, `src-tauri/`, `backend/`, `tests/`, `scripts/`, `docs/`, `spica/`, a build `dist/` folder, and other content. This document reports code structures observed in the archive; it is not proof of a fresh build or Windows/RTX 3060 runtime test.

The archive does **not** include `node_modules`. Frontend full typecheck/build/lint, Rust build/tests, actual Tauri WebView behavior, native model performance and end-to-end Windows exports were **not run** for this review. Existing documentation records historical tests, which are not relabeled as checks on this particular archive.

## A. Existing subsystems — preserve and extend

| Area | Existing implementation | Relevant files/symbols | Architectural consequence |
| --- | --- | --- | --- |
| Project storage/revisions | Durable, scoped graph records and optimistic revision checks; graph undo/redo | `src/spica/repository.ts`: `SpicaRepository`, `SpicaProject`, `validateSpicaProject` | Introduce v2 alongside v1, with migration and restore tests. |
| Graph | `Graph` schema 1: pages, preferences, controls, optional collections, program, appearance; atomic validation and graph edits | `src/spica/graph.ts`: `Graph`, `GraphEdit`, `validateGraph`, `changeGraph`, `compileGraph` | Existing model is **not** a general typed node+edge IR; do not silently replace it. |
| Block/recipe runtime | 26 registered block contracts, 3 recipes, typed workflows and scenarios | `src/spica/program.ts`: `blockRegistry`, `recipeCatalog`, `Program`, `executeFlow`, `validateProgram`, `runtimeScenarios` | These form the initial real adapter basis. Maintain exact IDs and version locks. |
| Runtime warehouse | In-memory registered runtime search/inspection with target and permission eligibility | `src/spica/warehouse.ts`: `searchSpicaWarehouse`, `browseSpicaWarehouse`, `inspectSpicaComponent`, `registeredWarehouseCounts` | Preserve truthful execution status; scale with native index/registry bridge. |
| Large descriptor catalog | 35 declared category slots × 10K capacity; checked-in draft manifests; native SQLite/FTS5 index | `src/spica/catalog/categories.ts`, `manifests.ts`, `client.ts`; `src-tauri/src/spica_catalog.rs` | Draft search and executable search are distinct today. One facade is desirable, but **not** one misleading count. |
| Research | Native search/provider, page reading, same-origin reference following, comparisons, evidence persistence, budgets and Web Search OFF check | `src/spica/research-run.ts`: `SpicaResearchRun`; `src/research/conversation.ts`: `ConversationResearch`; `src/components/SpicaResearch.tsx` | Improve observation-driven block selection using existing research primitives rather than building a second browser runtime. |
| Spark integration | Existing action tool schema paging; graph create/read/edit/export/verify; real tool approvals | `src/spica/tools.ts`: `spicaTools`, `spicaToolContract`, `selectSpicaTools`, `reviewSpicaEdit`, `executeSpicaTool`; `src/engine/agent.ts` | Do not create a parallel agent or model-stream loop. |
| Styling | Typed appearance properties, supported states, validation and CSS lowering | `src/spica/appearance.ts`: `Appearance`, `StyleEdit`, `styleTargets`, `applyStyleEdit`, `appearanceCss` | Expand through interoperable block contracts, not arbitrary CSS injection. |
| UI | Spica dialog inside Chat, preview, warehouse, workflows, research and changes | `src/views/Chat.tsx`, `src/components/SpicaWorkbench.tsx`, `SpicaPreview.tsx`, `SpicaWarehouse.tsx`, `SpicaWorkflows.tsx`, `SpicaResearch.tsx` | Keep the **centered dialog** and live preview; overhaul presentation inside that interaction. |
| Diff preview | Component compares expected/proposed source and highlights removed/added line ranges | `src/components/ChangesetReview.tsx` | Existing renderer is a short changed range, not a full synchronized side-by-side diff editor with grouped hunks. |
| Export | Scoped generated-file ownership receipts, conflict detection, reserved custom file | `src/spica/emit.ts`: `emitTauri`, `OWNERSHIP_PATH`, `CUSTOM_PATH`; `src/spica/export.ts`: `inspectExport`, `exportSpica` | Preserve source ownership; never overwrite user code silently. |
| Verification | Project scripts, command evidence, source/executable fingerprints, native scenarios, launch gating | `src/spica/export.ts`: `verifySpica`, `currentSpicaBuild`, `launchSpicaApp`; `src-tauri/src/spica_preview.rs` | Existing verification is valuable; extend rather than replace. |
| Code Studio | Monaco workspace, source review/apply, scoped project services | `src/coding/`, `src/engine/intelligence/`, `backend/project/`, `src-tauri/src/glitch.rs` | Hybrid code editing phase should reuse these existing services. |
| Game creation | Spica tile-map/game adapter plus substantial separate 2D editor implementation | `src/spica/game.ts`, `src/spica/target/GameApp.tsx`, `src/varmover/` | A universal game bridge does **not** yet follow just from coexisting code trees. |
| Tests | Dedicated Spica, agent, integration, native and source tests | `tests/spica.test.cjs`, `tests/foundation.test.cjs`, `tests/continuity.test.cjs`, `tests/glitch-integration.test.cjs`, `src-tauri/` | Every phase must add focused regressions and rerun available suites. |

## B. Specific current limitations relevant to the next phases

1. `Graph.schema` is `1`, and its primary model is app metadata plus `Program`; it has **no generic public `nodes`, typed `ports`, and `edges` collections**. Introducing universal blocks requires a versioned addition/migration.
2. `validateGraph` enforces limits including 24 pages, 100 settings, 12 related collections, and 512 KB serialized graph size. Those limits are appropriate to the current app subset and should not be assumed sufficient for a 10K-node editor.
3. `blockRegistry` contains 26 adapters and `recipeCatalog` 3 recipes. Warehouse descriptors in `catalogManifests()` and procedurally built web research profiles are **not runnable by themselves**.
4. `searchSpicaWarehouse` uses in-memory registered data and a bounded shortlist; `searchCatalog` uses Rust SQLite FTS for the draft catalog. A unified discovery API must keep the source/maturity/permission distinctions while joining the navigation experience.
5. `SpicaWorkbench` is **already** a MUI centered `Dialog` configured with a side-by-side evidence/preview grid (`src/views/spica.css`, 94vw × 90dvh). No need to invent a new top-level editor tab. The changes view currently uses a compact diff and lacks the polished synchronized review from the design concept.
6. The research loop **already exists** and is used through `ConversationResearch` in `src/engine/agent.ts`; deeper multi-hop research should extend it with semantic block discovery, provenance, explicit budgets, and deterministic stopping conditions. Do not call this system absent.
7. The game editor under `src/varmover/` and the small `src/spica/game.ts` adapter are **not automatically one integrated game-authoring engine**. Define exportable, versioned bridge contracts and tests before enabling broad game workflows.
8. Historical files in `spica/` describe 350K-capacity plans and reference paths that may not match actual merged source. Runtime code and tests take precedence over historical suggested paths.

## C. Compatibility rules from the repository

`AGENTS.md` requires reading `docs/info/INFERENCE_ARCHITECTURE.md` before modifying inference, agent/tool selection or runtime. In particular:

- Preserve one native streamed model response per genuine inference turn; do not add 2,048-token restart loops, fake reasoning, or synthetic continuation messages.
- Preserve small tool-schema working sets for limited GGUF context windows, backed by real tool results.
- Preserve Spark identity, scoped files/sources, explicit Ask/Auto/YOLO permissions, and Web Search OFF behavior.
- Failed validation remains an unfinished task, not a success hidden behind a different passing check.
- Keep actual file/command results and source hashes as the authority for claims of completion.
- Keep user-specific source content private; no public block promotion or network submission without explicit approval.

## D. Acceptance baseline to establish in the first implementation round

Run **without changing the source first**:

- `npm install` or an existing local dependency cache (respect repo policy and no unauthorized external downloads).
- `npm test`
- `npm run check`
- `npm run lint`
- `npm run build`
- `npm run test:glitch` (when Python environment is available)
- `cargo test` and `cargo check` in `src-tauri/` when the Rust/Windows dependencies exist.
- Real Windows Tauri startup plus a known Notes Organizer graph/preview/verification run on the user's machine.

Record passed/failed/skipped/unavailable distinctly, with exact logs and source revision. Never use the zip's historical documentation as proof that these checks passed today.
