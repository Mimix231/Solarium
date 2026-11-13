# Phase 02 — Dream Workbench / Terminal Build Stream / Glass Overlay

**Round:** 02 of 12 · **Source input:** `Solarium_SPICA_Phase01_Canon.zip` · **Date:** 2026-11-11.

**Result:** Phase 02 source implementation and focused automated validation completed. **Full Tauri desktop release validation is NOT certified:** the environment cannot install the original frontend dependency tree or run a Windows native target. Do not interpret a graph preview as proof of a launched native application.

## User-approved visual direction

- Preserve Solarium's chat, projects and existing navigation behind **one centered, translucent, softly blurred MUI Dialog**. The original SpicaWorkbench remains the parent/coordinator. No separate Spica top-level tab, route or product shell.
- The left pane provides real stage/activity messages, native command output, Monaco red/green side-by-side diff, existing complete command logs, actual test evidence and the existing inspector/warehouse controls. The right pane remains a fully interactive **sample-data graph preview** while navigating any left-side tab.
- The footer shows only known recorded stage statuses, including failure/cancellation/skips. Stronger purple/cyan accents and a terminal-like aesthetic match the reference images without replacing Solarium's teal identity.
- Use Material UI/Emotion and the already installed Monaco editor package; no new runtime package dependency was added.

## Implemented code boundaries

| Path | Actual change |
|---|---|
| `src/spica/build-events.ts` | New typed, evidence-only build notices, stage/status mapping, 240-event per-run journal, 96 KB sanitized terminal-output cap, cancellation detection. |
| `src/spica/export.ts` | Added **optional** `SpicaBuildEventSink` to existing `exportSpica`, `prepareSpica`, `verifySpica`. Event stages now wrap the real existing exporter, dependency commands, toolchain check, frontend build, native tests, desktop build, scenario execution and failures. No duplicate exporter or synthetic timer. |
| `src/components/SpicaWorkbench.tsx::SpicaWorkbench` | Preserves existing graph operations and modal; adds Build Stream tab, real output wiring with animation-frame coalescing, revision-scoped pre-export snapshots, Monaco diff, live-preview wrapper, real timeline, cancellation and launch statuses. |
| `src/components/spica/SpicaBuildStream.tsx` | Terminal-style MUI stage list, real run ID inspection, capped and scrollable live stdout/stderr, selectable full logs via the existing command-output reader. |
| `src/components/spica/SpicaBuildTimeline.tsx` | Progress dots based on actual journal statuses, not timer percentages. |
| `src/components/spica/SpicaCodeDiff.tsx` | Monaco DiffEditor for actual `ExportReview.changes` pre-/post-source bytes. Ownership conflicts compare current on-disk file with proposed export; graph diff explicitly marked separately. Large-file fallback warns rather than claiming to display the complete diff. |
| `src/components/spica/SpicaLivePreviewPane.tsx` | Wraps existing interactive `SpicaPreview` with honest Graph Preview vs Native Verified evidence labels. |
| `src/views/spica.css` | One centered frosted dialog, legible terminal, purple/cyan glass accents, responsive two-column-to-stacked layout, keyboard-friendly focus inheritance, reduced-motion/forced-colors fallbacks. |
| `tests/spica-phase02.test.cjs`, `scripts/check-spica-phase02.cjs` | Focused offline tests for real export/verification events, failure/cancellation, dependency setup compatibility, event limits and structural UI wiring. |
| `package.json` | New `npm run test:spica:phase02`; existing scripts and dependencies retained. |

**Backward-compatibility note:** All original `exportSpica(root, record)`, `prepareSpica(root, record, network, signal, onOutput, onResult)` and `verifySpica(root, record, webEnabled, signal, onOutput, onResult)` calls remain valid. The new final `onEvent` argument is optional. Existing app schema, block ID registry, permission handling, file ownership protection, source fingerprinting and persistence are unchanged.

## Verified in this environment

