# Glitch merge into Solarium

The normal Solarium application owns this integration. Open Code for the selected project, or choose a source folder there. Conversation opens the ordinary Spark chat beside the editor. No second application, model runtime, QA identifier or profile is required.

## Active integration

| Imported capability | Solarium connection |
| --- | --- |
| Monaco source editor, tabs, Quick Open and command palette | Code view; local bundled workers; no editor CDN |
| Explorer, source search and Git | Canonical native project scope; actual disk and Git output |
| Scoped writes and review diff | Existing native CAS and backups; stale disk bases fail; explicit review to reconcile |
| Project index and relevant exact source | Private Python stdio service; separate persistent database per canonical root |
| Symbols and references | Labelled lexical results; dependency traversal pruned |
| External language services | Actual discovered TypeScript/Python/Rust/C++ servers; diagnostics distinguish unavailable and pending |
| Terminal | Native PTY, Unicode log paging/replay, root ownership, resize, exit status and process-tree cleanup |
| Tasks | Solarium manifest command catalogue and full command logs/cancellation |
| Workspace recovery | Project-owned Foundation SQLite records with exact dirty buffers, save bases and revision checks |
| Agent intelligence | Staged `query_project_intelligence`; same tool permissions and main conversation controller |

The active imported source is now consolidated under `src/coding`. Standalone Glitch application bootstrap, Dona generation/subagent orchestration, CodeDiffusion runtime/training/quantization, model-manager and experimental runtime panels were archived outside production source after a verified checkpoint. Only the dependency-free scoped project service remains in `backend`. [CODING_CONSOLIDATION_MANIFEST.json](CODING_CONSOLIDATION_MANIFEST.json) records exact archived paths and their source checkpoint. Running the old inference server alongside Solarium would violate the single inference path. These archived experiments are not claimed as working Solarium features.

## Runtime requirements and scope

Indexing uses Python 3.10+ with only the standard library. Native startup probes the interpreter; `SOLARIUM_PYTHON` can select one. File editing, native saves and Tasks remain available when project intelligence reports an unavailable interpreter. Packaged resources contain only the project service and project modules; they do not include tensor models, Python caches or the former inference backend.

Language servers require their actual executables. Development includes the installed TypeScript language server; a project-local server or `SOLARIUM_TYPESCRIPT_LANGUAGE_SERVER` can be used. A packaged release still needs Python/Node and the language servers it intends to run. An installer bundling those runtimes has not been produced in this round.

Web OFF is retained. Source indexing and language services are local. Trusted user terminals/project scripts retain their existing operating-system networking behaviour; they are not an OS network sandbox. Interactive terminal commands are not exposed as a new agent tool. Git discard asks explicitly. Source deletion retains recoverable originals in `.solarium-trash`.

Source/project-service helper processes belong to the application. Each Windows language-server family also owns its descendants through a Job Object. Shutdown closes them; switching source buffers does not replace the loaded GGUF model.

## Regression results

- Frontend: 248 tests, 247 passed, one existing Linux Bash check skipped on Windows.
- Python project-service: all nine tests passed, including a real installed TypeScript server's definition/diagnostic output, dirty-buffer isolation, Unicode framing, source refresh, symlink escape and stdio RPC.
- Rust library: 22 tests passed, including actual native source CAS/conflict/trash and UTF-8 terminal paging.
- Lint: zero errors; three pre-existing warnings in BlockWorkbench/LivePreview.
- Added editor dependency's critical DOMPurify advisory and PDF.js high advisory were resolved with targeted versions. The registry audit still reports lower-severity dependency advisories; no blanket forced upgrade was applied.

Production build passed with the existing large-bundle warnings. Normal-instance acceptance results are recorded below. Existing controlled/unit tests are not proof of literary quality, 50k real-model chapter completion or every imported experimental runtime feature.

## Normal-instance acceptance

The production build was followed by the ordinary `npm run tauri dev`, with identifier `org.solarium.desktop`, the existing profile and the actual installed GGUF. Developer-console calls inside that WebView exercised the same product stores, conversation controller and native commands. No alternate QA client/profile or computer-use session was used. This is native integration evidence; visual layout/usability was not evaluated with computer use.

`output/quality/glitch-native-current.json` records thirteen passing checks: mounted local editor, actual TypeScript diagnostics, live-buffer ownership, shared agent index, real filesystem refresh into the editor, stale-save rejection, exact SQLite recovery, reviewed Unicode save, foreign-root rejection, three manifest commands with complete logs, and programmatic-buffer synchronization to the language server. An earlier normal application restart also restored the exact dirty buffer and save base. The original three saved writing revision body hashes were checked again and remain unchanged.

The PTY executed Unicode output and the actual package's `npm test`; its initial-output log was replayed. Foreign-root log reads were rejected. Two observed Node process IDs (parent and child) both disappeared after native terminal Stop. The corrected child cwd uses the ordinary scoped path so CMD/npm do not misinterpret a Windows verbatim prefix as UNC. File-watch paths use the same ordinary identity as tree/editor paths.

Real-model coding acceptance **passed** with Dona, `gemma-4-26B-A4B-it-UD-Q4_K_M`, the existing 4,096-token input context and temperature 0.7. The model performed one source read, one actual replacement, three native command requests and controller-checked completion, then reached a natural final EOS. All three verification commands passed at the current file revision, each on its first attempt in this final run; the independent reference tests remained unchanged. The existing model/reasoning path was used throughout.

The final trial took about 8 minutes 33 seconds on this machine. This is a successful correctness result, not a throughput improvement or broad benchmark. Actual reasoning was preserved; no synthetic thought, second auditor model, output quota or continuation chat was added. The ordinary app remains running, with the previous active project/chat/view restored.

Evidence: `output/quality/glitch-model-current.json` (final run), `glitch-model-history.json` (normal-profile quality/task records), and `glitch-acceptance-history.jsonl` (diagnostic snapshots). Current native integration checks are in `glitch-native-current.json`. Diagnostic trials were stopped to repair observed routing/repetition faults; their cancelled records remain in the normal Foundation history rather than being called passes.


## Repairs found during integration

- Fixed short/fragmented LSP frames and Windows URI escaping/case identity.
- Language-server responses distinguish pending/unavailable diagnostics; disk queries cannot overwrite a live editor buffer, including changes waiting for debounce.
- Editor-instance ownership prevents an old asynchronous close/change from damaging the new buffer. Typing, external refresh and recovery updates all reach the language server.
- Fixed autosave/session subscriptions and debounce state; project-owned recovery retains exact content/base and enforces revisions and archive scope validation.
- Corrected the linked-project repair intent predicate using the actual coding acceptance prompts.
- Repeated passed commands now count as unchanged work. Staged verification retains pending command IDs, then controller-checked completion, instead of offering unrelated source rewrites after passing checks. Failed checks and missing behavioral evidence still expose repair tools. Every command and edit remains a real model-selected native operation.

## Remaining boundaries

This merge does not certify every model/task, long-chapter voice/continuity, a new 50k real-model chapter, or the preserved CodeDiffusion/Dona experimental features. Quality runs remain individual evidence. Python/Node/language-server runtime packaging is described above. The existing bundle-size and three lint warnings remain visible. The dependency audit has fifteen low/moderate advisories; the high/critical issues encountered in the editor/PDF dependencies were repaired without a blanket forced dependency migration.
