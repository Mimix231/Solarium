# Phase 17 — 10K-per-Category Warehouse Evolution & Safe Extensions

**Goal:** Grow SPICA from a small reliable executable registry into a broad, reusable, searchable ecosystem without equating a 350K catalog capacity with 350K working programs.

## Baseline numbers

The Phase 9.5 planning baseline reports **35 category IDs**, a planned **10,000 slots per category** (350,000 conceptual capacity), 26 legacy block modules and 103 Graph V2 executable modules. Reconcile these numbers against current source at implementation time. Search-indexed descriptors, tested adapters, recipes and installed packages are four distinct counters.

## Category strategy

Keep independent categories and relevant subfamilies for **styling, variables, functions, layout, visual appearance, interface, UI, professionalism, research, data, graphics, game logic and integrations**. Each category can scale to 10K+ entries without loading that catalog into Dona's prompt. Entries may be primitive, component, composite, profile or recipe; each has truthful maturity and target support.

## Warehouse implementation

- Canonical source files: `src/spica/runtime/blocks/<category>/<subfamily>/<block-id>.ts`. Never introduce another `blocks` implementation root.
- Manifest for every executable block: stable ID/version, ports, config schema, capability facets, targets, permissions, dependencies, implementation module, provenance and tests.
- Indexed metadata: SQLite/FTS versioned catalog, optional embeddings and dependency graph, paginated exact/semantic search, bounded shortlist and operation-specific config inspection.
- Composition recipes must be explicitly differentiated from underlying primitive implementations; no inflated capability counts by generating thousands of identical presets.
- Provenance controls: local trusted, reviewed community, unreviewed third party, metadata-only draft. Downloaded code cannot execute without explicit user trust and permission checks.
- Registry generation/check must reject duplicates, moved legacy files, mismatched manifests and missing test fixtures before development startup.
- Safe upgrade/removal: dependency pins, cached prior version, import/export compatibility, rollback, source ownership and audit log.

## Spark-assisted evolution

Dona may search existing blocks, identify a **specific missing capability**, propose a new source file and tests in a protected workspace, validate it, and submit it for approval. The model must not grant itself tools, install privileged dependencies or silently promote generated code to trusted runtime status.

## Research blocks

Preserve Phase 8's real search/read/follow/compare/evidence-save path. Add capability-appropriate dynamic research strategies only after target/permission validation; search result IDs are evidence resources, not callable tool names. Tool contract registry remains the single authority.

## Performance and acceptance

- Stress index with >=350K **synthetic non-executable** descriptors; measure cold build, warm search median/p95 and memory, with a reproducible benchmark command and hardware details.
- Test discovery with many candidate entries but constrained model context; exact matching runnable targets must rank ahead of drafts when user wants execution.
- Community block import with approval, dependency resolution, failure isolation and safe rollback.
- Validate at least one library-authored extension powering a real exported app and one custom game block.
