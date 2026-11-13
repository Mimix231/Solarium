# Phase 09 Hardening Checkpoint — Tool Contract Intelligence

Status: **Implemented and focused-test validated. Phase 10 is NOT started.**

## Why this checkpoint exists

Dona repeatedly submitted `inspect_spica_tool` calls containing an `arguments` property, although the advertised inspection tool initially accepted only `name` and `operation`. Invalid calls were rejected repeatedly while unrelated successful searches reset the repeated-failure counter. The UI then showed many tool operations even though the project was unchanged.

This update fixes the contract boundary rather than hiding failed calls, inventing a new feature-specific builder, or silently retrying commands.

## Implementation architecture

- `src/engine/intelligence/tool-contract-intelligence.ts` owns `ToolContractRegistry`, `ToolSchemaProvider`, `ToolCallValidator`, `ToolExecutionCoordinator`, `ToolDependencyGraph`, and `AgentProgressTracker`.
- `ToolContractRegistry` indexes **the very tool declarations provided to the model** and rejects duplicate names, unknown required fields, and non-strict top-level argument schemas.
- `ToolSchemaProvider.expose()` returns the exact, registered definitions for the current inference stage, without copying or modifying argument keys.
- `ToolCallValidator.check()` validates the model's proposed JSON against those same declarations. `ToolExecutionCoordinator.prepare()` enforces the registered contract before `executeAgentTool` dispatches. **It does not grant permissions or invoke the tool by itself.**
- `ToolDependencyGraph` exposes registration-backed named prerequisite relationships for SPICA writes, graph migration/composition, execution and exports. These are recommendations, never implicit execution.
- `AgentProgressTracker` identifies repeats of the **same structural error** even when the model changes otherwise irrelevant argument values. It also identifies three identical read-only tool calls without a verified project change. Merely listing tools or searching blocks cannot reset the failure history. A confirmed state-changing action clears the checkpoint; inspection of the suppressed tool's actual contract may allow a corrected call.

## Updated Spark tools

`inspect_spica_tool` now advertises an optional `arguments` object with a specific, read-only meaning: inspect a candidate argument object against the named tool's exact schema and return `candidateValidation`. It does **not** call or write to the named tool. For SPICA writes, `check_spica_tool_call` remains the required preflight stage and the existing permission broker remains authoritative.

`inspect_solarium_tool` can inspect a registered contract after `inspect_spica_tool` itself is withheld for repeated invalid calls. This makes an alternate inspection path available without silently rewriting arguments or bypassing source and filesystem permissions.

`list_solarium_tools` and `inspect_solarium_tool` resolve names and schemas from `ToolContractRegistry`, rather than an independent shadow schema. `list_spica_toolchain` and `inspect_spica_tool` provide corresponding dependency information.

## Concrete code locations

- `runAgent()` in `src/engine/agent.ts`: stage selection, model-facing schemas, argument validation, verified-state tracking, post-tool feedback.
- `executeAgentTool()` in `src/engine/tools.ts`: strict final pre-dispatch validation before normal authorization.
- `executeSpicaTool()` in `src/spica/tools.ts`: inspection, read-only proposed-argument review, graph-specific preflight, source-of-truth global inspection.
- `listSpicaToolchain()` and `inspectSpicaTool()` in `src/spica/tool-intelligence.ts`: registered prerequisite links.
- `validateToolArguments()` in `src/engine/intelligence/tool-validation.ts`: strict JSON-schema subset validation used by all above.

## Non-negotiable behavior

1. No invented, undocumented or executable block-ID tool names.
2. No hidden retries, automatic argument coercion, made-up project writes, or simulated build success.
3. No denied permission can be bypassed by a contract inspector.
4. Only actual permissioned writes/graph changes or verified execution evidence count as application-building progress.
5. A failed tool remains a visible failed tool; a repeated malformed inspection cannot occupy the entire action loop unchallenged.
6. The small model's native single-stream inference path, existing Sparks and project ownership rules are preserved.

## Tests and outstanding gates

Run `npm run test:spica:contracts` and the nine `npm run test:spica:phaseNN` scripts, `npm run spica:registry:check`, `npm run spica:runtime:registry:check` and `node scripts/check-syntax.cjs`.

Full frontend compilation, native Tauri build, and end-to-end real GGUF tool-selection behavior still need Windows verification with installed dependencies. Focused suites are **not** a substitute for those release gates.

### Regression scenarios

- Invalid `inspect_spica_tool.arguments` property is now an **advertised optional candidate-inspection input** (read-only and validated).
- Repeated invalid unknown properties still fail; changing values does not reset the same malformed-field failure.
- `check_spica_tool_call` rejects undocumented tool arguments before any write.
- Repeated identical discovery/search/inspect calls do not count as implementation progress.
- Different corrected parameters remain permissible; actual permissions and graph revision checks still apply.
- Graph-1 and Graph-V2 tools, all 129 registered block files and existing exports remain intact.

**Phase 10 must not be started solely because focused tests pass. Validate in the real Solarium desktop application first.**
