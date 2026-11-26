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

## Phase 10 canonical graph-editor correction (2026-11-13)

There is exactly one Spark-facing graph editor, `edit_spica_graph`. It handles
schema-1 and V2 through the `view` discriminator; **do not restore**
`edit_spica_v2_graph` as a tool or alias. V2 runtime nodes must retain exact
registered ports and valid `validateConfig` data during preflight and durable
storage. The Graph V2 migration-origin check is required in the preflight,
dry-run and save paths; no mismatched schema-1 origin may be committed. The
unreferenced old `agent-build.ts` direct starter fallback was removed. Keep
`src/spica/runtime/blocks/` the only block implementation root. See
`spica/roadmap/43_PHASE10_SINGLE_GRAPH_EDITOR_CORRECTION.md` and run the Phase
03/95/10 suites and both registry checks before delivery.

## Phase 10 registered capability and composer-plan correction (2026-11-13)

For error-prone small GGUF Sparks, preserve exact tool names while exposing natural-language capability queries that return actual registered block IDs, ports and configs. `resolve_spica_capabilities` is read-only; do not silently alias hallucinated block IDs or bypass authorization. `inspect_spica_runtime_block`, `inspect_spica_wiring`, `inspect_spica_tool`, and `inspect_solarium_tool` accept their documented discovery/inspection parameters. The Compose stage must prioritize real validation over repeated generic inspection; Plan discovery requires a real registered block ID. Record-list/delete adapters stay one source file each in `src/spica/runtime/blocks/`, behind permissioned transactional storage. The folded plan is centered directly above the chat input; the expanded plan remains above composer controls. Run `npm run test:spica:phase10:reliability` and all prior phase suites; see `spica/roadmap/44_PHASE10_REGISTERED_CAPABILITIES_AND_COLLAPSIBLE_PLAN.md`.


## Phase 10 scoped aliases and interactive event runtime (2026-11-13)

User-approved source-controlled aliases in `src/spica/runtime/aliases.ts` resolve
**only known runtime block identifiers** to tested canonical implementations.
They are never new callable tools, never synthetic block implementations, and
never guesses substituted for unknown identifiers. Canonicalize all authored
block locks, keep one block source file per implementation, and reject aliases
pointing to missing/duplicate blocks. The `SpicaRuntimeBlockContext.interaction`
bridge is scoped to explicitly delivered string UI events and transactional
session text; it never grants database access or runs arbitrary JavaScript.
Unconditional storage effects must not run in an automatic preview. Only
previously authorized `records.read` / `records.write` transactions may access
real storage. The previous Phase 9 'no aliasing' rule refers to hidden fallbacks;
these reviewed and documented runtime-only aliases are an explicit user-requested
exception, not a general alias fallback. Test the Notes Organizer end-to-end
Save/Reopen path and all phase suites before delivering changes.

## SPICA Phase 10 Round A execution reliability (2026-11-13)

`spicaScopedEditParameters()` must not throw on unverified model-proposed
operation names. Validate through `verifiedSpicaEditScope()` and do not promote
`inspect_params` / tool-inspector responses into `spicaEditScope` unless the
actual operation is registered for the chosen graph view. Failed preflights
must return compact required/accepted keys plus the selected operation schema,
not the entire 25-variant graph editor union. A stalled tool is **not** hidden
by its name: corrected arguments remain callable subject to exact validation,
preflight, permissions and revision checks. The work log and plan count only
persisted, advancing graph revisions as implemented changes. No hardcoded
Dona-specific agent routing.

Run `node scripts/audit-spica-phase10-roundA.cjs`, the Phase 01–10 suites,
`npm run test:spica:contracts` and the registry checks. See
`spica/roadmap/47_PHASE10_ROUND_A_EXECUTION_AUDIT_AND_FIXES.md`. Round B Thought
Blocks are a separate, unimplemented round; keep the native inference stream
contract intact.

## SPICA Phase 10 Round B independent thoughts and inspector view (2026-11-14)

`SparkThoughtJournal` is the authoritative action-level journal held inside the
existing `SpicaTaskPlan` in `task_execution`. Each record is persisted before
native inference, then after the model has emitted its proposed tool calls and
**before** any tool executes, then after actual tool results and settlement.
If persistence fails, do not execute the uncheckpointed operation. Keep actual
model reasoning archived locally, never synthesize hidden reasoning. Use one
natural generation stream per Thought Block; do not split mid-reasoning at a
token quota or issue synthetic Continue prompts. The next thought sees saved
verified evidence, not the previous reasoning transcript. Interrupted thoughts
are paused; pending tool calls must never replay automatically on Resume.

