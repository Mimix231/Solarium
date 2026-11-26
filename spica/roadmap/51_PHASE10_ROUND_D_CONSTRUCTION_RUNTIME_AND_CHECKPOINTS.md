# Phase 10 / Round D — Construction Access, Executable Blocks, Source Evidence

Status: **source implemented and focused regressions passing**; full Windows/Tauri + local GGUF acceptance remains unverified.

Round D preserves the Round A–C source and existing block contracts. It does **not** change the Cosmic theme; visual redesign remains scheduled for Phase 11.

## D1 — Construction access and safe tool availability

- `src/spica/construction-coordinator.ts` selects from **registered tools only**. The agent's `selectSpicaTools` and existing `selectActionTools` remain authoritative; the coordinator combines their declarations within a four-tool model context. There is no duplicate dispatcher.
- `src/engine/agent.ts` invokes that selection only for an unfinished, writable SPICA task and an authorized linked project. Actual executor permissions, project-file scoping, and matching graph preflights remain mandatory.
- After read-only churn, offer a real source editor with graph preflight. After confirmed native source changes, offer registered checks. After a failed check, offer a diagnostic reader *and* an editor so the Spark can repair rather than repeat inspection. After passing checks, expose supported completion actions.
- `inspect_params` invalid-operation guidance now provides a valid operation in `nextArguments`, rather than requesting a call that will necessarily fail again.

## D2 — Real executable warehouse expansion

**32 new standalone, source-controlled runtime block modules**, registered in `src/spica/runtime/registry.generated.ts`, expand the warehouse from 116 to **148** executable V2 blocks. These preserve the independent legacy block registry. Every new block uses typed ports, a config schema, runtime config validation, and `execute` logic.

- State: `state_derive`, `state_reset`, `state_subscribe`.
- Events: `event_filter`, `event_dispatch`, `event_sequence`, `event_throttle`.
- Permissioned data: `record_count`, `record_query`, `record_pagination`, `record_upsert`.
- Data/functions: `array_join_field`, `array_aggregate`, `array_project`, `function_map`, `function_filter`, `function_reduce`, `function_compose`.
- Logic: `logic_switch`, `logic_guard`, `logic_sequence`.
- Validation/errors: `validate_value`, `validate_schema`, `validate_form`, `error_capture`, `error_map`.
- UI/layout: `ui_dialog`, `ui_form`, `ui_loading_state`, `ui_validation_error`, `layout_split`, `layout_scroll`.

The first-level `SpicaBlockPreview.tsx` now renders the added dialog/form/loading/scroll descriptors. Record operations use the existing permissioned transactional host, with bounded reads; missing grants cause a real failure. UI descriptors do **not** claim to provide standalone app compilation. The runtime still requires a configured storage host for persistence.

## D3 — Actual source-edit/check/repair operations

The coding backend's preexisting `read_project_file`, `apply_project_changes`, `replace_project_text`, `run_project_check`, `run_project_command` and `read_command_output` are now reachable during authorized SPICA construction. No mock command tool or fake file-writing adapter was added.

`src/engine/agent.ts` checks native source-write results, including positive replacement counts, and records **confirmed** changed file paths only. Failed writes, no-op replacements, and staged model arguments are not successful construction. The existing Tauri tool runner supplies actual exit codes, stdout/stderr, check-state tracking, and workbench events. A failed native check retains a tool route for reading the diagnostic and revising the implementation.

## D4 — Durable evidence and next action batch

`SpicaTaskOrchestrator.recordSourceWrite()` and `SparkActionBatchJournal.recordSourceWrite()` record the confirmed files and source-revision evidence in the existing `task_execution` plan. A confirmed file change may checkpoint an action batch even without a graph revision; a merely inspected capability or failed write cannot. Confirmed changes move the task into verification, **not** directly into completion. Pending writes are not replayed on resume. The next batch reads compact saved facts rather than replaying a private reasoning transcript.

## Verification and boundaries

Run:

- `npm run test:spica:phase10:roundD` — standalone strict TypeScript runner, runtime registry checks, syntax checks, and functional Round D cases.
- `npm run test:spica:phase07`, `npm run test:spica:phase09`, `npm run test:spica:phase10:reliability`, `npm run test:spica:phase10:roundC`, `npm run test:spica:phase10`, `npm run test:spica:contracts` — compatibility regressions.
- `node scripts/audit-spica-phase10-roundA.cjs` — dispatcher, stage, and permission metadata audit.

The isolated tests check real record querying, Recents list composition, transaction grants and upsert persistence, metadata/config conformance of all new blocks, graph/source action selection, failure-to-repair reachability, source evidence checkpointing, and interrupted-task recovery.

**Remaining acceptance boundaries:** A complete frontend TypeScript/Vite and Tauri build needs the project's npm dependencies and native toolchain. An actual Windows project, authorized source edits/terminal output, and a live Spark/GGUF Recents+Markdown acceptance run have not been executed here. Do not label a passing adapter test or a mere file edit as a verified full user feature. Round E alias/failure-intelligence expansion and Phase 11 Cosmic interface work are not part of Round D.
