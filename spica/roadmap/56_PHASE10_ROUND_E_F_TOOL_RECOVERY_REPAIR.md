# SPICA Phase 10 — Round E/F Tool Recovery Repair

**Date:** 2026-11-15  
**Source:** `Solarium[Bak](2).zip` (user-supplied canonical archive)  
**Scope:** execution/selection regressions, independently checkpointed Thought Blocks, and focused regression coverage. No migration or rewrite of existing project graphs.

## Verified defects addressed

1. **Preflight/inspector deadlock** — `runAgent()` rejected a valid registered `check_spica_tool_call` when there was no immediately previous inspector result. The preflight itself already validates the authoritative contract and project revision. A correctly approved call now permits the next *matching* tool submission, still subject to existing permission and graph guards.
2. **Alias identity mismatch** — when the Spark preflighted a reviewed alias (for example `edit_graph`), the agent stored that alias as the approval name while the executor advertised the canonical tool (`edit_spica_graph`). The agent now canonicalizes both target name and arguments before hashing the approval signature and setting the applicable edit scope.
3. **Approved tool lost to paging** — the construction coordinator could prioritize source tools over the single approved graph operation. The exact approved graph action now survives the next turn of tool selection.
4. **Unknown-check-target loop** — an invalid preflight target previously led back to repeated generic inspection/preflight. A rejected preflight now retains its real `code`, `message`, and errors, and routes to registered discovery without offering the identical malformed check as the next action.
5. **Losing successful inspection evidence** — several failed preflights could consume all three retrieved Thought Block evidence slots. Retrieval now reserves a slot for an actual successful graph/capability observation when available. Oversized successful graph results are compacted around verified revision, collection, screen and node/block identities before storage in the short Thought Block record; full results remain available in the original archive.
6. **Unused implicit starter build** — removed `src/spica/agent-build.ts`, which had no imports or runtime callers and conflicted with the explicit-tool-only invariant.

## Files changed

- `src/engine/agent.ts` — canonical preflight approvals; exact diagnostics; no mandatory extra inspector before a validated operation.
- `src/spica/tools.ts` — actionable composition and recovery tool selection, with operation-scoped contracts.
- `src/spica/construction-coordinator.ts` — approved graph action cannot be paged away.
- `src/engine/intelligence/spark-thought.ts` — bounded, verified result carryover and oversized-evidence summaries.
- `src/spica/agent-build.ts` — obsolete, unreferenced source removed.
- `tests/spica-phase07-tools.test.cjs` — new preflight/selection regression tests.
- `tests/spica-phase10-roundE.test.cjs` — regression tests for overflowed failure evidence, graph IDs, and action paging.
- `tests/spica-phase07.test.cjs`, `tests/spica-block-unification.test.cjs` — update old source-only assertions to preserve the stronger canonicalized contract and corrected recovery route.
- `AGENTS.md` — maintainers' invariants.

## Compatibility and safety

- Only registered tools remain callable; runtime block IDs remain argument data, not tool identifiers.
- The canonical `edit_spica_graph` editor and matching review/revision requirements remain intact.
- No silent retries, no unapproved source writes, no permission bypass, no fabricated successful build result.
- llama.cpp inference output limits, model reuse, and streaming are unchanged.
- The original precompiled `dist/` frontend assets were preserved. **Those assets are not a rebuilt proof of this source patch.** Rebuild with the project's installed dependencies before shipping a desktop binary or hosting the static frontend.

## Validation

The available source-level and phase-specific checks were run against the repaired source. Newly added regression tests cover the exact misrouting reproduced in the user screenshot. The registry checks verify 26 schema-1 block modules and 166 executable V2 modules.

This test environment does **not** have the npm frontend dependencies installed and cannot reach `registry.npmjs.org`, so `npm run check`, `npm run build`, and complete native desktop acceptance cannot be truthfully marked as passing here. `npm run check` stops in `precheck` with missing `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-highlight`, `highlight.js`, `katex`, `pdfjs-dist` and `mammoth`. On a configured development machine, install from the committed lockfile (`npm ci`), run `npm run check`, `npm run lint`, `npm run build`, and validate a real Notes Organizer change through inspect → discover → preflight → edit → verify. Repaired source checks are not a substitute for that end-to-end acceptance.
