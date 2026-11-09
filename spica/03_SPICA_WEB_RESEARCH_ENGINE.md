# SPICA — Web Research & Evidence Engine

**Edition:** 0.2 · 9 November 2026  
**Status:** Architecture + candidate block atlas, not shipped software.  
**Design promise:** A Spark can search, inspect real results, select another compatible research block, follow credible evidence, verify claims, and stop when the objective has been satisfied or a budget/safety gate intervenes.

## 1. Why this should be its own Spica category

Ordinary `Search → Text → Answer` is too weak for technical research. A result is an **observation** containing citations, candidate sources, technical facts, version clues, contradictions, and navigation opportunities. The Spark should be able to choose the next action based on those observations, rather than treating every search as the terminal step.

The Web Research category is **category 27** and cooperates with networking (category 08), databases/search (06), AI integrations (17), security (22), and graph/runtime execution. It must not duplicate unrelated browser or HTTP implementations.

## 2. The agent-visible research cycle

```text
RESEARCH OBJECTIVE
    ↓
INSPECT SOURCES / EXISTING CONTEXT
    ↓
DISCOVER COMPATIBLE RESEARCH BLOCKS (top 5–12)
    ↓
SELECT + VALIDATE + EXECUTE BLOCK
    ↓
OBSERVE RESULT (sources, extracted claims, gaps, errors)
    ↓
CHOOSE FOLLOW-UP BLOCK based on actual observation
    ├─ Need original source? → trace citation/maintainer/upstream
    ├─ Need details? → fetch page or PDF → extract passages
    ├─ Need verification? → search contradictory source → compare
    ├─ Need code? → find release-specific API/issue/example
    ├─ Inaccessible? → try permitted fallback, mark unknown
    ├─ Sufficient? → verify claims → report with evidence
    └─ Budget reached? → stop and report partial findings
```

A selected block can be a primitive, composition, or research profile. The **execution service** resolves that selection to real, permitted operations. The LLM never receives 10K full schemas and never directly evaluates page content as code.

## 3. Example: investigate a failed local GGUF tool call

*User:* "Why does a model answer normally but refuse tool calls after a llama.cpp update?"

| Step | Chosen block | Observable result | Next choice |
|---:|---|---|---|
| 1 | `research.plan.constraints` | Model/runtime version and evidence gaps identified | Search release notes |
| 2 | `research.search.provider` | Results include official docs, GitHub issues, and a repost | Rank original sources |
| 3 | `research.results.rank` | Maintainer docs + issue look relevant | Fetch official guide |
| 4 | `research.fetch.page` | Docs mention tool-aware templates | Extract compatibility claims |
| 5 | `research.extract.versions` | Claimed behavior differs across builds | Follow relevant release notes |
| 6 | `research.follow.version` | Release-specific change appears relevant | Inspect issue reproduction |
| 7 | `research.extract.errors` | Issue describes a matching symptom | Compare evidence |
| 8 | `research.evidence.compare` | Evidence supports a hypothesis, not proof on user's machine | Produce diagnostic checklist |
| 9 | `research.verify.requirements` | Still needs active `/props` and template info | Report uncertainty and suggested local check |

**Truth condition:** Until Solarium inspects the user's actual model/server, this is an evidence-based hypothesis, not a demonstrated root cause. This trace is hypothetical, not a live run.

## 4. Research source model

```ts
export interface SpicaResearchSource {
  sourceId: string;
  url: string;
  finalUrl?: string;
  domain: string;
  publisher?: string;
  title?: string;
  mediaType?: string;
  publishedAt?: string;
  modifiedAt?: string;
  retrievedAt: string;
  contentHash?: string;
  status: 'candidate' | 'retrieved' | 'rejected' | 'unavailable';
  parentSourceIds: string[];
  policy: { networkAllowed: boolean; robotsChecked?: boolean; rightsNote?: string };
}

export interface SpicaResearchClaim {
  claimId: string;
  text: string;
  sourceId: string;
  location?: { selector?: string; page?: number; start?: number; end?: number };
  evidenceKind: 'direct' | 'indirect' | 'inference';
  stance: 'supports' | 'contradicts' | 'context';
  verified: boolean;
}

export interface SpicaResearchObservation {
  stepId: string;
  blockId: string;
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  sources: SpicaResearchSource[];
  claims: SpicaResearchClaim[];
  openQuestions: string[];
  nextCandidateBlockIds: string[];
  diagnostics: string[];
}
```

