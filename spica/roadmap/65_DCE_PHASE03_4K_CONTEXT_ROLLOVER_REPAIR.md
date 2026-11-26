# DCE Phase 3 — 4K Context Rollover and Non-Shifting Model Repair

**Date:** 2026-11-22  
**Baseline:** `Solarium_DCE_Phase03_InferenceContinuity_2026-11-22.zip`  
**Change scope:** inference input fitting, source-construction turn context, backend output limits, and regression tests. No legacy SPICA graph-format migration.

## Reproduction and root cause

The user's displayed live diagnostic reported:

- `n_ctx=4096`
- `input=3455 tokens` (server count)
- `n_keep=3455`
- `max_tokens=-1`
- `context shift=unsupported`
- `finish_reason=length`, no completed native tool call or final answer

This is a real finite native inference context, not an arbitrary 4096-token output-segment limit. When the server lacks context shifting, the nearly full input leaves too little room for a long reasoning phase and a complete native function-call payload. On recovery `runAgent()` previously appended an extra operational hint but retained essentially the same full project conversation and instructions, so the next decision could exhaust the same window without advancing the task. A 2-attempt safety guard then paused the task honestly, but did not solve repeated non-progress.

## Implemented changes

1. `src/engine/construction/decision-context.ts` (new): build a source-construction decision packet from actual saved state only: system action contract, original request, Spark identity, user-authored project instructions, verified construction checkpoint, verification ledger, latest executed tool result, and currently registered tool identifiers. Previous speculative assistant replies or unfinished internal reasoning are not reused as durable facts. Latest user message and original goal are not truncated.
2. `src/engine/agent.ts`: use this packet on source-construction turns when loaded context is <=8192. For an explicitly non-shifting model at <=8192, offer only the first stage-selected registered contract, rather than consuming context with four large contracts. Continue using the existing tool validator, permission broker and task checkpoint store. All file operations remain real authorized tool executions.
3. `src/engine/context-window.ts`: for `contextShift=unsupported`, reserve ~40% of loaded context (1638 tokens on 4096) as response space **before** invoking the model. Unknown context-shift state receives 25%; supported shift retains the former lightweight headroom. This is only prompt fitting, never an inference-time split.
4. `src/engine/continuous-generation.ts`: when the llama.cpp backend explicitly reports no shift support, use a finite `max_tokens` reflecting true space left rather than requesting unlimited output from an impossible configuration. Set `n_keep=0` for that non-shifting case. Supported and unknown shift retain the existing `max_tokens=-1` streaming contract; supported/unknown retained prefix is limited to a conservative fraction of the actual context.
5. `src/engine/construction/inference-recovery.ts`: after exhausted retries in the unsupported-shift condition, include a model context and chat-template compatibility diagnosis while persisting the unfinished task. Do not execute partial function-call JSON or auto-invent completion.
6. Architecture docs and tests updated to cover actual shifting capability, compact state, real output reservations, and the continued single-backend-request policy for each model turn.

## Tests performed on working source

- `tests/dream-construction-phase01.test.cjs`: 17/17 pass.
- `tests/dream-construction-phase02.test.cjs`: 36/36 pass.
- `tests/dream-construction-phase03.test.cjs`: 24/24 pass.
- `tests/tool-execution-reliability.test.cjs`: 9/9 pass.
- `tests/construction-inference-recovery.test.cjs`: 7/7 pass.
- `tests/dce-context-rollover.test.cjs`: 6/6 pass.
- `tests/dce-inference-streaming.test.cjs`: 5/5 pass.
- SPICA Round D 11/11, Round E 15/15, Round F 13/13, context-fix 15/15 pass.
- TypeScript syntax check; both SPICA registries; and DCE source warehouse hash check pass.

The old Round E static test matched a literal unconditional `max_tokens=-1` branch and correctly failed after this change. It was updated to enforce `-1` only for backends not explicitly reporting unsupported shift, and the new streaming test exercises the finite branch end-to-end.

## Remaining limitations / real-device acceptance

1. **A no-shift 4K server cannot generate infinitely in a single request.** This change improves the likelihood of a short actionable tool call and makes the reason for a genuine pause accurate. It cannot guarantee every local model/chat template emits native tool calls.
2. Full npm dependency-based `tsc`/frontend Vite build, native Windows/Tauri build, and direct GGUF inference remain unverified in this container. Missing packages include Tauri, TipTap, and Vite/frontend types. Global `tsc` can parse and emit the changed test modules; dependency errors still exist elsewhere.
3. To prove the user-facing bug fixed, run the same Notes Organizer request with a tool-capable model. Confirm a real `plan_project_app`/`apply_project_changes` operation is emitted and persisted, then a new decision uses those actual results rather than restarting from the original reasoning. Prefer 8K–16K `n_ctx` or a genuinely context-shifting model/template when 4K cannot fit persona, project instructions and a tool.
4. Runtime operator cancellation, denied permission, wrong linked project, or genuinely unsupported tools must still stop or pause safely.

**This is a correctness and reliability repair, not a claim that the Dream Construction Engine's Phase 4 deterministic planner is already built.**
