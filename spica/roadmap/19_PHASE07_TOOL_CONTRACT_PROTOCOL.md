# Contract-First SPICA Tool Protocol

This specification describes the implemented Phase 07 Spark-to-SPICA contract. It is not a prompt template substituting for registered tool implementations.

## 1. Source of truth

The `AgentToolDefinition.function.parameters` object for a registered tool is authoritative. `inspect_spica_tool` publishes that same schema through `spicaToolContract(...)`. `check_spica_tool_call` validates the proposed `arguments` against the same contract through `validateToolArguments(...)`; there is **no** second parallel “simple” schema and **no** argument alias or compatibility translation in `executeAgentTool`.

The schema can describe syntactic types only. Live graph semantics are checked separately with the existing `inspectSpicaParameters`, `reviewSpicaEdit`, and `previewSpicaComposition` implementation. The Spark must not invent IDs, types, nested keys, or permission grants.

## 2. Registered inspection tools

| Tool | Required arguments | Meaning | Writes? |
|---|---|---|---|
| `list_spica_toolchain` | none | List registered SPICA tool names, required keys, stages and prerequisites | No |
| `inspect_spica_tool` | `name` | Read exact schema; optional `operation` adds Graph V1 operation guidance | No |
| `inspect_spica_wiring` | `blockIds` | Inspect block port contracts and compatible type connections; optional `target` | No |
| `check_spica_tool_call` | `name`, `arguments` | Validate exact proposed call and current live graph prerequisites | No |
| `search_spica_runtime_blocks` | `query` | Search executable V2 adapters, not metadata-only catalog drafts | No |
| `inspect_spica_runtime_block` | `id`, `version` | Inspect exact block contract and config examples | No |
| `validate_spica_composition` | See `inspect_spica_tool` | Run V2 composition dry-run | No |
| `validate_spica_edit` | `revision`, `edits` | Run schema-1 atomic edit dry-run | No |

The other existing tool definitions remain discoverable through `list_spica_toolchain`; inspect them rather than copying example calls with unknown graph IDs.

## 3. Write/execute gating

- The model must inspect the exact target tool and preflight the exact `arguments`.
- The tool's current revision and environment prerequisites must agree with the in-memory graph; V2 nodes/port connections must pass typed validation.
- Action tools are stage-advertised only once preflight succeeds; the model's final actual arguments must match the validated canonical signature. No silent normalization.
- Ask/Auto/YOLO approvals and filesystem ownership remain separate and mandatory. The preflight does not grant permission.
- A failed/denied SPICA tool call stops the current attempt and preserves the actual diagnostic. It does not automatically build a starter app, mutate a feature by name, try another schema, or claim success.

## 4. Feature composition is not hardcoded

For a request to build a Recents page with a Markdown editor, the Spark must search for date, sort/filter, state/records, layout, and Markdown UI primitives. It must use actual returned block IDs, inspect their ports, construct typed node/connection IDs, validate the resulting graph, and execute the authorized composition. The words “Recents” or “Markdown” are **not** used as a feature-specific shortcut in request routing.

**Important boundary:** A V2 node graph that runs in the isolated executor and renders UI descriptors is not yet a standalone Tauri app. Do not claim an exported native app or durable SQLite persistence without real native export/build evidence.

## 5. Example sequence (operations, not invented arguments)

1. `list_spica_toolchain` — see available operations and prereqs.
2. `inspect_spica_tool({name:"search_spica_runtime_blocks"})` — discover exact `query` contract.
3. `search_spica_runtime_blocks(...)` — select only executable blocks.
4. `inspect_spica_runtime_block(...)` and `inspect_spica_wiring(...)` — gather actual typed ports and candidates.
5. `inspect_spica_tool({name:"validate_spica_composition"})` and dry-run composition.
6. `inspect_spica_tool({name:"compose_spica_v2_graph"})`, then `check_spica_tool_call({name:"compose_spica_v2_graph",arguments:...})` with *exact final arguments*.
7. `compose_spica_v2_graph(...)` only if preflight passes and permissions allow.
8. Repeat inspect/preflight for `run_spica_v2_graph`, then invoke it and inspect real trace/output.

## 6. Acceptance tests

- `scripts/check-spica-phase07.cjs` runs the tests for source-defined registered blocks, real schema inspection, exact parameter preflight, wrong-argument rejection, revision checks, type-compatible wiring, atomic composition execution, routing, and negative fallback assertions.
- The test suite verifies no `normalizeSpicaProposal` path remains in the agent/execution layer, and no `buildSupportedSpicaTemplate` / `runSupportedSpicaChange` shortcut is invoked.
- The preserved Phase 1–6 suites check compatibility with existing graph, exports, preview and permission contracts.
