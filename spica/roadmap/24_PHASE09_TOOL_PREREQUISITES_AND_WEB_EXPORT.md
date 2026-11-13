# Phase 09 — Spark Tool Prerequisites and Dual Export Contract

## Correct names and types

- **Callable tools** include `list_spica_toolchain`, `spica_next_action`, `inspect_spica_tool`, `inspect_spica_runtime_block`, `read_spica_graph`, `migrate_spica_v2_graph`, `check_spica_tool_call`, `compose_spica_v2_graph`, and `inspect_spica_target`.
- A resource identifier such as `spica.runtime.ui_markdown_editor` is **not** a callable tool name. Pass it in the `id` field of `inspect_spica_runtime_block`. Direct resource inspection through `inspect_spica_tool` also returns resource metadata, not a successful executable action.
- A `list_spica_toolchain` request only accepts its documented arguments. Tool argument shapes must come from registration, never inferred from block configuration shapes.
- `check_spica_tool_call` requires `name` plus the exact intended `arguments`. It validates but does not execute.

## Constructing a Graph V2

Use `read_spica_graph` to obtain graph state and current revision. Before composing Graph V2, call `spica_next_action` with stage `compose`. If it returns `migrate_spica_v2_graph`, inspect and preflight the returned `revision` and **perform that explicit operation**. Only after the V2 graph exists should the Spark search and inspect block contracts, choose the correct blocks, validate wiring and call the composition tools.

When a call fails, return its exact error to the model. Repeating the same invalid call unchanged is not building progress. Inspect the prerequisite and make a different **registered** call; permission checks and version checks are never bypassed. No assistant-generated implementation is hardcoded for a user-specific feature request.

## Exporting

`inspect_spica_target` evaluates the actual app and target before export. Target `desktop` produces standalone Tauri source. Target `web` produces browser-only Vite source, including browser record persistence and download adapters. `export_spica_app`, `prepare_spica_app`, and `verify_spica_app` use exact target contracts.

Do **not** report that `run_spica_v2_graph` produced native source: V2 runtime evaluation and schema-1 target lowering are separate capabilities. Unsupported V2 exports must be rejected with explicit diagnostics. A green native check does not verify a web artifact, and a green web check does not permit launching a native executable.

## Repository ownership

All 129 current block modules live in `src/spica/runtime/blocks/`. `src/spica/blocks/` must not reappear. The cleanup script rejects divergent leftover files rather than deleting them. Both registries must validate before cleanup.
