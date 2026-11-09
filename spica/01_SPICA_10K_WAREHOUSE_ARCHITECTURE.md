# SPICA — 10K-Per-Category Block Warehouse Architecture

**Edition:** 0.2 concept proposal · 9 November 2026  
**Status:** Design specification. No blocks described here are claimed to be installed or tested.  
**Companion:** `SPICA_Master_Blueprint.md` (the existing original master blueprint).  
**Main decision:** Ten thousand entries is an **upper bound for each category's searchable namespace**, not a requirement to produce ten thousand handwritten implementations or expose ten thousand model tools.

## 1. Executive decision

Spica should have a **capability warehouse** with a stable catalog, semantic/type-based discovery, a typed graph compiler, executable implementations, parameterized compositions, test evidence, and human-readable Markdown documentation. Keep the existing `SpicaBlockDefinition`, `SpicaGraph`, `SpicaChangeSet`, `SpicaService`, and Spark tool vocabulary described in the original master blueprint. Extend them; do not construct a competing editor or a second activity event bus.

### The four things people call "blocks"

| Kind | Has independent implementation? | Example | Quality gate |
|---|---:|---|---|
| Primitive block | Yes, after implemented | `research.fetch.page` | Real adapter + contract tests |
| Composition block | Not necessarily; orchestrates primitives | Fetch → extract → compare | Valid graph + end-to-end test |
| Parameterized profile | Usually not; configures another block or composition | Official-first documentation research | Resolved configuration + tests |
| Recipe / template | Uses blocks to create a feature/project | Source-backed research assistant | Builds and functional scenario passes |

**Never count a name, Markdown file, or JSON descriptor as a working block.** 10,000 entry slots per category can include all four kinds, but UI and APIs must show kind, maturity, implementation availability, dependencies, and targets truthfully.

## 2. Scale mathematics

- Original proposal: 26 existing categories.
- Suggested additions: **27 — Web research, retrieval, evidence** and **28 — Game creation and gameplay** to support LeonisMaker.
- Capacity at 10,000 entries each: **280,000 indexed entries**, assuming every category is fully populated.
- These numbers are **index/capacity targets**, not a prediction of distinct useful algorithms.
- Example Web category: 120 candidate primitives plus 10,000 generated **research profile combinations** in a separate catalog. They are not 10,120 verified functional tools.
- A high-quality first release should deliberately ship perhaps **20–40 tested core blocks**, not thousands of placeholders.

## 3. Registry design: storage versus execution

### Markdown is documentation, not the execution system

Markdown should be used for category overviews, usage contracts, research procedures, examples, architecture decisions, integration notes, and readable lists. Authoritative machine-readable manifests should be JSON or YAML validated against a schema, backed by a searchable local index such as SQLite (FTS5) plus optional embeddings. Source code/registered adapters implement actual behavior. Never parse arbitrary Markdown into executable model tool permissions.

**Proposed logical layout** (adjust to the actual merged repository after inspection):

```text
spica/
  docs/
    block-warehouse/README.md
    block-warehouse/architecture.md
    block-warehouse/categories/01-.../README.md
    block-warehouse/categories/27-web-research/README.md
  registry/
    schemas/block-definition.schema.json
    manifests/            # source of truth for catalog entries
      27-web-research/0000-0099/*.json
    index.sqlite          # generated, not edited by hand
    lockfiles/
  implementations/
    shared/
    web-research/
  recipes/
    web-research/
  services/
    block-search.ts
    block-resolve.ts
    compatibility.ts
    evidence-store.ts
    research-runner.ts
  tests/
    contracts/
    catalog/
    research/
```

**Do not create one 10,000-line `route.ts` or one huge model prompt.** Metadata search and execution should be in separate modules. Recommended catalog shard size: **100 entries**, resulting in **100 shards per full category**. Generated Markdown indexes may aggregate the shards for portability.

## 4. Identifiers and versions

