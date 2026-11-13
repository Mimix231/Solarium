# Phase 08 — Evidence-Driven Research and Authoritative Tool Discovery

**Canon checkpoint:** Solarium/SPICA Phase 07 TypeScript-fixed ZIP.  
**Implemented:** 12 November 2026.  
**Scope:** Tool registration/discovery correctness, one canonical graph-read operation, evidence-driven public-web research over the existing conversation provider, Source persistence, Spark routing, and focused regression tests.

## The user-visible failure addressed

The Spark called `inspect_spica_tool` with `name: "spica.runtime.ui_list"` and received `UNKNOWN_TOOL`. This is not evidence that the block is absent: `spica.runtime.ui_list` is an **executable block ID**, not a callable function name. A Spark must distinguish functions from values before composing calls.

Implemented:

1. `inspect_spica_identifier({id})` classifies an ID as a callable tool, executable block, unknown block, or unknown identifier; returns the correct next inspector and exact argument names.
2. `list_solarium_tools({offset?,limit?,query?})` reads **all actual central registry definitions**, page by page, shows required argument names, current callability, and whether more pages exist. The default page size is 60; use `nextOffset` until `hasMore=false`.
3. `inspect_solarium_tool({name})` reads the authoritative, current central tool schema, including tools outside SPICA.
4. `inspect_spica_tool({name})` specifically reports `BLOCK_ID_NOT_TOOL` for a `spica.runtime.*` ID submitted as a callable function name. It directs the Spark to `inspect_spica_runtime_block({id,version})` instead.
5. `read_spica_graph({view:'schema1'|'v2'|'both'})` replaces the separate V2 read declaration and the active V2 read dispatch. `read_spica_v2_graph` is **not registered**. By default schema-1 responses stay small; `view:'v2'` returns the typed graph, revision, diagnostics and current-origin check. This is an intentional consolidation rather than a runtime capability change.
6. New SPICA research tools are included in the existing coding-tool definitions, and those definitions are included in the central `engine/tools.ts` registry. Network research dispatch is handled before generic coding dispatch. `engine/action-permissions.ts` protects network and project/source actions.
7. Research action routing honors exact tool contracts and permissions. An approved source-save call is not suppressed by the general research tool-selection sequence.

## Ten evidence-oriented research operations

| Callable function | Meaning | Network? | Modifies project? |
|---|---|---|---|
| `spica_research_status` | Read research status, remaining budgets and observations | No | No |
| `spica_research_search` | Search public sources with explicit provider selection | Yes | No |
| `spica_research_read` | Retrieve actual page text, paged with `offset` | Yes for unread sources | No |
| `spica_research_links` | List URLs found in a previously read source | No | No |
| `spica_research_follow` | Follow an *actual returned* reference URL | Yes | No |
| `spica_research_compare` | Compare retrieved passages, hashes and version mentions | No | No |
| `spica_research_claim` | Estimate lexical evidence overlap without asserting truth | No | No |
| `spica_research_next` | Rank feasible next actions from observed results | No | No |
| `spica_research_save` | Save real retrieved text/provenance into project Sources | No | Yes, requires write permission |
| `spica_research_stop` | Stop this run and block more network calls | No | No |

Research uses the established `ConversationResearch.run` and public HTTPS reading provider. No new uncontrolled search backend was introduced. The user Web Search toggle remains authoritative. Public fetched text is untrusted evidence, never executable instructions. Provider fallback is *explicit*, not automatic in SPICA research calls. Reference following only accepts links discovered on a read page, not arbitrary URLs the model invents. Read/search budgets are intentionally bounded.

`spica_research_claim` returns `unverified` with short matched passages, source URL, content hash and retrieval time. This is intentionally not a truth-certification system. Version mention mismatches are warnings requiring human/model analysis, not proof of incompatibility.

## How a Spark should use this

1. List actual tool names with `list_solarium_tools`, or inspect an ambiguous ID with `inspect_spica_identifier`.
2. Inspect the required tool schema (`inspect_solarium_tool` or `inspect_spica_tool`).
3. For a block, call `inspect_spica_runtime_block` with its **ID as an argument**, not as a tool name.
4. Read app graphs with `read_spica_graph({view:'v2'})` when composing V2 blocks.
5. For research, call `spica_research_next` to inspect gaps, then choose exact `spica_research_search`/`read`/`links`/`follow`/`compare` calls based on observed source IDs.
6. Before a project-changing call, inspect and run the existing `check_spica_tool_call` preflight with exact arguments. Do not silently normalize invalid tool arguments, retry a failed action or invent a success result.

## Changed source areas

- `src/spica/tools.ts`, `src/spica/tool-intelligence.ts`: canonical graph reader and registry introspection; research stage selection; exact parameter metadata.
- `src/spica/research-tools.ts` (new): ten callable operations, permission-conscious dispatch and provenance-bearing results.
- `src/spica/research-run.ts`: observation-driven research, evidence comparison, explicit sources, budgets and cancellation.
- `src/research/conversation.ts`: retains the one existing research run and conversation evidence integration.
- `src/engine/tools.ts`, `src/engine/action-permissions.ts`, `src/engine/agent.ts`, `src/engine/live-workspace.ts`: central registry/dispatch, permission gates, task routing and activity labels.
- `src/components/SpicaResearch.tsx`: surface the next observed-evidence action.
- `tests/spica-phase08.test.cjs`, `scripts/check-spica-phase08.cjs`, `package.json`: focused validation and invocation.
- Prior phase test fixtures updated for registration imports and canonical read name.

## Validation and release gates

The Phase 01–07 suites continue to pass; Phase 08 includes a controlled fake public-web provider fixture to verify search, read, links, follow, compare, claim, Sources persistence, explicit provider behavior, cancellation, URL restrictions, and the distinction between block identifiers and callable tool names. The frontend/source registry and `src/spica/target` source files remain intact.

**What is NOT verified:** full frontend Vite/TypeScript compilation, Linux/Windows Tauri native builds, real external search provider availability, actual GGUF/Dona end-to-end behavior, and standalone V2 graph export. The container does not have installed frontend project dependencies or the Rust/Windows toolchain. Successful focused tests are not a substitute for those release gates.

**No misleading claims:** A 350,000-entry proposed category capacity is not 350,000 executable blocks. The implementation retains **26 legacy adapters and 103 registered executable V2 blocks** (plus metadata-only drafts). No feature-specific automatic app builder has been introduced.
