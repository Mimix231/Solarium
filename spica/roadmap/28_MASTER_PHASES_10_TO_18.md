# SPICA 10–18 — Master Phase Roadmap

## Goal

Make Dona capable of finishing real application tasks **with durable progress**, while allowing users to choose between the familiar default Solarium interface and the new concept-inspired cosmic workspace. Carry the original roadmap's Code Studio, game-authoring and ecosystem goals into later phases without rushing them ahead of agent reliability.

## Milestone map

| Phase | Title | Main visible outcome | Must exist first |
|---|---|---|---|
| **10** | Persistent Agent Execution & Rolling Context | Dona keeps a plan across inference cycles, uses tools to change the project and accurately reports real outcomes | Phase 9.5 tool contracts |
| **11** | Dual UI Shell & Eye Switcher | User changes **Classic ↔ Cosmic** layout using an eye icon, with Classic as default | Stable preference persistence |
| **12** | Cosmic Design System & Responsive Layout | Concept-inspired glass dashboard, context bars, step cards and atmospheric but efficient visuals | Phase 11 shell contracts |
| **13** | Dream Workbench V3 & Visual Graph Authoring | Centered build overlay with graph canvas, real source diff, terminal/log timeline and interactive preview | Phase 10 task events; Phase 12 design system |
| **14** | Universal Graph V2 Renderer & Export Compiler | Supported V2 block graphs render and compile to real desktop/web apps | Phase 13 renderer contracts; existing Graph V2 runtime |
| **15** | Glitch + Code Studio Hybrid Builder | Jump from blocks to source, inspect diagnostics, register and test custom blocks safely | Phase 14 compiler/ownership |
| **16** | LeonisMaker Game Creation Bridge | Reusable game blocks compose playable 2D scenes with separate game renderer | Phase 15 block SDK; game runtime integration |
| **17** | Scalable Warehouse & Extension Ecosystem | Search, version and safely promote high-quality blocks, recipes and packages at scale | Phase 10 tool discipline; Phase 14/16 targets |
| **18** | Product Hardening & Distribution | Reliable builds, accessible themes, cross-target tests, signed/reviewed extensions and release process | All preceding phases |

## Dependency and gate policy

- One phase per round. Fix urgent regressions as needed without claiming the next phase was implemented.
- Every round starts from the latest *verified canonical source*, not an older archive or an overlay of ZIPs.
- Do not expand block counts at the cost of reliable tool use. Separate **planned 350,000 category slots** from **129 registered block modules in the Phase 9.5 baseline**, tested target capabilities, drafts, recipes and user-created extensions.
- For each phase supply: source changes, documentation under `spica/roadmap`, migration/backout notes, targeted tests, global regressions, full `npm run check`/build when dependencies exist, and any native Windows/Tauri limitations.
- Do not report full release success from syntax parsing or mocked model calls alone. Windows/Tauri and local GGUF execution must be exercised on their actual targets.

## Five concept images — visual strategy

1. Compact Plan card above the chat composer: plan progress, step statuses, quick resume.
2. Full conversation layout: current project, context budget and build state in tasteful right-hand contextual panels.
3. Agent console: command-accurate execution timeline, graph revision and verified changes.
4. Rolling context orchestration: current inference-cycle budget, checkpoints, preserved task state.
5. Dream Workbench: node graph, terminal/code differences, progress timeline and real app preview.

**Important:** These are design references, not proof that the pictured metrics or features currently exist. No demo data should be presented as actual verification.

## Critical UI interpretation

### Classic (default)

Keep the user's existing **3DS/Wii U-inspired** interface: brand/title bar, vertical rail, existing chat and project sidebar, controls, familiar navigation and density. This is the **default UI layout**, including on upgrade. Existing palette themes (Obsidian, Crystal, Aurora, etc.) still work.

### Cosmic (opt-in)

Use the concepts as a **new interface shell**, not as a different product or separate SPICA tab: more layered glass panels, atmospheric surfaces, contextual right rail, responsive resizable work areas, compact Plan above composer, and the same centered Dream Workbench overlay. Preserve Solarium colors and user content; apply palette tokens to both layouts.

### Switching behavior

Eye icon → `UiThemeSwitcher` menu/popover → choose Classic or Cosmic → update persisted `uiLayoutTheme`. Switching must never unload the active project or destroy the in-flight agent task. It must remain functional in chat, projects, coding, and settings. `ThemePicker` continues to select color palettes.

## Canonical source anchors observed in Phase 9.5

- UI shell: `src/components/Shell.tsx`, `src/main.tsx`, `src/views/Chat.tsx`, `src/components/ThemePicker.tsx`.
- Theme/persistence: `src/themes/registry.ts`, `src/themes/*.css`, `src/domain/types.ts`, `src/domain/defaults.ts`, `src/state/useSolarium.ts`, `src/data/repository.ts`.
- SPICA workbench and UI: `src/components/SpicaWorkbench.tsx`, `src/spica/target/`, `src/spica/appearance.ts`.
- Agent and tooling: `src/engine/agent.ts`, `src/engine/intelligence/`, `src/spica/tools.ts`.
- Block implementations: `src/spica/runtime/blocks/` **only**.
- Graph/emission/verification: `src/spica/graph-v2/` or equivalent existing graph modules, `src/spica/runtime/`, `src/spica/emit.ts`, `src/spica/export.ts`, `src-tauri/`.
- Game editor: `src/varmover/` and relevant SPICA game target.

Verify exact module exports/signatures against the canonical source before implementation; this is a roadmap, not a claim that any proposed class already exists.

## Definition of complete

A phase is complete when its user-visible outcome works under representative real usage; all relevant tests, security and accessibility checks pass; existing data and Classic UI remain compatible; generated outputs and verification are truthfully attributed; and any external environment limitations are explicitly documented. A missing dependency or failing native build means **partial validation**, not full completion.
