# Phase 10 — Round B: Independent Thought Blocks & durable checkpointing

Status: Implemented in source; native Windows/real-GGUF acceptance remains pending.
Scope: Round B only, plus the reported `inspect_spica_tool.view` argument bug.

## Changes

- Added `src/engine/intelligence/spark-thought.ts` with `SparkThoughtJournal` and `SparkThoughtContextAssembler`. Each native inference/tool-action turn produces a separately checkpointed, independently justified decision record. No output-token slicing, synthetic continuation prompts, hidden retries, or additional model loading.
- Extended `SpicaTaskPlan`/`SpicaTaskOrchestrator` to retain recent Thought Blocks in existing `task_execution.spicaPlan`, with restored index ordering across budget-cycle history and explicit interrupted/pause behavior. Starting a new thought never replays pending actions from a previous process.
- Modified `runAgent()` so each action-oriented SPICA turn saves a pending thought before inference, archives actual model-emitted reasoning and the proposed tool names before execution, saves each observed tool result, then settles the thought before beginning another. Thought persistence failures stop execution rather than proceeding on an unsaved proposal.
- Each new thought is assembled from the original Spark identity, linked project instructions, latest user request, current project/task checkpoint and labelled evidence of the most recent real tool results; prior model reasoning and historical tool transcript are excluded from the inference input. The historical conversation remains saved; only temporary inference input is scoped.
- Added output token accounting, with server-sourced and estimated counts explicitly distinguished. Input prompt budget remains the previously configured soft 4,096-token working target, constrained by actual loaded model capacity. No forced inference stop at the configured input target.
- Expanded `SpicaTaskPlanView` to show recent Thought Blocks, action outcomes, token usage, and model-emitted reasoning excerpts within the existing expandable Plan card. Preserved the centered collapsed composer pill and Classic UI.
- Corrected `inspect_spica_tool.view` and `inspect_solarium_tool.view`: explicit scalar strings, `null`, `{format:'v2'}`, `{view:'v2'}`, `{type:'v2'}` and bounded arrays normalize into `schema1`, `v2` or `both`. Ambiguous requested operation + `both` returns a structured diagnostic; unknown formats are never silently coerced. This does not introduce any V2-named callable graph editor.
- Updated isolated older phase test harnesses to load the actual `inspect-tool-view.ts` source. Their previous unmocked-dependency failures were not application failures; assertions remain intact.

## Tests and reproducibility

- `npm run test:spica:phase10:roundB`: strict isolated TypeScript compilation plus persistence, independent-input, tool-result-order, no-call, cancellation, resume and inspector-view regressions.
- `node scripts/audit-spica-phase10-roundA.cjs` checks the existing registered tool names, permissions and dispatch relationships remain intact.
- All existing phase scripts, syntax validation, both block registries and contract/unification suites should be run before delivery. Source syntax checks are not a substitute for the complete Vite TypeScript check.

## Intentionally not implemented in Round B

- Round C's complete public argument expansion and canonical contract registry changes.
- Round D's broad new runtime-block families and universal app compilation.
- Round E's alias/capability expansion or automatic recovery algorithms.
- Round G's actual Windows/Tauri + local GGUF acceptance suite.

The user-requested goal remains unfinished and resumable when permission is denied, the model returns without a registered tool call, the backend fails, or durable storage cannot be written. Successful app completion still requires real graph changes and verified target results.
