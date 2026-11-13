# 03 — Solarium Canon Round Protocol and Handoff

**Rule:** ONE mega-phase per conversation/development round. The user's current `Solarium[Bak].zip` is the baseline, not an invitation to replace newer code in a later round.

## Before changes

1. Confirm the newest user-supplied canonical source snapshot/repository revision. Do **not** merge an older ZIP over a newer source tree.
2. Read `AGENTS.md`, `docs/info/INFERENCE_ARCHITECTURE.md`, `docs/info/SOURCE_AND_ACTION_ARCHITECTURE.md` and the active phase spec.
3. Create a clean working branch/checkpoint or a copy before modifications.
4. Identify existing APIs, tests and compatibility fixtures relevant to this phase. Record baseline test outcomes, not assumptions.
5. Explicitly list the functions/classes/interfaces being replaced or adapted. Identify data/schema migrations and rollback strategies.

## During one mega-phase

- Split implementation into internally verifiable batches, but **do not announce the phase complete** until the end-to-end phase acceptance criteria pass.
- Preserve user projects, messages, files, native tests, research evidence, agent reasoning and model memory. Do not alter the llama.cpp inference stream for warehouse work.
- Keep scope bounded to the current phase. Essential regressions can be repaired in place; adjacent features get a deferred-ideas entry.
- Never invent a build success. Terminal logs, code differences and results must derive from actual commands and graph revisions.
- Perform security and permission checks before running generated/custom code or network requests.

## After changes

Record this **handoff manifest** in `SPICA_ROUND_STATUS.md` (a suggested new project file):

```yaml
canonical_source: "<commit or exact source archive fingerprint>"
round: 1
phase: "01 — Registry"
state: "not_started | in_progress | partial | complete"
changed_files: []
api_changes: []
block_ids_migrated: 0
catalog_entries_proposed: 0
registered_blocks: 0
verified_executable_blocks: 0
migrations: []
build_checks:
  npm_test: "not_run"
  npm_check: "not_run"
  npm_lint: "not_run"
  npm_build: "not_run"
  glitch_python: "not_run"
  rust_checks: "not_run"
  windows_native: "not_run"
known_failures: []
rollback_checkpoint: "<real revision/path>"
next_phase: "02 — Centered terminal/glass overlay"
```

Replace every placeholder with observed facts. Persist a source/checkpoint ZIP or Git commit before the next round.

## Conditions requiring a stop or partial result

- Existing user data/graph migration cannot be shown safe.
- A required build or test fails and cannot be repaired within the current round.
- A source conflict with a newer canonical snapshot exists.
- Permission boundary is unclear for executing code, reading files, or accessing network.
- A capability exists as metadata only but is being advertised as runnable.
- A phase depends on code from a previous phase that has not passed its acceptance gate.

## How to restart in a later chat

Supply the newest checkpoint, the last `SPICA_ROUND_STATUS.md`, and the intended phase. Ask: “Continue Solarium SPICA with Phase XX only, using this ZIP as the latest canon. Preserve past migrations and report tests.” Do not rely on previous assistant ZIP paths without verifying them in the current turn.

## Priority visual constraints across all rounds

- Use the actual Solarium screenshot and the two reference concept images as design references.
- SpicaWorkbench stays in the existing conversation and opens as one centered overlay (not a new top-level navigation tab).
- Terminal-style **real** streamed build output; smooth accurate added/removed code diff; app rendered within the glass overlay.
- Material UI/Emotion for React application UI by default, or an approved equivalent with real package/runtime integration. Distinct game targets use game-specific rendering blocks.
- One executable block per source file in a proper category/subcategory, with generated registration and unique versions.
