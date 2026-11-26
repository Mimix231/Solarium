# Phase 10 — Round C: unified graph API, action batches and distinct Cosmic UI

## Changes implemented

1. **Canonical graph editor.** `edit_spica_graph` owns schema1 and Graph V2 mutations, including V2 migration, graph history (`undo_graph`, `redo_graph`, `rollback_graph`), registered-block composition (`compose_blocks`), registered node/port edits, and schema1 field formatting (`set_field_property`). `revision` is required for writes. `edits:[{op,...}]` and a documented supported `edit_type` shorthand normalize to the same transaction; unsupported shortcuts do not execute.
2. **Verified preflight.** `validate_spica_edit` and `check_spica_tool_call` validate through the registered edit schema and actual project revision. A valid `validate_spica_composition` response contains an exact `edit_spica_graph` request and authorizes the matching call through the same transaction; a structurally valid composition is not claimed as a functional app.
3. **Canonical execution.** `run_spica_graph` executes the registered V2 adapter runtime with an explicit `view:'v2'`; it does not claim standalone app export or persistent database writes. Previous V2-named callable endpoints remain as **compatibility handlers**, but the new toolchain workflow hides them in favor of the canonical edit/run names. `read_spica_graph` stays the single graph reader.
4. **No inspection-only completion.** A migration advances the graph revision but cannot complete the discovery/feature-composition stages. Tool selection favors preflight + real construction after capability discovery; while a SPICA task is unfinished and tools are supported, structured tools are required regardless of migration status. Native build verification still requires actual recorded success.
5. **Durable action batches.** `SparkActionBatchJournal` groups separate natural model/tool turns under the same feature objective. It tracks actual tool calls, token totals and failures; mere inspections never seal a checkpoint. Confirmed revision progression or explicit verification seals an evidence-based onion-skin summary. Paused/interrupted actions are never automatically replayed.
6. **Compact next-thought context.** `SparkThoughtContextAssembler.next` carries saved checkpoint evidence and the latest actual tool results; it does not replay previous reasoning. The 4,096-token target does not interrupt individual model generations or transactions mid-stream.
7. **Cosmic UI independent from Classic.** Five source reference concepts are preserved at `docs/design/cosmic/`. `src/themes/cosmic/` contains its own skin, scenery and live task telemetry rail. The eye control switches interface layouts independently of palette preferences. Classic remains the default. Workbench receives Cosmic-specific styling without changing its implementation.

## Verified by source-level tests

- `npm run test:spica:phase10:roundC`: strictly compiles pure graph/task runtime and runs operation, rollback-safety, action-batch, migration progress and UI-source regressions.
- `npm run test:spica:phase95`: validates the single edit tool and every registered V2 edit operation.
- `npm run test:spica:phase10:roundA` / `roundB`: previous persistence/contract regressions.
- `npm run spica:registry:check` and `npm run spica:runtime:registry:check`: both block catalogs.

## Not claimed

- This is not a complete arbitrary Graph V2 native application compiler. Source-level and isolated graph runtime passes are not Windows/Tauri builds.
- Full frontend compilation and pixel-level Cosmic screenshot matching require installed frontend packages and a running graphical app. Do not claim they happened from source tests.
- No model can be guaranteed to follow every tool correctly. The architecture must preserve structured failures, authorization boundaries and resumable tasks instead of faking success.

## Next rounds

Round D: comprehensive actual runtime block/function capability expansion. Round E: additional verified aliases, resolver and failure-recovery diagnostics. Round F: remaining Plan/Workbench polish based on real UI screenshots. Round G: live multi-Spark GGUF builds, Windows/Tauri verification, and end-to-end functional tests.
