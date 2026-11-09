# 12 — Copy-and-paste Copilot implementation tasks

These prompts assume **Copilot has access to the actual merged Solarium repository**. Attach/link the docs in this pack and point Copilot to the original `SPICA_Master_Blueprint.md`. They demand implementation evidence rather than invented success. Never assume the proposed paths already exist.

## Task 0 — Repository audit and precise mapping

> Read `README.md`, `00_ADOPTION_AND_COMPATIBILITY.md`, `02_TYPESCRIPT_CONTRACTS.md`, and `10_INTEGRATION_PATHS_AND_FILE_OWNERSHIP.md`. Inspect the merged Solarium repository. Locate the actual definitions and usages of `SpicaBlockDefinition`, `SpicaGraph`, `SpicaChangeSet`, `SpicaService`, the current agent tool registry, canonical activity events, Sources and project persistence. Report a table mapping every proposed module to its actual current location or missing state. Run baseline lint/typecheck/tests and report existing errors. Do not edit code in this task. Do not invent file paths or claim anything was verified without running it.

## Task 1 — Contracts, categories and manifest validation

> Implement the additive warehouse contracts described in `02_TYPESCRIPT_CONTRACTS.md` and the category map in `01_CATEGORY_MAP_AND_10K_CAPACITY.md`, preserving all current Spica types and category IDs 01–28. Add categories 29–35 with stable IDs and exactly one primary category per record. Implement `WarehouseManifestImporter.importDirectory()` or integrate an existing equivalent using schema validation. Add ~20 meaningful **draft** JSON manifests across styling, variables, functions, layout, appearance, interface, UI, professionalism and research. Include tests for duplicate `id@version`, unsupported category, malformed manifest, and unknown implementation. Do not claim draft blocks are executable. Show edited symbols and test output.

## Task 2 — Searchable warehouse

> Implement `WarehouseRegistry`, `WarehouseSearchService.search()`, `WarehouseEligibilityService.check()` and `WarehouseCatalogReporter.getCounts()` from `03_REGISTRY_SQLITE_AND_SEARCH.md`, using the repo's existing SQLite library if available. Add FTS5 indexing and deterministic keyword/facet/target filters. The Spark default shortlist is eight results and cannot exceed 12 in initial integration. Explicitly distinguish declared capacity, indexed records, executable entries and verified stable entries. Provide unit tests and a throwaway 350,000-row synthetic benchmark fixture; avoid loading full metadata into model context or UI memory.

## Task 3 — Graph edits and validation

> Inspect and reuse the real `SpicaGraph`, `SpicaChangeSet`, `SpicaApplyResult`, `SpicaService`, and `SpicaGraphOperation` symbols. Implement/integrate `validateGraph()`, connection type checks, schema validation, forbidden cycle checks, and revision-safe `proposeChangeSet()` / `applyChangeSet()` using `04_GRAPH_ENGINE_AND_COMPILATION.md`. Ensure a failed transaction does not partially write changes, and undo/redo restores exact snapshots. Do not replace the existing project persistence format without migration tests. Add test cases for wrong port direction, type mismatch, missing block, revision conflict and rollback.

## Task 4 — Minimal visual editor

> Implement a feature-flagged `SpicaStudioView` with `WarehouseBrowser`, `GraphCanvas`, `GraphOutline`, `BlockInspector` and `SpicaDiagnosticsPanel` using the existing UI framework and patterns, according to `06_SPICA_STUDIO_UX.md`. It must support keyboard and mouse access, insertion from verified search results, node selection, schema-driven property editing, compatible port connections, undo/redo, and a source/code view when available. Do not put all state in a single giant React component. Use existing project services for persistence. Supply screenshots or runnable test output only if actually produced.

## Task 5 — Real settings-panel end-to-end

> Implement only the primitives required by `13_END_TO_END_EXAMPLE.md` for one supported target. Provide real variable state, button click, theme token, stack/split layout, screen composition and a scoped persistence adapter. Compile/export actual code into generated-owned paths without overwriting user custom code. Verify the app builds and the UI can change a setting, persist it, and restore it after reopen. If build tooling is absent, report the blocker rather than claiming success.

## Task 6 — Spark warehouse tools and honest activity

> Add only `spica_warehouse_search`, `spica_block_inspect`, `spica_project_inspect`, `spica_change_propose`, `spica_change_apply`, `spica_graph_validate`, `spica_project_build`, and `spica_evidence_inspect` to the existing agent tool registry, *without a duplicate agent loop*. Use actual canonical Activity events, not new synthetic phase cards. Validate inputs before executing. Add a test model that emits malformed JSON, nonexistent block IDs, unauthorized requests and an outdated graph revision. Preserve llama.cpp continuous streaming and existing Sources behavior.

## Task 7 — Research follow-up

> Implement a small real research adapter group from `07_WEB_RESEARCH_OBSERVATION_LOOP.md` and connect to existing Solarium web permissions. A Spark must be able to `search -> inspect result -> follow a link or citation -> compare claims -> verify`. Use source-level timestamps and claim provenance, explicit step/request/byte budgets, cancellation, injection resistance and SSRF protection. Web-off must cause exactly zero outbound requests. Do not mark any of the existing 10,000 research profiles executable until their underlying implementation and tests are present. Supply an E2E fixture with an actual follow-up research decision.

## Task 8 — Professionalism audit

> Add a real `SpicaQualityFinding`/audit pipeline using `categories/PROFESSIONALISM_10K.md` and `09_QUALITY_TESTING_AND_METRICS.md`. Start with checks that can be reproduced: keyboard focus reachability, missing accessible names, predictable contrast, overflow in responsive preview, inconsistent token usage and unhandled error states. Each issue must name affected node(s), rule, evidence and suggested fix. Avoid a generic model-generated quality percentage. Include fixtures demonstrating passing and failing cases.

## Required response format from Copilot after each task

1. Changed file paths and **actual** functions/classes modified or created.
2. Why each change is necessary and how it integrates with existing Solarium code.
3. Commands run, exit codes and meaningful errors (if any).
4. Summary of passing and failing tests, with honest limitations.
5. Next unimplemented milestone; do not conflate proposed catalog entries with executable ones.

## Tasks NOT to give Copilot prematurely

- “Generate 10,000 different working code blocks in every category now.”
- “Rewrite all of Solarium and its local inference engine for Spica.”
- “Assume old documented paths match the latest merged repo.”
- “Make arbitrary existing source convertible into a perfectly editable Spica graph.”
- “Install third-party packages and execute their scripts silently.”
