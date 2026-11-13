# SPICA follow-up — Unified blocks and nonterminal tool inspection

**Source base:** Solarium Phase 08 Research and Tool Registry (November 12, 2026).

## Root cause reproduced

A Spark inspected `spica.runtime.ui_markdown_editor` through `inspect_spica_tool(name=...)`.
This ID is an executable node ID, not a callable tool name. The inspector correctly returned
`BLOCK_ID_NOT_TOOL`, including `nextTool: "inspect_spica_runtime_block"`, but `src/engine/agent.ts`
marked *any* unsuccessful SPICA call as `taskBlocked` and terminated the task. The model never
received a useful next opportunity to use the supplied diagnostic.

## Implemented behavior

- `src/engine/agent.ts` preserves failed/denied evidence and the user's original goal. An
  unsuccessful inspection, preflight, graph validation, build command or node execution is **not
  automatically declared a terminal task failure**. The next LLM tool turn receives the actual
  failed tool result and diagnostic. No repair tool is run automatically.
- Tool selection recognizes `invalid_spica_tool` and offers `inspect_spica_identifier`,
  `inspect_spica_runtime_block`, and other bounded discovery tools. Actual graph-edit errors
  continue to provide graph inspection. Native build/verification failure retains its build
  diagnostics path.
- `inspect_spica_tool` explicitly states that its `name` accepts a **callable function** only.
  `spica.runtime.*` IDs are data passed to `inspect_spica_runtime_block({id,version})`.
- Permissions, preflight, project ownership and immutable runtime block IDs are unchanged.
  A user-denied permission is still blocked. An invalid call is not silently renamed,
  reinterpreted, retried or marked successful.
- If the model ceases issuing tool calls without verifying the requested work, Solarium
  continues to report the task as **incomplete**, not completed.

## One physical block source tree

- 26 legacy `defineSpicaBlock` source modules remain at `src/spica/blocks/<category>/<family>/`.
- 103 V2 `defineRuntimeBlock` source modules were moved into
  `src/spica/blocks/<category>/runtime/<family>/`. `visual-appearance` is the canonical category
  directory for former V2 `appearance` files; ID and contract values remain unchanged.
- `src/spica/runtime/blocks/` no longer exists. The runtime executor, validators, storage,
  permission checks, metadata and generated registry remain in `src/spica/runtime/`.
- The legacy generator ignores V2-only `runtime` subtrees and retains the original 26 contracts.
  The V2 generator scans only category runtime subtrees, with static validation and a checked
  generated import registry. No duplication and no runtime filesystem walks.

## Verification

Run in repository root:

1. `npm run spica:registry:check`
2. `npm run spica:runtime:registry:check`
3. `node --test tests/spica-block-unification.test.cjs`
4. `npm run test:spica:phase01` through `npm run test:spica:phase08`
5. `npm run check`, `npm run build`, and `cargo check` (when dependencies and Rust toolchain exist)
6. Real GGUF end-to-end: ask Dona to inspect a Markdown block, observe a wrong-namespace
   inspection if one occurs, then verify Dona can select `inspect_spica_runtime_block` and
   continue with graph composition in **the same original task**. No model/hardware execution
   is claimed from fixture checks.

**Limitations:** The focused tests and generated-registry checks validate source and contracts.
Native Windows, installed frontend packages, real chat-template behavior, and real app launch
require independent verification on the target machine.
