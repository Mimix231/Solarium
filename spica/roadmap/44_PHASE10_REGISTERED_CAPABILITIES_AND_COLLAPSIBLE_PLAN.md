# Phase 10 — Registered Capability Discovery, Tool Contracts & Collapsible Composer Plan

**Scope:** Phase 10 correction on `Solarium_Phase10_Single_Unified_Graph_Editor_Fixed.zip`; **Phase 11 was not started**.

## Evidence from the reported Dona execution log

The provided `Pasted text(4).txt` shows that Dona sent names such as `spica_graph_edit`, `read_writing_document`, `MarkdownEditorBlock`, `notes_list`, `notes_organizer_id`, `notes_db_reader`, and `spica.runtime.markdown_renderer` to inspectors. These are **not** registered executable identifiers. In particular, the log also sent the *callable* `search_spica_runtime_blocks` as an `inspect_spica_wiring.blockIds` value. The engine correctly refused unregistered execution, but the discovery/inspection contracts were far too unforgiving for a small GGUF model and did not provide useful real alternatives. Several invalid inspector results were recorded as successful calls, and a successful but empty search was counted as Plan Step 2 completed.

The shipped registry already had `spica.runtime.ui_markdown_editor`, `spica.runtime.ui_markdown`, `spica.runtime.ui_list`, `spica.runtime.array_sort_field`, `spica.runtime.array_take`, and several date functions. **Do not register aliases for hallucinated names** or create duplicate markdown implementations.

## Implemented changes

### New, real one-block-per-file executable adapters

- `src/spica/runtime/blocks/data-records/runtime/storage/record-list.ts` (`spica.runtime.record_list`): a bounded, deterministic, **permissioned** collection read. Results connect to `array_sort_field` → `array_take` → `ui_list` for a real Recents composition.
- `src/spica/runtime/blocks/data-records/runtime/storage/record-delete.ts` (`spica.runtime.record_delete`): a permissioned transactional delete by key. It is not a dummy catalog entry.

The runtime transaction contract now supports explicit `list`/`delete` methods where the hosting store implements them. `SpicaMemoryStore` implements both atomically, and `executeSpicaGraphV2` applies `records.read` and `records.write` gates to every operation. External storage hosts lacking these methods fail with a precise `UNSUPPORTED_STORAGE` error; no unapproved host or filesystem access is introduced. **Isolated V2 runtime storage is not the same thing as exported schema-1 persistent desktop storage.** Universal V2 source export remains a later roadmap phase.

### More capable, canonical inspection APIs

- **New** `resolve_spica_capabilities({queries,target?,limitPerQuery?})`: searches executable block IDs from the actual runtime registry and returns their typed ports, example configurations, and explicit `registered` markers. Queries are natural language; outputs are *data*, never made-up callable functions.
- `inspect_spica_tool`: supports exact `name` **or** `query` plus optional `view`, `operation` and read-only proposed `arguments`. Unknown tool names receive a bounded candidate set instead of pages of irrelevant available-name arrays.
- `inspect_solarium_tool`: supports exact `name` or `query`, and optional operation-specific `view`, `operation`, and `parameters` to validate a proposed call without invoking it. This addresses real errors from `inspect_solarium_tool.operation Unexpected property`.
- `inspect_spica_runtime_block`: exact `id` with optional version, or natural-language `query`. Unknown IDs return *registered* candidate IDs and the next correct discovery operation, not a generic uncaught exception.
- `inspect_spica_wiring`: accepts `blockIds` **or** `query`, and reports typed port compatibility for selected *registered* adapters. Unknown block IDs are never substituted or connected silently.
- `inspect_spica_identifier`: `id` or `query`; distinguishes tools from blocks and suggests registered candidates.
- `spica_next_action`: optional capability `query`, forwarded into the stage-appropriate registered resolver when applicable.
- `search_spica_runtime_blocks`: improves only its **ranking and query parsing**, including `MarkdownEditorBlock`, `recent notes`, underscores and camelCase. It does **not** create undeclared IDs.
- The removed `edit_spica_v2_graph` name stays removed. **Only `edit_spica_graph`** remains the graph edit tool for schema-1 and V2.

### Correct stage selection and progress truthfulness

- `selectSpicaTools()` now accepts the actual task-plan stage. At Compose, repeated generic inspection calls are not prioritized over registered composition/validation operations.
- `SpicaTaskOrchestrator` marks discovery complete only if a successful tool result includes **an actual registered block ID**. Empty searches cannot mark a feature built or the discovery step complete.
- Structured `ok:false` inspector results are recorded as **failed** tool operations (with diagnostic and next-tool guidance). Successful searches, inspections and tool preflights remain **read-only**.
- Permission gates, explicit check-before-write, revision checks, and persistent tool logs are preserved.

### Composer UI: expanded and folded plan

`src/components/SpicaTaskPlanView.tsx` now has two presentations: expanded plan with steps/checkpoint details, and a compact centered `SPICA Plan · N/4` pill with an **expand chevron**. `src/views/Chat.tsx` positions the compact pill **immediately above the message composer**, after the model-selector, attachment, and tool controls. Expanding restores the full plan above those controls. Both use the same `SpicaTaskPlan` and callbacks; collapsing never cancels or restarts a model.

## Verification

- Run `npm run test:spica:phase10:reliability` for the strict runtime compilation, existing tool API tests, 5 new transaction/runtime integration tests, and persistent task/Plan tests.
- Re-run all earlier Phase 01–10 and Phase 9.5 checks, both registries, block cleanup checks, and syntax checks.
- Test `npm run check` / `npm run build` on a machine with installed npm dependencies; missing frontend dependencies in this environment prevent claiming a complete Vite/Tauri build.
- Test with real Dona/GGUF to assess tool-choice quality: source-level contracts and deterministic tests **cannot guarantee** that a model will never invent tool or block names.

## Acceptance walkthrough

1. Ask Dona to add Recents/Markdown to Notes Organizer.
2. Confirm a search returns **real** `spica.runtime.*` IDs, including record-list/markdown renderer.
3. Confirm `inspect_spica_runtime_block` or `resolve_spica_capabilities` reveals real config/port contracts.
4. Confirm `inspect_spica_wiring` uses returned IDs, not guessed aliases.
5. Confirm `validate_spica_edit` / `validate_spica_composition` happens before a permissioned `edit_spica_graph` / composition commit.
6. Confirm saved graph revision actually advances and the updated V2 preview can execute a compatible graph. Do not claim standalone export just from V2 execution.
7. Collapse Plan to the centered pill directly on top of the chat message box; expand back without losing work.
