# Daily-use verification — 2026-11-01


Current Glitch integration round (2026-11-02): see [GLITCH_INTEGRATION.md](GLITCH_INTEGRATION.md) for the production build, 247 frontend / 9 Python / 22 Rust passes, normal-profile integration evidence and the passing real Gemma coding trial. Earlier pending trials below retain their original status.
This report separates implementation checks, real native execution and reading
quality. A passing build does not establish model quality. Failed and cancelled
model runs remain in the normal application's `quality_run` history.

## Instance and data

Validation uses `npm run build`, followed by `npm run tauri dev` with the ordinary
`org.solarium.desktop` identifier, existing workspace, Dona and selected local
GGUF. No alternate QA application, profile or client is used. A developer-console
connection invokes the application's own Runtime Center quality runner inside
that same WebView. Chat and quality cases share `engine/conversation-run.ts` for
streaming, saving, revision confirmation, memory capture and reply persistence.
No computer-use automation is used.

The real-model configuration is Gemma-4-26B-A4B-it-UD-Q4_K_M, llama.cpp, 4,096-token
input context and the normal managed runtime. Native output remains uncapped;
there is no 2,048-token generation loop or synthetic continuation conversation.
This does not imply infinite context or guaranteed model comprehension.

Original workspace and Foundation databases were backed up before live checks.
The original fanfiction chat and chapter are not rewritten by these checks.
SHA-256 comparison of the three pre-existing revision bodies still matched on
2026-11-01. SQLite `quick_check` returned `ok`.

## Implementation checks

| Check | Observed result |
| --- | --- |
| `npm test` | 236 total: 235 passed, 1 skipped |
| Skipped test | Managed vLLM Bash syntax check runs on Linux CI; this host is Windows |
| `npm run check` | Passed |
| `npm run lint` | 0 errors; 3 existing Hook dependency warnings in BlockWorkbench/LivePreview |
| `npm run build` | Passed; Vite reports a large main bundle |
| `cargo check` | Passed |
| `cargo test` | 19 passed |

Focused regressions cover attributed human instructions, approved outlines,
completed-plan consumption, exact user evidence, newer protected facts, scoped
cast, knowledge/belief separation, immutable revisions, concurrent edits,
malformed writing blocks, actual saved scene proofs, length measurement,
offline retrieval, behavioural command verification and the shared conversation
controller. All eight coding fixtures fail their independent assertions before
repair. Those fixture tests establish the checks are meaningful; they do not
establish that a model has repaired them.

## Real-model findings and repairs

The original user workflow had a saved 7,323-character chapter, two writing
openers, only the opening portion of a four-beat accepted outline, and no saved
cast. Its latest request did not itself specify 50,000 characters. Calling it a
token-limit failure would have hidden the instruction and artifact failures.

Early native trials exposed genuine additional problems:

- A nested multi-character tool with duplicate quote/value arguments encouraged
  unsupported paraphrases and malformed calls. The production protocol now saves
  one character per operation using exact human quotes. Unsupported summaries
  cannot become protected facts. Attribution and actual source message IDs
  remain mandatory.
- After setup, the model returned plain prose instead of a writing artifact.
  The staged prompt now changes to the precise writing format and removes
  irrelevant tool schemas. Approved outlines use planned document operations.
- A real run saved all requested Mimir facts, then hit an input limit before
  saving Subaru: the original brief and newly stored profile were both in the
  prompt. Story data now occupies one retained slot and is loaded after setup,
  with a regression protecting the saved facts.
- A follow-up run repeated a completed profile operation. Setup now offers
  unfinished cast names and validates that stage before saving. An approved
  outline without a new length target is executed directly, without re-planning.
- The same run exposed concurrent SQLite snapshot upgrades. Native CAS batches
  now acquire their writer before reading versions, and ordinary database reads
  no longer rewrite schema metadata. The native concurrency regression passes.
- Native context-shift logs showed setup retaining over 3,200 of 4,096
  tokens. Its input now contains the pending character and exact relevant
  human statements, rather than code-project awareness and old assistant
  outlines. Originals remain saved. This reduces input duplication without
  imposing a reasoning/output quota. Clear quotations about another character
  cannot become the pending character's protected trait.
- A hot-reload diagnostic used an old renderer module. That run was cancelled;
  subsequent checks use a cold normal desktop launch and stable source.
- Unit validation caught a concurrent-edit ownership race while adding document
  bindings. Ownership now follows the revision ID, so metadata changes cannot
  authorize overwriting a user's newer revision.

These runs are evidence of the failures and resulting repairs, not successful
acceptance. Their JSON reports are under `output/quality/` and their actual
operations remain in the normal profile.

## Current native acceptance

The copied original Mimir request is being checked in the normal instance after
the staged protocol repair. Its required checks are actual saved appearance and
personality, stranger relationship, exact original-message evidence, one readable
document, and saved passages for all four approved beats. Literary voice and
whether the scenes meaningfully fulfil the outline require reading separately.

Native acceptance results will be recorded here after the runs finish. A
cancelled or failed run is never counted as passed.

## Practical limits

There are 33 in-app cases, including six held-out cases. The added generated-source workflow is documented in [CODE_STUDIO_IMPLEMENTATION.md](CODE_STUDIO_IMPLEMENTATION.md). A case being available
does not mean it has passed on every model. Results retain model, context,
permissions, source/scenario fingerprints, individual attempts and reading
criteria. Native long-generation, web evidence, cancellation and coding results
must be assessed separately.

Cast/name routing and source-symbol extraction are lexical aids. They are not
universal entity understanding or a compiler language service. Repetition and
exact-passage checks detect specific structural failures, not perfect prose.
Saved quotations and original messages remain available when a compact working
context omits detail. The model's reasoning stream stays genuine; none of its
thoughts are fabricated, replayed as human prompts or parsed into story facts.
