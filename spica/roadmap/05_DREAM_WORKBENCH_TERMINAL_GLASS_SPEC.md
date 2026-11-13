# 05 — SPICA Dream Workbench: Terminal Build Stream + Glass UI + App Preview

**User-approved direction:** The normal Solarium chat remains open and visible under one **centered, softly blurred glass overlay**, matching the current Solarium screenshot. Do not add a full-height separate Spica navigation tab or substitute a new app shell. Reference A demonstrates a terminal-like build process; Reference B demonstrates the dreamy glass treatment and embedded running app.

**Implementation phase:** Phase 02, after Phase 01's registry parity passes. Phase 02 operates on the existing graph v1/Spica exports first. A universal graph is Phase 03, not a prerequisite to display real existing build events.

## Current source anchors

- `src/components/SpicaWorkbench.tsx::SpicaWorkbench`: currently MUI `Dialog`, has `runBuild`, `perform`, `saveEdit`, `showLog`, `SpicaPreview`, `ChangesetReview`, tabs `changes/logs/tests/inspect`.
- `src/views/spica.css`: `.MuiDialog-paper.spica-workbench` currently **94vw / 90dvh**, rounded, dark gradient; `.spica-workbench-grid` currently has evidence and preview columns.
- `src/components/ChangesetReview.tsx`: basic line-level changed ranges; should remain a fallback until full Monaco diff works.
- `src/components/SpicaPreview.tsx`: real graph preview, currently embeddable in dialog.
- `src/spica/export.ts::{exportSpica,prepareSpica,verifySpica,currentSpicaBuild,launchSpicaApp}`: actual export, build and verification operations; do not invent parallel build logic.
- `src/engine/intelligence/commands.ts::readCommandOutput`: existing paginated command output.
- The root `package.json` **already includes** `@mui/material`, `@emotion/react`, `@emotion/styled`, `@monaco-editor/react`, `@xterm/xterm` and associated addons. Reuse them.

## Layout wireframe (desktop)

```text
CURRENT SOLARIUM CHAT (visible, gently dimmed)
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CENTERED SPICA OVERLAY                             │
│  SPICA • Building Notes Organizer     revision 42         [Minimize] [×]    │
│─────────────────────────────────────────────────────────────────────────────│
│  [Build Stream] [Changes] [Tests] [Inspect]       [Graph] [Warehouse]       │
│┌───────────────────────────────────┬─────────────────────────────────────┐│
││ REAL TERMINAL-LIKE BUILD STREAM   │ LIVE GENERATED APPLICATION          ││
││ > Discover block ... success      │  Notes Organizer (live)             ││
││ > Register ... validated          │  [ Add note ] [ Search... ]         ││
││ > Connect ... OK                  │  [ Notebook list / controls ... ]   ││
││ > Export 12 files                 │                                     ││
││ > Compile ... (real output)       │  Directly interactive              ││
││ > Execute scenario 3/5 ...        │                                     ││
│├───────────────────────────────────┤                                     ││
││ CODE CHANGES / ADD & REMOVE       │                                     ││
││  - old line  | + new line         │                                     ││
│└───────────────────────────────────┴─────────────────────────────────────┘│
│  1 Register ✓  2 Generate ✓  3 Build …  4 Test ○  5 Preview ○             │
│  [View logs]                         [Cancel run] [Re-run] [Launch verified] │
└─────────────────────────────────────────────────────────────────────────────┘
```

The code diff can also occupy the entire left pane via the **Changes** section, preserving a wide two-column Monaco diff when space permits. Keep live preview **visible** even when logs/diffs are selected, whenever available. Small screens use stacked panels within the same dialog, not route navigation.

## UI treatment

- Respect Solarium's existing dark/teal palette, readable text hierarchy and native MUI theme. Apply purple/cyan highlights only to meaningful progress and interactions, not every border.
- Center overlay with MUI `Dialog`, `Backdrop`, `Paper`, `Stack`, `Tabs`, `IconButton`, `Tooltip`, `LinearProgress`, `Chip`, `Alert`, `Typography` and a shared Spica theme layer.
- Frosted surfaces: translucent panel backgrounds with graceful blur fallback; avoid rendering the app under unnecessary blur **inside** the preview.
- Smooth reduced-motion-compatible state transitions (~120–220ms where appropriate), keyboard focus restoration, clear Escape/Cancel behavior, accessible live regions and contrast.
- Show the project name, current graph revision, actual selected file, and current stage; never display fake success or clock-based pretend progress.
- Collapse/expand individual command events and saved prior runs; output wraps/scrolls without blowing away the app preview.

## Actual build event protocol (proposed)

