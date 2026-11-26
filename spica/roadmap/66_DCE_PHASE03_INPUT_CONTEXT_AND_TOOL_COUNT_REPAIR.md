# DCE Phase 03 — Input-context fitting and tool-aware token-count repair

Date: 2026-11-22. Base: `Solarium_DCE_Phase03_ContextRollover_2026-11-22.zip`.

## User-visible incident

A `4096`-token local llama.cpp reported an input-context error immediately after the native Notes Organizer inspection. The planning prompt was approximately `3262` tokens before accounting for one offered schema, while the existing fitter still required a separate `1638`-token response reserve. No writing tool was executed and the task was marked blocked. Earlier fixes had reduced repetitive reasoning but not the overlarge *mandatory* construction prompt.

## Confirmed defects repaired

1. `src/engine/construction/decision-context.ts`: `buildConstructionDecisionContext()` formerly packed a large, untrimmable collection of inspection metadata, checkpoint, verification history and prior diagnostic text into a single mandatory system message. The new handoff keeps brief verified facts and callable tool identity mandatory; detailed evidence is separately marked as optional and can be paged. The original unfinished task, latest request, Spark identity and user project instructions are never shortened.
2. `src/engine/agent.ts`: the initial `inspect_project` result can be generated before the model conversation's `tool` messages exist. Its verified snapshot now becomes the compact handoff's fallback observation.
3. `src/engine/context-window.ts`: when a 4K model cannot context-shift, the 40% response reservation was an inflexible minimum that blocked a valid instruction and a single real tool. Optional evidence is removed first; a *preferred* allowance can be reduced only when a meaningful >=512-token first-decision window remains. Truly impossible mandatory requests still block.
4. `src/engine/llama.ts` and `src/engine/backends.ts`: added optional exact, combined input-token accounting using newer llama.cpp's `/v1/chat/completions/input_tokens` endpoint. The request includes the exact offered schemas, merged system messages, and tool choice. The successful positive server count is not double-charged for tools. Older/invalid servers retain template+schema fallback. Zero counts from both the exact counter and older tokenizers are rejected.

## Safety and compatibility boundaries

- This changes **input preparation**, not generated output streaming. It does not split a reasoning response into multiple synthetic requests, restart the model, fabricate tool calls, skip permissions or treat a successful inspection as a file write.
- The full original task, latest user request, agent instructions, saved inspection/command logs and other evidence stay persisted. Optional evidence is pruned only from the temporary *next* model request.
- One actual registered tool stays advertised when an explicit source-building action requires it. Tool selection is still checked by the same permission-aware registry and executor.
- A finite 4096-context server with unsupported KV shifting still cannot deliver a literally infinite one-turn response. Completion depends on real GGUF/chat-template tool compatibility.

## Test strategy and observed results

- `tests/dce-input-context-recovery.test.cjs`: screenshot-size fixture, project-inspection handoff, mandatory identity and goal preservation, optional-evidence paging, 80 varied evidence sizes, exact token accounting, older-server fallback and zero-token safety.
- `tests/dce-inference-streaming.test.cjs`: full native request after prompt fitting, tool-call survival, input-token schema/request parity and explicit 404 fallback.
- `tests/dce-context-rollover.test.cjs` plus prior `tests/context-window.test.cjs`: compact prompt and classic inference compatibility.
- `scripts/prepare-dce-inference-tests.cjs`: compiles the dependency-free inference subset for `npm run test:inference:inputfix` even without the frontend dependency tree. The generated `.test-dist/` directory is omitted from the ZIP.
- Legacy phase and warehouse tests, permission-sensitive tool tests, TypeScript and source-registry checks remain required.

## Not a claimed live desktop release

Full frontend and Tauri builds require unavailable packages/toolchains in this sandbox. Real multi-step Notes Organizer construction with the user's actual GGUF is still the decisive acceptance test. Missing dependencies, timeouts and unexecuted GUI workflows must not be marked passing.

## Reproducible checks in this release

Run `npm run test:inference:inputfix` on a fresh archive extraction. It builds just the eight dependency-free TypeScript engine modules used by the tests, then runs all 42 context/streaming assertions. It does not require bundled `dist` files or the frontend packages.

Run `npm run test:construction:phase01`, `npm run test:construction:phase02`, `npm run test:construction:phase03`, `npm run test:tool:reliability`, `npm run spica:registry:check`, `npm run spica:runtime:registry:check` and `node scripts/check-syntax.cjs`. Run `npm run check`, `npm run lint` and the actual Windows/Tauri build after installing the missing dependencies on the user's workstation.

## Final archive QA evidence

| Check | Outcome |
|---|---|
| 4K input/streaming/context regression tests | 42/42 passed on clean extracted ZIP |
| DCE Phase 01 regression tests | 17/17 passed on clean extracted ZIP |
| DCE Phase 02 regression tests | 36/36 passed on clean extracted ZIP |
| DCE Phase 03 regression tests | 24/24 passed on clean extracted ZIP |
| Tool-contract/reliability tests | 16/16 passed on clean extracted ZIP |
| Legacy SPICA Rounds D / E / F | 11/11, 15/15, 13/13 passed |
| SPICA registries | 26 catalog source modules; 176 executable V2 adapters |
| Source syntax and strict source-block TypeScript | 584 files parsed; 42 source/contract modules checked |
| Frontend/npm check | BLOCKED: `react-markdown`, `remark-*`, `rehype-*`, `pdfjs-dist`, `mammoth`, etc. unavailable |
| Lint | NOT RUN: `eslint` unavailable (`127`) |
| Windows/Tauri and GGUF end-to-end | NOT VERIFIED: target system and live model unavailable |

The original baseline's 1,025 files are preserved byte-for-byte **except the documented modified source, test, and documentation paths**. Three new source/test/report files are present. The ZIP is validated for integrity and its contents are compared against a clean extraction. Local desktop inference is still the acceptance gate: the fix prevents the previously reported **INPUT** block; it cannot force a model whose own output budget is exhausted to produce a valid tool call.