Use stable namespaced IDs, not ordinal array offsets:

- Primitive: `spica.research.fetch.page`
- Composition: `spica.research.workflow.primary-source-trace`
- Profile: `spica.research.profile.official-source.local-llms.official-first`
- Recipe: `spica.recipe.search-and-verify`

Lock project references to an exact version: `id@semver`. A version change must declare migration/compatibility. Display labels may change without changing IDs. `aliases` must not shadow another block's canonical ID. Content hashes are recommended for audits; license and trusted publisher metadata are required for distributed blocks.

## 5. A compact block descriptor

```ts
export type SpicaBlockMaturity =
  | 'draft' | 'prototype' | 'beta' | 'stable' | 'deprecated' | 'blocked';
export type SpicaCatalogKind = 'primitive' | 'composition' | 'profile' | 'recipe';

export interface SpicaCatalogRecord {
  id: string;
  version: string;
  categoryId: string;
  kind: SpicaCatalogKind;
  label: string;
  summary: string;
  tags: string[];
  targets: string[];
  inputsSchemaId: string;
  outputsSchemaId: string;
  capabilityRequirements: string[];
  implementationRef?: string; // absent for non-executable drafts
  resolvesTo?: string[]; // primitives/compositions selected at runtime
  dependencies: Array<{ id: string; versionRange: string }>;
  maturity: SpicaBlockMaturity;
  tests: string[];
  documentationPath: string;
  publisher: string;
  license: string;
  checksum?: string;
}
```

The existing `SpicaBlockDefinition` remains the compiler-facing block contract; this **catalog** record supplements it as a discovery/storage layer. Keep a `SpicaProfileDefinition` separately for research variants; never make a profile's metadata claim it has standalone codegen.

### Standard result envelope

```ts
export interface SpicaExecutionResult<T> {
  runId: string;
  stepId: string;
  blockId: string;
  blockVersion: string;
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  output?: T;
  diagnostics: Array<{ code: string; message: string }>;
  observedAt: string;
  provenanceRefs: string[];
  nextSuggestedBlockIds: string[];
}
```

Output is **typed and validated** before the LLM sees it; tool results never get silently treated as trusted instructions.

## 6. Search millions of possible combinations without context overflow

**Model-facing discovery contract:** initially expose about **8–12 high-level tool interfaces**, not the whole catalog. Search index → compatibility filter → ranking → short candidate cards → inspect exact selected contract → execute. Only show a small working set (typically 5–12 candidates) to the Spark.

```text
User objective
  → Inspect project state and capabilities
  → Retrieve top relevant categories
  → Query catalog index (keyword/type/target/permissions)
  → Filter by graph compatibility + installed implementations
  → Rank by task match, maturity, test coverage, cost
  → Return small shortlist + rationale and missing capabilities
  → Spark inspects specific block/recipe
  → Proposal/permission/validation
  → Execute trusted implementation
  → Observe actual result and repeat if needed
```

Recommended scoring order:

1. Hard constraints: capability permissions, target availability, input/output compatibility, installed runtime, version, safety.
2. Relevance: description, tags, use case, graph neighborhood, existing project structure.
3. Evidence of quality: installed status, tests, successful local executions, maintained version.
4. Resource costs: latency, VRAM/RAM/CPU, network, token budget, licensing.
5. Human preferences and recent accepted choices, never overriding safety.

Search suggestions must remain useful when no embedding model is installed. For the 8/12 GB VRAM target, FTS5 and deterministic schema matching should be primary; optional semantic reranking can run briefly on CPU or a small model.

## 7. Canonical block-selection loop

