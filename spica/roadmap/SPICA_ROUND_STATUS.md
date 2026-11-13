# SPICA Canon Round Status — 2026-11-12

```yaml
round: 9
phase: "09 — Canonical Runtime Block Tree, Dual Standalone Export and Tool Progression"
state: "implemented_focused_validation_passed_full_desktop_unverified"
canonical_block_directory: "src/spica/runtime/blocks/"
obsolete_block_directory: "src/spica/blocks/ (removed; must remain absent)"
cleanup_script: "npm run spica:blocks:cleanup:check"
legacy_registry_modules: 26
runtime_registry_modules: 103
registered_block_modules_total: 129
catalog_capacity_proposed: 350000
warehouse_drafts_non_executable: true
callable_tools_vs_block_ids: "different namespaces; block IDs are resource arguments"
canonical_graph_reader: "read_spica_graph(view:schema1|v2|both)"
removed_callable: "read_spica_v2_graph"
next_action_tool: "spica_next_action (read-only graph prerequisites)"
repeated_invalid_call_guard: true
hidden_tool_fallback: false
browser_export: "emitWeb (Vite, React, MUI, IndexedDB)"
desktop_export: "emitTauri (Tauri desktop)"
unsupported_v2_export: "explicit rejection; no silent lowering"
workbench_targets: [desktop, web]
native_launch_for_web_build: false
verified_checks:
  phase01: "12/12"
  phase02: "11/11"
  phase03: "12/12"
  phase04: "14/14"
  phase05: "10/10"
  phase06: "7/7"
  phase07: "14/14"
  phase08: "8/8"
  phase09: "7/7"
  block_unification: "2/2"
  all_focused: "97/97"
  registry_legacy: pass
  registry_runtime: pass
  source_syntax: "429 TypeScript/TSX files parsed"
remaining_release_gate:
  - "Install frontend npm dependencies and run complete TypeScript/Vite build"
  - "Run native Windows/Rust/Tauri build and functional scenarios"
  - "Test GGUF Spark tool selection with real conversation graph"
  - "Verify desktop and web artifacts on supported host targets"
next_phase: "10 — Glitch Integration and Custom Code"
```

See [Phase 09 Implementation Report](23_PHASE09_IMPLEMENTATION_REPORT.md) and
[Tool Prerequisites and Export Contract](24_PHASE09_TOOL_PREREQUISITES_AND_WEB_EXPORT.md).


## Phase 9.5 — Tool contracts and single editor (November 12, 2026)

`edit_spica_graph` now handles schema-1 and V2. Parameter contracts are operation-specific, `add_block` is registered-port-backed, V2 preview/save and batch runtime-block inspection are available. Focused check: `npm run test:spica:phase95`; see `27_PHASE09_5_UNIFIED_EDITOR_AND_TOOL_CONTRACTS.md`. Phase 10 remains pending full Windows/GGUF confirmation.

## New phases 10–18 — Planning update (November 12, 2026)

This archive adds a **proposed** nine-phase extension. The prior original Phase 10 Glitch / Phase 11 game / Phase 12 quality sequence is **superseded as a plan only** by `28_MASTER_PHASES_10_TO_18.md` (Glitch becomes Phase 15; LeonisMaker Phase 16; ecosystem/release Phases 17–18).

**Next planned Phase 10:** Persistent Agent Execution & Rolling Context. **Current implemented checkpoint:** Phase 9.5; no Phase 10 implementation is claimed.

Two host UI layouts are planned: `Classic` (default existing 3DS/Wii U-like shell) and `Cosmic` (opt-in concept-inspired shell), selected with a new eye-button independent of palette and workspace mode.
