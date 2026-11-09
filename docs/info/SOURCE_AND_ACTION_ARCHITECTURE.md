# Solarium 0.1 Sources and Action Contract

Read this with [INFERENCE_ARCHITECTURE.md](INFERENCE_ARCHITECTURE.md). Sources and Actions do not replace the inference engine or manufacture reasoning. The selected Spark remains the assistant; a researched character is data in a Story World.

## Storage and ownership

`foundation/store.ts` and `src-tauri/src/foundation.rs` implement the same versioned record/content and compare-and-swap transaction boundary. Desktop uses local SQLite (`foundation-v1.db`, schema version 1, WAL). The separate records/content tables keep large bodies out of workspace settings. Browser development uses IndexedDB and an explicit 50 MB limit. A failed transaction does not advance a saved revision.

Sources have an explicit conversation or project owner. Retrieval requires the active conversation/project; another project's ID is never an implicit permission. The personal Writing Library is separate from automatically retrieved Sources. Same-project conversations may use project Sources. Conversation Sources stay in their originating conversation unless explicitly copied/moved. Content and native paths are untrusted data, never tool permissions or Spark instructions.

`sources/repository.ts` stores the complete imported text, a normalized SHA-256, provenance, tags, enabled state, and chunks with headings/line locators. Duplicate decisions are explicit. Retrieval ranks relevant enabled chunks under the active spoiler/continuity boundary, with IDs and provenance. The bounded prompt excerpt is not the stored original. `read_saved_source` reads the exact original in pages.

`foundation/archive.ts` preserves full task-start conversations, tool results, inspected files, and opened web pages in 32,000-character pages with a SHA-256 and original locator. `recall_context` searches/reads only current owners. Input fitting may omit temporary messages, but must never delete these originals or saved chat to fit a prompt. A missing archive page is an error, not an empty successful read.

## Real project work

`creator.rs` canonicalizes roots and file paths, checks existing ancestors and junction/symlink targets, validates supported text formats, compares expected originals, backs up edits, and rolls back failed file batches. Files are staged for review before native writes; streamed JSON is never sufficient proof of a write. Inspection counts actual directory entries, including an otherwise apparently empty folder containing binary files.

`project_commands.rs` builds a command catalogue from the current project manifests. Package scripts use the detected npm/pnpm/yarn/bun executable; Rust commands reference actual Cargo manifests; pytest and Git checks require matching project metadata. Interactive/watch scripts are not advertised as bounded verification commands. A command ID is revalidated before execution. No model-supplied arbitrary shell string or executable is accepted. Existing legacy check IDs remain compatible; normal agent and recipe calls use the catalogue runner.

Commands run inside the canonical project root, with stdin closed, hidden Windows windows, separate stdout/stderr pipes, a process timeout, cancellation, and a Windows Job Object for descendant cleanup. Solarium's own Tauri/Cargo build environment is removed before starting a child project. Native logs retain original bytes; tool context receives a tail with a run ID and explicit completeness flag. `read_command_output` checks root ownership and pages the complete log. Stop retries cancellation registration until the native call settles, including the process-start race. A timeout/cancel/nonzero exit is not success.

`VerificationLedger` stores each command's status, diagnostics, attempts and file revision. A successful build cannot erase a failed test. Edits invalidate previous passes. Required script checks, tests, lint, build and Rust checks/tests must pass at the current revision. `complete_project_task` validates this state; rejection is a real tool result, after which repair can continue. The agent has no one-repair policy and no 80-turn cutoff. It advances only after actual model-requested tool calls. If a model ignores required tool calling and ends in prose, work remains incomplete; Solarium never invents a tool call or a new human message to restart its reasoning. A concrete reported external blocker remains visibly unverified.

Task goals, check ledgers, operation archives and cancellation/failure state persist in `task_execution`. Resume restores the original goal and unresolved checks for that conversation. It does not replay a stopped reasoning channel. The recovery card fills a visible user request; the user sends it normally. No action grant survives a task/restart.

## Tool registration, permission and research

The native implementations remain registered. `selectActionTools` supplies a small stage-relevant schema set; `choose_project_tools` allows another real tool page without requiring a larger model context. Existing folders can always reach reads/edits. Validation runs before permissions/execution and returns structured errors for malformed/unknown/duplicate tool calls.

