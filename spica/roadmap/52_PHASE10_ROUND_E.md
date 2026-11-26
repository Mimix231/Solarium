# Phase 10 — Round E: bounded input, evidence ghosts and developer activity

Date: 2026-11-15

This report describes source changes implemented on top of the full Round D archive. Round E remains part of Phase 10. It does **not** claim native GGUF or Tauri acceptance, a pixel-identical theme, a 4,096-token native model context, or arbitrary standalone Graph V2 compilation.

## E1 — Fix input bloat without changing infinite native output

The existing llama.cpp adapter keeps the single native generation request with `max_tokens: -1`. Round D introduced additional selected tool schemas, which can increase the *input* payload even with unlimited backend output streaming. The 4,096-token Thought input target is a soft prompt budget and not a command to chunk model output; the actual loaded context remains the hard limit. `prepareGeneration()` now gives optional project snapshots, retrieved reference text and saved-action ghosts lower priority than the current Spark persona, latest user request, user-authored project instructions and current registered tool requirements. It discards optional context from the next assembled request **only** and never mutates saved task or chat records. It can page unneeded secondary tool definitions (keeping one required registered tool) and fall back to unused real model capacity when the soft target cannot fit mandatory material. An honest blocked state remains necessary if the essential input cannot fit the actual model context.

The Round E regression constructs a >12,000-estimated-token original prompt with an 8,192-loaded-context model and a 4,096-input target. It verifies the actual request is compacted before submission, preserving persona, current user request, and one usable tool. Another regression ensures genuinely user-authored project instructions cannot silently be dropped to fake a successful budget calculation. This is a deterministic simulated-adapter test, not a real GGUF run.

## E2 — Onion-skin evidence instead of cumulative transcripts

`SparkThoughtContextAssembler` selects **no more than three** relevant, evidence-backed snippets from *actual saved tool results* using `retrieveSparkGhosts()`. It also includes a short previous-action status and one bounded saved batch checkpoint. The complete earlier reasoning transcripts, old inspected schemas and redundant results are not replayed as active prompt messages; they remain in the durable task data. Snippets carry tool identity, success/failure status and archive locator where present, and are explicitly labeled untrusted evidence rather than instructions. No numbered "Window" or "Thought" labels appear for context refresh in the UI. Native generation turns are never interrupted mid-stream for this process.

## E3 — Registered name variants and construction access

Explicit runtime aliases are preserved. `installVerifiedRuntimeAliases()` now derives unambiguous punctuation/case/suffix variants exclusively from registered executable IDs. Exact aliases take precedence and collisions remain unresolved instead of guessing. There are still **148 executable V2 runtime blocks**; alias spellings are not extra implementations. Tool names cannot be executed as block names. `SpicaConstructionCoordinator` can expose authorized graph/source construction actions when the task is stuck in repeated discovery or composition inspection, without bypassing source permissions, graph revision checks or preflight authorization. `spica_next_action` retains its canonical name and accepts its already supported string/object/keyword-array query forms.

## E4 — Codex-style work activity, without false edits

`WorkLog` groups durable action-batch objectives and actually recorded `SparkThoughtToolResult` outputs under development activities. Graph changes, source changes, checks and diagnostics come from persisted real tool results, not inferred narration. Recent eight actions are shown directly; older results and raw history are available through disclosure controls. Internal context rotation never creates a fake visible milestone. The task Plan no longer renders raw Thought history or every action batch in the card.

## E5 — Compact Plan and coded Cosmic migration

`SpicaTaskPlanView` shows only the task, four stages, current verified evidence, a bounded last diagnostic, budget option, and task controls. Collapsed Plan control remains centered above composer. The actual Work Log owns activity details. All Cosmic sources live in `src/ui-themes/cosmic/`, including the added `cosmic.work.css` (real CSS styling for Work Log, Plan and layout) and existing React telemetry. Old imports updated; Classic remains default. The overlay cleanup script removes obsolete `src/themes/cosmic/` contents only if every old file has a byte-identical copy in the new tree, refusing deletion on divergence or unique user files. Historical roadmap references to older paths are not active imports.

## E6 — Validation and known limits

Commands:

- `npm run test:spica:phase10:roundE` — isolated registry, syntax, targeted strict TS, cleanup and 9 behavioral regression checks.
- `npm run ui:cosmic:cleanup:check` — safe overlay migration preflight.
- `npm run spica:registry:check` and `npm run spica:runtime:registry:check` — legacy and V2 registry integrity.
- Earlier Phase 1–10, Round A–D, unified editor and tool-contract regressions.

This environment lacks some frontend runtime/npm dependencies, so **full frontend TypeScript, Vite, native Tauri builds and live GGUF inference are not verified**. The source ZIP is separately validated by fresh extraction and re-running its tests. A functional application build by a real Spark remains a subsequent acceptance test; no synthetic builds are counted as successful.
