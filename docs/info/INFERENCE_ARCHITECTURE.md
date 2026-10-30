# Solarium 0.1 — Inference Architecture Contract

**Status:** Architectural invariant. **Read before modifying** `src/engine/agent.ts`, `context-window.ts`, `continuous-generation.ts`, `llama.ts`, `backends.ts`, the managed runtime launcher, or reasoning display. Changes must preserve these rules and update tests and this document together.

## What we agreed to build

Solarium is a local-LLM assistant with configurable Spark personalities and real project tools. **Generating an answer must not load a second copy of the selected model, allocate a second model's worth of VRAM, or restart reasoning merely because 2,048 more tokens have been emitted.** Both a model's exposed reasoning and its final answer belong to one continuous model response.

The **2,048-token number is legacy terminology**, not a repeated HTTP request boundary, memory-allocation unit, separate Thinking quota, or a requirement to prompt the model to “continue.” It must never cause another model instance to load. The implementation was deliberately changed after repeated 2,048-token chat continuations caused 48-minute reasoning loops. Do **not** reintroduce those loops.

## Current native inference path (inspect the code before editing)

1. `runAgent()` in `src/engine/agent.ts` assembles the active Spark instructions, project facts, relevant conversation, and permission-filtered tool declarations.
2. `prepareGeneration()` in `src/engine/context-window.ts` fits **input** into the *actual loaded* context capacity. It may exclude old turns or optional search excerpts **from the temporary request only**. It never deletes saved chat. It must not discard the newest user instruction or essential Spark identity.
3. `streamContinuousAnswer()` in `src/engine/continuous-generation.ts` makes **one `adapter.generate()` call per assistant inference turn**, not one per 2,048 emitted tokens. The existing model remains loaded in the same server.
4. llama.cpp receives `max_tokens: -1` for a single streamed reply. The managed llama.cpp server uses `--context-shift` when supported; the backend manages its KV cache. Native reasoning and answering are parsed from the same server-sent event stream, via `streamLlamaTurn()` and `ReasoningSplitter`.
5. vLLM also streams a single turn. It is constrained by its loaded finite context and does not have a universal llama.cpp-style `max_tokens: -1`/context-shift guarantee. Do not pretend it can resume an interrupted reasoning channel through a synthetic user prompt.
6. When the model **actually requests a tool**, the agent executes the authorized operation and sends the real result as a tool message. This new tool turn is not an artificial 2,048-token continuation; it is needed to perform the user's requested work. Visual Actions report results only from actual operations.

## VRAM/RAM: the meaning of reuse

- **Model weights:** Loaded once by an inference server and reused for subsequent reasoning, answer, and tool turns. 8 GB of weights does not become 16 GB after another 2,048 tokens. (8 GB is an illustrative example, not a target.)
- **KV/context cache and working buffers:** Managed by the backend with the configured context capacity. Usage can vary and old context may be displaced. Resetting an output-token counter does not magically erase KV-cache entries or keep *all* earlier tokens accessible forever.
- **Input context vs output streaming:** A 4,096-token context cannot ingest a 5,105-token prompt, *even if* generation streams forever. The input prompt, tool schemas, and chat template count toward this capacity. **This is separate from continued output streaming and must not change how it works.**
- **No invented allowances:** Do not impose separate reasoning budgets, thought-reset prompts, per-segment retry counters, synthetic Thinking-to-answer transitions, or time limits to disguise context problems. User Stop and genuine backend failures must still work.

## Tool context: what caused the 2026-10 regression

`runAgent()` previously advertised **nine large project/web tool schemas simultaneously**, *in addition to* Spark persona, project awareness, inspection details, conversation, and a Markdown-formatting guide. `prepareGeneration()` then threw a “context too small to hold ... required development tools” error. This blocked actual code creation, even when the project folder was correctly inspected (including an empty folder).

### Required behavior now

- `selectActionTools()` in `src/engine/tools.ts` sends a **small stage-relevant working set** of real tools. The registered tool implementations, permission controls, and project directory boundaries are unchanged.
- After each **real tool result**, the next agent turn may offer a different working set (e.g., create files, then run checks, then read and correct files). This is **tool schema paging**, not an inference/Thinking continuation or extra model loading.
- The code-generation task does not include the verbose `BLOCK_FORMAT_GUIDE` when it needs actual filesystem tools.
- If the configured context still cannot fit the essential instruction and **even one** offered required tool, report a truthful **input context** limitation. Never lie about writing files, never silently convert an implementation request into a chat-only answer, and never claim “generation needs more VRAM per 2,048 tokens.”
- Keep the latest user request, linked project/folder facts, and Spark personality intact. Preserve tool permission gates (Ask, Auto, YOLO; Web OFF means no web requests). A tool is not considered run until it actually executes.
- Tool responses do **not** make source code changes merely by appearing as text. Only native filesystem operations can mark files as saved.

## Developer regression checklist (mandatory)

Before landing changes in these modules:

1. Verify `streamContinuousAnswer()` still makes **one generate call per assistant inference turn** and llama.cpp still sends `outputTokens: -1`. No fake “continue thinking” chat message, no two-segment counter, no 2,048 HTTP request cycling.
2. Verify a long stream with many reasoning tokens **then** answer tokens completes without a new request or dropped reasoning.
3. Verify a 4K-context, empty linked project and an implementation request can offer a real file-writing tool without advertising every unrelated schema.
4. Verify tool definitions can move between **actual tool turns** without losing permissions or fabricating actions, and the chat UI shows only confirmed results.
5. Verify oversized **input** is handled independently of the **output** policy, and that saved conversation history is never deleted to fit the prompt.
6. Run `npm test`, `npm run check`, `npm run lint`, `npm run build`, and `cargo check` in `src-tauri` where dependencies/toolchains exist. Be explicit about checks that cannot be run. Real llama.cpp/vLLM and VRAM behavior require local hardware testing.

**Do not “fix” an inference problem by introducing a new arbitrary limit, replaying a reasoning prompt, hiding the available tools, or claiming memory use is constant.** Diagnose whether the issue is input length, incorrect tool schemas/template, stalled server streaming, or a real context-capacity error, and fix that layer only.