```ts
export interface SpicaNextActionRequest {
  objective: string;
  projectId?: string;
  currentGraphId?: string;
  availableInputTypeIds: string[];
  target?: string;
  allowedCapabilities: string[];
  alreadyTriedBlockIds: string[];
  diagnosticCodes?: string[];
  topK?: number; // capped by server
}

export interface SpicaBlockCandidate {
  id: string;
  kind: SpicaCatalogKind;
  version: string;
  reason: string;
  inputSchemaId: string;
  outputSchemaId: string;
  maturity: SpicaBlockMaturity;
  executableNow: boolean;
}

export interface SpicaRegistryQueryService {
  searchCompatible(input: SpicaNextActionRequest): Promise<SpicaBlockCandidate[]>;
  resolve(id: string, version: string): Promise<SpicaCatalogRecord>;
}
```

**Never** allow the LLM to invent a block ID and have it silently accepted. Reject invalid IDs and offer real registry candidates.

## 8. Persistence / scale / consistency

- Database tables: `catalog_entry`, `entry_tag`, `entry_port`, `implementation`, `dependency`, `test_evidence`, `compatibility`, `profile`, `search_audit`.
- Index by `(category, maturity, kind)`, `(id, version)`, types/targets, and searchable text via FTS5.
- Lock versions per project; don't modify historical projects when a block updates.
- Lazy load metadata; load implementations only for blocks used in a run.
- Cache dependency plans and compatibility results by registry revision.
- Debounce UI search; virtualize large lists; paginate deterministic stable sort.
- Never upload local source code or private indexed content without permission.

## 9. Truthfulness gates

`draft`: documentation or planned combination only. `prototype`: executable in constrained example. `beta`: supported integration tests. `stable`: verified target with docs/compatibility/migrations. `blocked`: nonexecutable due to known issue. An exact 10,000-row Markdown inventory can **describe** capacity and profiles, but cannot certify independent implementations.

## 10. Warehouse ↔ Spark ↔ Spica ↔ Glitch ↔ LeonisMaker

- **Solarium:** conversational session, project identity, user permissions, canonical activity events, local models, Sources.
- **Spark:** plans, selects a small set of relevant blocks, learns from real feedback. No direct unvalidated file/network side effects.
- **Spica:** registry, typed graphs, execution plans, code generation, target exports, real tests.
- **Glitch:** custom code and compiler/refactoring escape hatches; its output can become a reviewed registered block.
- **LeonisMaker:** game-specific scene graph, asset pipeline, play mode. Uses common state, events, storage, and networking blocks behind specific game adapters.
- **Research subsystem:** first-class evidence graph and retrieval actions. The Spark selects the **next real research step** after inspecting tool observations.

Keep code, generated apps, game assets, and saved Sources **owned by users** and runnable independently where supported.

## 11. Implementation order (one coordinated development program)

| Gate | Deliverable | Acceptance condition |
|---|---|---|
| A | Stable catalog metadata and validator | Duplicate IDs/invalid manifests rejected |
| B | SQLite FTS + typed/target filters | Search a synthetic 280K-entry index without dumping it into the prompt |
| C | Ten genuinely executable core primitives | Each passes representative contract tests |
| D | Minimal research run service | Query → result → inspect → follow-up → evidence answer |
| E | Spark tool adapter | Model sees shortlist, calls only validated block IDs |
| F | Profile compiler | Generated combinations resolve to existing tested primitives |
| G | Visual research graph | Human can inspect citations, branches, retries, and budgets |
| H | 10K web profiles indexed | Exactly 10,000 unique profiles, but maturity accurately marked |
| I | Sandboxing/privacy/security tests | SSRF, injection, secrets, untrusted hosts, and permissions tested |
| J | LeonisMaker and other categories | Reuse shared primitives; avoid duplicated runtimes |

**Do not skip C/D and jump straight from an enormous catalog to claiming 10,000 working blocks.**

## 12. Standards and source references

- JSON Schema 2020-12 (machine-readable validation): https://json-schema.org/specification
- MCP tool discovery and pagination (design comparison; no requirement to use MCP internally): https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- Robots Exclusion Protocol, RFC 9309: https://www.rfc-editor.org/rfc/rfc9309

These are external design references, not proof of any implementation in Solarium.
