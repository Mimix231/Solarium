# SPICA Phase 10 — Persistent Agent Execution & Rolling Context

**Implementation checkpoint:** 2026-11-13. **Scope:** Phase 10 only; phases 11–18 remain roadmap specifications. **Release status:** source-level implementation with focused test coverage; Windows/GGUF end-to-end gate pending.

## Baseline and observed regression

The previously supplied screenshots demonstrated repeated inspector/tool-schema calls without graph writes and a premature generic incomplete-work reply. The original Codex-era architecture and current Phase 9.5 code show that normal inference should be a continuous stream per model turn. The newly introduced contract/progress suppression could block specific repeated calls without maintaining a persistent build plan. Phase 10 replaces the immediate completion assumption with checkpointed task state; it **does not** remove permissions or accept arbitrary unknown tool properties.

## Implemented modules and integration

| Location | Behavior |
|---|---|
| `src/engine/intelligence/spica-task-orchestrator.ts` | Durable typed task plan, evidence-bearing steps, graph revision/verified change tracking, explicit paused/blocked/cancelled states, bounded cycle history |
| `src/engine/intelligence/agent-budget.ts` | 2,048 / 4,096 / 8,192 / auto model-aware soft input targets and compact checkpoint context assembly |
| `src/engine/intelligence/task.ts` | Existing atomic `task_execution` record now carries the plan; read last plan and explicit Pause/Cancel/Resume state controls |
| `src/engine/context-window.ts` | Optional soft `workingContextLimit` that borrows available actual model context when required schemas cannot fit a smaller preference |
| `src/engine/continuous-generation.ts` | Passes soft limit to context preparation, records token measurement source; retains a single uninterrupted backend generate stream |
| `src/engine/agent.ts` | Saves task plan/cycle observations on real tool turns; confirms graph revisions after writes; verifies current graph revision; keeps unfinished tasks resumable rather than interpreting EOS as successful implementation |
| `src/components/SpicaTaskPlanView.tsx` | Compact expandable build plan above Chat composer, genuine step evidence, configurable working budget, cycle bar, Pause/Resume/Cancel |
| `src/views/Chat.tsx` | Loads last durable session/project task, proposes plan for build requests, updates it through `AgentOptions.onTaskPlan`, controls session and task state |
| `src/domain/{types,defaults,validation}.ts` | Validated `spicaCycleBudget` preference with default 4,096 |
| `src/spica/tools.ts` | Existing `list_spica_toolchain` accepts meaningful `stage`, `offset`, `limit`, `includeSchemas` parameters; bounded response includes the same exact JSON tool contracts used at execution |

No feature-specific Recents/Markdown installer, duplicate graph editor, hidden tool execution, new top-level UI route, or parallel inference session was introduced. The canonical directory remains `src/spica/runtime/blocks/` with **26 legacy and 103 V2 registered blocks**.

## What 4,096 tokens means

The configured target is a **working prompt-context target per natural model/tool turn**. The selected model's loaded actual capacity is authoritative. The scheduler checkpoints state **after a model finishes one normal tool turn**, not during partially generated text and not at precisely the 4,096th output token. Backend token counts may be unavailable; client estimates are labelled. Mandatory tool schemas may temporarily require more than the target, using real available context. Saved checkpoints retain goal and verified state but do not turn a small model into an unlimited-context model.

## Acceptance evidence

- `npm run test:spica:phase10` covers inspection-only stagnation, real revision-bound progress, verification ordering, failures/denials, 3 cycle round-trips, prompt-budget borrowing without another model inference, and actual persisted task store resume/cancel behavior.
- Phase 7 tool tests cover paginated exact schema response and preserved strictness (`additionalProperties:false`), avoiding repeated contract guessing.
- Existing Phase 1–9, Phase 9.5, contract and unified block tests must remain green; results are recorded in the accompanying acceptance checklist.
- TypeScript/TSX syntax and targeted strict compilation are checked. Complete frontend checking is not accepted as passed until the target project installs `node_modules`.

## Outstanding release gates (do not mark green without actual results)

1. On Windows with the installed project dependencies: `npm ci`, `npm run check`, `npm run build`, desktop Tauri build and launch.
2. Start a real configured GGUF and make Dona create an app change from existing registered blocks, with permission review and new graph revision.
3. Verify at least one resumed plan cycle and that successive tool turns really use the saved task evidence without repeating committed changes.
4. Verify responsive composer plan and Pause/Resume/Cancel in Classic UI; Phase 11 owns the Cosmic UI switcher.
5. Confirm standalone preview/export claims only for supported target/graph types; arbitrary V2 standalone code emission remains Phase 14.

A malformed tool call remains possible with a small local LLM. The contract introspection and task state make it observable and recoverable, not mathematically impossible. Phase 10 does not guarantee completion of arbitrary projects or infinite autonomous operation without explicit user and resource bounds.
