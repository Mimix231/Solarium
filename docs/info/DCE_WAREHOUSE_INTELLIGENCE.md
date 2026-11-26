> **Later inference-recovery update (November 22, 2026):** The Phase 03 text below documents the original pause-on-first-reasoning-only-stop behavior. Source construction now permits up to two bounded, independent action decisions using the authoritative task checkpoint. See `docs/info/INFERENCE_ARCHITECTURE.md` for the current contract.

# Dream Construction Engine — Phase 03 Warehouse Intelligence

**Status:** Metadata search, dependency resolution and on-disk index production implemented in Phase 03. This is **not** the Phase 04 planner or Phase 05 project writer.

## Source ownership and safety

The canonical reviewed portable implementations stay in `src/spica/source/portable/`, with registered hashes and contracts in `src/spica/source/builtins.ts`. The existing `src/spica/runtime/blocks/` adapters are untouched and still execute through the legacy SPICA runtime.

The new index contains only `IndexedCapability` data: identity, version, kind, description, category, target, language, public symbols, declared dependencies and provenance kind. It contains **no executable source, generator callback, native permission, project path, or LLM-produced code**. Arbitrary extra fields and invalid metadata are rejected before indexing. Neither searching nor resolving dependencies writes source files.

Catalog entries have four distinct kinds: portable source, generator, host-runtime, and knowledge descriptor. Only the first two can be passed to the existing source emitter. Count each category separately; the catalog size is not the executable block count.

## Key classes and interfaces

| Component | File | Contract |
|---|---|---|
| `IndexedCapability`, `WarehouseIndexManifest`, `WarehouseIndexProvider` | `intelligence/contracts.ts` | Portable, serializable public catalog and shard I/O |
| `WarehouseIndexer.build()` | `intelligence/indexer.ts` | Builds deterministic versioned shards and inverted term-to-shard postings |
| `validateWarehouseManifest()` | `intelligence/indexer.ts` | Checks counts, identifiers, digests, postings and descriptor categories |
| `CapabilitySearchEngine.search()` | `intelligence/search.ts` | Bounded indexed search, exact symbol filters, target/category/version filters, relevance ranking and incomplete-results flag |
| `CapabilitySearchEngine.exact()` | `intelligence/search.ts` | Deterministic identity-to-shard lookup with SHA-256 verification |
| `SourceDependencyResolver.resolve()` | `intelligence/dependencies.ts` | Exact registered transitive dependencies, target compatibility, export symbol checks, cycle detection and generator-config constraints |
| `CompositionRecipeRegistry` | `intelligence/recipes.ts` | Named **plans**, separately indexed from actual source modules |
| `searchSourceWarehouse()` and `resolveSourceDependencies()` | `src/spica/catalog/source-intelligence.ts` | Read-only entry points for later construction planning |

Shard contents are checked against the manifest digest before use and cached in a bounded 12-shard LRU. Queries do not load the executable modules. Search reads only indexed candidate shards, up to a caller-controlled bound, and reports `incomplete: true` when that bound is reached. It does **not** claim full-catalog ranking in that case.

Natural-language discovery currently uses lexical token scoring and a deliberately small curated synonym map; embeddings and semantic reranking are not included. The registry distinguishes supported targets `typescript-web` and `typescript-desktop` (webview) and exact public symbol declarations. It does not claim native mobile, Rust, JavaScript or arbitrary package integration.

## Using the warehouse

- `npm run dce:warehouse:index -- --out .dce-warehouse-index` writes reviewed public contracts to a new folder only.
- `npm run dce:warehouse:index -- --out .dce-warehouse-index --check` compares the saved index to current reviewed registrations. It fails on tampering, missing shards, or stale registrations.
- `npm run dce:warehouse:benchmark -- --entries 350000` tests simulated **descriptor** scale. The synthetic descriptors are not deployable code or registered application blocks.
- `npm run test:construction:phase03` runs the focused discovery/compatibility and construction-stop regressions.
- `npm run dce:source:types` strictly checks the source warehouse and intelligence contracts independently of the full Vite dependency graph.

## Why indexed capability discovery is not an executable tool call

Source discovery returns facts for planning. Later phases will convert a reviewed construction plan to `SourceSelection` values and use `SourceBlockEmitter` to generate a read-only `SourceFileBundle`. The **authorized native project-file writer** in Phase 05 must still verify receipts, check permissions and project root, and commit files. Nothing in Phase 03 bypasses the task permission broker or creates project writes.

## Model stop and Resume

When `runAgent()` receives a source-construction turn that has no actual tool calls and no answer, it now returns `describeConstructionStop()` as visible assistant text **after** the original task and construction checkpoint have been settled paused. The stop explanation identifies reasoning-only output, open reasoning channels, context/output limits, and unknown termination separately. Pause causes are retained in `ConstructionSession.pauseReason` across Resume until a confirmed next operation advances the task.

**There is no hidden retry, invented tool call, automatic continue prompt, second inference engine, or fake success.** If the local GGUF/chat template never closes its reasoning channel or emits usable function calls, the native environment must be corrected; these code changes make the outcome diagnosable and resumable rather than secretly solving model capability limitations.

## Known boundaries

The 350K benchmark builds an index in Node memory and reads saved metadata shards lazily; production-grade incremental indexing of continually changing third-party catalogs and background ingestion is future work. SHA-256 verifies a shard against its manifest but is not a digital signature of external publisher identity. Only approved registrations and their source hashes authorize reuse. A full Vite/Tauri build and live GGUF tool-calling acceptance remain required before release readiness.