The data model must distinguish **page publication date**, **modification date**, and **time retrieved**, and must never copy a search-result snippet as though it were verified webpage content.

## 5. Expose a tiny Spark API

```ts
export interface SpicaResearchAgentTools {
  startResearch(objective: string, constraints: Record<string, unknown>): Promise<{runId: string}>;
  discoverNextBlocks(runId: string, topK?: number): Promise<Array<{id: string; reason: string; executableNow: boolean}>>;
  inspectBlock(blockId: string): Promise<{contract: unknown; maturity: string}>;
  runBlock(runId: string, blockId: string, arguments_: unknown): Promise<SpicaResearchObservation>;
  inspectEvidence(runId: string, claimId?: string): Promise<unknown>;
  verifyResearch(runId: string): Promise<{passed: boolean; gaps: string[]}>;
  finishResearch(runId: string): Promise<{answer: string; citations: unknown[]; caveats: string[]}>;
}
```

These interfaces represent a **target API** to implement, not code known to exist. Use the original Solarium canonical event stream for start/complete/tool calls; never introduce fake "thinking" or "browsing" cards.

## 6. Candidate selection policy

For each result, the system computes permitted **next actions** using deterministic predicates before the model chooses:

- `source.status === 'candidate'` + HTTP URL + allowed domain ⇒ offer `research.fetch.page`.
- `mediaType === 'application/pdf'` ⇒ offer `research.fetch.pdf` and `research.parse.pdf` once fetched.
- `extractedLinks > 0` ⇒ offer `research.follow.citation` with specific target IDs.
- `claims.length > 0 && independentSourceCount < required` ⇒ offer corroboration or contradiction search.
- `versionsMismatch === true` ⇒ offer version-specific scope and comparisons.
- `verifiedClaimsCoverObjective === true` ⇒ offer `research.verify.requirements` and report.
- `budgetExhausted === true` ⇒ offer safe partial report, not infinite retries.

Each suggestion includes a human-readable reason and **exact expected input types**. The Spark cannot select arbitrary execution identifiers not in the registry or evade capability checks.

## 7. Example: finite research orchestrator

```ts
export async function executeResearchLoop(
  run: ResearchRun,
  registry: ResearchBlockRegistry,
  executor: ResearchBlockExecutor,
  choose: (options: ResearchCandidate[], state: ResearchState) => Promise<string>,
): Promise<ResearchRunResult> {
  while (!run.signal.aborted && !run.budget.exhausted()) {
    const candidates = await registry.compatibleNext(run.state);
    if (candidates.length === 0) break;
    const id = await choose(candidates.slice(0, 8), run.state);
    const selected = candidates.find(candidate => candidate.id === id);
    if (!selected || !selected.executableNow) {
      run.recordDiagnostic('INVALID_OR_UNAVAILABLE_BLOCK');
      continue;
    }
    const observation = await executor.execute(selected, run.state, run.signal);
    run.recordObservation(observation);
    if (await run.verifier.hasSufficientEvidence(run.state)) break;
    if (run.state.noProgressCount >= run.budget.maxNoProgressSteps) break;
  }
  return run.verifier.finalize(run.state);
}
```

Interfaces `ResearchRun`, `ResearchBlockRegistry`, `ResearchBlockExecutor`, `ResearchCandidate`, `ResearchState`, `ResearchRunResult` are contracts to define in the implementation. The function is architectural pseudocode, not a drop-in compiled file.

## 8. The 10,000-profile design

**Do not invent 10,000 unrelated network scrapers.** Use a **typed combinatorial catalog of 10,000 proposed research profiles** driven by:

- **40 research intents** — what question is being answered (definitions, versions, compatibility, issues, costs, security, etc.).
- **25 research domains** — where the question applies (desktop apps, LLM inference, video, docs, game engines, etc.).
- **10 evidence strategies** — how results are prioritized and verified (official-first, version-specific, offline, contradiction search, etc.).

40 × 25 × 10 = **10,000 unique profiles**. A profile is metadata that configures and composes the same underlying **120 proposed research primitives** listed in this document. Some combinations may return "not applicable" or "no evidence" for a specific task; they are not guarantees of successful results or separate implementations.

The associated `04_SPICA_WEB_10K_PROFILE_CATALOG.md` contains all 10,000 entries. Each uses an exact ID, defined intent/domain/policy, and a candidate follow-up operation. **All entries have maturity `draft/profile`.**

