# Solarium development rules

**MANDATORY FIRST READ for inference, agent, tools, model context, and runtime edits:**
[`docs/info/INFERENCE_ARCHITECTURE.md`](docs/info/INFERENCE_ARCHITECTURE.md)

The documented single-stream reasoning/answer path, model-memory reuse, input-vs-output distinction, and staged project-tool registration are compatibility requirements. Do not add 2,048-token HTTP generation loops, extra reasoning quotas, synthetic continuation chats, or tool-schema blockers that prevent an existing project from being edited. Do not alter the inference architecture without a focused regression test and a corresponding update to the architecture contract.

Keep Spark personas, real filesystem verification, Ask/Auto/YOLO permissions, project-folder scoping, and Web Search OFF behavior intact. Every claimed filesystem or terminal success requires an actual executed result. Run and report available tests; distinguish skipped checks from successful ones.

**Read for Sources, task execution, project tools, storage and imports:** [Sources and Action Architecture](docs/info/SOURCE_AND_ACTION_ARCHITECTURE.md). Preserve scoped originals, per-command verification, actual output logs and durable task recovery. Failed checks remain work to repair; a different pass is not overall completion.

**Read for authoring, long chapters, characters, canon and web research:** [Writing, Canon and Research Architecture](docs/info/WRITING_CANON_RESEARCH_ARCHITECTURE.md). Preserve stable rich documents/revisions, explicit length targets, planned scene boundaries, per-field evidence and locked AU facts. Characters never become the Spark persona. A finished fence or model EOS alone is not proof that a requested chapter length was reached.

## SPICA unified block warehouse and nonterminal tool diagnostics (2026-11-12)

All canonical block implementations now reside in `src/spica/runtime/blocks/<category>/`:
legacy schema-1 descriptions under `<category>/<subcategory>/` and executable V2 nodes under
`<category>/runtime/<subcategory>/`. `src/spica/runtime` contains the engine **and its sole block source tree**; there is no competing `src/spica/blocks` directory. Regenerate the two checked manifests with
`npm run spica:registry` and `npm run spica:runtime:registry`.

A rejected SPICA tool inspection or malformed call remains a failed operation in the work log,
but must not terminate the overall user task. Deliver its exact diagnostic to the model and
advertise the appropriate registered inspector on the next inference turn; the Spark must
explicitly call it. No hidden retry, guessed arguments, aliasing, or permission bypass is allowed.
User-denied permission still blocks the unauthorized action. Verify the phase regressions and
`tests/spica-block-unification.test.cjs` after changes to any of these contracts.

## SPICA Phase 09 export and tool-sequencing requirements (2026-11-12)

The canonical block sources are `src/spica/runtime/blocks/`. Run `npm run spica:blocks:cleanup:check`; the cleanup command refuses to delete unique or divergent sources. See `spica/roadmap/23_PHASE09_IMPLEMENTATION_REPORT.md`. Browser and desktop emitters must validate actual target compatibility and artifact evidence. Unsupported authored V2 graphs must not be silently exported as schema-1 apps. `spica_next_action` reports exact graph/tool prerequisites; repeated invalid calls must not become fake progress or cause a hidden retry.

## SPICA stale runtime source handling (2026-11-12)

When a Phase 09 archive is extracted onto a previous phase, obsolete executable block
files can survive at `src/spica/runtime/blocks/<category>/<subcategory>/*.ts` while
the canonical copy exists at `<category>/runtime/<subcategory>/*.ts`. Before
`npm run dev`, `npm run build`, or `npm run check`, the `spica:runtime:cleanup`
script checks those sources and removes *only* duplicates whose executable AST and
resolved import targets match. It does not rewrite or delete divergent or
unique files. The schema-1 registry rejects misplaced `defineRuntimeBlock` sources
with a specific remediation message. Verify with
`npm run spica:runtime:cleanup:check`, both registry checks, and
`node --test tests/spica-stale-runtime-cleanup.test.cjs`.

## SPICA Phase 09 flat-block startup fix (2026-11-12)

The startup cleanup now scans **direct** category files as well as nested old
V2 paths, using canonical block IDs and resolved-import-aware AST comparison.
This covers old `data-records/save-note.ts` and all Phase 04–08 layouts when
an archive is extracted on top of an existing working tree. Unique/divergent
sources are never deleted. Verify with the eight
`tests/spica-stale-runtime-cleanup.test.cjs` tests and both registry checks.
See `spica/roadmap/25_PHASE09_FLAT_BLOCK_STARTUP_FIX.md`.

## Phase 09 Tool Contract Intelligence checkpoint (2026-11-12)

Model-facing tool declarations, SPICA inspection, preflight and the final executor
must validate against the *same* registered schema through
`src/engine/intelligence/tool-contract-intelligence.ts`. Do not introduce
shadow argument contracts, feature-specific build shortcuts, hidden retries,
or a second inference stream. `inspect_spica_tool.arguments` means read-only
candidate validation and never invokes the named tool. Repeated invalid calls
and redundant identical reads are not progress; retain errors until a real
contract inspection or verified project-state change. Consult
`spica/roadmap/26_PHASE09_TOOL_CONTRACT_INTELLIGENCE.md` and run
`npm run test:spica:contracts` along with all existing phase suites.

## Phase 10 persistent SPICA task/checkpoint contract (2026-11-13)

For SPICA development instructions, `SpicaTaskOrchestrator` owns a versioned plan in the existing `task_execution` record. Only real graph revisions and current verified build results complete construction/verification stages. The model finishing a response does not complete an unfinished application task; preserve a resumable paused state, including the original goal and diagnostic. Ask/Auto/YOLO permissions and explicit user Stop/Cancel remain authoritative. Never silently replay a saved graph edit or auto-select a substitute tool.

`AgentBudgetScheduler` manages a soft prompt-working target (default 4,096) **between natural tool turns**; `streamContinuousAnswer()` still calls a single backend generation stream per turn. Do not create another LLM context-shift loop, fake Continue message, second model load, or truncated tool contract. Mandatory prompt/tools may borrow the actual context capacity above the configured target. Keep `docs/info/INFERENCE_ARCHITECTURE.md` consistent with any change.

`list_spica_toolchain` accepts `query`, `stage`, `offset`, `limit`, `includeSchemas`; its response is derived from the exact registered executable contracts, and any optional argument must have a real, tested effect. All executable blocks remain one file per block under `src/spica/runtime/blocks/`. Run `npm run test:spica:phase10` and earlier phase suites after changes. A complete target-platform/GGUF acceptance test is necessary before claiming Phase 10 release readiness.
