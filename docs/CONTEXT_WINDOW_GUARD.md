# Solarium 0.1 — Context preflight

A request containing 5,105 prompt tokens cannot fit into a model configured for 4,096 context tokens. Output streaming policy does not change that fact.

`prepareGeneration()` in `src/engine/context-window.ts` measures the initial prompt using the backend tokenizer where possible, otherwise conservatively estimates. It may omit old *inference-only* conversation history, optional web excerpts, and oversized optional tool definitions, preserving the Spark identity and newest user request. If the essential prompt is still too large, the request is reported rather than silently discarding the user's current task.

This preflight now runs **once per assistant inference**; Solarium does **not** forge continuation user/assistant turns when a stream crosses an arbitrary 2,048-token boundary. llama.cpp streams until its own stop (`max_tokens: -1`, with `--context-shift` in managed launches). vLLM instead uses its finite context capacity in one stream.

See [Native streaming and reasoning-loop fix](NATIVE_STREAM_REASONING_FIX.md).