`inspect_spica_tool` and `inspect_solarium_tool` share explicit `view` schemas
and `resolveInspectorView()`: string format, documented structured format or a
bounded array. Neither guesses unsupported values or uses a V2-named duplicate
editor. Run `npm run test:spica:phase10:roundB`, all existing phase suites,
registry checks, and frontend checks where dependencies are installed. See
`spica/roadmap/48_PHASE10_ROUND_B_INDEPENDENT_THOUGHT_BLOCKS.md`.

## Phase 10 Round C construction interfaces

- Use `edit_spica_graph` as the canonical atomic graph editor (`revision` + `edits`, or supported `edit_type` shorthand). Never reintroduce `edit_spica_v2_graph`.
- Migrate through `edit_spica_graph({revision,view:'v2',edits:[{op:'migrate_graph'}]})`; use `compose_blocks` to install a validated set of real blocks. The older `*_v2_graph` functions are retained only for compatibility, not primary model guidance.
- `run_spica_graph({revision,view:'v2'})` executes current registered runtime blocks; a passed adapter run is not standalone export evidence.
- Action batches checkpoint only on recorded revision progress or verified completion. Never close a construction batch for inspections alone. Resume from compact saved evidence, never replay pending writes.
- Cosmic is an opt-in interface in `src/ui-themes/cosmic/`, separate from the default Classic and older console-channel styles. Use the five immutable image references under `docs/design/cosmic/` when reviewing it.

## Phase 10 Round D: source-backed construction and runtime blocks (2026-11-14)

The shared SPICA agent must expose authorized actual project-file editing/checking tools alongside graph preflights during construction. `src/spica/construction-coordinator.ts` pages **existing** tool definitions; it never executes tools, invents tool names, weakens grants, or bypasses matching SPICA revision/preflight checks. A failed native check keeps diagnostics and source repair reachable in the same small tool set. The backend's real results (not proposed arguments) are the source of truth for edited file paths and command outcomes.

`SpicaTaskOrchestrator.recordSourceWrite()` and `SparkActionBatchJournal.recordSourceWrite()` checkpoint confirmed source changes. Inspections, no-op replacements, failed writes, format-only migrations, and failed checks do not verify the requested feature. Resume never replays pending edits. New executable V2 blocks remain one source file per block under `src/spica/runtime/blocks/`; permissioned data operations use the existing transactional storage host. The Cosmic theme is out of Round D scope. See `spica/roadmap/51_PHASE10_ROUND_D_CONSTRUCTION_RUNTIME_AND_CHECKPOINTS.md`; run `npm run test:spica:phase10:roundD` and earlier phase regressions.

## Phase 10 Round E: rolling evidence context and minimal Plan

Use `src/ui-themes/cosmic/` as the exclusive Cosmic source root. Run
`npm run ui:cosmic:cleanup:check` and run the cleanup script on old overlay
installations; it refuses unique or divergent files. Classic is still default.
Thoughts and action-batch results display in the Work Log (not the Plan).
Keep native llama.cpp `max_tokens: -1`, single-stream reasoning, permission
checks and durable source evidence. `SparkThoughtContextAssembler` retrieves
at most three actual previous tool results plus one small verified checkpoint.
Only the next assembled inference request is compacted; full saved results
remain archived. Do not replace system persona, latest user goal or user-authored
project instructions with generated memory. See `spica/roadmap/52_PHASE10_ROUND_E.md`.


## Phase 10 input-context overflow correction (2026-11-15)

Never advertise `unifiedSpicaEditParameters` (the complete 18-KB JSON union)
through the model-facing SPICA selector. Use the verified edit scope or a
bounded operation-specific seed from `initialSpicaEditScope` when no verified
scope exists. This applies to BOTH `validate_spica_edit` and `edit_spica_graph`.
`prepareGeneration` may switch to a smaller **already offered** registered tool
if the preferred tool schema cannot fit; it must not invent, truncate or
silently coerce tool arguments. Protect Spark identity, written instructions,
latest user goal and project instructions. Memory/World/example *reference*
sections can be paged out of the active prompt while their originals stay saved.
Keep llama.cpp unlimited native output streaming and 4,096 soft input target.
See `spica/roadmap/53_PHASE10_INPUT_CONTEXT_OVERFLOW_REPAIR.md` and run
`npm run test:spica:phase10:contextfix` plus the phase regressions.

