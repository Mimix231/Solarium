# Implementation Round Protocol & Test Matrix

## Rule: one phase per round

Each new coding round loads the most recent **verified** Solarium archive or repository commit, reads the phase's Markdown specification, identifies relevant exported classes/interfaces/functions, makes only that phase's changes, tests them and writes a checkpoint. No overlaying ZIPs from older phases; previous leftover block path errors arose from stale file layouts.

## Before editing

1. Read `AGENTS.md`, current `spica/roadmap/SPICA_ROUND_STATUS.md`, the chosen phase file, `package.json` scripts, relevant `src/` modules and current tests.
2. Record source hash, registered block IDs/version counts and the presence of `src/spica/runtime/blocks/`. Ensure `src/spica/blocks/` remains absent.
3. Capture baseline `npm run check`, `npm run build`, phase regression scripts and native build status. Don't mislabel environment failures as changes from the round.
4. Explicitly state which existing function/component is being modified or replaced; avoid adding parallel registry or duplicate graph editor APIs.

## During editing

- Change one architectural slice at a time; never introduce fake test stages or silent fallback features.
- Maintain `read_spica_graph` and `edit_spica_graph` as single canonical APIs for both schemas.
- Keep tool registry, model-advertised schema, validator and handler in strict parity.
- Avoid repetitive typed errors: output schema and prerequisite guidance as *data* and let the agent select next operations; don't count inspections as completed work.
- Respect Ask/Auto/YOLO permissions and user cancellation; keep project-level graph mutations atomic and version-checked.
- For UI work, test Classic and Cosmic independently, and verify layout switching does not remount active conversation/model state.

## Standard checks

| Scope | Required check |
|---|---|
| Registry | `npm run spica:registry:check` and `npm run spica:runtime:registry:check` |
| Block folder | `npm run spica:blocks:cleanup:check` and `npm run spica:runtime:cleanup:check` |
| TypeScript | `npm run check`, `npm run build` with actual frontend dependencies installed |
| Regression | `npm test`; phase-specific suites, e.g. `npm run test:spica:phase95` |
| Native | `npm run desktop:dev` / `npm run desktop:build` in supported Windows/Rust/Tauri environment |
| UI | React component tests, Playwright snapshots/interactions, keyboard and accessibility scans |
| Models | Real local GGUF tool-call multi-step scenario with checkpoint resume and verified source changes |
| Export | Independent desktop/web target builds and real scenario tests on supported platform |
| Packaging | Fresh extraction, path/hash comparison to baseline, rerun tests from extracted ZIP |

**Do not add package scripts without implementing the referenced tests.** The above are release-run targets; actual scripts may evolve by phase.

## Per-round implementation report template

```markdown
# SPICA Phase NN Implementation Report
- Base archive/commit and baseline SHA256:
- Goal / acceptance criteria:
- Exact files created/modified/removed:
- Key classes/functions/interfaces changed:
- User-data migration and rollback:
- Test commands and actual results:
- Native/Windows/GGUF evidence:
- Known failures / blocked tests (no false green):
- Block counts: executable vs draft vs recipes vs capacity:
- UI state: Classic default preserved? Cosmic opt-in functional?
- Next phase (not implemented in this round):
```

## Core end-to-end acceptance scenario

A user tells Dona: “Add a Recents screen and Markdown editing to my Notes Organizer.” Dona composes the feature from existing generic blocks, persists real plan state across multiple model cycles, validates contracts, commits graph changes, updates the live preview, and verifies a supported target export. At least one forced invalid tool argument may occur during a negative test, but the task is not falsely reported complete and the model must not repeat the same mistake without new actionable evidence.

A complete run is measured by artifact/graph/test evidence, **not** the number of tool calls. If the current block/library/compiler lacks a required feature, Dona must persist that exact missing capability and provide a resumable blocked state, not hallucinate a finished app or spin forever.
