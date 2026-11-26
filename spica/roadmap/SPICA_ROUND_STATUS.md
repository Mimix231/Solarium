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

## Phase 10 correction — Canonical graph editor (2026-11-13)

The Phase 10 source from `Solarium[Bak](1).zip` already exposed one editor
`edit_spica_graph`. This round hardened the V2 implementation without creating
a second endpoint: shared schema1/V2 validation, registered-node ports/config
checks, migration-origin preflight parity, fully atomic repository writes,
operation-specific V2 parameter inspection, updated active runtime guidance,
and removal of an unused direct-template fallback. See
`43_PHASE10_SINGLE_GRAPH_EDITOR_CORRECTION.md`. This is **Phase 10**, not 10.1;
Phase 11 remains unimplemented.

## Phase 10 continued — registered capability inspection and folded Plan (2026-11-13)

Existing Phase 10 code was amended in-place. The latest focused runtime registry has 105 executable blocks (including `record_list` and `record_delete`), both in separate canonical files. Source-level `resolve_spica_capabilities` and inspector query/parameter expansion improve ID discovery without aliasing nonexistent tools. Compose-stage selection is plan-aware, and empty searches no longer count as discovered capabilities. The folded Plan is centered directly above the chat message box and expands into the original detailed panel. Phase 11 has **not** begun. Source-level regression checks cannot certify natural tool choices by a particular GGUF model or unsupported general V2 standalone export; see report 44.

## Phase 10 Round A — Tool contract/execution reliability (November 13, 2026)

Audited 100 global callable declarations (34 SPICA direct calls), added strict source checks for handler/permission/stage/work-log coverage, removed the fatal unverified scoped-operation exception, made absent V2 migration reachable after explicit preflight, retained tools for corrected invocations, and reduced failed graph-edit preflight payloads. Generic Dona addressing was removed. **Round A only**; Round B–G and Phase 11 remain unimplemented. See `47_PHASE10_ROUND_A_EXECUTION_AUDIT_AND_FIXES.md`.
