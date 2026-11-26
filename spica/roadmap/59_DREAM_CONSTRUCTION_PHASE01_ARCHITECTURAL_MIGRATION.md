# Solarium — Dream Construction Engine · Mega-Phase 01

**Checkpoint:** 2026-11-22 · **Scope:** architectural migration and canonical construction-task stabilization.

## Boundary and intent

This phase introduces the source-project construction **control plane** only. It does **not** claim to implement portable-source-block composition, the 350K catalog, a cinematic editor, playable previews, gameplay telemetry, or autonomous repair. Those are later phases. The current warehouse remains usable in legacy SPICA projects.

The routing decision lives in `src/engine/construction/intent.ts` (`classifyConstructionIntent`). Before advertising tools, `runAgent()` maps a request to one of three routes:

| Route | Typical requests | Executor |
| --- | --- | --- |
| `source` | Build a platformer, create a normal app, modify linked source files | Existing registered native project tools and `VerificationLedger` |
| `legacy-spica` | Edit an existing SPICA graph, explicit graph-V2/typed-node requests, SPICA application graph | Existing SPICA tools, graph revision checks and orchestration |
| `conversation` | Explanations, story chapters, writing artifacts, in-chat code examples | Existing response/writing/artifact pipeline |

Questions about SPICA graph concepts or how to build an application remain conversational even if they mention graph/tool names; they must not trigger edits. The app-plan eligibility check in `src/engine/intelligence/app-builder.ts` includes games/platformers/RPGs/simulators, so ordinary games receive the same durable multi-step planning as ordinary apps and dashboards. The intent classifier is a routing heuristic, not a security or permission grant. User permissions and the actual linked-project root are validated by their existing native owners.

## Phase-01 implementation files

- `src/engine/construction/session.ts`: typed, versioned `ConstructionSession` with a stage, project/root binding, event sequence, confirmed file receipts, native-check receipts, and explicit lifecycle states.
- `src/engine/construction/intent.ts`: source / legacy SPICA / conversation routing.
- `src/engine/construction/orchestrator.ts`: a **pure evidence state machine**: `start()`, `resume()`, `observe()`, `settle()` and `context()`. This component does not execute tools, create source code, or launch a model.
- `src/engine/construction/checkpoint.ts`: writes snapshots through the existing `TaskExecution` optimistic concurrency record and reports UI events only after successful persistence.
- `src/engine/construction/index.ts`: public module exports.
- `src/engine/agent.ts`: uses the new routing decision before selecting tools, observes confirmed native file operations and current check results, persists session checkpoints and exposes an optional `onConstructionEvent` hook for future UI adoption. The existing `streamContinuousAnswer()` path remains intact.
- `src/engine/intelligence/task.ts`: stores `TaskData.construction` alongside existing task state; `TaskExecution.setConstructionCheckpoint()` and `latestConstruction()` reject cross-project and cross-session mismatches.

The project tool registry, permission broker, source files, project sandbox, verification ledger, legacy SPICA adapter/graph APIs, writing layer, and inference request shape are intentionally preserved. The new control plane NEVER grants extra permissions or invents a file write.

## Authoritative outcomes

1. Inspection transitions to `plan` only after a real successful `inspect_project` call.
2. A saved plan transitions to `build`, but contains **zero file-write evidence**.
3. Native file-write events require committed relative paths and the current valid `VerificationLedger` source revision. A streamed proposal alone is not a saved file.
4. Executing a command is not automatically proof that the check passed. The existing verification ledger decides whether it passed.
5. `complete_project_task` may close the construction session only after its existing execution and current-ledger validation succeed.
6. Tool errors and permission denials remain visible; permission denial produces a blocked, resumable task rather than fake success.
7. A model that ends without verified completion pauses the task for an explicit Resume. Cancellation remains cancellation.
8. Resumption requires the same conversation, task, project ID and linked root; a changed root is rejected rather than silently writing elsewhere.
9. When a construction event is reported to UI listeners, its complete snapshot has already been committed to `task_execution`.

## Verification and regressions

`tests/dream-construction-phase01.test.cjs` includes route decisions, legacy graph and story isolation, accurate lifecycle transitions, insufficient-evidence handling, permission denial, linked-root binding, cancellation, event ordering, file-write revision evidence, storage failures, and actual CAS persistence/restoration using a test-backed `TaskExecution`.

Also re-run all existing SPICA phase suites, code/reasoning/inference suites, syntax checks, registry checks, and source-identity checks. Native Windows/Tauri project execution and any tests that require external dependencies or a local GGUF must be separately reported: a syntactic/standalone regression pass is not a native end-to-end acceptance pass.

## Operational guidance

- Source construction is the intended route for normal applications. Existing SPICA-graph projects and explicit SPICA graph requests remain on the legacy path.
- The user must attach a project source folder for real writes; no linked folder means no construction.
- Rebuild the frontend assets after installing dependencies. The packaged `dist` (if present) is inherited from the previous archive and does not validate the new source.
- Do not show cinematic file creation, playable previews, or repair as available before the future implementing phases ship.

**Next phase:** design and implement the portable `SourceBlockDefinition` contract and a small set of tested source emitters. Never treat SPICA host-runtime adapters as automatically transferable source code.
