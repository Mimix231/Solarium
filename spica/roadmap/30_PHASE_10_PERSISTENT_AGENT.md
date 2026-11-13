# Phase 10 — Persistent Agent Execution, Build Plans & Rolling Context

**Source implementation checkpoint (2026-11-13):** Main architecture and UI integration implemented, with target-platform/GGUF release verification pending. See `41_PHASE10_IMPLEMENTATION_REPORT.md` and `42_PHASE10_ACCEPTANCE_AND_WINDOWS_CHECKLIST.md`. Do not mark the release gate complete without real on-device evidence.

**Goal:** Restore the reliable *do the work* behavior of the earlier Codex-era agent, eliminate inspection-only stagnation, and let Dona carry one user task across multiple local GGUF inference cycles without losing verified progress. This replaces the previously proposed **Phase 9.6** and is the FIRST implementation round after Phase 9.5.

## Baseline and diagnostic investigation

1. Compare `src/engine/agent.ts`, tool-selection modules, and relevant tests in `Solarium[Bak].zip` (original user-supplied canon) with Phase 9.5. Build a line-by-line inventory of new termination branches, inspection suppressions, max-attempt guards, tool-loop exits and response fallbacks. Do **not** assume their entire behavior was defective; establish failure reproductions.
2. Reproduce current user failures: `inspect_spica_tool.name is required`, `inspect_spica_tool.arguments Unexpected property`, wrong block ID as callable tool, repeated valid inspections with no graph commit, missing V2 prerequisite, and misleading narrated completion.
3. Trace the exact schemas visible to the model versus `ToolCallValidator`, preflight and dispatcher. Record every mismatch. Preserve Ask/Auto/YOLO permissions; never solve discovery by bypassing safety.
4. Save a known-good regression fixture where the agent edits a Notes Organizer using existing blocks. Compare graph revisions and source artifacts rather than counting chat statements as success.

## Core implementation

| Proposed module/type | Responsibility |
|---|---|
| `SpicaTaskState` | Durable `{taskId, projectId, userGoal, status, plan, activeStep, graphRevision, operations, evidence, blockers, cycle}` record |
| `SpicaTaskOrchestrator` | Choose task stage from unmet verified requirements; route from inspection → composition → validation → commit → verification |
| `AgentProgressTracker` | Compare verified graph revisions, changed file hashes, registered nodes/edges, successful tests; detect no-progress behavior |
| `AgentCheckpointStore` | Atomic, versioned save/load of task state and small evidence references in established SQLite repository; prevent partial writes |
| `AgentBudgetScheduler` | Compute actual available input/output/tool budget based on selected model capabilities and configured cycle limit |
| `AgentContextAssembler` | Rebuild compact prompt from user goal, authoritative plan, latest graph state, selected block contracts and evidence references |
| `TaskPlanView` | Persistent step card above the Chat composer, visible through current conversation without changing top-level routes |
| `ContextBudgetBar` | Current cycle usage, output reservation, checkpoint readiness, explicit estimated-vs-exact token accounting |

These names are proposed interfaces, not claims they already exist. Integrate with the existing `AgentOptions`, activity events, `useSolarium`, repositories and the existing inference pipeline. No second local LLM runner.

## Task lifecycle

`proposed → active → verifying → completed` or `paused / blocked / cancelled`. Tool failures **do not** automatically mean the task is complete or turn the agent into a generic answer. The next cycle receives real diagnostics and returns to the outstanding step. Exact repeated calls with no new knowledge are disallowed as *progress*, but the user task remains persisted and resumable. Do not silently substitute different tools. Authorization denial, explicit cancellation, model unavailable, repeated invariant violations or depleted resources must enter an explicit **blocked/paused** state with a reason—not an endless loop.

## Plan button beside the composer

- Detect application-building intent from the conversation/project context; offer compact `Plan` control **immediately above the composer** for active builds. Avoid treating general fiction/chat requests as builds.
- Default four stages: `Inspect project`, `Discover compatible blocks`, `Compose and apply`, `Build and verify`. Allow richer substeps from real capability requirements.
- Status is derived from events and committed project changes, **never** from Dona merely saying “I did it.”
- Expand/collapse, Pause, Resume, Cancel, inspect evidence. Preserve the last step after app restart and session switches; permission decisions are not silently replayed.
- The UI is shared between Classic and Cosmic layout (Phase 11) and feeds the Dream Workbench (Phase 13).

## Rolling inference cycles

- Default working target **4,096 tokens per cycle**, configurable `2048 / 4096 / 8192 / auto`, bounded by the model's context capability. This is a context-assembly budget, not a fresh infinite memory or a guarantee of exactly 4,096 tokens produced.
- Reserve room for system/tool schemas, output and tool observations before model calls. Never truncate mandatory contract structure.
- Checkpoint: stable goal, selected project/graph revision, completed plan steps, tool call/result IDs, source provenance, unresolved prerequisites, latest verified source hashes; optionally short summary derived from evidence.
- Upon budget exhaustion, finish current atomic operation or safely cancel/pause it, commit checkpoint, then resume with freshly assembled compact context. Do not truncate a half-applied graph write.
- Expose per-cycle token usage from the actual inference backend when available; mark estimates as estimates.

## Acceptance gate

1. Reproduce original inspection loop in a deterministic fixture; new system must not mark any inspection as a completed feature.
2. The same task survives at least three **simulated** 4K context cycles with checkpoint round-trips and no duplicated graph writes.
3. One real GGUF test on the user's Windows installation makes an actual graph change using current blocks, verifies it, and reports the new graph revision.
4. Tool error, permission denial and invalid schema each produce an explicit task state, no fabricated success and no generic “I will now proceed” finish.
5. Switching UI layout and sessions leaves the task state intact (initially using a minimal plan UI even before Cosmic layout ships).
6. All existing tests pass, and complete Vite/TypeScript + native Tauri validation run in the user's installed environment.

## Non-goals

Do not build a hardcoded Recents/Markdown feature; do not introduce hundreds of new blocks or an unbounded autonomous worker; do not start Phase 11 until the actual local-model build test is credible. No promise of flawlessly completing arbitrary requests without available capabilities.
