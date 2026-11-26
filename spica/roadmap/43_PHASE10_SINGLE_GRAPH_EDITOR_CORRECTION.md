# Phase 10 correction — One canonical `edit_spica_graph`

**Status:** Source integration implemented and targeted regression tested. This is a **Phase 10 correction**; it does not start Phase 10.1 or Phase 11.

## What was actually present in the user's uploaded archive

The uploaded `Solarium[Bak](1).zip` already contained an **initial** merge in `src/spica/tools.ts`:

- The old callable `edit_spica_v2_graph` no longer existed in the registered `spicaTools` list.
- `edit_spica_graph({revision,view:"v2",edits})` called `SpicaRepository.updateV2`, while omitted/`"schema1"` view called `SpicaRepository.update`.
- `validate_spica_edit` already supported both formats using one operation schema.

This correction **does not pretend to reintroduce an absent second tool**. It completes and hardens the existing merge, removes stale active guidance, and ensures dry-run, direct save and repository validation agree.

## One tool interface

```json
{
  "revision": 11,
  "view": "v2",
  "edits": [
    {
      "op": "add_block",
      "id": "recent_item",
      "blockId": "spica.runtime.note_record",
      "version": "1",
      "config": {"title": "Recent", "body": "Registered block"},
      "scope": "root"
    }
  ]
}
```

`view:"schema1"` (or omitted `view`) retains the legacy app edit operations. `view:"v2"` selects V2 operations, requires an existing migrated V2 graph and the current revision. **No legacy alias** has been added. `read_spica_graph` remains the single read API for schema-1 and V2.

**V2 operations supported by the canonical editor:** `rename`, `add_scope`, `remove_scope`, `add_node`, `add_block`, `remove_node`, `set_node_config`, `move_node`, `connect`, and `disconnect`. Up to 12 operations may be submitted atomically per call. `add_block` obtains ports from the real `spica.runtime.*` adapter, not invented JSON. Schema-1 and V2 still have separate persisted graph representations; arbitrary V2 graphs are **not** standalone app exports.

## Concrete changes

- `src/spica/graph-v2/edit-adapter.ts`: added `assertSpicaRuntimeNodeContracts(graph)` to validate typed port signatures and executable adapter `validateConfig` for all registered runtime nodes, not merely `add_block`.
- `src/spica/tools.ts`: V2 `reviewSpicaEdit` now applies both structural graph checks and executable-node config checks. `check_spica_tool_call`, `validate_spica_edit` and `edit_spica_graph` reject a V2 edit with a stale schema-1 migration origin (`STALE_V2_ORIGIN`) before allowing a save. Tool description no longer mentions the removed callable name.
- `src/spica/repository.ts`: both atomic `updateV2` and bulk `composeV2` enforce runtime node contracts before durable persistence. This rejects invalid `set_node_config` or forged ports even if a caller bypasses the chat inspector.
- `src/spica/inspect-params-v2.ts`: `set_node_config` is discoverable for existing editable nodes and continues to expose an operation-specific schema; returned examples are marked as templates requiring a genuine change and validation.
- `src/spica/runtime/README.md`: removed active instructions to call the deleted V2 editor and documented the canonical editor's `view:"v2"` contract.
- Deleted `src/spica/agent-build.ts`: dead, unreferenced starter-template fallback from an earlier phase. Existing Phase 3/7 tests explicitly required its removal; verified no active imports before deleting it. This prevents bypassing the Spark's real tool-selection flow.
- `scripts/check-spica-phase03.cjs`: includes the newly imported V2 adapter in its focused compiled fixture.
- `tests/spica-phase03.test.cjs`: added real repository persistence coverage for invalid registered runtime config.
- `tests/spica-phase95-unified-edit.test.cjs`: extended to test 10 V2 operations, preflight/save parity, single editor registration, CAS revisions, origin invalidation, atomic batches, typed ports and runtime config validation.

## Tool contract invariants

1. A single registered edit name, `edit_spica_graph`, is available to Sparks and the permission broker. Do not add `edit_spica_v2_graph` as a callable alias or compatibility function.
2. Schema-1 and V2 use the same outer arguments (`revision`, `view`, `edits`). The operation-specific structures are derived from `src/spica/edit-schemas.ts`, not separate hardcoded copies.
3. Dry-run is read-only. It must not claim an edit is safe if the current graph's schema-1 migration origin is stale or if registered executable node config/ports fail.
4. A failed batch cannot partially mutate the graph; the underlying repository uses revision and version CAS checks.
5. V2 graph writes are **authoring** results, not native application export evidence (`exported:false`).
6. Existing permissions, source ownership, task checkpoints and the one-file-per-block `src/spica/runtime/blocks/` hierarchy remain authoritative.

## Validation and remaining release gates

Run:

```sh
npm run test:spica:phase03
npm run test:spica:phase95
npm run test:spica:phase10
npm run test:spica:contracts
npm run spica:registry:check
npm run spica:runtime:registry:check
npm run check
```

The phase tests and registry checks have been exercised in the source environment; a full frontend build and live GGUF end-to-end interaction still require installed frontend dependencies and the Windows/Tauri runtime. **Do not claim native release readiness based only on these tests.**

## Acceptance test in the running application

1. Read `read_spica_graph({view:"both"})`; migrate once if the V2 graph is missing.
2. Use `search_spica_runtime_blocks` and `inspect_spica_runtime_block` to choose actual compatible ports/configuration.
3. Call `inspect_params({view:"v2",operation:"add_block"})` to discover required parameters.
4. Call `check_spica_tool_call` with `{name:"edit_spica_graph",arguments:{revision,view:"v2",edits:[...]}}`.
5. Call `validate_spica_edit` with identical inner arguments. Both preflights must agree.
6. Call `edit_spica_graph` once with the validated revision and V2 edits; confirm the persisted revision increased and only the V2 graph was changed.
7. Read again, connect typed ports through the **same** edit tool, and run supported V2 execution/verification. The Workbench must show actual evidence, not a simulated app export.
8. Verify a schema-1 edit through the same callable tool, using `view:"schema1"`, without confusing the V2 authoring graph with the standalone schema-1 exporter.