## 9. Security and responsible browsing

1. **Prompt injection:** Instructions in webpages, repositories, snippets, issue comments, PDFs and files are untrusted **data**. Never let them override the user's objective or permission scope.
2. **SSRF and local-file safety:** Reject loopback, private/link-local IPs, cloud metadata endpoints, `file://`, and disallowed schemes when executing fetches; recheck DNS after redirects. A local development mode should require explicit permission and still isolate secrets.
3. **Network toggle:** If user turns web searching off, do not call remote providers or fetch remote pages. A cached-offline profile should never silently escape to the network.
4. **Respect robots/terms:** For automated crawling, follow the robots exclusion standard (RFC 9309), relevant site access terms, provider quotas, and applicable laws. `robots.txt` is not a replacement for authentication rules.
5. **Source hygiene:** Track URL redirects, source authority, retrieval timestamps, content hashes, observed errors, and true citation spans. Avoid fabricated citations.
6. **Bounded execution:** User-configurable budgets for total steps, per-host concurrency, downloaded bytes, query count, tokens, and deadlines. Enforce cancellations and cleanup.
7. **Privacy:** Search queries and uploaded documents may contain private data. Require permission for external queries and avoid sending private project code by default.
8. **Licenses:** Don't treat fetched code and media as free to copy into projects. Record provenance and check usage rights.
9. **Provider accuracy:** Search ranking is not evidence; a snippet is not necessarily the source text; absence of results is not proof of absence.
10. **Executable content:** Browsing must not automatically run scripts, install packages, or execute copied commands. Route privileged tasks through separately authorized Spica/Glitch tools.

## 10. Source result UX

A research step should show: query → provider → ranked sources → selected page → extracted claims → verification gaps → the Spark's next selected block and **why it was allowed**. Give the human an explicit **Stop / Retry / Follow reference / Compare / Save to Sources** action. The graph should show branching paths without playing a preprogrammed animation. Provide an alternate outline and accessible keyboard navigation.

## 11. Acceptance tests for adaptive research

- The model requests an unknown `blockId` ⇒ receives a real schema validation error and a compatible shortlist.
- A search result contains "ignore previous instructions" ⇒ text is treated as page data; no tool or permission change.
- Search finds a PDF ⇒ the next shortlist contains a PDF-compatible fetch/extract action, not just an HTML parser.
- User turns off Web Search ⇒ no outbound requests; cached sources remain available.
- A result contradicts an earlier claim ⇒ explicit conflict node; do not silently erase earlier evidence.
- Two sources quote the same upstream article ⇒ count as one original lineage, not two independent confirmations.
- A source returns 403 or rate-limit ⇒ mark unavailable and attempt only permitted alternate sources.
- A user requests version-specific findings ⇒ mismatch warnings on other versions.
- Research budget runs out ⇒ stop with a partial, sourced conclusion and open questions.
- A stable block claims to be installed ⇒ manifest must resolve to an executable adapter with valid tests.
- Malformed tool arguments ⇒ validation error, not replacement with `{}`.
- Saving project Sources ⇒ explicit user permission and provenance retained.

## 12. Core primitive atlas (120 proposals; not implementations)

The following is the **engine capability backbone**. Each named item must acquire its own inputs, outputs, permissions, tests, and implementation reference before being promoted to stable.

### Discovery and query planning

| Block ID | Purpose |
|---|---|
| `research.plan.objective` | Determine exact research goal and acceptance criteria |
| `research.plan.constraints` | Extract domain, freshness, version, and scope |
| `research.plan.query` | Build focused query from evidence gaps |
| `research.plan.variants` | Construct nonduplicative related queries |
| `research.search.provider` | Submit a query to an authorized search provider |
| `research.search.site` | Search only approved site or domain |
| `research.search.local` | Search downloaded offline source index |
| `research.search.federated` | Combine authorized multiple provider results |

### Result triage

| Block ID | Purpose |
|---|---|
| `research.results.normalize` | Normalize provider result fields and URLs |
| `research.results.dedupe` | Remove exact and near-duplicate search hits |
| `research.results.rank` | Rank candidates by relevance and evidence potential |
| `research.results.cluster` | Cluster results by subtopic |
| `research.results.filter` | Apply explicit domains, media, and date filters |
| `research.results.preview` | Provide title, URL, and snippet safely |
| `research.results.group` | Group hits by canonical publisher or document |
| `research.results.score` | Produce transparent candidate scoring explanation |

