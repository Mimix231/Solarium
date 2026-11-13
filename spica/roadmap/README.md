# Solarium × SPICA — Canon Mega-Phase Implementation Pack

**Source baseline:** `Solarium[Bak].zip` supplied 11 November 2026.  
**Baseline archive SHA-256:** `7958cf9a210772dc40798bbe91d31169cd13826b7fb06059bbca07c032cf73c8`  
**Status:** Planning documents derived from a static source inspection. This pack is **not an implementation patch**, and no native build or user-data migration has been executed.  
**Work cadence:** **ONE complete major phase per round**; preserve a passing canonical checkpoint before proceeding.

## Read order

1. `00_CURRENT_SOURCE_AUDIT.md` — what is actually in the supplied ZIP (static inspection, not a fresh test).
2. `01_MASTER_MEGA_PHASE_ROADMAP.md` — detailed **12 large, one-round-per-phase** implementation plan.
3. `02_PHASE_01_IMPLEMENTATION_ORDER.md` — exact first-round targets and Copilot-ready handoff.
4. `03_ROUND_PROTOCOL_AND_HANDOFF.md` — source checkpoint and test protocol across ChatGPT/Copilot/Codex rounds.
5. `04_BLOCK_FILE_AND_CATEGORY_STANDARD.md` — **one executable block per source file** in its category; generated registration and accurate status.
6. `05_DREAM_WORKBENCH_TERMINAL_GLASS_SPEC.md` — early Phase 02 centered glass modal, actual terminal stream, red/green diff and interactive preview.
7. `06_PROFESSIONAL_MUI_APP_TARGETS_AND_GAME_BLOCKS.md` — library-backed app UI and separately rendered games.
8. `07_PHASES_AT_A_GLANCE.md` — concise twelve-phase map.

## Important distinctions

- **Warehouse capacity** is not an executable block count. The source declares 35 categories with capacity for 10,000 catalog slots each (350,000 total).
- **Draft descriptions** are documentation and search candidates, not guaranteed implemented operations.
- **Runtime registered adapters** currently number 26, alongside three recipe descriptors, in `src/spica/program.ts`.
- **Verified capability** requires passing direct and integration tests on a real supported target. Source presence alone does not establish that the snapshot builds or passes tests.

## Canon preservation

Treat `AGENTS.md`, `docs/info/INFERENCE_ARCHITECTURE.md`, `docs/info/SOURCE_AND_ACTION_ARCHITECTURE.md`, and relevant test suites as compatibility contracts. Do not discard the existing Spica graph, export, source evidence, Glitch/Code Studio, or LeonisMaker/ShadowiumUI code.

**UI direction:** Keep the existing Solarium Chat shell, with a **single centered, dreamy glass SpicaWorkbench overlay**. The overlay contains a **genuine terminal-like construction stream**, correct red `−` and green `+` source diff, and interactive app preview. **No separate top-level Spica tab.** Use MUI/professional component packages in exported app UI; put each actual block in its own category file; game blocks have dedicated render targets.

## Starting instruction

Begin **Phase 01 — Canon Hardening, Per-Block Source Files & Unified Capability Registry** only. Do not implement phases 2–12 at the same time. After one phase passes its checks, update the tracker and carry a checkpoint into the next round.

## Current implementation rounds

- **Phase 01:** [`09_PHASE01_IMPLEMENTATION_REPORT.md`](09_PHASE01_IMPLEMENTATION_REPORT.md) — source refactor and compatibility evidence.
- **Phase 02:** [`10_PHASE02_IMPLEMENTATION_REPORT.md`](10_PHASE02_IMPLEMENTATION_REPORT.md) — terminal/glass workbench, source diff, actual build events, interactive preview, focused tests and environment limitations.
- **Phase 03:** [`11_PHASE03_IMPLEMENTATION_REPORT.md`](11_PHASE03_IMPLEMENTATION_REPORT.md) — universal typed graph, schema-1 migration, tool-routing repair and permissioned starter execution.
- **Latest round/checkpoint manifest:** [`SPICA_ROUND_STATUS.md`](SPICA_ROUND_STATUS.md).

