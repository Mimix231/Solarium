# Solarium × SPICA — Phase 01 source update

The **12-mega-phase roadmap** and Phase 01 implementation notes are in [`roadmap/`](roadmap/). Phase 01 has been applied to the Solarium source: see [`roadmap/09_PHASE01_IMPLEMENTATION_REPORT.md`](roadmap/09_PHASE01_IMPLEMENTATION_REPORT.md) and [`../src/spica/blocks/README.md`](../src/spica/blocks/README.md). Registered legacy blocks have one module each; large draft catalogs do not become executable by being indexed. This pack still contains earlier architectural documents as references.

---

# SPICA — 350K-Capacity Block Warehouse: Copilot Implementation Pack

**Edition:** 0.3 — 9 November 2026  
**Status:** Technical proposal, Markdown implementation specifications. **No claim of implementation, build success, or repository inspection.**  
**Audience:** Solarium developers using GitHub Copilot, Codex, or a local Spark; human reviewers retain control.

## What has changed since the earlier 10K package?

The earlier 0.2 warehouse planned **28 categories × 10,000 catalog slots = 280,000 possible entries**. This pack preserves **all 28 existing category IDs** and introduces **seven additional primary categories**: Styling (29), Functions (30), Layout (31), Visual Appearance (32), Interface Architecture (33), UI Components (34), and Professionalism (35). Variables remains **category 05**; Web Research remains **category 27**. This produces **35 × 10,000 = 350,000 potential catalog slots**, not 350,000 implemented blocks. None of the seven new categories replaces or silently renumbers earlier categories.

A *slot* is capacity. A *record* is a searchable descriptor. A *verified executable block* is a separately counted implementation proven by real tests. Keep these numbers distinct in every API, UI, metric, and marketing statement.

## Primary project principles

1. **Determinism beneath AI:** the same valid graph and inputs produce defined behavior without a model.
2. **Visual-first, source-available:** Spica edits graph data; Glitch remains available for advanced coding.
3. **Small model support:** a Spark receives a shortlist, not tens of thousands of tool definitions.
4. **One source of truth:** schema-validated manifests and graph transactions; Markdown is explanatory, never executed.
5. **Independent exports:** generated applications must not require Solarium unless a clearly declared runtime dependency demands it.
6. **Truthful status:** draft, prototype, beta, stable, deprecated, and blocked have explicit meanings.
7. **No fake functionality:** an entry is not executable until its resolved implementation, permissions, and tests say so.
8. **Incremental integration:** preserve existing agent, inference, Sources, and project services rather than cloning them.

## File map

| Read order | Document | Outcome |
|---|---|---|
| 1 | `00_ADOPTION_AND_COMPATIBILITY.md` | Understand what existing architecture is preserved |
| 2 | `01_CATEGORY_MAP_AND_10K_CAPACITY.md` | Exact category assignments, quotas, taxonomy |
| 3 | `02_TYPESCRIPT_CONTRACTS.md` | Canonical data structures and validation boundaries |
| 4 | `03_REGISTRY_SQLITE_AND_SEARCH.md` | Catalog ingestion, FTS, dependency/target discovery |
| 5 | `04_GRAPH_ENGINE_AND_COMPILATION.md` | Typed connections, graph IR, compilation and export |
| 6 | `05_SPARK_TOOL_PROTOCOL_AND_EVENTS.md` | Shortlist → inspect → change → verify |
| 7 | `06_SPICA_STUDIO_UX.md` | Browser, canvas, inspector, audits, accessible views |
| 8 | `07_WEB_RESEARCH_OBSERVATION_LOOP.md` | Real results → choose another research operation |
| 9 | `08_SECURITY_TRUST_AND_PERMISSIONS.md` | Prompt injection, capabilities, blocks and secrets |
| 10 | `09_QUALITY_TESTING_AND_METRICS.md` | Test gates, performance, regression, success criteria |
| 11 | `10_INTEGRATION_PATHS_AND_FILE_OWNERSHIP.md` | Proposed paths, ownership, migrations, no duplicate runtime |
| 12 | `11_IMPLEMENTATION_MILESTONES.md` | Small, reviewable development batches |
| 13 | `12_COPILOT_COPY_PASTE_TASKS.md` | Tasks with explicit files, symbols and acceptance tests |
| 14 | `13_END_TO_END_EXAMPLE.md` | Full settings-panel build example |
| 15 | `14_BLOCK_AUTHORING_AND_PROMOTION.md` | How to grow warehouse without fake capabilities |
| 16 | `15_PERFORMANCE_AND_LARGE_CATALOG_BENCHMARKS.md` | 350K stress-test and 8/12 GB considerations |
| 17 | `16_SOURCE_PROVENANCE_AND_VERSIONING.md` | Block locks, provenance, reproducibility |
| 18 | `17_SMOKE_TEST_CHECKLIST.md` | Quick verification checklist after Copilot patches |
| 19 | `18_CANDIDATE_MANIFEST_EXAMPLES.md` | Explicitly draft examples for schema authoring |
| 20+ | `categories/*.md` | Dedicated 10K-capacity specifications per requested domain |