### Safe retrieval and transport

| Block ID | Purpose |
|---|---|
| `research.fetch.page` | Retrieve a permitted web page |
| `research.fetch.pdf` | Retrieve and validate a PDF source |
| `research.fetch.text` | Retrieve plain text and Markdown |
| `research.fetch.headers` | Inspect response status and cache metadata |
| `research.fetch.redirects` | Resolve and record redirect chains |
| `research.fetch.etag` | Use ETag and Last-Modified for conditional fetch |
| `research.fetch.sitemap` | Discover declared sitemap URLs |
| `research.fetch.robots` | Interpret robots exclusion rules for automated access |

### Page interpretation

| Block ID | Purpose |
|---|---|
| `research.parse.html` | Parse page structure and readable content |
| `research.parse.pdf` | Extract available PDF text and layout hints |
| `research.parse.markdown` | Parse Markdown and headings |
| `research.parse.json` | Parse bounded JSON documents |
| `research.parse.xml` | Parse bounded XML documents |
| `research.parse.code` | Tokenize source-code snippets and file refs |
| `research.parse.tables` | Extract tables with row/column metadata |
| `research.parse.metadata` | Extract document title, authors, and dates |

### Extraction and structuring

| Block ID | Purpose |
|---|---|
| `research.extract.claims` | Extract atomic factual claims with source spans |
| `research.extract.links` | Extract page references and link relations |
| `research.extract.versions` | Extract version numbers and compatibility notes |
| `research.extract.methods` | Extract documented procedures and requirements |
| `research.extract.errors` | Extract reported failure symptoms and codes |
| `research.extract.entities` | Extract named products, components, and APIs |
| `research.extract.quotes` | Capture short attributable source excerpts |
| `research.extract.data` | Extract typed numeric and categorical evidence |

### Follow-up navigation

| Block ID | Purpose |
|---|---|
| `research.follow.citation` | Open cited references from selected result |
| `research.follow.primary` | Trace secondary claims back to primary source |
| `research.follow.issues` | Follow issue, pull-request, and commit references |
| `research.follow.docs` | Follow API pages and documentation hierarchy |
| `research.follow.version` | Open release/tag-specific source |
| `research.follow.author` | Inspect publisher provenance where allowed |
| `research.follow.related` | Follow on-topic related links |
| `research.follow.counterclaim` | Follow contradictory evidence sources |

### Evidence analysis

| Block ID | Purpose |
|---|---|
| `research.evidence.compare` | Compare claims across sources |
| `research.evidence.conflicts` | Detect explicit disagreements |
| `research.evidence.correlate` | Relate sources to subclaims and open questions |
| `research.evidence.relevance` | Assess relevance to user objective |
| `research.evidence.reproduce` | Find testable verification steps |
| `research.evidence.timeline` | Order dated events, versions, and changes |
| `research.evidence.coverage` | Identify unverified parts of research objective |
| `research.evidence.confidence` | Rate evidence strength with explanation |

### Research memory

| Block ID | Purpose |
|---|---|
| `research.memory.record` | Persist accepted evidence with provenance |
| `research.memory.reject` | Record rejected or low-quality candidates |
| `research.memory.cite` | Bind claims to source locations |
| `research.memory.sourcehash` | Hash retrieved content for change detection |
| `research.memory.link` | Store provenance parent-child edges |
| `research.memory.snapshot` | Preserve bounded research state and history |
| `research.memory.search` | Retrieve relevant previously saved evidence |
| `research.memory.expire` | Mark stale cached evidence for re-check |

### Reporting and verification

| Block ID | Purpose |
|---|---|
| `research.report.outline` | Build outline from covered claims |
| `research.report.citations` | Prepare precise, attributable citations |
| `research.report.uncertainty` | Describe unknowns and conflicting evidence |
| `research.report.delta` | Summarize what changed since earlier research |
| `research.report.trace` | Show evidence path through research steps |
| `research.verify.requirements` | Check objective and requested constraints |
| `research.verify.unsupported` | Flag claims without supporting evidence |
| `research.report.answer` | Prepare grounded research answer or handoff |

### Agent decision and execution