The **original baseline text above** describes the planning snapshot. Phase 01, Phase 02, and Phase 03 reports document subsequent implemented changes. Complete frontend/native verification on Windows remains pending.

- [Phase 04 implementation report](12_PHASE04_IMPLEMENTATION_REPORT.md) — executable typed runtime, Spark graph edits and validated registry.

- [Phase 05 implementation report](14_PHASE05_IMPLEMENTATION_REPORT.md) — scalable metadata indexing, category extensions, Spark inspect/dry-run/save and measured limits.
- [inspect_params edit workflow](15_SPICA_INSPECT_PARAMS_EDIT_WORKFLOW.md) — exact Spark tool calls and recovery patterns.
- [Warehouse extension contract](16_PHASE05_WAREHOUSE_EXTENSION.md) — category operations, provenance, and synthetic benchmarks.

- [Phase 06 implementation report](17_PHASE06_IMPLEMENTATION_REPORT.md) — shared Material preview/export design system, eight individual blocks, progressive graph preview, stored native command evidence, Phase 01–06 tests, and environment limitations.

## Phase 07 (2026-11-12)

- [18 — Phase 07 Implementation Report](18_PHASE07_IMPLEMENTATION_REPORT.md)
- [19 — Tool Contract Protocol](19_PHASE07_TOOL_CONTRACT_PROTOCOL.md)
- Updated [SPICA Round Status](SPICA_ROUND_STATUS.md)

Phase 07 adds 89 individually registered V2 executable blocks, plus contract-first Spark introspection and exact preflight. This does **not** mean 350,000 executable blocks or universal V2 native export are present. A failed SPICA action stops instead of invoking a feature-specific fallback.

## Phase 08 (2026-11-12)

- [21 — Phase 08 Implementation Report](21_PHASE08_IMPLEMENTATION_REPORT.md)
- [22 — Tool Discovery and Research Protocol](22_PHASE08_TOOL_DISCOVERY_AND_RESEARCH_PROTOCOL.md)
- Updated [SPICA Round Status](SPICA_ROUND_STATUS.md)

Phase 08 addresses the callable-tool/block-ID confusion, provides paginated inspection of the actual central registry, consolidates `read_spica_graph` for schema 1 and V2, and registers evidence-driven public-web research operations with explicit permissions. Phase 01–08 focused tests pass, but native desktop/full frontend validation remains a release gate.

## Phase 09 (2026-11-12)

- [Phase 09 Implementation Report](23_PHASE09_IMPLEMENTATION_REPORT.md)
- [Tool Prerequisites and Web Export Contract](24_PHASE09_TOOL_PREREQUISITES_AND_WEB_EXPORT.md)

**Current canonical block source**: `src/spica/runtime/blocks/` only. The Phase 08 unification note is historical and superseded in folder direction. Desktop and web source export are distinct, verified targets; arbitrary V2 application export remains unsupported.

**Phase 09 hardening:** [Tool Contract Intelligence (26)](26_PHASE09_TOOL_CONTRACT_INTELLIGENCE.md) adds canonical tool schemas, explicit prerequisites, deterministic candidate validation, and repeat/progress detection. Phase 10 remains pending real desktop and local-model verification.

## Updated roadmap: Phases 10–18 (planning only)

Start with [28 — Master Phases 10–18](28_MASTER_PHASES_10_TO_18.md). The [dual UI theme specification](29_DUAL_UI_THEME_AND_EYE_SWITCHER.md) describes an eye-button switch between Classic (existing/default) and Cosmic (concept-inspired), independent of color palettes. One phase per round; Phase 10 is persistent agent execution and rolling context. Original planned Glitch, games, and ecosystem work is retained in later phases. Implementation not started by this documentation package.