## Recommended implementation order for Copilot

**First Copilot session:** read `00`, `02`, `03`, `10`, `11`, `12` and implement **M0 — contracts + registry + 20 truthful sample records**. Do *not* ask Copilot to generate 350,000 names or rewrite the inference engine. Run typecheck, contract tests, and regression checks. Keep everything behind a feature flag until it passes.

**Second session:** implement FTS search, category filters, target constraints, and small Spark-facing discovery operations. **Third session:** graph edits, deterministic validation and a minimal application UI. **Fourth session:** one real end-to-end settings panel. **Fifth session:** research observation and evidence loop with explicit network permissions. Expansion to more profiles happens only after the primitives work.

## Compatibility notes

The earlier master blueprint defines `SpicaBlockDefinition`, `SpicaGraph`, `SpicaChangeSet`, `SpicaService`, and `SpicaBuildEvent`. Those are the underlying concepts in this pack. Do not duplicate them if already present in your repository. Existing Solarium integration notes describe `src/app/api/chat/stream/route.ts`, `src/lib/solarium/activity-events.ts`, `src/lib/solarium/agent-runtime/activity-projector.ts`, and `src/lib/solarium/python-agent-client.ts`; **their current post-merge status has not been verified**. Inspect before touching.

## Companion material bundled under `references/`

- `references/SPICA_Master_Blueprint_0_1.md` — original comprehensive product architecture.
- `references/previous_280K_package/` — original 28-category documentation, including the **10,000 draft** web research profile Markdown catalog and older 28 category briefs.
- `references/Solarium_Project_Intelligence_Sources_Notes.md` and `references/Solarium_Agent_Debugging_Notes.md` — prior agent/Sources/event constraints.

These are **historical project references**, not a live repository audit. The earlier SQLite/JSONL web-research prototypes are not included to avoid bundling an oversized unused test database. They remain available in the user's prior 10K warehouse package.

**Next action:** open `12_COPILOT_COPY_PASTE_TASKS.md` and give Copilot **Task 0**, with the compatibility documents as context.

## Current runtime warehouse boundary

The Spark-facing warehouse is assembled from the real `blockRegistry` and `recipeCatalog` in `src/spica/program.ts`; it does not import Markdown or draft research profiles as executable entries. `src/spica/warehouse.ts` provides bounded local search and exact ID/version inspection, with maturity, target, capability, installation, and implementation status derived from those registered adapters and the active graph. Results are paged through the existing SPICA tool path before graph edits; no second agent loop or network request is introduced.

The runtime index is intentionally small and its counts are derived from the registries. The 10,000 web-research profiles and 350,000 category slots described in this proposal remain catalog designs, not installed or executable functionality.

## Canon integration checkpoint

The current source has Phase 01 (registered block-file architecture) and Phase 02 (centered glass SpicaWorkbench with real terminal-style build evidence and source-diff preview) implemented. See [`roadmap/SPICA_ROUND_STATUS.md`](roadmap/SPICA_ROUND_STATUS.md) and [`roadmap/10_PHASE02_IMPLEMENTATION_REPORT.md`](roadmap/10_PHASE02_IMPLEMENTATION_REPORT.md) for test results and native release limitations. **Phase 03 is not implemented yet.**