| Block ID | Purpose |
|---|---|
| `research.agent.discover` | Return short compatible next-block suggestions |
| `research.agent.inspect` | Inspect exact block contract before use |
| `research.agent.execute` | Execute approved typed research block |
| `research.agent.observe` | Summarize actual tool result and gaps |
| `research.agent.branch` | Choose conditional next operation from observation |
| `research.agent.replan` | Change approach after unsuccessful evidence |
| `research.agent.stop` | Stop when evidence suffices or budget exhausted |
| `research.agent.resume` | Restore research after cancellation/restart |

### Guardrails and privacy

| Block ID | Purpose |
|---|---|
| `research.guard.robots` | Enforce robots policies when crawling |
| `research.guard.domain` | Apply private-network and hostname restrictions |
| `research.guard.permission` | Check network/search/scrape user permissions |
| `research.guard.injection` | Treat page instructions as untrusted data |
| `research.guard.secrets` | Redact credentials from logs and model context |
| `research.guard.ratelimit` | Obey provider and host rate limits |
| `research.guard.budget` | Enforce step, time, token, and byte budgets |
| `research.guard.policy` | Apply source access, terms, and licensing checks |

### Resource and document scopes

| Block ID | Purpose |
|---|---|
| `research.scope.site` | Constrain research to named site |
| `research.scope.repo` | Constrain to trusted repository/project |
| `research.scope.document` | Constrain to named document and its references |
| `research.scope.version` | Constrain to named runtime or release version |
| `research.scope.language` | Prefer specified language without mistranslating |
| `research.scope.date` | Constrain by publication/observation date |
| `research.scope.platform` | Constrain to system or device platform |
| `research.scope.sources` | Constrain to user-selected local Sources |

### Quality and repair

| Block ID | Purpose |
|---|---|
| `research.quality.fetch` | Diagnose inaccessible or failed fetch |
| `research.quality.parse` | Diagnose parse errors or encoding issues |
| `research.quality.citation` | Check citation resolves to correct passage |
| `research.quality.bias` | Warn about single-source and selection bias |
| `research.quality.staleness` | Warn when fetched material may be outdated |
| `research.quality.mismatch` | Detect source-version or target mismatch |
| `research.quality.hallucination` | Flag unsupported model-generated assertions |
| `research.quality.repeat` | Avoid duplicate unproductive searches |

### Knowledge graph

| Block ID | Purpose |
|---|---|
| `research.graph.entity` | Create typed entity with source provenance |
| `research.graph.claim` | Create claim node with evidence links |
| `research.graph.source` | Create canonical source node |
| `research.graph.references` | Link citing and cited documents |
| `research.graph.conflicts` | Add contradictory-claim relations |
| `research.graph.expands` | Expand related entities within budget |
| `research.graph.query` | Query stored evidence relationships |
| `research.graph.export` | Export grounded source/claim graph |

### Specialized content checks

| Block ID | Purpose |
|---|---|
| `research.special.api` | Validate API signature against version |
| `research.special.package` | Verify package identity and provenance |
| `research.special.performance` | Check benchmark comparability and environment |
| `research.special.security` | Find advisories and mitigation applicability |
| `research.special.license` | Read primary license text and obligations |
| `research.special.protocol` | Compare behavior to primary protocol spec |
| `research.special.tutorial` | Validate documented steps against target |
| `research.special.example` | Check reference examples for reproducibility |

## 13. Native integration with existing Solarium work

- Retain existing `SpicaBlockDefinition`, `SpicaGraph`, `SpicaService` and proposal-based transactions from the first blueprint.
- The **Research Source** and **Claim** models complement Project Sources and Chat Sources; do not inject whole saved libraries into prompts.
- Use the single canonical event protocol recommended in `Solarium Debugging and Fix.txt`; tool progress must correspond to actual operations.
- Capability detection for available models should decide whether a local Spark can call tools natively. Use a validated UI/manual fallback if a selected model cannot.
- Native `llama.cpp` streaming remains untouched; research tools execute around inference and report evidence to the next model turn.
- Python may parse, extract, rerank, and deduplicate if that helps, but it does not magically accelerate llama.cpp token generation.
- Glitch remains the extension path for novel parsers or specialized algorithms, subject to review/testing.

## 14. Standards and source links

- JSON Schema 2020-12: https://json-schema.org/specification
- Tool discovery with pagination, MCP spec as design inspiration: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- RFC 9309 robots exclusion: https://www.rfc-editor.org/rfc/rfc9309
