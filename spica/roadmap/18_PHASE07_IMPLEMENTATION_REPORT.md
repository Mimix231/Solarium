# Phase 07 — Spark Block Assembly and Contract-First Tool Intelligence

**Canon checkpoint:** 2026-11-12  
**Source base:** Solarium SPICA Phase 06 — Professional UI and Live Preview  
**Implementation scope:** registered executable block growth, discoverable tool contracts, exact argument preflight, permissioned generic Graph V2 composition, and interactive Spica block-preview descriptors.

## Principle

A Spark must build requested software features by finding, inspecting, configuring, and composing **real reusable SPICA blocks**. A chat message such as “add a recent-items screen and Markdown editor” is a project action, **not** a trigger for a special case that directly inserts that feature. There is no feature-named request router, direct hardcoded Recents/Markdown graph-edit handler, automatic starter-app substitution, or retry/repair fallback when a submitted tool call fails.

This phase improves the *available contract information* before an action. It cannot guarantee that every local GGUF model will always choose the correct tool, generate a valid plan, or finish arbitrary applications; those require a real model and Windows runtime acceptance tests.

## Added or changed functionality

1. **103 registered executable V2 block adapters** (up from 14 in Phase 06), each stored in an independent TypeScript source file under `src/spica/runtime/blocks/<category>/<subcategory>/`. Blocks cover functions/text/numbers/arrays/dates, data/record operations, variables/state, UI descriptors, materials, layout, appearance, and workflow building primitives. All use generated registry manifests. The original **26 schema-1 source adapters** are unchanged.
2. **`list_spica_toolchain`** — discover names, required arguments, current project/graph prerequisites, and tool stages directly from the actual registered schema declarations.
3. **`inspect_spica_tool`** — inspect the authoritative JSON argument schema. For `edit_spica_graph` and `validate_spica_edit`, supply `operation` to see its live graph-specific allowed types, IDs, constraints, and example shape.
4. **`inspect_spica_wiring`** — inspect real V2 block port contracts, type-compatible connection candidates, and unfulfilled required inputs for 1–12 block IDs, before editing. Compatible ports are candidates, not an automatic graph design.
5. **`check_spica_tool_call`** — read-only exact-call preflight against the **same** tool schema the execution layer uses. It also checks current graph revision, prerequisites, Graph V1 edit semantics, and V2 composition semantics where relevant. A failed preflight does not change the graph or initiate automatic recovery.
6. **Permissioned action path** — after the model has inspected a tool and passed preflight with concrete JSON arguments, Solarium offers the action tool; the agent checks that its arguments still match the validated JSON signature and preserves Ask/Auto/YOLO permission and project-folder ownership. An invalid or failed SPICA tool stops the current attempt with the actual recorded diagnostic; no hidden retry or compatibility coercion.
7. **General-purpose Graph V2 composition** — search executable blocks, inspect exact port/config contracts, validate a proposed composition, atomically save the nodes/connections, and execute the registered graph through the Phase 4 runtime. The model must choose blocks and wire them; Solarium does not choose a feature implementation from the wording of the user's request.
8. **Workbench V2 descriptor preview** — the Workbench can show the Graph V2 block-descriptor preview with MUI-based presentation while preserving the existing schema-1 native graph preview and the centered Workbench overlay. It remains an isolated runtime rendering, **not** a claim that V2 has a native Tauri exporter.
9. **Source correction** — removed an obsolete `normalizeSpicaProposal` call in `src/engine/tools.ts` that could rewrite tool arguments after preflight; `src/views/Chat.tsx` now opens the centered Workbench for actual `compose_spica_v2_graph` and `run_spica_v2_graph` calls.

## Tool workflow

```text
User imperative inside an active SPICA project
  → classify as action, not discussion
  → list_spica_toolchain
  → inspect_spica_tool (exact action parameters)
  → search_spica_runtime_blocks / inspect_spica_runtime_block
  → inspect_spica_wiring (read-only)
  → validate_spica_composition (read-only)
  → check_spica_tool_call with the final exact composition arguments
  → permissioned compose_spica_v2_graph
  → inspect_spica_tool + check_spica_tool_call for execution
  → permissioned run_spica_v2_graph
  → return real output and limitations
```

Graph V1 editing uses the same tool-contract path, with `inspect_params` and `validate_spica_edit` for its operation-specific graph semantics. No mutation can be described as saved on the strength of a preflight response.

## Implementation-specific ownership

- `src/spica/tool-intelligence.ts` — prerequisite and schema discovery plus typed wiring inspection.
- `src/spica/tools.ts` — registered Spark tool declarations, strict preflight handlers, staged offering, Graph V1/Graph V2 authorization and execution.
- `src/engine/tools.ts` — schema validation using **unmodified** proposed arguments.
- `src/engine/agent.ts` — project-aware routing, exact preflight signatures, no automatic fallback, honest task-blocked states.
- `src/spica/intent.ts` — generic imperative-versus-discussion routing, no feature-name implementation selection.
- `src/spica/runtime/blocks/` — source-defined executable block adapters; `src/spica/runtime/registry.generated.ts` is generated.
- `src/spica/runtime/composition.ts` — validate candidate nodes and typed connections without writing.
- `src/components/spica/SpicaBlockPreview.tsx` and `SpicaLivePreviewPane.tsx` — descriptor preview, separate from native standalone export.

## Validated on this environment

- Phase 01: **12/12** focused tests.
- Phase 02: **9/9** focused tests.
- Phase 03: **12/12** focused tests.
- Phase 04: **14/14** focused tests.
- Phase 05: **10/10** focused tests.
- Phase 06: **7/7** focused tests.
- Phase 07: **13/13** focused tests, including five direct Spark tool-handler integration tests.
- **77/77 total focused tests**, as well as both deterministic registry-generation checks.
- **427 TypeScript/TSX source files** passed syntax parsing.
- Phase 07 runtime/introspection modules passed a focused strict TypeScript compile.

## Unverified release gates

This environment lacks installed frontend packages (`vite/client` types absent), so `npm run check`, full Vite production build and browser-based end-to-end Solarium UI validation are **not** passing release evidence. Native Rust/Tauri build and real Windows execution likewise require the user's toolchain. Spark behavior with the selected GGUF model must be tested locally: introspection improves determinism but cannot promise that the model will never make an invalid proposal. **Graph V2 standalone native export is not implemented in Phase 07.** These are explicit remaining gates, not successful checks.

## Rollback / next step

Rollback source is the Phase 06 canonical ZIP. Phase 08 may deepen evidence-backed web research with the same contract-first tools and explicit permission controls. Do not merge Graph V2 execution success with native app build verification.
