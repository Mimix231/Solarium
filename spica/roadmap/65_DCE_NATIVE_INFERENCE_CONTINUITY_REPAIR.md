# Solarium DCE — Phase 03 follow-up: native inference continuity repair

**Baseline:** `Solarium_DCE_Phase03_2026-11-22.zip` (Phase 03, 1,017 files).
**Scope:** `src/engine/llama.ts`, `src/engine/context-window.ts`, `src/engine/continuous-generation.ts`, `src/engine/agent.ts`, `src/engine/construction/*`, corresponding focused tests and inference documentation.
**User-visible defect:** a construction request consumes a full model reasoning turn, receives no native tool call or final answer, and immediately shows `Source construction paused`, with zero confirmed file writes.

## Root cause and limits of evidence

1. `streamContinuousAnswer()` correctly requests `max_tokens: -1` for llama.cpp, but the OpenAI-compatible transport also sent `n_keep: -1`. When the prompt nearly saturates the model context, retaining every input token can leave too little shiftable KV history to continue producing output. Runtime llama.cpp flags, actual model template, and whether the selected backend honors `n_keep` still require a live-machine test; the screenshot alone does not prove a single specific server stop mechanism.
2. Prompt fitting reserved as little as `64 + 96` tokens for the model's first action. That is not a 64-token output cap, but it can send an already almost-full prompt to the model, especially when tool definitions are large.
3. In `runAgent()`, a native turn ending after reasoning but without an answer/call immediately resulted in a durable `paused` construction task. Phase 03's status message was truthful but did not perform a second *independent* decision from saved task facts. This was the visible abrupt stop.
4. The `finish_reason=length` signal does **not** distinguish a model context limit, server cap, or output cap. We no longer state a specific cause without transport evidence.

## Changes

- **Native context shifting:** the llama.cpp request still uses `max_tokens:-1`. It now sends a bounded numeric `n_keep` based on the *actual fitted prompt* and reserved decision headroom. This preserves essential task context and permits native context shifting to reclaim generated tokens. No arbitrary 2048-token output segments were introduced.
- **Prompt fitting:** llama.cpp reserves `max(128,min(1024,floor(n_ctx/8)))` initial response tokens, plus the pre-existing 96-token headroom. If the prompt cannot fit, existing optional-pruning and input-limit reporting remain authoritative. This is an initial-fit allowance, **not** a reasoning or output cap.
- **Bounded independent recovery:** after a complete native generation stops without any complete tool call or final answer, the existing `runAgent()` loop may make at most two additional independent model action decisions, anchored to the original request, the persisted checkpoint, and currently exposed tool contracts. This is **not** an attempt to continue private reasoning or replay the same server stream. Tool calls still undergo the existing contract checks and permission broker.
- **Partial tool safety:** any tool-call fragments returned when `finish_reason=length` are explicitly discarded before execution, even if a name and some JSON had already streamed to the workbench. The preview remains a proposal, never a confirmed write.
- **Traceable failure:** final pause messages show the backend finish reason and available request diagnostics (`n_ctx`, approximate input tokens, `n_keep`, `max_tokens`, optional usage and context-shift indication) without inventing source writes. Cancellation, explicit denial, unsupported tool calling and transport failures remain terminal or resumably blocked as appropriate.
- **Regression coverage:** newly added `construction-inference-recovery.test.cjs` and `dce-inference-streaming.test.cjs` prove bounded decisions, safe partial-tool rejection, native unlimited output request, a long SSE reasoning + tool-call turn, and prompt headroom. Older assertions tied to `n_keep:-1` and over-specific warning text were updated.

## Verification and the remaining desktop release gate

All claims here concern the source/test environment, **not** a real GGUF run on the user's Windows machine. Check the release QA log alongside this report. Relevant commands:

- `npm run test:inference:continuity` (requires test CommonJS transpilation in `.test-dist`)
- `node scripts/check-syntax.cjs`
- `node --test tests/dream-construction-phase0{1,2,3}.test.cjs` (run individually)
- `node --test tests/tool-execution-reliability.test.cjs`
- `node scripts/generate-spica-registry.cjs --check`
- `node scripts/generate-spica-runtime-registry.cjs --check`
- `node scripts/check-dce-source-warehouse.cjs`

Full `npm run check` / `npm run build` depends on the complete npm dependency tree, absent from this environment. A real acceptance test must start the loaded GGUF server, verify its tool-aware chat template and `--context-shift` support, trigger a capacity edge case, confirm continued *new* model decisions, confirm an actual authorized write, run a build check, and verify that explicit Stop/Cancel never restarts inference.

## Non-goals

- No claim of literally infinite context on finite VRAM/KV capacity.
- No artificial hidden user messages, prefilled/fabricated tool results or duplicate inference model instances.
- No source-block warehouse expansion (Phase 03 remains intact) or new Workbench UI.
- No automatic permission grants, silent code edits, or guaranteed completion by a model with an incompatible function-calling template.
