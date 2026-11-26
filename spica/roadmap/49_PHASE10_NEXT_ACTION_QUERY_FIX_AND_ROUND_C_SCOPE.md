# Phase 10: `spica_next_action.query` correction and Round C scope

## Implemented in this correction

The same callable tool `spica_next_action` now accepts these **explicit** optional query forms:

- A nonempty plain string: `{ "query": "recents Markdown" }`.
- A nonempty list of strings: `{ "query": ["recent notes", "Markdown"] }`.
- A structured descriptor with one or more of `query`, `text`, `goal`, `task`, `capability`, `feature`, `description`, `search`, `prompt`, `keywords`, `requirements`, `features`; the last three are lists of strings. Example: `{ "query": { "goal": "recent notes", "keywords": ["Markdown", "search"] } }`.
- `null` or omission for no capability query.

The model-facing argument contract, exact preflight validator, and handler use the same declared shapes. The handler explicitly normalizes supported fields to a bounded capability search string, so a structured query is not silently ignored. Unknown fields or empty objects produce `INVALID_NEXT_ACTION_QUERY` rather than guessing. No new tool name, bypass, auto-approval, synthetic execution, or graph write is added.

Regression coverage: `tests/spica-phase07-tools.test.cjs` tests preflight and actual dispatch, including a registered capability-discovery next step, and preservation of strict unknown-field rejection.

## Round C — planned, **not implemented** in this correction

Round C must be based on **action batches**, not a mandatory fresh thought for every tool call:

1. **Action batch owner:** an independent Thought Block owns one objective, e.g. `Build a functional Recents screen` or `Wire and save Markdown content`. It may choose and execute several distinct real registered tool calls as needed to reach a verified checkpoint. Not every call restarts reasoning or opens a new Thought Block.
2. **Persist before execution:** save the batch objective, selected validated calls, contract fingerprints, and project revision. Execute authorized calls only when the corresponding checkpoint is durable.
3. **Checkpoint evidence:** after each operation, persist real tool outputs, failed preflights, token accounting and observed state/revision changes. Complete the batch only when its action goal has verified evidence; discovery alone must never count as a saved implementation.
4. **Onion-skin successor:** after a batch checkpoint, assemble the next thought from the current project graph/revision, unfinished goals, a short retained summary of immediately relevant prior verified work, and exact diagnostics. Do **not** replay the old reasoning transcript, tool schemas, or full inspection logs. Distinguish UI budget resets from actual native inference context capacity.
5. **Prevent inspection loops:** if the same inspection result contains no new relevant evidence, select a registered construction/preflight or report the actual prerequisite rather than repeatedly rediscovering it. A rejected call remains recorded and resumable, not silently retried or pronounced successful.
6. **Unified graph contracts:** keep `edit_spica_graph` (and `read_spica_graph`) canonical. Audit/merge all existing V2-named functionality that has an equivalent canonical tool and provide the actual operation-specific required arguments and examples. Preserve permission gates, expected revision, transaction atomicity and validators.
7. **Plan and Thought UI makeover (moved forward into Round C at user request):** retain the collapsed centered Plan pill. Expanded mode shows batches/steps, current objective, actual graph revisions, observed actions and outcomes, token budget, failure diagnostics, and a visually compact 'onion skin' of the last checkpoint. A batch that makes no project change must not present as accomplished. Preserve the existing Classic interface; do not silently switch to Cosmic or make a mandatory separate SPICA tab.
8. **Acceptance:** test two tasks that require actual connected graph writes. Show that one action batch may use more than one tool; a later independent thought receives only necessary checkpoint facts; no validation or inquiry loops replace implementation; failure/permission blockers remain accurately paused/resumable. Native GGUF/Tauri test remains required on supported local hardware.

Round C scope is an implementation plan, not a claim that the proposed batch scheduler, UI, full graph-contract audit or app compiler are complete.