Ask asks for each operation. Auto permits reads and obtains task-local write/check grants. YOLO runs registered tools; explicit deny, missing project root, unsafe paths and Web OFF still win. Web OFF blocks the native public-web/search entry points, including coding/character research and network dependency installation. Trusted project scripts may themselves use networking; the Web switch does not claim to be an OS network sandbox. Cache-only installation disables lifecycle scripts and reports missing cached dependencies honestly.

`get_project_map` supplies actual paths, lexical declarations/imports and installed package versions. It is labelled a lexical map, not a complete compiler symbol graph. Read implementation ranges before changing APIs. `research_coding_docs` searches registered official documentation domains with the installed version, reads actual pages, and saves complete readable evidence. Exact API/version compatibility remains explicit when a page does not confirm it. Missing toolchains, provider failures, blocked pages and unsupported packages are errors, never fabricated documentation.

The public reader validates HTTPS targets, port, DNS addresses and each redirect, rejects local/private destinations and credentials, limits downloads, and extracts readable text without executing site scripts. Bing RSS is the built-in provider; self-hosted SearXNG requires public HTTPS and enabled JSON output. No Brave credential or service subscription is installed automatically. Visual Actions distinguish found/reading/read/failed sources and save the actual selected material.

## Backup, migration and compatibility

Workspace schema 1 remains readable. Legacy writing/code blocks remain available and migrate to a durable document when opened; no existing chat or user assets are replaced. Full workspace export includes Foundation records and bodies. Import validates owners, collection types, revisions and hierarchy before an atomic transaction. Explicit scoped import copies/remaps identities. Deleting an owner removes Sources, task logs and context archives; authored writing/Story Worlds are recovered to the personal library.

Visual Actions and terminal results report actual operations and belong to their originating conversation/message. A saved file and a failed check may coexist and must be reported separately. Never claim model quality, native UI acceptance, physical behavior or unlimited recall solely from unit tests. Current acceptance evidence and limitations belong in `DAILY_USE_VERIFICATION.md`.

Chat presents one expandable `WorkLog` per reply. Its rows derive from actual operations and terminal results, retain individual attempt details, consolidate repeated errors and tuck tool selection into an internal section. Real model progress prose can appear between operation groups; full originals are archived. Native reasoning retains its separate unchanged Thinking display. Detailed workspaces open only when requested and never take over chat automatically.

Live decision memory preserves conclusions across real tool turns and explicit Resume. Its verified facts come from inspection/manifests; model notes are labelled as notes and cannot assert filesystem success. Changing a settled note requires a reason. Repeated identical discovery changes the offered tools without a fixed retry allowance, fabricated action or forced reasoning continuation. A different check passing still cannot clear a failed check.

## Quality checks in the normal application

Runtime Center contains 32 executable quality cases covering existing-repository repairs, conversation memory, authoring, research, length, Unicode and cancellation. `quality/runner.ts` runs the same `runAgent`, writing stream, tools, Spark, preferences and Foundation store inside the normal renderer. It does not create a QA application identifier or alternate profile. Coding fixtures are real newly created temporary repositories; the native helper validates bounded relative source paths and cannot write an existing project. Their reference tests reproduce actual failures and are compared after a repair so weakening the checks cannot count as success.

Each `quality_run` retains its app identifier, model/context, measurements, native operations, warnings and individual assertions. Repeated trials remain separate. Voice/coherence/scene fulfilment await explicit reading scores; model self-approval cannot mark them passed. A cancelled run retains its actual draft. Web cases require the quality surface's explicit Web permission; offline cases disclose the absence of current research. Results export as JSON and open their actual saved chat/documents. `conversation_brief` and `quality_run` participate in full backup/import validation and are removed with their owner rather than becoming personal-library material.

Source ranking uses offline BM25 over accessible enabled records. `read_project_symbol` returns real scoped source ranges from lexical declarations; it is not advertised as a compiler/LSP guarantee. Functional coding tasks require a real behavioral verification command; unchanged failures and previous decisions remain visible while actual repairs proceed.

Normal chat and Runtime Center quality cases both call `engine/conversation-run.ts`. That shared controller owns draft streaming, story binding, actual revision confirmation, accepted scene memories, command/source records, reply persistence and grouped actions. There is no duplicate quality-only save/stream client. The renderer supplies only its UI callbacks and the same workspace sink. A structurally closed fence remains running until the controller confirms its actual current stored prose. Storage failures preserve the real reply and report recovery errors.