## Phase 10 Round F: callable aliases, real diagnostics and Cosmic controls (2026-11-15)

Canonical tool declarations remain in `src/spica/tools.ts`; `src/spica/tool-aliases.ts`
resolves reviewed alternate names without registering duplicate handlers. Resolve and normalize
before preflight, inspection or dispatch, but never treat an unregistered guessed name as executable.
`discover_compatible_blocks` translates to `resolve_spica_capabilities` with canonical `queries`.
Aliases must never bypass source-write grants, graph revisions, or runtime permissions.
The only new callable diagnostics in this round are `inspect_spica_graph_impact`,
`run_spica_behavior_checks`, and `inspect_spica_registry_health`; they have distinct
execution semantics and source-backed tests. `src/spica/runtime/blocks` now has 166
registered executable adapters, including 18 new one-file implementations. The five Cosmic
concept images remain visual references only; coded scenery and working controls live under
`src/ui-themes/cosmic/`. Keep Classic default, preserve unlimited native llama.cpp output,
and use `npm run test:spica:phase10:roundF` when touching these contracts. See
`spica/roadmap/54_PHASE10_ROUND_F_TOOLS_ALIASES_RUNTIME_AND_COSMIC.md`.

## Phase 10 Round F tool-loop and readable Work Log repair (2026-11-15)

Never force full `list_spica_toolchain` and `inspect_spica_tool` calls before every SPICA write when the graph revision and contract have not changed. The live inference-turn tool guide must enumerate the **actual offered contracts** and required top-level keys; `check_spica_tool_call` requires `{name,arguments}` and the target must be a registered callable name. Do not infer missing names or authorize a write by normalizing arguments. Exact verified `tool`/`params` synonyms are normalized before validation for this canonical preflight and its aliases. If it fails without a name or with an unknown target, reoffer real discovery/action tools rather than the same malformed preflight. The Work Log must never let expanded result JSON squeeze tool names into vertical characters. Full evidence remains in the raw history. Run `npm run test:spica:phase10:loopfix` plus phase regressions; see `spica/roadmap/55_PHASE10_ROUND_F_TOOL_USE_AND_WORK_LOG_REPAIR.md`.

## SPICA Round E/F thought-to-tool regression correction (2026-11-15)

A successful `check_spica_tool_call` is already an authoritative, read-only contract and
revision validation. A separate prior `inspect_spica_tool` call is optional, not a
prerequisite to executing the exact, matching permissioned action. Normalize any
reviewed callable alias and its arguments **before** recording the approved name and
signature. The next model turn must advertise this approved registered operation
before source-tool paging can displace it. Unknown preflight targets must instead
show registered discovery/inspection choices; never repeat a known-bad preflight
or relax the permission, CAS revision, or edit-schema checks.

Between independent Thought Blocks, carry only verified checkpoints and up to three
actual results. When selecting those results, keep a successful graph/capability
observation available even if several preflight errors followed it, and compact
large graph results around exact revision and registered node/block identities.
The full original result remains archived. Never replay previous private model
reasoning, pending writes, or guessed tool identities.

Regression tests are in `tests/spica-phase07-tools.test.cjs` and
`tests/spica-phase10-roundE.test.cjs`; the affected phase suites, runtime registry
checks, and `scripts/check-syntax.cjs` should pass before packaging. Full frontend
builds also require installed npm packages and native desktop builds require a
working Tauri/Rust environment; do not report those checks as passed without
running them.

## November 22: unified model tool proposal and fiction profile handling

`src/engine/intelligence/tool-contract-intelligence.ts` and `tool-arguments.ts`
now validate exactly the contracts offered to the model on that inference turn.
The argument resolver may only repair unambiguous transport formatting and
non-nullable optional nulls; it cannot invent or discard meaningful user data.
Keep native permission and file/revision checks inside `runAgent` and the
native tool executor. Any correction tool must still be currently permitted.
Do not restore a full-registry validation fallback.

