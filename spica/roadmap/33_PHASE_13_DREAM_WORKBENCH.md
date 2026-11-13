# Phase 13 — Dream Workbench V3, Visual Graph & Live Execution Evidence

**Goal:** Deliver the high-fidelity fifth concept while keeping SPICA inside the existing Chat conversation. Build/Test opens the **centered glass overlay**, with real graph editing, terminal trace, source changes and a live app preview visible together.

## Required UI

- **Centered, dismissible dialog** with background conversation visible/dimmed, resizable inside sensible bounds, focus management, keyboard shortcuts and compact-mode stacking.
- **Left/center editing pane** with selectable tabs: Graph, Changes (Monaco diff), Build Stream (real xterm/structured events), Tests and Inspect. No separate top-level Spica route is necessary.
- **Right pane**: interactive running graph/app preview bound to selected graph revision; preserve preview data across compatible graph edits.
- **Plan strip** above or alongside the dialog: current step, real operations, committed graph revision, build target, Pause/Resume/Cancel; only verified data contributes to completion.
- Typed interactive node graph canvas with category-aware nodes, compatible input/output handles, multi-select, zoom, accessibility alternatives and undo/redo. Show schema and runtime provenance, not just a visual drawing.

## Data and execution contracts

- `SpicaBuildEvent` stream contains run ID, event ID, timestamp, stage, severity, graph revision, tool/command ID and actual result/output references. Reuse existing Phase 02 event architecture; no second synthetic log feed.
- Node graph edits go through unified `edit_spica_graph` and current graph revision/permissions; never mutate local graph state without committing through validator.
- A generated native executable preview is not automatically the same as an interactive in-app graph preview. Label the preview type accurately.
- Diff originates from actual before/after source snapshots; `+`/`−` rendering cannot be invented.
- Scenarios/test badges refer to real executed commands, with exact target desktop/web and fingerprints.

## Implementation plan

1. Inspect existing `src/components/SpicaWorkbench.tsx`, build event stream and preview modules. Keep working functionality.
2. Introduce `SpicaGraphCanvas` using `@xyflow/react`; `elkjs` for optional automatic arrangement. Adapt canonical Graph V2 nodes, typed ports and edges—don't invent parallel block schemas.
3. Integrate context-aware `SpicaBlockInspector`: contract, inputs/outputs, config schema, permissions, target compatibility, source file, errors.
4. Implement safe graph gesture commands (connect, disconnect, move, configure, undo) via unified edit dispatch; ensure transactional revision checks.
5. Implement resizable panels using `react-resizable-panels`; use existing Monaco/xterm for code diff and terminal. Optional `@tanstack/react-virtual` for large trace logs.
6. Add real plan/agent state from Phase 10, live preview synchronization and robust cancellation.
7. Visual QA against concept 5 and the user's original SPICA screenshot; support Classic and Cosmic surfaces without two workbench implementations.

## Acceptance gate

- Drag a registered V2 block onto graph, inspect contract, connect valid ports, submit an edit, see graph revision increase and preview update.
- Invalid edge or missing permission is clearly rejected; graph remains unchanged and task stays resumable.
- Workbench displays live build/verify events, true red/green diff and application preview in one centered dialog.
- Exported/native verification is correctly labeled; no “verified” claim from a static graph image.
- Handles narrow windows, full keyboard traversal, zoom and screen readers.