Native Foundation CAS batches acquire `BEGIN IMMEDIATE` before reading versions, preventing WAL snapshot upgrade failures between concurrent draft/history saves. Opening an initialized database for reading does not rewrite schema metadata. Concurrent disjoint saves must both persist; concurrent writes with the same expected version must produce one real revision conflict. A native SQLite concurrency regression covers both. Story setup offers only unfinished cast names after a confirmed save, retaining original quotations through the brief reader and avoiding repeated completed profile operations.


## Glitch source workspace

The Code view now reuses Glitch's Monaco editor, file tree/search, Git and terminal surfaces. Every native editor operation carries an explicit root. Saves reuse `creator` compare-and-swap writes and backups; external disk changes cannot silently overwrite a dirty editor buffer. A separate optional diff compares the actual current disk file with the edited buffer. Explicit reviewed application still uses that exact disk base. Deletion moves a scoped source into `.solarium-trash` with original-path metadata; it never deletes the project root. Junctions, symbolic-link mutation, parent traversal and foreign roots are rejected.

Project intelligence runs over stdio in a native-owned Python process. Index databases and terminal logs live under the normal app-local profile, outside source folders. Dependency directories are pruned before walking. Symbols/references are explicitly lexical; TypeScript and other discovered language servers provide actual compiler/editor services. Unsaved buffers remain separate from disk-verification requests. Repeated unchanged indexed context has stable evidence, while original tool results remain inspectable.

The interactive terminal is a user-operated PTY, with root-bound read/write/resize/kill, original byte logs, paged replay and descendant cleanup. It is not exposed as an unrestricted agent shell. Agent checks and the Tasks view continue using Solarium's existing registered command catalogue, complete logs, cancellation and check ledger. Source-helper RPC cannot run shell commands or load models.

Editor tabs and exact dirty buffers/save bases are durable `code_workspace_state` records in Foundation SQLite, owned by a project ID. They use revision checks, archive validation and root validation. They never become source-file success claims. Recovery failures remain visible; closing with unsaved work requires saving or explicitly retaining recovery. See [GLITCH_INTEGRATION.md](GLITCH_INTEGRATION.md) for active and preserved components and verification.

## Generated source and Code Studio

Normal assistant source fences are also authored code. The same `conversation-run` controller checkpoints their exact bodies into scoped `code_artifact` records, then creates immutable `code_revision` originals at actual generation end. User edits create new revisions with compare-and-swap checks. Chat rendering, combined web previews and Code Studio read those current revisions; reopening an old message cannot overwrite a later edit. Explicit `file=` metadata is a suggested relative destination, not a native write. User messages never acquire assistant-generation provenance.

Generated documents have virtual `solarium-generated` Monaco URIs. They can be edited, exported and previewed without linking a project. They are never passed to filesystem recovery, native file reads or external project language servers as real source paths. Stop and interrupted recovery retain incomplete source; a closed fence without natural model completion does not become a completed artifact. Opening an interrupted checkpoint recovers an incomplete immutable original, and an active stream cannot be recovered or edited. Exact originals survive owner deletion in the explicitly opened Recovered library; model readers retain ordinary chat/project scope and cannot automatically search that library.

Apply to project loads the actual scoped destination, displays a diff and writes only after the user applies that reviewed source. The native write uses its exact reviewed disk base, backups and existing path protections. A changed artifact or changed destination invalidates the review. Only a confirmed native write may add an application receipt. An applied receipt is historical source application, never evidence that commands or behavioural checks passed; later artifact edits clear it. Actual project commands and their current-revision verification ledger remain the execution route.

`list_generated_code` and `read_generated_code` expose saved source without requiring a project folder. Complete bodies remain stored while explicit offsets page input for a model's working context. The normal permission layer, explicit denies and Web OFF behaviour apply. Explicit requests for source in chat retain that delivery route; applying or modifying actual project files retains project tools.

The active imported editor modules live under `src/coding`. Unreachable Glitch frontends and the unused inference/training backend were removed from production source only after a verified source/database checkpoint. The exact archive paths and hash are recorded in [CODING_CONSOLIDATION_MANIFEST.json](CODING_CONSOLIDATION_MANIFEST.json). They are not activated as a second inference path.

