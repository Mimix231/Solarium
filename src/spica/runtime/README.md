# SPICA Graph V2 — Phase 04 executable block runtime

This folder contains a **bounded, permission-checked executable graph engine**. It is independent of the schema-1 program exporter, the 26 schema-1 source adapters, the 350K proposed descriptor catalog, and the future production app renderer.

## Source ownership

| Source | Responsibility |
| --- | --- |
| `adapter.ts` | `SpicaBlockAdapter`, typed port and target contracts, `defineRuntimeBlock` validation |
| `./blocks/<category>/runtime/<block>.ts` | Exactly one built-in implementation per file, including config validation and execution |
| `registry.generated.ts` | Generated static import list; do not edit |
| `registry.ts` | Exact `id@version` runtime lookup; refuses duplicate registration |
| `executor.ts` | Validated topological order, event routing, feedback limits, cancellation, traces and transactions |
| `permissions.ts` | Built-in trust restriction, target checks and explicit grant broker |
| `store.ts` | Test/development transactional memory store; **not durable storage** |
| `value.ts` | Runtime type checks and result serialization/size checks |
| `trace.ts` | Real execution evidence and summary contracts |

Create a new adapter as `./blocks/<category>/runtime/<block-name>.ts`, **one `export default defineRuntimeBlock({...})` per file**. The filename must match the suffix of the `spica.runtime.*` ID, replacing underscores with hyphens. The `id`, `version` and `trust` properties must be literal strings for static registration checking. The checked-in runtime registry is regenerated using `npm run spica:runtime:registry` and checked using `npm run spica:runtime:registry:check`. Categories are directories; further nesting is supported.

## Spark and Solarium integration

`src/spica/tools.ts` exposes `list_spica_runtime_blocks`, `inspect_spica_runtime_block`, and `run_spica_v2_graph`. Sparks can read the exact port contracts and issue `edit_spica_v2_graph` mutations at the latest graph revision. `run_spica_v2_graph` emits actual trace events via the existing execution output callback, which the live workspace categorizes as an execution. Runtime commands never claim standalone export, materialized MUI controls, or durable records.

The runtime rejects forged port types, unknown adapter IDs/versions, placeholders, unauthorized permissions, incompatible targets, invalid output values, unbounded event cycles, excessive feedback and result sizes. A failure/cancellation rolls back staged writes. This in-process engine accepts **only trusted source-controlled built-in adapters**. Do not execute downloaded/community TypeScript in this context; Phase 12 will need a separate isolated trust model.

### Running a graph

1. `create_spica_app` if the project has no graph, or `read_spica_graph` to obtain its current revision.
2. `migrate_spica_v2_graph` (read-only, non-destructive schema-1 projection) if no V2 graph exists.
3. `list_spica_runtime_blocks` and `inspect_spica_runtime_block` to obtain exact registered signatures. Never guess block names or port shapes.
4. `edit_spica_v2_graph` to add typed runtime nodes with matching signatures, config and edges; use the revision returned by each edit batch.
5. Approve required permissions through the existing project grant flow; `run_spica_v2_graph` does not elevate grants.
6. `run_spica_v2_graph` with current revision and `target: "desktop" | "web"`. Inspect the `state`, trace, error and `committed` fields; never infer success from a prose answer.

The built-in notes scenario in `tests/spica-phase04.test.cjs` shows the executable data → predicate → event → transactional storage → UI-model path. The UI-model block returns **data**; a materialized MUI app is a later-phase capability.

## Resource boundaries

- Maximum 1,024 operations per run (default 256).
- Maximum 100 feedback rounds (default 32) and every feedback edge has a finite iteration budget.
- Maximum 1,024 retained trace entries, output clones at most 128 KB per value, and total returned node results 4 MB.
- Memory storage is transactional and isolated per invocation unless a trusted host explicitly injects an approved transaction store.
- On failure or cancellation, the transaction is rolled back. No subprocess, network or filesystem APIs are exposed through block context.

Run `npm run test:spica:phase04` to compile the runtime under strict TypeScript options and execute its focused contract tests. Continue running Phase 01–03 tests after runtime changes.

## Schema-1 tool-call compatibility fixes

`edit_spica_graph` `put_screen.fields` accepts `string[]` and safely normalizes keyed field objects from Sparks to IDs. It supports `screen.query` for list screens. It **does not silently create collection fields** when reading keyed screen references. Add new fields using `add_collection` for a new collection, or the typed `add_record_field` operation for an existing one. Exact duplicates are rejected atomically with an actionable field-key error.

Example of **valid schema-1 edit arguments** (assuming the current graph already contains collection `notes` and revision 10):

```json
{
  "revision": 10,
  "edits": [
    {"op":"add_record_field","collection":"notes","field":{"key":"body","label":"Body","type":"text"}},
    {"op":"put_screen","screen":{"id":"review","label":"Review","view":"list","collection":"notes","fields":["title","body"],"query":""}}
  ]
}
```

Use actual graph IDs and only fields that are not already present. Read the current revision and collection before editing. The current graph's own field validation remains authoritative.