`src/engine/intelligence/fiction-profile-contract.ts` limits staged cast writes
to two characters; when no Story World is selected, a new one requires the
user-grounded `story.title` and `story.franchise`. Saving some characters does
not complete the whole cast and does not consume a failed-attempt allowance.
After genuine repeated failure or a denied permission, preserve a blocked,
resumable chapter task, not a simulated success. Changes must pass
`npm run test:tool:reliability` and the normal project checks where npm
packages are installed. Full reasoning streaming and Ask/Auto/YOLO remain
unchanged. See `spica/roadmap/58_UNIFIED_TOOL_EXECUTION_AND_FICTION_PROFILE_RECOVERY.md`.

## Dream Construction Engine — Mega-Phase 01 (2026-11-22)

Normal application/game construction routes through `src/engine/construction/intent.ts` into the existing *native project tools* rather than requiring SPICA graph-edit calls. Explicit graph and existing SPICA-graph edit requests retain their legacy path; fiction, prose, and code-artifact replies retain their own workflows. This is a routing/migration foundation, NOT a new inference engine, source composer, preview, or a 350K executable warehouse.

`ConstructionOrchestrator` is a durable evidence-only projection and MUST NOT perform filesystem writes, auto-approve operations, synthesize tool calls, or regenerate a model response. `TaskExecution` owns its checkpoint in the existing `task_execution` CAS record, tied to the same session, project and linked root. Emit `onConstructionEvent` only after the checkpoint saves. Verify source changes against real native write paths and the `VerificationLedger` revision; `complete_project_task` remains the sole project-completion authority. Retain permission denials, explicit Resume and cancellation as real states.

See `spica/roadmap/59_DREAM_CONSTRUCTION_PHASE01_ARCHITECTURAL_MIGRATION.md`. Run `node --test tests/dream-construction-phase01.test.cjs` plus the existing SPICA, syntax, inference and native acceptance checks as available. Any work on the agent/inference path must preserve `docs/info/INFERENCE_ARCHITECTURE.md` without new token limits or synthetic continuation requests.

## Dream Construction Engine — Mega-Phase 02 (2026-11-22)

`src/spica/source/` is the new **source-code capability** library. It does NOT replace
`src/spica/runtime/`, alter `SpicaBlockAdapter`, grant permissions or execute SPICA
graph tools. Source manifests are reviewed, version-locked and SHA-256 validated.
`SourceBlockLoader` only reads reviewed bundled sources; `SourceBlockEmitter.emit()`
returns an in-memory file bundle. Native project writes and builds stay behind the
existing permissioned project tools until Phase 05 integrates the source composer.

Always distinguish the four `SourceBlockDefinition` categories: `portable-source`,
`source-generator`, `host-runtime`, and `knowledge-descriptor`. Host dependent
SPICA adapters and metadata-only entries may **never** be represented as standalone
compiled implementations. New source blocks must have real code, exact exports,
dependencies, target support, version, provenance, checksum and strict compilation
tests. Updated source hashes require explicit review and
`node scripts/check-dce-source-warehouse.cjs --write`. They must not be changed
implicitly by model-generated tool calls.

Run `npm run test:construction:phase02`, `npm run dce:source:types`, Phase 01
construction tests and both SPICA registries after modifying source contracts.
Refer to `spica/roadmap/61_DCE_PHASE02_SOURCE_WAREHOUSE.md` and
`src/spica/source/README.md`. No Phase 03 indexing, Phase 05 native writes,
Phase 06 Workbench, or Phase 07 preview is claimed by this checkpoint.

## Dream Construction Engine — Phase 02 source warehouse completion (2026-11-22)

The source library lives separately under `src/spica/source/`; runtime block
adapters must remain under `src/spica/runtime/blocks/`. The new `SourceBlockEmitter`
returns immutable in-memory source and SHA-256 receipts, not project-file writes
or permissions. Inspect `spica/roadmap/62_DCE_PHASE02_COMPLETION_AND_HARDENING.md`
before altering portable source modules. Review changes, refresh source hashes
only with `node scripts/check-dce-source-warehouse.cjs --write`, and verify with
`npm run test:construction:phase02`, `npm run dce:source:types`, Phase 01 tests,
and the SPICA registry/compatibility checks. Do not claim that source compilation
proves an interactive game or complete frontend build.

## Dream Construction Engine Phase 03 — Indexed source capability discovery (2026-11-22)