Quality results include a SHA-256 of actual frontend/backend/native/test source and the SHA-256 of the currently running native executable. A Git revision alone or the stringification of selected functions cannot identify a build with local helper changes. Generated identity output is excluded from its own digest. Source hashes identify a tested snapshot; they do not by themselves establish behaviour.


## Local coding commands, services and current-source evidence

A project may register a named coding executable, bounded argument vector, canonical project-relative cwd, purpose and setup/check/test/service kind. Registration persists a root-bound proposal in app-local storage and never executes it. Ask/Auto/YOLO and explicit denial apply to agent tools. Network setup is unavailable with Web Search OFF. Execution resolves the current manifest/registered catalogue. Project-local Python environments take priority over app-private Python.

Native commands fingerprint actual authored source bytes before and after execution. A source-changing verification command cannot pass; setup mutations invalidate earlier evidence. Completion re-reads the native fingerprint, so external edits invalidate passes without inventing agent writes. Build/dependency/cache output is excluded. Originals and full logs remain scoped and readable.

Development services retain native process/job ownership, scoped output logs, exit status and optional loopback HTTP readiness. Occupied ports are rejected. The app never adopts or kills unrelated PIDs. Preview displays the actual project URL. Process/readiness success is separate from browser behaviour and functional test proof. App exit stops owned services and descendants.

inspect_code_position obtains actual compiler definitions/references/hover/diagnostics while preserving live editor ownership. read_dependency_api reads installed project package declarations/version/source with exact paths and lines without online requests. Neither replaces behavioural checks.

Optional private Node, Python and language services live under runtime/coding-tools. Activation requires published archive SHA-256 verification and executable version checks; global PATH/system installations stay untouched. Public GGUF downloads use immutable repository commits, exact range-resume responses, complete size/SHA-256 verification and atomic promotion. Partial files are not activated; split models require all shards. These operations do not certify a model's coding quality.


Application feature plans are part of task_execution, under the same chat/project owner and revision history. plan_project_app creates or extends model planning metadata; it never reports filesystem success. read_app_plan retrieves that saved scope. complete_app_step requires actual nonempty source and passing current native check IDs; complete_project_task also reconciles changed source and audits substantial exact repetition. Feature descriptions alone cannot mark an app complete. Source and tool result originals remain retained through cancellation and Resume. Full source length is a measurement, not a substitute for functionality.

## SPICA source ownership

SPICA stores a versioned project graph with undo and redo in Foundation. Its typed control connections lower to an ordered runtime plan for the preview and Windows Tauri export. The exported app owns its SQLite preferences and uses revision-checked updates. Invalid imports are rejected before the store changes.

The first export needs an empty linked folder. A receipt binds the graph revision and target version to hashes of the generated files. Regeneration checks the previous managed files before writing a reviewed native batch. Edited managed files surface a current and proposed comparison. The custom source module belongs to the user and survives regeneration. Code Studio opens the same exported project for inspection and custom work.

Verification retains native command run IDs, diagnostics and source fingerprints for the frontend build, native preference test and standalone executable build. An edited graph or project makes this evidence stale. Tauri-generated schema output is excluded from the authored-source fingerprint. Standalone launch and interactive acceptance are recorded separately from build success.

The Notes and Tasks recipes share a collection editor, record storage, list queries and archive actions. The exported graph describes stable field keys, types, defaults and optional Boolean filters. The standalone app uses its own SQLite store. On launch it compares the compiled storage schema to the stored schema, backfills additive fields and advances the schema in one transaction. Existing fields keep their storage contracts. Native row writes use revision checks, including after an upgrade. A rejected migration surfaces an error and rolls back its schema and record changes. Graph undo operates on the design and cannot erase a deployed data field.

Appearance is optional in graph schema 1. App theme tokens, block overrides and interactive states use the same validated compiler in SPICA and the standalone renderer. The export writes compiled appearance to its bundled stylesheet under the target's self-only style policy. Stable IDs follow page, control and field keys. Both inspector saves and Spark edits use the same graph revision history. The live preview uses isolated sample data and keeps in-progress sample edits through appearance changes and dock switches. Compact and wide previews use the same responsive styles as the standalone app.

Test & Preview exports the reviewed managed sources, then runs the normal native checks with the log beside the sample app. A passing record retains the executable SHA-256 in addition to its graph and source hashes. Launch checks all three identities and starts the fixed project build output. Starting its process and exercising the app remain separate evidence.
