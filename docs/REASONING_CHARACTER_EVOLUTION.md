# Solarium 0.1 — Reasoning and Character Evolution

Existing anime avatar changes, editable character layers, Modern / Classic / Chibi styles, and Spark appearance migration remain in the project. They are unchanged by this patch.

**Reasoning fix (newer than the original Character Evolution build):** Previous versions reused the same loaded model but interrupted reasoning every 2,048 tokens and replayed it as a new user instruction. This caused Dona's prolonged reasoning loop. The active implementation uses a single server-side llama.cpp stream with `max_tokens: -1`, and enables managed llama.cpp context shifting. Both reasoning and answer deltas flow through the same request, so completion is a genuine model transition, not a synthetic chat reenactment.

vLLM uses its available context capacity for one uninterrupted stream; when that capacity is reached, the UI preserves genuine reasoning and states that no answer was emitted instead of endlessly restarting thoughts.

For the full implementation details, see [Native streaming and reasoning-loop fix](NATIVE_STREAM_REASONING_FIX.md).