```ts
export type SpicaBuildStage =
  | 'discover' | 'register' | 'compose' | 'validate'
  | 'generate' | 'prepare' | 'compile' | 'scenario-test'
  | 'preview' | 'launch';
export type SpicaBuildStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled' | 'skipped';
export interface SpicaBuildEvent {
  eventId: string;
  runId: string;
  graphRevision: number;
  timestamp: number;
  stage: SpicaBuildStage;
  status: SpicaBuildStatus;
  severity: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  blockId?: string;
  filePath?: string;
  commandRunId?: string;
  stream?: 'stdout' | 'stderr';
  outputOffset?: number;
  evidenceRef?: string;
}
```

Event producers should live beside the existing export, verification and graph operations. Event consumers are MUI/Xterm UI components. The model may describe actions but may not forge `passed` status. Resume/reconnect uses event ID + run ID; cancellation uses existing `AbortController` and `withLocalWork` semantics. Bounded ring buffers plus paginated persisted command output prevent memory blowups.

## Proposed code boundaries

- `src/components/SpicaWorkbench.tsx::SpicaWorkbench`: retained as parent dialog coordinator, not turned into a 2,000-line monolith.
- `src/components/spica/SpicaBuildStream.tsx`: xterm.js-like live output and stage grouping with accessible text fallback.
- `src/components/spica/SpicaCodeDiff.tsx`: Monaco side-by-side source diff using the project's actual before/after files, block source/graph trace metadata and real hunks.
- `src/components/spica/SpicaLivePreviewPane.tsx`: wraps existing `SpicaPreview`, preserves pointer/focus and accounts for independent target launching.
- `src/components/spica/SpicaBuildTimeline.tsx`: stage status indicators from `SpicaBuildEvent`, including failure/cancel/skipped.
- `src/spica/build-events.ts`: typed events, run reducer and subscription surface (new module; no new agent engine).
- `src/views/spica.css`: root glass shell and responsive layout/tokens; move scoped styles to component-level modules when the app's conventions support this.
- `src/spica/export.ts`: add event emission around **existing** `exportSpica`, `prepareSpica`, `verifySpica` and `launchSpicaApp` without changing build semantics.
- `src/components/ChangesetReview.tsx`: retained fallback/compatibility UI; do not delete until diff parity passes.

## Diff requirements

- Real source before/after snapshots; color `−` deletions red and `+` additions green; stable line numbers; source path and changed-hunk navigation.
- For generated/export-owned files, honor source ownership (`src/spica/emit.ts::OWNERSHIP_PATH`) and compare-and-swap conditions. User-owned changes are **conflicts**, not automatic deletions.
- The graph JSON diff can be offered, but is **not** a substitute for source-code diff.
- Display large diffs virtually to preserve scroll smoothness. Avoid rendering an entire large output into a single `pre` or React array.
- Stage and file revision match verification state. If source has changed since the last pass, clearly mark test results stale.

## Terminal requirements

- Use xterm.js (already a dependency) for high-volume terminal display where appropriate, with ANSI sanitization, log throttling and output length limits. Provide a selectable accessible text log alternative.
- Terminal lines are real events/outputs from the Spica pipeline and command runner. Do not invent syntax-accurate output for an action that has not run.
- Include timestamps, per-command run ID, elapsed time only when derived from actual timestamps, expand-to-full-log, copy, filter (all/warnings/errors), and stop operation.
- A failed build keeps the preview of the last known good graph visually marked as stale rather than swapping to an invalid success image.

## Preview requirements

- Preview is interactive, not a static screenshot. Label `Graph Preview`, `Verified Native Run` and `Previous Verified Build` honestly; these are different evidence levels.
- Keep the app visible in the overlay even while changing left-side tabs. Make actions such as resize, responsive breakpoint and keyboard interactions testable.
- Preview cannot claim an app was compiled or launched solely because a React graph renderer displayed successfully.

## DONE gate for Phase 02

1. Overlay opens **centered over the existing chat**, no top-level Spica route/tab.
2. App preview stays visible inside the glass overlay and is usable by keyboard/pointer.
3. Start an existing Spica native verification run; terminal displays **real** stage transitions/output. Stop/cancel works and is not reported as passed.
4. Changes view shows actual synchronized before/after **source** diff, red `−` / green `+`, with relevant filenames and conflicts.
5. Large logs/diffs remain responsive; no runaway UI memory; accessibility/reduced-motion and small-window checks pass.
6. The existing Notes Organizer preview/export, on-disk ownership protection, and native scenario tests remain compatible.
7. No false `passed` state from agent-generated text or UI simulation.
