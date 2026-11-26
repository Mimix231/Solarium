# Phase 10 Round F — Tool-use and Work Log correction

## Reported regression

The Spark repeatedly submitted `check_spica_tool_call` without its mandatory `name`, resulting in `INVALID_ARGUMENTS`. The Work Log rendered the tool name in a one-character-wide column whenever an expanded JSON result competed for flex width. Earlier prompt instructions additionally demanded a full toolchain lookup and inspector on every mutation—even if the exact contract was already known.

## Implemented root-cause corrections

1. `src/components/WorkLog.tsx` and `src/themes/foundation.css`: tool operations use a minimum-width grid (`16px minmax(0,1fr) auto`), with result details on a separate full-width row. Long JSON remains scrollable. Adjacent identical failed activity entries are visually grouped with an accurate count, without changing archived results or the raw history.
2. `src/spica/tool-call-guidance.ts`: exposes a compact current-turn list of actual registered tools and required keys, as taken from the very definitions submitted to the inference backend. `check_spica_tool_call` receives its mandatory `{name, arguments}` shape and a verified illustrative target based on saved graph state. No guessed tool is executed or substituted.
3. `src/engine/agent.ts`: injects that live tool guide into the existing system context, preserves validation and permissions, retains exact invalid-call diagnostics, and changes recovery choices when a preflight is malformed. Old prompts forcing repeated inspectors were replaced with actionable, revision-aware guidance. Existing single-stream llama.cpp generation, model output settings, onion-skin checkpoints, and task persistence are unchanged.
4. `src/spica/tools.ts` and `src/spica/construction-coordinator.ts`: after a preflight is missing `name` or uses an unknown target, next actions prioritize registered tool discovery/graph state instead of reoffering the same preflight. `UNKNOWN_CHECK_TARGET` now returns a concrete registered-tool search path.
5. `src/spica/tool-aliases.ts`: reviewed parameter synonyms `tool`→`name` and `params`→`arguments` are normalized for `check_spica_tool_call` **even when that canonical tool name was used directly**. Unknown names and unrecognized extra parameters remain invalid. This translation happens before the same authoritative validator in both the agent and SPICA executor.

No new callable tools or `_v2` clones were introduced. The existing 166 executable blocks and 73 curated tool aliases remain intact.

## Verification

Run `npm run test:spica:phase10:loopfix`. This exercises the registered tool/port manifests, TypeScript syntax, Phase 7 exact tool contracts, Phase 9 sequencing, Phase 10 reliability, and Round F. The added Phase 7 regressions reproduce the missing `name` error, assert the corrected next tools, exercise the canonical parameter synonyms against the real handler, and guard against the Work Log width regression.

A full frontend Vite/TypeScript and native Tauri build still requires all declared dependencies and the target workstation. A live GGUF Spark run with its model-specific chat template is also not verified by isolated source tests. A finite-context LLM can still emit invalid arguments; this correction prevents the observed fixed loop and gives it the currently registered actionable contracts rather than pretending all model proposals are valid.
