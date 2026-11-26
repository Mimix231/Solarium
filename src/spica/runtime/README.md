# SPICA Graph V2 — Phase 04 executable block runtime

This folder contains a **bounded, permission-checked executable graph engine**. It is independent of the schema-1 program exporter, the 26 schema-1 source adapters, the 350K proposed descriptor catalog, and the future production app renderer.

## Source ownership

| Source | Responsibility |
| --- | --- |
| `adapter.ts` | `SpicaBlockAdapter`, typed port and target contracts, `defineRuntimeBlock` validation |
| `./blocks/<category>/runtime/<block>.ts` | Exactly one built-in implementation per file, including config validation and execution |
| `registry.generated.ts` | Generated static import list; do not edit |
| `registry.ts`, `aliases.ts` | Canonical `id@version` lookup plus a curated, validated set of non-callable identifier aliases; refuses duplicates |
| `executor.ts` | Validated topological order, event routing, feedback limits, cancellation, traces and transactions |
| `permissions.ts` | Built-in trust restriction, target checks and explicit grant broker |
| `store.ts` | Test/development transactional memory store; **not durable storage** |
| `value.ts` | Runtime type checks and result serialization/size checks |
| `trace.ts` | Real execution evidence and summary contracts |

Create a new adapter as `./blocks/<category>/runtime/<block-name>.ts`, **one `export default defineRuntimeBlock({...})` per file**. The filename must match the suffix of the `spica.runtime.*` ID, replacing underscores with hyphens. The `id`, `version` and `trust` properties must be literal strings for static registration checking. The checked-in runtime registry is regenerated using `npm run spica:runtime:registry` and checked using `npm run spica:runtime:registry:check`. Categories are directories; further nesting is supported.

## Spark and Solarium integration

`src/spica/tools.ts` exposes `list_spica_runtime_blocks`, `inspect_spica_runtime_block`, and `run_spica_v2_graph`. Sparks can read the exact port contracts and issue `edit_spica_graph({view:"v2",revision,edits})` mutations at the latest graph revision. `run_spica_v2_graph` emits actual trace events via the existing execution output callback, which the live workspace categorizes as an execution. Runtime commands never claim standalone export, materialized MUI controls, or durable records.

The runtime rejects forged port types, unknown adapter IDs/versions, placeholders, unauthorized permissions, incompatible targets, invalid output values, unbounded event cycles, excessive feedback and result sizes. A failure/cancellation rolls back staged writes. This in-process engine accepts **only trusted source-controlled built-in adapters**. Do not execute downloaded/community TypeScript in this context; Phase 12 will need a separate isolated trust model.

### Running a graph

1. `create_spica_app` if the project has no graph, or `read_spica_graph` to obtain its current revision.
2. `migrate_spica_v2_graph` (read-only, non-destructive schema-1 projection) if no V2 graph exists.
3. `list_spica_runtime_blocks` and `inspect_spica_runtime_block` to obtain exact registered signatures. Never guess block names or port shapes.
4. `edit_spica_graph({view:"v2",revision,edits})` to add typed runtime nodes with matching signatures, config and edges; use the revision returned by each edit batch.
5. Approve required permissions through the existing project grant flow; `run_spica_v2_graph` does not elevate grants.
6. `run_spica_v2_graph` with current revision and `target: "desktop" | "web"`. Inspect the `state`, trace, error and `committed` fields; never infer success from a prose answer.

The built-in notes scenario in `tests/spica-phase04.test.cjs` shows the executable data → predicate → event → transactional storage → UI-model path. The UI-model block returns **data**; a materialized MUI app is a later-phase capability.

## Resource boundaries

- Maximum 1,024 operations per run (default 256).
- Maximum 100 feedback rounds (default 32) and every feedback edge has a finite iteration budget.
- Maximum 1,024 retained trace entries, output clones at most 128 KB per value, and total returned node results 4 MB.
- Memory storage is transactional and isolated per invocation unless a trusted host explicitly injects an approved transaction store.
- On failure or cancellation, the transaction is rolled back. No subprocess, network or filesystem APIs are exposed through block context.

Run `npm run test:spica:phase04` to compile the runtime under strict TypeScript options and execute its focused contract tests. Continue running Phase 01–03 tests after runtime changes.

## Schema-1 tool-call compatibility fixes

