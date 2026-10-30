# Solarium 0.1 — Native streaming and reasoning-loop fix

## Root cause

The previous `streamContinuousAnswer()` ended requests at 2,048 output tokens, even if Dona was midway through her reasoning. `createContinuationMessages()` then invented a new *user* instruction telling Dona to continue reasoning, alongside an assistant `UNFINISHED REASONING TAIL` message. This was not a continuation of the same inference stream or model execution state. The model interpreted each artificial exchange as a new reasoning task and repeatedly reconstructed a plan without ever entering its final answer. The reported 48m 17s reasoning trace shows this pattern over and over.

## Corrected path

- `src/engine/continuous-generation.ts`: **one actual inference request per assistant generation**. There is no reasoning replay, synthetic user continuation prompt, segment retry counter, or new hidden budget for Thinking. The `onReasoning` channel and `onAnswer` channel stream from the *same* live inference execution. The UI still shows a single compact Thinking panel.
- `src/engine/llama.ts`: existing SSE parsing and `<think>`-tag splitting remain responsible for moving genuine model-generated text into reasoning or answer channels.
- `src-tauri/src/lib.rs`: both managed llama-server launch commands now pass `--context-shift`, so the server can reuse its allocated context/KV window when supported and required. The loaded model is never reloaded between parts of a message.
- llama.cpp OpenAI-compatible API: `max_tokens: -1` requests natural model completion without resetting the request at 2,048 tokens. This is a **per-request output setting**, not a promise of unlimited GPU memory or model coherence. An earlier 2,048-token segmentation constant remains for source compatibility but no longer interrupts active inference.
- vLLM OpenAI-compatible API: use the available context capacity for **one stream**. vLLM does not offer the same portable unlimited context-shift behavior as llama.cpp. If its context is exhausted during reasoning, Solarium records the genuine content and reports that limit without attempting to invent another thinking turn.
- `src/engine/context-window.ts`: fit the *initial* prompt by excluding old conversation turns from the temporary inference payload when needed. Essential Spark instructions and latest user prompt stay in the prompt. The removed continuation-tail/replay mechanism cannot be accidentally triggered.
- `src/engine/agent.ts` and `src/views/Chat.tsx`: a reasoning-only result is saved, with a truthful warning rather than a fabricated assistant answer or a disappearing Thinking panel.

## What this does NOT do

It does **not** force the model to stop thinking because of a timer or artificial thought-token cap, and it does **not** guarantee that every reasoning model will eventually decide to answer. A model can still become repetitive of its own accord. There is no separate reasoning-repair loop, budget, or automatic fake "Continue thinking" message. Genuine server context exhaustion and user cancellation remain observable limits.

The model weights are held by the inference server. The configured context size and KV-cache settings determine bounded cache allocation, not the previously chosen 2,048-token *API request* size. Context shifting discards older context when needed; it cannot retain infinite context with finite VRAM.

## Testing performed here

`npm test`: **103 passed, 0 failed**, including a regression that feeds tens of thousands of characters of reasoning followed by a real final answer in one SSE stream, a vLLM no-replay test, and an agent test confirming reasoning-only results are preserved. Core TypeScript test compilation and syntax parsing also pass.

Full frontend typechecking requires installing the declared npm packages first. Native Windows/Rust builds and actual GGUF/vLLM inference are **not verified in this environment**.

## Test on Windows

1. Apply the patch to Solarium 0.1 and run `npm install`, `npm test`, `npm run check`, `npm run build`, and `npm run desktop:dev`.
2. Restart the managed llama.cpp server after the update so `--context-shift` is active. Existing model files are not modified.
3. Retry the same Dona conversation. Observe one live reasoning stream transitioning into an answer. No fabricated `UNFINISHED REASONING TAIL` user turns should be sent.
4. If a selected model stops during reasoning without an answer, read the inline warning. Check the model's actual context setting or chat template rather than restarting reasoning in new prompts.
5. If using an externally managed llama.cpp server, Solarium cannot set server CLI flags; enable supported context shifting on that server yourself.