| Check | Result | What it proves |
|---|---|---|
| `npm run spica:registry:check` | **PASS** | 26 pre-existing block adapters and 35 categories remain registered. |
| `npm run test:spica:phase01` | **PASS (12/12)** | Legacy graph and registry compatibility suite, including strict TypeScript compilation and standalone emitter test. |
| `npm run test:spica:phase02` | **PASS (9/9)** | Real export event tests using mocked native services; passed/failed/cancelled verification behaviors, source conflict handling, event bounds and wiring. This is **not** a real native command execution. |
| `node scripts/check-syntax.cjs` | **PASS (296 sources)** | TS/TSX source syntax parser detects no errors. |
| Chromium CSS fixture smoke: 1536×900 and 390×760 | **PASS** | Centered desktop two-column and stacked narrow-window layout, no horizontal viewport overflow. This is not the full React/Tauri app. |
| `npm ci --offline` | **BLOCKED** | Required dependency tarballs missing from local npm cache (`ENOTCACHED`). |
| `npm ci --ignore-scripts` | **FAILED IN ENVIRONMENT** | npm returned `Exit handler never called`. Partial `node_modules` removed afterward. |
| `npm run check`, `npm run build` | **BLOCKED** | Existing `check-frontend-dependencies.cjs` reports missing frontend packages. |
| `npm run lint` | **BLOCKED** | eslint executable unavailable without dependency install. |
| `npm test` | **BLOCKED** | Whole-project compilation requires unavailable frontend packages; no passing assertion is made. |
| `npm run test:glitch` | **ENVIRONMENT FAILURE (3 errors, 1 skipped)** | Python tests try launching Windows `node_modules/.bin/typescript-language-server.cmd` in this Linux environment, as in the pre-existing Phase 01 baseline. |
| `cargo check`, native Tauri build, real Spica Quick Capture | **NOT RUN** | Rust/Cargo or Windows native runtime unavailable. |

## Manual acceptance checks on Windows before shipping

1. Extract into a **new** checkout. Run `npm ci` with your original lockfile, then `npm run check`, `npm run lint`, `npm test`, `npm run build`, `npm run test:spica:phase01`, and `npm run test:spica:phase02`. Repair any real errors. Run `cargo check --manifest-path src-tauri/Cargo.toml` with Rust installed.
2. Launch Solarium Desktop, open a Notes Organizer project and its existing Spica overlay. Confirm the chat remains behind one centered glass MUI dialog, not a new route or workspace tab. Verify Tab/Escape/focus restoration and scrolling at multiple DPI settings.
3. Choose a dedicated output folder. Start **Test & Preview**. Watch actual export, dependency, toolchain, frontend, native, desktop and scenario transitions. During builds, inspect paged stdout/stderr. Check that a failed command is visibly failed, not replaced with success text.
4. In **Changes**, compare actual generated files before and after export. Check red/green line numbers in Monaco, select different files, and manually alter a managed file to confirm the existing ownership check rejects the conflict safely.
5. Interact with the embedded app while the left pane displays logs or diffs. Confirm it is marked **Graph Preview / sample data**, not a verified native run. Check compact/wide preview and keyboard layout auditing.
6. Cancel during a long native command and during a scenario; confirm underlying commands receive cancellation and no passing build evidence is emitted. Re-run successfully afterward. Close the dialog mid-run and confirm its existing abort controller stops work.
7. Only when a full current source/build fingerprint matches, launch the verified native executable. Its launch stage must record the actual process ID or an error.
8. Visually compare desktop and narrow windows to the user's November 11 concept: teal Solarium identity, softly glowing centered glass, terminal status steps, readable Monaco diff and preview visible beside it.

## Deliberate non-goals

- The **350K warehouse**, universal graph ports, game block engine, MUI migration of **exported** apps and independent LeonisMaker integration belong to later phases.
- The existing graph preview is not replaced with a screenshot or falsely claimed to be a native executable embedded in a browser. An executable that launches in a separate native process remains separately labeled.
- No inference-stream, Spark persona, Ask/Auto/YOLO permission, repository persistence, generated app schema or native command API modifications were made.

**Next round:** Phase 03 — Universal Graph V2 with typed nodes/ports and non-destructive migration of schema-1 apps.
