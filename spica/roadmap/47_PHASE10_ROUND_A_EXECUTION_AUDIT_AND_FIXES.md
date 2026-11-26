-# SPICA Phase 10 — Round A: Agent Execution and Tool-Contract Audit

**Implementation status:** Round A source corrections complete; focused regression and registry tests passed. **Not** a certified Windows/Tauri or real-GGUF release. No Round B–G functionality was implemented by this round.

**Source baseline:** `Solarium_Phase10_TS1117_TS2339_Fixed.zip` (116 V2 runtime implementations, 26 legacy modules). Earlier `Solarium[Bak].zip` and `Solarium[Bak](1).zip` were used to trace the evolution of the agent loop.

## Actual root causes found

| Issue | Verified source evidence | Round A correction |
|---|---|---|
| Fatal `Unknown edit operation in scoped contract` | `spicaScopedEditParameters()` threw when handed unverified operation names; `runAgent()` populated `spicaEditScope` from the model's inspection arguments without checking the returned contract | `verifiedSpicaEditScope()` and `editScopeFromArguments()` validate exact operations and graph format before scoped schema generation; an invalid inspection is a structured failed result. A broken scope can never throw out of the agent's tool selection path. |
| Inspector falsely approves nonexistent edit | `inspect_spica_tool` / `inspect_solarium_tool` could return a generally successful inspector envelope even when their nested edit-operation contract was invalid | Both inspector routes return `{ok:false,code:'UNSUPPORTED_EDIT_OPERATION',allowedOperations,...}` without mutating or authorizing anything. `inspect_params` exposes a consistent `ok` and explicit invalid-operation diagnostic. |
| Missing V2 leads to repeated composition errors | The `selectSpicaTools()` Compose path offered unrelated inspectors and validation while a V2 projection was absent | Missing-V2 state prioritizes `spica_next_action`, `inspect_spica_tool`, `check_spica_tool_call`, and `read_spica_graph`. The existing registered `migrate_spica_v2_graph` can be reached after exact inspection/preflight. Actual graph edits still use **only** `edit_spica_graph`. Renaming/unifying all other V2-prefixed tools is reserved for Round C rather than being slipped into this audit. |
| A failed tool is withheld even after arguments are corrected | The selection filter used `name !== state.suppressedTool`, blocking an entire callable API rather than just the known-invalid invocation | Corrected proposals remain eligible under the same registered tool. Exact argument validation and permissioned preflight still prevent invalid/unapproved writes; no hidden tool retries were added. |
| Failed tool preflight consumes the whole local 4K context | `check_spica_tool_call` returned the entire `edit_spica_graph` schema union (schema-1 and V2) after any error | Rejections now return required keys, accepted keys, graph view, an exact operation schema when recognized, or a short list of allowed operations. Full contracts remain discoverable by explicit inspection. |
| Successful execution misreported as source progress | Every successful SPICA mutation, including a graph run or export, reset stalled inspection/failure history | The tracker now clears only when the persisted task's **verified graph change count increases** against the authoritative repository. A run/verification cannot falsely count as an edit. |
| Diagnoses lost when model stops producing tools | A general `paused` reason replaced the specific latest failure and a canned message replaced the previous response | Pause state retains the exact last diagnostic. UI status now contains the graph revision, verified changes, next unfinished stage, next registered operation to inspect, and the actual diagnostic. It **does not claim task completion** or trigger an artificial new inference stream. |
| SPICA name parsing depended on Dona | `spicaActionText()` explicitly stripped `dona` as the only named persona | Generic vocative parsing handles different Spark names while retaining non-build requests and ordinary leading verbs. No SPICA runtime feature is tied to any Spark identity. |
| Tool activities and stages were unclassified | Five callable SPICA tools lacked `workKindForTool` entries; `inspect_spica_target` lacked a toolchain stage entry | Filled missing classifications; tests ensure declaration coverage. |

## Tool registry/permission audit

Run `node scripts/audit-spica-phase10-roundA.cjs` to reproduce the generated `46_PHASE10_ROUND_A_REGISTRY_AUDIT.json` inventory. It tracks **100 distinct callable tool declarations** across SPICA, SPICA research, coding, knowledge and base utilities. The SPICA subset has **34 registered callable names**, all with source-level dispatch, work activity and toolchain-stage mappings. It checks canonical `read_spica_graph` / `edit_spica_graph`, direct write/check permissions, `...spicaTools` registration in the coding dispatcher, and schema guards. It statically validates **68 literal required-parameter declarations**; **30 dynamic/nonliteral declarations require runtime/type tests**. These numbers refer to *tools*, not the 116 executable blocks.

**Important limitation:** Static source coverage cannot prove that every handler implements every optional argument, nor that a GGUF model will select the correct call. Round C must finish the handler-by-handler argument audit; Round E covers alias and failure-diagnosis expansion. There is **no claim** that Round A created every imaginable operation.

## Regression tests added/updated

`tests/spica-phase07-tools.test.cjs` now validates:

1. An unknown `v2` edit operation cannot crash tool selection, inspector preflight, or fall through as a successful operation.
2. Missing V2 prevents premature `validate_spica_composition` while exposing a legitimate migration prerequisite through the existing registered tools.
3. `check_spica_tool_call` rejects malformed `edit_spica_graph` arguments with a **compact** response under 3.8K characters, rather than a giant unfiltered JSON union.
4. A corrected `edit_spica_graph` call remains possible after an earlier invalid call with the same *tool name*.
5. Different Spark addressees (Dona, Astra, Orion) are handled by the same generic instruction classifier.

An obsolete Phase 9 assertion that specifically required **global tool-name withholding** was replaced with a regression expectation forbidding that deadlock. The new behavioral test above verifies the corrected tool remains available. This is a defect repair, not a test bypass.

## Preserved invariants

- One registered graph editor `edit_spica_graph`; one graph reader `read_spica_graph`. No `edit_spica_v2_graph` alias/dispatcher.
- Original SPICA block sources and curated runtime aliases unchanged; **one file per block** in `src/spica/runtime/blocks/`.
- Permissioned preflight, Ask/Auto/YOLO, project scoping, Web OFF, versioned graph transactions, user Stop/Cancel preserved.
- Inference still makes one `adapter.generate()` stream per normal assistant turn, reuses the selected model, and never synthesizes another turn just to extend reasoning.
- A naturally ending model response with unfinished work still produces a **saved resumable task**, not a verified completion. Round B (independent Thought Blocks) is required before autonomous thought-boundary continuation can be tested.

## Checks run

- Phase 01–10, Phase 9.5, reliability, contract and block-unification suites: passing in the source working tree.
- SPICA registries: 26 schema-1 source modules, 116 executable V2 block modules.
- 450 TS/TSX files: syntax parsed. New edit schema and validator: strict targeted TypeScript compilation passed.
- Registry/permission/static handler audit: passing, 100 declared tools identified.
- `npm run check`: blocked at missing frontend dependency precheck. `npm test`: TypeScript cannot resolve missing installed frontend/native packages. This is an environment validation gap, **not** a green full build.
- Real local GGUF, GUI smoke test, Vite build and native Windows/Tauri checks: not executed in this environment.

## Next implementation round

**Round B:** independent action-focused Thought Blocks, durable evidence/checkpoints, actual per-thought 4,096-token accounting and robust resume semantics. Do not implement Round C's broad new argument/graph operation contracts or Round D's dozens of runtime blocks accidentally as part of Round A. Do not advance Phase 11 while Phase 10 acceptance remains unmet.
