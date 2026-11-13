# Phase 10 — Acceptance / Windows and GGUF Smoke Checklist

## Before running

- Work from a fresh extracted Phase 10 directory or back up your source before overlay extraction.
- Confirm the canonical block tree at `src/spica/runtime/blocks/`; do not reintroduce `src/spica/blocks/` or copy old flat runtime files into the same tree.
- Install dependencies with `npm ci` and run `npm run spica:runtime:cleanup:check` / `npm run spica:registry:check` / `npm run spica:runtime:registry:check`.
- Run `npm run check`, `npm run build`, `npm run lint`, and `npm run desktop:dev` with Windows/Tauri installed. Record the actual exit codes; `npm run lint` can also discover unrelated existing warnings.
- Run `npm run test:spica:phase10` and prior phase suites. Do not mark a skipped native check as passed.

## Model-backed functional scenario (required for completion)

1. In an existing SPICA Notes Organizer project, ask Dona to add one supported capability using registered blocks. Do **not** preinstall a hardcoded feature-specific recipe.
2. Before sending, verify the small Plan control appears above the Chat composer; select the 4,096 working budget.
3. Confirm the plan is stored in the `task_execution` repository and survives switching away from and back to the conversation.
4. Confirm `list_spica_toolchain({stage:'edit',includeSchemas:true,limit:10})` returns actual edit tool arguments/required keys; validate the actual graph edit with `check_spica_tool_call`.
5. Confirm Dona uses the existing registered `edit_spica_graph` (schema 1 or V2) rather than inventing deprecated `edit_spica_v2_graph`.
6. Observe a successful graph revision write (e.g. r20→r21). An inspection-only work log must leave `verifiedChanges=0`.
7. Run available real export, preview and native verification for the graph's supported target. Only a matching revision with actual test evidence permits status `completed`.
8. Cause a malformed argument and confirm it stays visible as a failed attempt. The original task/plan remains saved; a new valid next tool call is permitted without secretly substituting arguments.
9. Pause a running task and Resume explicitly. The next natural inference turn uses persisted goal and evidence, does not replay r21 write, and starts the next indexed cycle. Cancel must persist an unrestartable task status until the user creates a new task.
10. Observe that a normal model response ending without tool action leaves an unfinished plan `paused`, not falsely `completed`. Confirm no generic narration is presented as proof of work.
11. Verify the prompt usage bar distinguishes backend counts and estimates. Verify that a 4,096 working target does NOT split a model stream or reload model weights; when valid tool schemas need more room, the existing actual context is used if available.
12. Reopen Solarium and confirm task state, project revision, and plan remain coherent. If any of the above fails, attach log, schema, graph revision and model template to the next debugging report.

## Expected evidence for release approval

A saved build plan, an actual graph diff and new revision, explicit native test result, paused/resumed cycles, and no duplicate graph mutations. A screenshot of an attractive plan card is *not* sufficient. Phase 11 (dual UI themes) should be started only after the Phase 10 capability gates pass on the real installation.
