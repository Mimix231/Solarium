# 11 — Practical implementation milestones for GitHub Copilot

Each milestone is shippable and independently testable. The total architecture is coordinated, but **do not ask Copilot to implement 350,000 entries in one go**. Work in coherent patches with tests. Don't rewrite active Solarium subsystems unless an integration seam genuinely requires it.

## M0 — Audit and contracts (first session)

**Files:** actual existing Spica type modules + new warehouse extension contract, category registry and 20 sample manifests.  
**Functions/classes:** `SpicaWarehouseEntry`, `WarehouseManifestImporter`, category resolver.  
**Tasks:** inspect repo, identify target/version/test runner, preserve types, add 29–35, validate unique IDs and metadata.  
**Acceptance:** typecheck; test duplicate, missing schema, malformed version; original Solarium tests still pass.  
**Out of scope:** FTS, executable blocks, visual canvas.

## M1 — Search and truthfulness

**Files:** `registry-database.ts`, `search-service.ts`, `eligibility.ts`, `registry.ts`, tests.  
**Functions/classes:** `WarehouseSearchService.search()`, `WarehouseEligibilityService.check()`, `WarehouseCatalogReporter.getCounts()`.  
**Tasks:** SQLite FTS5 import/rebuild, faceted search, target/permission filters, 8-item default shortlist, registry counts.  
**Acceptance:** exact and fuzzy-ish lexical search, no docs execution, no draft executable flags; synthetic scale benchmark.

## M2 — Graph validator and transactions

**Files:** graph validator, operations, existing `SpicaService` implementation adapter.  
**Functions/classes:** `validateGraph()`, `proposeChangeSet()`, `applyChangeSet()` (reuse existing semantics).  
**Tasks:** typed ports, cycle rules, atomic graph changes, version conflict, undo/redo.  
**Acceptance:** type mismatch blocked; failing transaction leaves snapshot unchanged; valid two-node event graph passes.

## M3 — Minimal Studio

**Files:** `WarehouseBrowser`, `GraphCanvas`, `BlockInspector`, `SpicaDiagnosticsPanel`, existing layout integration.  
**Tasks:** search and insert verified block, connect valid ports, edit variables, undo, keyboard accessible outline.  
**Acceptance:** user creates a text label plus button with a variable binding without hand-editing JSON; canvas and outline match.

## M4 — Small genuine standard library

**Suggested first 12 executable primitives:** `variable.define`, `variable.read`, `variable.write`, `function.constant`, `function.format`, `function.equals`, `layout.stack`, `layout.split`, `style.token.resolve`, `ui.text`, `ui.button`, `interface.screen`. All IDs below category documents are proposal names and should use canonical chosen namespaces.  
**Tasks:** real adapter handlers, input/output schemas, error contracts, tests, at least one target compiler.  
**Acceptance:** settings-panel sample app loads, interaction changes value, local setting persists via an approved storage adapter.

## M5 — Spark operation bridge

**Files:** existing agent tool registry/handler and thin Spica bridge, canonical activity forwarding.  
**Tasks:** search/inspect/changeset/validate/build tools; model cannot call unknown blocks or skip validation.  
**Acceptance:** deliberate malformed tool inputs rejected; Spark only sees bounded results; no second Activity event stream.

## M6 — Research observation loop

**Files:** `research-runner.ts`, `evidence-store.ts`, `next-block-policy.ts`, approved network provider adapters.  
**Tasks:** search → inspect → follow link → compare sources → answer; web-off and SSRF guards.  
**Acceptance:** real source provenance, a legitimate second block selected from results, cancellation/budget stops, no network requests offline.

## M7 — Professionalism/appearance/layout maturity

**Files:** audit service, UI inspector tabs, responsive preview and style token resolver.  
**Tasks:** keyboard/focus, contrast, consistency, overflow checks; appearance compositing with safe fallbacks.  
**Acceptance:** each issue points to reproducible evidence and a graph node; invalid appearance effect doesn't silently break exports.

## M8 — 10K catalog profiles and ecosystem

**Tasks:** import existing 10K **draft** research profiles; validate generator; create category-specific automated *valid* profile families after primitives work; opt-in community imports, license/lock checks.  
**Acceptance:** exactly 10K unique existing web profiles, proper maturity and underlying dependency resolution; accurate dashboard counts; no false “350K functional blocks” claim.

## Recommended review rule

For every batch: inspect diff, list touched symbols, test typecheck/lint/unit/integration, capture known failures, verify source ownership, snapshot before migrations, and keep changes reversible. Make a PR/checkpoint after each milestone rather than accumulating a massive unreviewed branch.
