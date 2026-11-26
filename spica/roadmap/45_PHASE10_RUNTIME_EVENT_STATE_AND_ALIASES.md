# Phase 10 — Registered aliases, reactive event/state blocks, and functional notes-save path

**Status:** Source implementation and targeted runtime integration verified. Not a standalone Graph V2 app compiler; native Windows/Tauri and real local GGUF verification are separate requirements.

## Why this change exists

The user's captured work logs show Spark repeatedly submitting names such as `notes_list`, `MarkdownEditorBlock`, and `spica.runtime.markdown_renderer` while those features actually exist under canonical registered block IDs. The inspector used to reject even exact, known synonyms. Separately, previews of `ui_markdown_editor` could accept typing but could not deliver the edited text to any state or storage node. This made an application look more complete than its wiring actually was.

## Implementation decisions

1. Add a source-controlled, bounded `runtimeBlockAliases` mapping, **not** a second block registry. Every target is checked against `generatedRuntimeAdapters`; aliases cannot shadow canonical IDs. `getRuntimeBlock`, block inspection/discovery, `makeRuntimeNode`, `previewSpicaComposition`, and V2 `add_node` operations resolve the known aliases to their canonical blocks. `search_spica_runtime_blocks` and `edit_spica_graph` remain tool names and never become runtime blocks.
2. Add **eleven** independently registered runtime adapters (one source file per adapter) under `src/spica/runtime/blocks/`: `state_value`, `state_update`, `ui_event_binding`, `ui_selectable_list`, `ui_search_field`, `ui_screen_router`, `ui_notification`, `record_timestamps`, `record_refresh`, `settings_store`, `record_write_on_event`.
3. Add `SpicaRuntimeBlockContext.interaction` and `SpicaRunOptions.interactionState/events`. The executor exposes only **bounded string event values**, stores state changes locally until the storage transaction succeeds, then commits them. Cancel/error rolls back those state updates.
4. Extend existing `ui_button`, `ui_input`, `ui_markdown_editor` adapters with an optional, validated `eventId`. Add safe MUI descriptor event wiring for selectable lists, search, Markdown text editing, buttons and tab switching, including serial event dispatch.
5. New blocks expose static `configSchema` metadata, which runtime inspector returns alongside typed ports, permissions and `exampleConfig`; older config validators remain authoritative. Named events appear in `interaction` hints for UI block inspection. Only real registered blocks are executable.
6. Keep `edit_spica_graph` as the **only graph edit tool**. No new editor names, compatibility executor, or direct filesystem shortcuts are introduced.

## Permission and preview boundaries

- UI-session state is transient and scoped, not user-owned durable storage.
- Data reads/writes use the existing `records.read`/`records.write` grants and explicit host storage transaction.
- The automatic preview does not execute unconditional external effects. The only allowed preview-time storage writes (when a trusted caller provides explicit grant + store) are event-gated `record_write_on_event` and `settings_store`.
- The default Workbench still provides no production storage grant to the V2 preview. A real standalone Graph V2 compiler/exporter is a later roadmap phase. Do not call this a finished independent Notes Organizer binary.
- UI event IDs must be valid bounded keys; prototype-related IDs are rejected and only own event payload keys are accepted.

## Verified behavior

Runtime tests build typed graphs from actual registered blocks and check:

- Every alias maps to the exact canonical adapter, never a new executor.
- Registered block IDs are normalized before being persisted in composition.
- Event-driven Markdown text updates session state and is visible after a subsequent graph cycle.
- A failed graph run rolls back state updates and any storage transaction changes.
- A sorted Recents list returns stable IDs and renderable selectable rows, with reads denied without permission.
- `record_timestamps` preserves the original creation date while setting modification time.
- `settings_store` only persists with explicit permission and an event.
- The Notes Organizer: edit body → no database write yet → explicit Save event → `record_write_on_event` stores it → later graph run reads the updated content.

## Validation commands

- `npm run spica:runtime:registry:check`
- `npm run spica:registry:check`
- `npm run test:spica:phase10:reliability`
- `npm run test:spica:phase01` through `phase10` and `phase95`
- `node --test tests/spica-block-unification.test.cjs tests/spica-tool-contract-intelligence.test.cjs`
- `npm run check` and `npm run build` when dependencies are installed.

## Remaining limitations

No production host storage bridge was introduced automatically into Workbench. Graph V2 general-purpose app export remains unsupported. Full frontend typecheck needs local node_modules, and the Windows Tauri and actual GGUF sessions must be run in the user's development environment. These limitations are not equivalent to failed focused runtime tests.