`edit_spica_graph` `put_screen.fields` accepts `string[]` and safely normalizes keyed field objects from Sparks to IDs. It supports `screen.query` for list screens. It **does not silently create collection fields** when reading keyed screen references. Add new fields using `add_collection` for a new collection, or the typed `add_record_field` operation for an existing one. Exact duplicates are rejected atomically with an actionable field-key error.

Example of **valid schema-1 edit arguments** (assuming the current graph already contains collection `notes` and revision 10):

```json
{
  "revision": 10,
  "edits": [
    {"op":"add_record_field","collection":"notes","field":{"key":"body","label":"Body","type":"text"}},
    {"op":"put_screen","screen":{"id":"review","label":"Review","view":"list","collection":"notes","fields":["title","body"],"query":""}}
  ]
}
```

Use actual graph IDs and only fields that are not already present. Read the current revision and collection before editing. The current graph's own field validation remains authoritative.


## Phase 10: controlled runtime block aliases and interactive UI state

A curated alias table in `src/spica/runtime/aliases.ts` maps observed older/user-facing
names such as `notes_list`, `MarkdownEditorBlock`, and
`spica.runtime.markdown_renderer` to actual registered implementations. **Aliases
are not tools, executable adapters, or additional block source files.** The registry
verifies on load that every alias points to a registered canonical adapter and
cannot override another block. `makeRuntimeNode` and composition normalize an
alias to its canonical block lock. Tool names such as `edit_spica_graph` and
`search_spica_runtime_blocks` remain outside the block registry.

The host-driven interaction contract is restricted to per-run string event IDs
and transactional session state (`SpicaRunOptions.events`, `interactionState`).
`ui_event_binding` emits an event only if the host supplies that exact ID.
`state_update` changes **only** the scoped UI-session state, committed after
successful execution; failures roll back the staged state. No model-provided code
or UI descriptor may grant `records.write` permission or directly access the
filesystem/network.

The preview accepts UI-session-only effects by default, and can receive an
explicitly trusted `SpicaPreviewAuthorization` with storage and approved grants.
Unconditional storage writes/deletes are never automatically executed by that
preview even with grants. Only the registered event-gated `record_write_on_event`
and `settings_store` may write in such an authorized interactive session.
The unmodified Workbench does not inject a production storage host; therefore
these changes are **not** a full standalone browser/Tauri V2 compiler or a
claim of durable records inside an unapproved preview.

### New registered one-file-per-block capabilities

- `state_value`, `state_update`: session-scoped reactive text.
- `ui_event_binding`: host event → typed graph event.
- `ui_selectable_list`, `ui_search_field`, `ui_screen_router`, `ui_notification`:
  event-bearing, safely rendered MUI descriptors.
- `record_timestamps`: created/updated metadata on a record.
- `record_refresh`: explicit refresh event.
- `settings_store`: event-gated, permissioned settings persistence.
- `record_write_on_event`: event-gated, permissioned storage save.

Existing `ui_button`, `ui_input`, `ui_markdown_editor` now accept validated
`eventId` configurations; the preview dispatches those interactions into the
same registered event-source nodes. Read-only block inspection supplies
`configSchema` for newly added blocks and these three updated controls.

`tests/spica-phase10-state-and-aliases.test.cjs` covers alias lookup,
port-preserving node composition, UI state across multiple runtime cycles,
permission rejection, write rollback, Recents listing and explicit Save/Reopen.
Use `npm run test:spica:phase10:reliability` for focused validation.

## November 17 functional composition increment

The runtime registry contains 176 executable implementations. New canonical
blocks provide event-gated `record_patch_on_event` / `record_delete_on_event`,
`array_sort`, `array_group_by`, `date_localize`, `ui_number_input`,
`ui_date_input`, `ui_typed_form`, `styled_surface` and `interactive_surface`.
Checkbox, select and tabs accept validated event bindings. The shared preview
renders these controls and wrappers. Patch/delete join the event-gated write
allowlist only for an explicitly authorized store with read/write grants;
default preview still cannot mutate application records.

Tests: `tests/spica-construction-progress.test.cjs`. The target/export distinction
above still applies: these runtime implementations do not constitute a general
V2 standalone compiler. See `spica/roadmap/57_PHASE10_CONSTRUCTION_CONTINUITY.md`.