The source-warehouse intelligence implementation lives under `src/spica/source/intelligence/` and is separate from `src/spica/runtime/blocks/` and the model-facing legacy SPICA graph-tool API. `IndexedCapability` is read-only, serializable public metadata: it MUST NOT contain source bytes, generator functions, host runtime adapters, or permissions. Only the existing reviewed `SourceBlockRegistry` and exact source contracts permit actual emission. Search results never imply that an application was built or that a knowledge descriptor is executable. Shards are hash-verified, search is bounded and reports incomplete coverage, and transitive dependency resolution must reject cycles, missing symbols, unsupported targets and non-portable modules.

Source construction natural model stops never trigger synthetic inference. For a reasoning-only turn without a final answer or callable tool result, `describeConstructionStop()` must produce visible, truthful pause guidance and preserve the reason in the existing `task_execution` checkpoint. No fabricated write, duplicate model load, permission bypass or invisible retry is allowed. Read `docs/info/DCE_WAREHOUSE_INTELLIGENCE.md` and rerun `npm run test:construction:phase03`, Phase 01/02 suites and both SPICA registries after changes. Full native/UI/GGUF acceptance remains separate from source tests.


## DCE Phase 03 inference-continuity repair (2026-11-22)

The user-requested recovery for reasoning-only native stops supersedes the earlier Phase 03
**pause on the first incomplete decision** rule above, but does not change the one
uninterrupted `streamContinuousAnswer()` request per model decision.

- `llama.cpp` still requests `max_tokens:-1`. Numeric `n_keep` is bounded by
  the fitted context so native context shifting has room to evict generated tokens.
  Never impose a fixed 2048-token output allowance or silently erase the original goal.
- `constructionInferenceRecovery()` may request up to two *new*, independent
  construction-action decisions after a completed native stream produced neither
  an answer nor a complete tool call. The data for that action come from the
  original request, genuine tool contracts and verified checkpoint only. Do not
  replay private reasoning, inject fake user messages or execute partial tool JSON.
- A transport error, Cancel, permission denial, absent tool support or genuinely
  exhausted recovery still leaves a clear durable pause/blocked diagnostic.
- Regression command: `npm run test:inference:continuity` after compiling the
  engine into `.test-dist`; also run DCE Phases 01–03, syntax and both registries.
- See `docs/info/INFERENCE_ARCHITECTURE.md` and
  `spica/roadmap/65_DCE_NATIVE_INFERENCE_CONTINUITY_REPAIR.md`.

## DCE construction context rollover (2026-11-22)

When the backend reports context shifting unsupported, a 4K model cannot
stream a single inference forever. Do not replay unfinished model reasoning,
append synthetic Continue messages, or promise unlimited output with
`max_tokens=-1`. The source construction loop uses a compact verified decision
packet, preserves the original user goal, offers the exact stage-appropriate
registered tool contract, and reserves response room before inference.
Maintain `src/engine/construction/decision-context.ts` and its regression
suite alongside inference/agent changes. File writes and checks still require
real tool execution and existing permissions. Source conversation archives and
task evidence must not be deleted to reduce prompt input.


## DCE Phase 03 — Accurate 4K construction-input fitting (2026-11-22)

`buildConstructionDecisionContext()` must preserve the user's original goal, the current user request, the full Spark identity, project-specific instructions and the advertised registered tool(s). Details of prior inspections, recovery hints, verification logs and history are *optional evidence*, individually marked and pageable when preparing a small-context request; their full originals stay in task storage. The FIRST initial native project inspection is part of the verified context even though it precedes the model tool transcript.

`prepareGeneration()` may reduce a **preferred** non-shifting llama.cpp first-decision response reserve when no other optional material remains, but must retain at least a viable minimum tool-decision window or return an honest input-context error. No silent truncation of the user request, no fabricated result or synthetic reasoning continuation.

Use llama.cpp's optional tool-aware chat input-token count endpoint when available; count the *same* merged-system prefix, actual offered schemas and selected tool choice as the native generation request. Do not charge a schema estimate twice when the server returns a valid positive combined count. When unavailable/invalid, preserve the conservative legacy counting path.

Required checks: `npm run test:inference:inputfix`, `npm run test:construction:phase01`, `npm run test:construction:phase02`, `npm run test:construction:phase03`, `npm run test:tool:reliability`, and both SPICA registry checks. Native GGUF, full frontend and Tauri still require local acceptance. See `spica/roadmap/66_DCE_PHASE03_INPUT_CONTEXT_AND_TOOL_COUNT_REPAIR.md`.
