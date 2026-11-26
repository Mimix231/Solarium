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

## Durable work and planned document operations (0.1)

`VerificationLedger` and `task_execution` preserve real command failures, attempts and the original coding outcome. A different successful check cannot clear a failing one; edits invalidate earlier passes. There is no one-repair allowance or fixed 80-tool-turn completion policy. The loop advances only through real tool calls; `complete_project_task` verifies all current checks. A prose-only model stop with unresolved work is incomplete, never a fabricated continuation request.

Explicit long-writing requests use the durable scene plan in `writing/long-task.ts`. Planning and each scene are complete document operations. Each operation makes one uncapped native response and saves its actual result before scheduling another scene. This is allowed task decomposition, not a token-triggered continuation: no active reasoning stream is interrupted, no reasoning transcript is replayed, no artificial user message is inserted, and model weights are reused. A non-natural/cancelled scene does not automatically trigger another inference attempt. A user may explicitly Resume the saved task.

A new long narrative scene can contain two scheduled developments with distinct planned actions and actual outcome quotations. A confirmed development checkpoints its exact prose inside the scene, without a scene divider. The next development is a finished document operation with its own action and the saved prose tail. The controller commits the scene only after the last confirmed outcome and the measured scene length. Proof or length failures retain the current scene for revision. A stopped development is never promoted on Resume. See the saved-development and 50,000-character regressions in `tests/daily-use.test.cjs`.

Accepted web evidence stays linked to the chapter task before planning starts. Planning and drafting retain the original request and receive an explicit completed-research status. A naturally finished invalid plan is archived and revised with its actual parser diagnostic. Repeated unsuccessful proposals stop at the saved plan stage for Resume.

`GenerationOutcome` records actual termination and the reported context-shift capability. The absence of capability evidence is `unknown`, not proof of unlimited output. Regression coverage: `tests/daily-use.test.cjs` (multiple real failing command processes, stale passes, full archived context, planned long writing and cancellation), plus existing continuous-generation/reasoning/inference contract tests. Full behavioral contracts: [Sources and Actions](SOURCE_AND_ACTION_ARCHITECTURE.md), [Writing/Canon/Research](WRITING_CANON_RESEARCH_ARCHITECTURE.md).

Local templates receive one merged leading system prefix; prompt token counting applies exactly the same transformation. Authoring operations keep one user request containing the verbatim overall goal and explicitly labelled application scheduling metadata for the current saved operation. They do not append a pretend human continuation turn or replay thoughts. This framing prevents a model from mistaking every scene operation for a request to generate the whole chapter again. Scene word ranges are editorial briefs; native generation remains uncapped and ends on the actual model/backend signal.

## Decision continuity and story memory

`intelligence/work-memory.ts` pins verified folder/catalogue/manifest facts, settled model decisions, rejected routes and the next action alongside verification. Optional `work` notes ride on genuine tool calls; they never generate a separate reasoning request. `task_execution` saves this state and restores it on explicit Resume. Repeated unchanged discovery brings file creation back into the working set. Empty roots always retain `apply_project_changes`, including after tool selection. Unknown tool names are explicit failed selections with usable alternatives. Catalogue commands cannot become arbitrary shell strings; current IDs appear in their offered schema and are checked again before native execution.

Story identity/knowledge context is a separate retained system reference, not disposable search material. Planned scenes rebuild it after each accepted scene. A scene may append structured `solarium-memory` metadata in that same native response. The incremental parser keeps metadata outside prose; only naturally completed, saved prose with exact supporting passages can establish events. A malformed memory never destroys accepted prose. No reasoning text is parsed into memories, no synthetic user turns are added, and character profiles never replace Spark identity. `tests/continuity.test.cjs` covers persistence/resume, 4K writer availability, discovery errors, metadata streaming, scoped knowledge and retracted prose.
The native 26B regression exposed prompt eviction during context shifting: the server logged `n_keep = 1`, so it discarded the task, Spark and tool prompt during the same uncapped response. Historically Solarium sent `n_keep: -1` to retain the fitted prompt. The November 22 inference-recovery repair supersedes that: the fitter now guarantees streaming decision headroom, and the llama.cpp request sends a bounded *numeric* `n_keep` retaining the fitted task prompt only while leaving an evictable KV region. vLLM does not receive this llama.cpp-specific setting. Output remains `max_tokens: -1`, with one request per real turn and no reasoning quotas. This retains input, not every generated thought forever. Focused transport regression lives in `tests/continuity.test.cjs`. Reference: [official llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#post-completion), `n_keep`.
Large completed/failed write proposals are archived before the next tool turn and replaced with a labelled path/index excerpt even below the old 3,500-character threshold. This keeps a real failed proposal from filling a 4K input and preventing its repair. A failed native write refreshes actual folder facts; an empty string is never silently converted to new-file `expected=null`. Native CAS, scopes and approvals remain authoritative.
Small contexts (up to 8K input capacity) offer complete file-write batches of at most two files, rather than asking a model to hold an entire scaffold inside a sliding generation window. This is a real filesystem operation boundary, not an output/reasoning quota. A verified empty root advertises `expected:null` for its new files. Two discovery operations without changed evidence select the writer alone; read-only tasks can validate completion without a write. Offered schemas are validated before permission/execution, with globally registered tools remaining reachable through paging for normal projects.
The model can select `create_video_editor_project` for an empty, compatible Tauri/React video-editor request. This creates the actual bundled source through native compare-and-swap writes, reports each confirmed batch, preserves partial success on failure, and refuses any nonempty directory. The permission review receives the complete staged source. The starter contains a real frontend `invoke('greet')`, registered Rust command and Rust bridge test. Installation and all manifest checks remain separate model-selected operations. An explicitly different frontend stack keeps the ordinary source-writing route.

Live work-state and verification prompt excerpts are compact even after many failures; full decisions/diagnostics remain in durable records and logs. Web OFF filters network-install IDs from offered/read catalogues and retains native enforcement. No-op edits fail validation before authorization or filesystem execution, so identical replacements cannot advance the file revision or claim progress.
Unrun checks and failed checks are different states. A created starter or successful dependency install routes to current verification commands; real failed checks route to diagnostics/repair. Script-only Node projects with no declared dependencies are not forced into repeated installation. Writing fences flush their actual recovery checkpoint before a requested finalization tool executes. Identical already-finalized prose is accepted without an edit-conflict warning; concurrent different user edits remain protected. Formatting-only chapter edits retain supported event memories, while removing their rendered passage retracts them.

Work-memory evidence comparisons ignore fresh top-level archive IDs, command-run IDs and duration metadata. Re-reading identical file pages or search results counts as unchanged investigation; different files, changed content and actual source revisions do not. Exact original outputs remain archived. The continuity regression covers this distinction without scanning or altering genuine reasoning.

## Retained requirements and completion evidence

`intelligence/brief.ts` keeps attributed original user statements and explicitly approved outline beats in scoped `conversation_brief` records. The compact retained input is separate from optional reference excerpts. Full statements remain available through `read_task_brief`; an assistant suggestion is never user authority. Chapter length preferences can carry into a later writing request within the same conversation. Starting a different story resets that derived brief.

`save_story_context` is a genuine, permission-checked tool turn. It validates exact names, values, human message IDs and quotations before one atomic world/cast/claim write. It cannot bypass explicitly denied underlying story tools, overwrite newer protected user facts, or replace Spark identity. Chat and quality tasks use the same managed-model readiness function and native profile.

An approved chapter outline can schedule finished scene operations without inventing a numerical length target. Scene plans must cover approved beat IDs in order. Each such scene retains its reached state and a short exact passage; this is inspectable evidence, not a guarantee of literary quality. A naturally completed invalid proposal may schedule a named repair of that document operation, retaining the rejected response in the scoped archive. Unchanged rejected text, an interrupted stream or a real backend error leaves recoverable incomplete work. There is no thought replay, separate reasoning allowance, timer-driven continuation or token-triggered HTTP restart. `onAnswerReplace` updates the visible provisional document only; it never changes generated reasoning or deletes archived proposals.

Short ordinary writing is also measured against any explicit target. An absent block, unfinished block, unknown termination or shortfall is not marked fulfilled. Functional coding completion requires real current behavioral checks in addition to syntax/build checks; a documentation-only edit is not forced to add tests. Focused regressions: `tests/intent-quality.test.cjs`.

After a confirmed story setup, normal prose generation receives the exact writing-fence syntax and a narrative working set with no unnecessary discovery schemas. Large fact proposals are archived like source-write proposals, and saved profile values replace their duplicate live-brief excerpts. This is input packing after genuine tool results, not an output or thought limit. Generation throughput estimates include actual emitted reasoning and tool arguments as well as visible prose; exact backend usage remains authoritative when available.

Story setup is staged per character using a flat tool schema. It returns the remaining names mentioned by the user and continues through genuine tool results until those profiles exist. Names discovered lexically are routing candidates, never generated reasoning or factual profiles. The model must select the operation and quote an actual human statement. A protected fact uses the original quotation, or an exact optional subset; an unsupported paraphrase cannot replace the human wording. Direct descriptions/corrections to existing cast are routed through the same tool. Both chat and in-app quality evaluation use the shared conversation controller.

Story references occupy one retained context slot, not a second full copy in optional source material. During cast setup, the active original-human brief and next-character requirement remain available; freshly saved profile copies are loaded when authoring starts. This avoids the observed 4K input failure between the first and second cast save without changing output limits, Spark identity or saved originals. `tests/intent-quality.test.cjs` verifies one retained story slot and intact protected claims.

Cast setup scopes its active input to the pending character, exact relevant human statements and their message IDs. It does not resend code-project awareness, historical assistant prose or the accepted chapter outline during profile saving. Full originals remain in the durable brief/archives. The observed 4K runtime was retaining over 3,200 prompt tokens during setup; reducing redundant input leaves more native working context without adding an output/reasoning quota or splitting an active response. Clear cross-character quotation assignments are rejected. Generic stories without supplied cast do not require inventing a user-defined profile before writing.

A human ID in read_task_brief identifies that human statement even if the model also supplies part=outline. Pages are bounded and preserve nextOffset/full originals. Completed tool-progress prose is archived for story setup as well as coding. Two identical complete brief reads switch discovery to the pending real save; a failed save reopens evidence reading, with no single-repair limit. Dona's observed 9,579-character raw personality stays intact; these changes reduce duplicated task input rather than rewrite her persona.

During a planned authoring operation, the active brief elides only long human quotations actually present in the selected cast reference. Unrepresented user facts remain. The current saved operation supplies the accepted beat; its entire outline is not duplicated in the brief. Full human messages, cast claims and approved outline are unchanged in storage. The regression checks that source originals and unrepresented facts survive this input deduplication.


## Glitch workspace integration

The Glitch code workspace is an editor inside Solarium. Conversations live in the Conversation tab; the editor does not mount an additional Chat instance. Both routes retain the same workspace, Spark, model and permission layer. `query_project_intelligence` is a staged read tool that queries the same scoped index/language services as the editor. Real language-server availability and pending diagnostics remain explicit. These results do not replace manifest checks or satisfy a verification ledger by themselves.

`backend/solarium.py` is a private stdio project service, supervised by the normal native application. It imports the dependency-free Glitch project modules, not the former Dona or CodeDiffusion inference services. It does not load a model, manufacture assistant turns, add inference loops or change generation limits. The original experimental runtime sources are preserved but are not active inference routes. See [GLITCH_INTEGRATION.md](GLITCH_INTEGRATION.md).

Linked-project repair requests retain their project action route when descriptive words precede the target, including the actual "Fix the linked existing project" acceptance prompts. Advice and creative-prose corrections retain their ordinary routes. The regression runs every coding acceptance prompt through the same task-intent predicate; no synthetic model turn is added to correct misrouting.

At an unchanged file revision, repeated successful commands are unchanged observations too. The staged command runner advertises unresolved catalogue IDs while any remain, so already-passed build/check commands cannot crowd out a missing test. Edits invalidate passes normally. No command is fabricated or automatically executed, and failures remain repair work. Regression tests cover pending-command schemas, rejection of an obsolete proposed command, and new-revision reset.

After an actual passing verification command, the next advertised page retains the unfinished command phase, then offers controller-checked completion. A failed command or missing behavioral evidence exposes repair/source tools instead. This phase is driven by native results, not a repair-attempt budget; existing registered reads/edits remain available through the registry.

## Chat-generated code

The normal conversation controller also checkpoints actual source fences into scoped generated-code artifacts. This observes the existing answer stream; it never starts a second model, synthetic continuation, reasoning allocation or token-budget loop. Natural model EOS and a complete fence establish only a finished source artifact. Native file application and behavioural verification need their own actual results. Explicit source-in-chat requests can finish without a project folder. Follow-up source readers use paged saved originals in the same permission layer, with no reduction to the model's output capacity or alteration of Spark identity. See `tests/generated-code.test.cjs` and the Generated source section of the Source and Action contract.


## Local coding profiles and lifecycle

Automatic GGUF loading reads actual layer/head metadata and measured free GPU memory with runtime/KV headroom. This is an estimate; actual server loading remains required. Manual per-model allocation is retained. An unchanged resident model/context reuses its allocation. Both managed llama paths enable Jinja templates and one parallel slot. HTTP output remains requested as uncapped (`max_tokens: -1`); the fitted prompt uses an explicit bounded numeric `n_keep` with room for context shifting. Input context and GPU memory are separate from output length.

Compatibility checks ask the selected model to request a native read-only probe, execute it in this process, then supply the genuine result to its next inference turn. Transcripts, template/native identity and timings persist. Compatibility is distinct from coding quality: coding trials use the same Spark/conversation/task path and independent reference tests. Failed, cancelled and later manually corrected trials remain separate.

withLocalWork owns cancellation and waits for real storage finalizers; it never schedules inference turns or rewrites thoughts. Model changes during active work are rejected. Closing stops work, saves source/recovery/workspace as selected, and destroys the native window after success; failures stay visible and retryable. Regression: tests/local-coding-core.test.cjs.


## Substantial application authoring

Application requests use a durable feature/file dependency plan inside the normal agent task. Planning, complete file writes and feature verification are genuine model-selected tool operations. The Spark is explicitly allowed to author all source needed by the requested app, with no 4,096-character or 50k-character output ceiling and no length-padding target. A scaffold does not satisfy later feature work packages. Small input contexts still page source tools; they never clip generated files to a short response budget.

Each feature completion reads actual files and requires current native verification evidence. The overall task requires every planned feature, unchanged source hashes, all current project checks, and a substantial exact duplicate-source audit. These conditions are engineering evidence, not a guarantee that every semantic/UI requirement is correct. Acceptance criteria stay inspectable and subordinate to the original user request. Saved plans survive explicit Resume; confirmed implementation cannot be discarded by replacing its plan. Shared-file changes reopen affected feature verification. No extra inference loop, synthetic continuation or reasoning quota was introduced.

Ordinary generated code fences retain their complete originals and immutable revisions. Substantial repetition creates visible source-quality diagnostics; it never silently deletes code or rewrites the genuine answer/reasoning stream. Tests: tests/app-builder.test.cjs and tests/generated-code.test.cjs. The complete-task-board native quality case starts in an empty folder and has independent HTTP/persistence assertions plus a separate actual-UI review requirement.

## SPICA app tasks

A linked SPICA project routes its application changes through a small graph tool set. The Spark reads the saved graph, applies typed edits against the read revision, exports through native compare-and-swap writes, and verifies the exported revision with real native commands. Ordinary code-owned projects retain their existing tool stages. Graph saves and exports require write permission; verification requires check permission. The task stops with the real result when permission is denied or a concrete blocker is reported. The four operations use normal model-requested tool turns and the existing reasoning and answer stream. SPICA tests cover typed connections, stale and concurrent revisions, permission grants and stage selection.

An explicit chat request to create a SPICA app offers the graph creator in an empty linked folder. The real creation result enables registered component discovery and revision-checked edits. Explicit grant and revoke operations pass through the graph approval. Export reports whether cached dependency preparation is needed. The active setup or verification command uses the existing native command runner and check permission. A failed runtime assertion on an implementation task offers the exact graph and failed step, then reopens the graph edit stage. Saved scenarios are protected during repair. Verification-only requests retain read and check stages. An incomplete run displays the controller's recorded status beside the preserved model reply. These stages use genuine tool results and the same resident model.

SPICA derives a setting's type from its JSON initial value and choice list when the proposal leaves the explicit type out. A Boolean value such as `false` creates a Boolean preference and a toggle. Explicit types still require a compatible value. Invalid edits preserve the graph and return the actual field problem, while stale revisions request a fresh graph read. If the same invalid proposal returns at the same revision, the controller records the duplicate and leaves the task resumable without authorizing or executing that edit again. Corrected proposals can proceed immediately. The regression replays Dona's archived request with its original omitted type and Boolean value.

For an existing code-owned folder, an available explicit tool selection takes precedence over stalled-work and app-stage defaults. The offered command schema uses runnable current catalogue IDs, including Web OFF filtering. An empty root still offers the writer. Compare-and-swap conflicts identify the exact-read or unique-fragment repair path. SPICA record fields are typed graph edits, and Ask review shows the proposed field and SQLite backfill before approval.

SPICA appearance requests use the same graph, export and verification stages. The graph reader supplies stable visual targets and can return the supported properties and states for a specific target. A `set_style` operation belongs to a revision-checked graph batch. Invalid proposals return field diagnostics before Ask opens. Ask review shows changed values and color swatches for valid proposals. The preview reads confirmed revisions while the normal reply continues, and current build evidence requires the native executable hash. `tests/spica.test.cjs` covers appearance routing, validation and lowering.
## SPICA authoring and research turns

The stage-specific SPICA edit contract is resolved by the same selector when it is exposed and when it is dispatched. Equivalent flat collection and screen fields normalize to the reviewed payload before validation. Conflicting forms are rejected. A graph rejection retains the last confirmed revision and a correction hint. Exact repeated invalid proposals stop further edits on that reply and leave the task resumable. Authorization and graph compare-and-swap still apply to the corrected operation.

Normal web research uses actual model-selected search and page-read tools. Search observations are bounded JSON with scoped result IDs. A weak Bing response can use the same approved query through the existing DuckDuckGo fallback within the provider budget. The observation records which provider and attempts actually ran. Weak retrieved passages remain in the work log while the Spark refines its search. Only accepted passages enter the citation set and planned Fiction context. The normal conversation controller saves confirmed tool observations to the reply, including the search JSON. Each tool, plan and scene remains a separate completed operation using the same loaded model.

## Phase 07 — Contract-first SPICA tool paging (2026-11-12)

For actionable user instructions inside a linked SPICA project, `runAgent()` selects a small tool working set that first exposes registered tool discovery, exact JSON-schema inspection, and argument preflight. The model is not given all warehouse block schemas at once. The stage changes **only after a real tool result**; this is still ordinary, single-stream inference per assistant tool turn, without creating a second model or synthetic 2,048-token continuation.

`list_spica_toolchain`, `inspect_spica_tool`, `inspect_spica_wiring`, and `check_spica_tool_call` read authoritative registered contracts. The schema given to the model and the validation used to execute a call are the same. The agent records the inspected tool and a signature of validated arguments. It only offers/accepts a mutating SPICA operation after matching preflight and then applies existing Ask/Auto/YOLO permissions. A denied or invalid SPICA call stops the current attempt and reports real output rather than silently changing parameters or choosing a hardcoded feature implementation. This is an intentional requirement from the current user; it is not an inference-token or model-capability guarantee.

**Regression coverage:** `tests/spica-phase07.test.cjs` and `tests/spica-phase07-tools.test.cjs`, run by `scripts/check-spica-phase07.cjs`. They assert register/inspect/preflight/execute contract consistency, stage gating, absence of feature-specific fallback routes and permission preservation. Full local-model + Windows Tauri integration remains a separate release gate. See `spica/roadmap/18_PHASE07_IMPLEMENTATION_REPORT.md`.

## Phase 09 contract-intelligence checkpoint (2026-11-12)

Tool schema paging still occurs **between real tool turns**, never inside the
selected model's uninterrupted generation. `ToolSchemaProvider` advertises
exact `ToolContractRegistry` declarations; the agent validator and dispatch
coordinator check the same definitions. `AgentProgressTracker` identifies
repeated malformed proposals and duplicate discovery calls without creating
artificial continuation turns, fresh model loads, or synthetic tool results.
A blocked redundant tool requires an explicitly chosen alternative inspection,
not automatic execution. Permission checks, Web OFF, cancellation, and native
verification still govern all side effects.

## Phase 10 — Persistent SPICA build plan and rolling working context (2026-11-13)

Phase 10 introduces `SpicaTaskOrchestrator` (`src/engine/intelligence/spica-task-orchestrator.ts`), `AgentBudgetScheduler` and `AgentContextAssembler` (`src/engine/intelligence/agent-budget.ts`) without changing the one-stream-per-inference-turn guarantee above. **4,096 tokens is an optional per-tool-turn prompt working target**, NOT an output-token cap, a fresh model load, another chat request, or a guarantee that a 4,096-context model can fit all tool schemas. At an ordinary natural tool boundary, the task's stable goal, confirmed graph revision, completed steps, warnings and token usage can be checkpointed in the existing `task_execution` record. The next real model/tool turn incorporates a compact authoritative checkpoint. No invented tool result or automatic tool retry is generated by the scheduler.

`prepareGeneration()` accepts `workingContextLimit` as a **soft input budget**. When mandatory persona/instructions and valid tool declarations cannot fit the target, preparation may use the remaining *actual loaded context* instead. That repeats prompt preparation/token counting only, never `adapter.generate()`. The backend's continuous stream remains intact. `GenerationOutcome` distinguishes server/estimated/unknown token measurements. The Chat plan displays previous-cycle measured prompt usage; it is not a realtime output-token meter.

The durable SPICA plan is stored alongside the existing task record. A plan is only marked composed after an authorized tool call is followed by confirmation of a newer persisted graph revision; a successful inspector or planner is never a completed app feature. Verification is counted only after confirmed build evidence at that same revision. A normal model EOS without further actionable tool call leaves an **unfinished resumable/paused task**, not a fake success. Permission denials, explicit cancellation and external blockers keep their distinct state. Pause and Cancel are user actions; Resume starts the next normal inference after the user's explicit request and does not replay committed writes.

`list_spica_toolchain` can return stage-filtered, paginated **exact registered parameter schemas** (`stage`, `limit`, `offset`, `includeSchemas`) so small local models can inspect the next necessary tool contracts in one bounded operation. These are shared with `ToolCallValidator` and the real dispatcher: arbitrary undeclared parameters remain invalid. The one canonical block directory remains `src/spica/runtime/blocks/`.

The release gate is more than automated unit tests: end-to-end testing with a real GGUF, full frontend TypeScript/Vite compilation, and native Windows/Tauri verification must be completed on the target machine. Phase 11 must not be considered started by the Phase 10 source changes.

## Phase 10 executable-ID discovery and stage selection (2026-11-13)

Small GGUF models may invent callable names (e.g. `MarkdownEditorBlock`) or confuse a registered `spica.runtime.*` **block ID** with a callable tool name. The Phase 10 inspection update exposes query-based, bounded, read-only `resolve_spica_capabilities`, `inspect_spica_tool`, `inspect_spica_runtime_block`, `inspect_spica_wiring`, `inspect_solarium_tool`, and `inspect_spica_identifier` contracts. Results provide only IDs backed by the actual executable registry; guessed aliases are not registered or silently executed. `selectSpicaTools` considers the persisted `SpicaTaskOrchestrator.nextStep` and prioritizes validation/composition once the saved plan reaches Compose, while retaining strict check-before-write, permission and revision gates. Empty read-only discovery does **not** complete a plan step; structured `ok:false` inspections are recorded as failed operations. The native inference rule remains unchanged: **one backend generate stream per genuine assistant/tool turn, no fake 4,096-token response continuation and no extra model loading**. See `spica/roadmap/44_PHASE10_REGISTERED_CAPABILITIES_AND_COLLAPSIBLE_PLAN.md` and `npm run test:spica:phase10:reliability`.

## SPICA Phase 10 Round A — scoped contract and progress boundaries (2026-11-13)

The stage-selected `edit_spica_graph` schema is derived only from a *verified*
registered operation, never directly from model-authored operation names. An
unknown edit descriptor yields a compact structured diagnostic and retains the
same user task. Invalid or repetitive proposals cannot hide the whole tool by
name, because a corrected proposal must remain eligible for the same tool.
Tool preflight reports only the selected operation's required parameters; it
does not fill a small GGUF context with the entire editor union on error.

SPICA's progress tracker resets inspection history only after authoritative
project revision evidence proves a changed graph; execution, research and
preflight success do not substitute for an app edit. A model ending its natural
turn without confirmed work persists the task and its exact diagnostic; it
cannot be force-restarted with fabricated continuation messages. Round B will
introduce independent task decomposition at natural operation boundaries.

## Phase 10 Round B — independent, evidence-backed Thought Blocks (2026-11-14)

For active SPICA construction tasks, one **Thought Block** represents a single natural
model inference/tool-action turn. Its configured 4,096-token default is a soft **input**
working target for that turn; it does **not** interrupt generation after 4,096 output
or reasoning tokens. `streamContinuousAnswer()` still makes exactly one backend
`generate()` call for each natural turn, llama.cpp retains `max_tokens: -1`, and
permissions remain on the ordinary execution gateway. Model weights are reused.

`SparkThoughtJournal` in `src/engine/intelligence/spark-thought.ts` records the
current action objective, offered callable names, graph revision, actual model
reasoning **only when the model emits it**, prompt/output usage (with server vs.
estimate origin), proposed tool calls, and each observed outcome. The complete
emitted reasoning text is saved to the existing scoped `ContextArchive` before
any proposed tool is executed; the `task_execution.spicaPlan.thoughts` checkpoint
contains a short display excerpt and the archive ID. Absence of an exposed
reasoning channel must not be replaced with fabricated text.

The Thought Block and its proposed calls are durably persisted in the existing
`task_execution` record **before** any graph tool runs. Failure to save is a
hard blocker; do not execute an unsaved proposal. Every observed tool result is
persisted before the next action. A new Thought Block begins from retained
Spark/project instructions, the current user goal, authoritative project/task
state, and labelled results of the immediately preceding action. It **does not
replay** earlier assistant reasoning or tool-message history. On Resume, an
interrupted thought is paused with diagnostic evidence; pending writes are not
re-executed automatically. A no-tool model EOS pauses an incomplete task rather
than claiming completion or issuing a fake continuation.

Do not reintroduce a raw reasoning-cycle/reset mechanism or place untrusted tool
outputs in the user's mouth. The per-thought records are decision/action
checkpoints, not new user messages and not attempts to retrieve private model
chain-of-thought. The archived reasoning is the exact text actually streamed
by the model. `SpicaTaskPlanView` renders recent thoughts; older complete evidence
remains in the scoped archive, subject to normal retention policies.

Run `npm run test:spica:phase10:roundB` and the existing Phase 1–10 suites and
registry checks after modifying this path. Real GGUF/tool-template, frontend
TypeScript/Vite, and Windows/Tauri tests still require the appropriate runtime.

## Phase 10 Round E — 8,192-token SPICA input overflow repair (2026-11-15)

The unscoped `edit_spica_graph` / `validate_spica_edit` contract serializes to
roughly 18,407 characters (over 9,200 tokens by Solarium's conservative schema
estimate). **A single unscoped tool is larger than some loaded model contexts.**
`selectSpicaTools()` now always supplies operation-specific, registry-backed
editor contracts to the model. When no operation has been inspected yet,
`initialSpicaEditScope()` selects a bounded *real* set: `migrate_graph` if V2
is absent, `add_block`/`connect`/`compose_blocks` where V2 exists, or
schema-1 `put_screen`/`set_field_property`/`add_record_field`. The complete
canonical union remains available through `inspect_params` / registered tool
inspection and is still the authoritative executor/preflight grammar.
After a verified edit or inspection, the exact scoped operation replaces the
initial contract. No tool, permission or graph operation is invented.

`prepareGeneration()` retains the preferred tool if it fits, but when **that
single tool cannot fit**, it may choose a smaller tool already selected and
registered for the current turn; it never synthesizes or truncates a callable
schema. The agent continues to verify selected calls and permissions as before.

The Spark's core identity, user-written DNA, explicit personality instructions,
latest user request and user-authored project instructions remain protected.
Its memory notes, retrieved Spark World snippets and voice examples are emitted
as separately labelled optional reference sections in `runAgent()`, so input
fitting can remove these first without deleting their saved originals. The
complete output of `composeSparkInstructions()` remains unchanged for other
consumers. The 4,096 working target is soft and can borrow the real loaded
context when protected instructions do not fit that target. A request whose
**protected** content alone exceeds the model's actual maximum remains genuinely
unrepresentable in that one inference; never hide this by claiming success.

No changes were made to llama.cpp `max_tokens: -1`, `n_ctx`, output streaming,
model reloads, user approval, or the ordinary single-stream inference path.
Verification: `npm run test:spica:phase10:contextfix` and all phase suites.

## Construction continuity and actionable evidence (2026-11-17)

The 4,096-token working target still applies only to input assembly between
natural tool turns. Each Thought Block uses one native backend stream with
unlimited llama.cpp output. No saved-token counter interrupts inference or
injects a synthetic continuation. The model's actual context and resources
remain finite.

`SparkThoughtJournal` preserves bounded, actual inspected ports/configuration,
source reads/searches and the exact successful preflight proposal. The next
request receives up to three previous evidence references and a checkpoint,
plus the immediately actionable result. A still-approved preflight proposal
survives intervening read-only calls. It is untrusted data, never an automatic
write or a replayed model thought. The agent explicitly submits the proposed
call through the same schema, revision and permission checks. Oversized reads
are labelled partial; their original result remains in the scoped archive.

SPICA construction also exposes existing native project tools. Once the Spark
chooses a source tool, the construction coordinator keeps the source route
available across later reads and checks rather than returning to block
discovery after each read. This selection is not a permission grant. Verified
directory facts, command IDs and unchanged-read diagnostics accompany the
SPICA task context. A model-authored `plan_project_app` activates the existing
feature/file verification ledger; graph construction can still proceed without
a source plan. App names do not automatically select starter recipes.

`withLocalWork` propagates the original abort reason. Pause stays resumable;
Cancel stays cancelled. Resume examines the latest task for the conversation
and cannot skip a cancelled/completed latest goal to revive an older request.
Pending operations are never replayed by this handoff.

Focused regressions: `tests/spica-construction-progress.test.cjs`,
`tests/local-coding-core.test.cjs`, and `tests/continuity.test.cjs`, in addition
to the Phase 01–10, contract, registry, frontend and native acceptance checks.

## Fanfiction chapter authoring (2026-11-20)

New fanfiction plans aim for longer complete scenes. A draft operation uses one
`streamContinuousAnswer()` call with the same loaded model and uncapped
llama.cpp output. If the backend reports a real capacity stop or an assessment
finds the action unfinished, the writer can checkpoint the same scene. It retains
the original goal, last complete sentence, verified draft passages and next beat
as document data. The next operation is scoped to the unfinished action. There
is no timer or token quota that interrupts a live generation.
Truncated scene metadata from a reported capacity stop stays outside the prose.
The grounded review can recover continuity from complete passages when the native
stream did not reach the closing metadata tag.

The scene assessment and exact-passage correction are separate natural
document operations. They return observable evidence and revision instructions.
The continuation overlay reads durable progress and the public next beat. User
Stop, transport errors, unknown termination and failed checkpoints cannot
automatically start another stream. Short scenes contribute once their action
has happened. Further scenes may be planned before the conclusion. The chapter completes
after its last valid scene and a current saved revision passing the length
check. Old saved tasks retain their original scheduling and document ID.

Online reads and fiction profile saves are ordinary authorized model tool calls.
They prepare evidence for the drafting operations. Scoped sources, original
goals, the selected cast and the scene outcome checkpoints keep continuity
across the chapter. Spark reference memories remain optional inputs. The
4,096 working target still governs input assembly only, with no output slicing
or replayed model reasoning. `tests/fanfiction-chapter.test.cjs` covers the
82k save/readback, bounded scene development, speaker labels, exact-scope profile
evidence, same-scene capacity recovery and exact live correction. Real model
prose and native UI are checked separately.

When a named fiction profile has read evidence, its public summaries can
stream as a naturally finished document operation. The registered profile
tool validates and saves the resulting fields using the current permissions.
Chat resolves a typed group and category before the Spark is asked to write.
An authorized profile save never chooses a different owner or category from
the model's text.

English fiction can prepare an English summary of a foreign source through its
own native generation operation on the same Spark. The original source stays
available for exact citations. English character previews and profile writes
check generated fields for untranslated text. A later English summary can
replace a generated foreign field through a new revision.

When a planning or review operation reaches real backend capacity, the authoring
runner preserves its result and can prepare a smaller request for that work.
The overlay shows this transition. A complete scene plan still has to pass the
original plan checks. Each new operation keeps the original user request,
uses one native stream and leaves output uncapped on llama.cpp. If the smaller
operation also runs out of context, the chapter remains saved for Resume.
The chapter keeps its writing block open until the saved revision satisfies
the length target and the final scene is accepted. The continuation overlay
also covers rechecking interrupted editorial work and extends a short ending
inside its current scene. Intentional Stop still leaves a saved draft.

## Dream Construction Engine Phase 01: model streaming remains unchanged (2026-11-22)

`runAgent()` now computes `classifyConstructionIntent()` before it chooses action tools. Ordinary source-project implementation requests use the existing `selectActionTools()` and native project-tool execution; explicit SPICA graph requests retain SPICA tool selection; chat, story, and requested code artifacts retain their reply paths. This routing changes the **tool work set**, not model generation. `streamContinuousAnswer()` still sends one native generation request per actual model turn and retains all existing llama.cpp transport, context-shift and output-token policies. No 2,048-token continuation loop, duplicate inference planner, or hidden generated tool call was introduced.

When a source project and real task record exist, `ConstructionOrchestrator` observes only authoritative native tool outcomes. Its `ConstructionCheckpointStore` saves the event in the existing task_execution record before emitting it to UI listeners. Project-root, session and task identity remain tied across Resume. File receipts derive from confirmed source writes and native source revisions; verification and completion remain owned by the existing `VerificationLedger` and `complete_project_task`. A model stopping without this evidence pauses the task rather than inventing work.

Phase 01 intentionally does not provide the later portable-code warehouse, cinematic Workbench, executable-preview sandbox or autonomous repair pipeline. See `spica/roadmap/59_DREAM_CONSTRUCTION_PHASE01_ARCHITECTURAL_MIGRATION.md`.

## Phase 03 reasoning-only source construction stops (2026-11-22)

A model may stop after emitting reasoning and **no** final content or tool call, including when its selected chat template is not correctly tool-aware or it leaves a reasoning tag open. In that case the native inference stream is already over. Solarium must **never** fabricate a tool result, an answer, or a user-authored continuation. The November 22 recovery update first permits up to two **independent construction action decisions** in the same existing agent loop, using the real original user request, persisted construction state and the currently offered tool contracts. It does not replay private reasoning or restart a still-running stream. If no real action/answer emerges, source construction records a durable `pauseReason` and renders `describeConstructionStop()` as an explicit paused-task response; Resume remains available. The model's reasoning/channel termination and real tool-call capability still require local GGUF/backend validation. Regression: `tests/dream-construction-phase03.test.cjs`.

## Post-Phase 03: Native context shifting and independent construction decisions (November 22, 2026)

- **One native inference stream per model decision.** `streamContinuousAnswer()` requests `max_tokens: -1` for llama.cpp, with no 2048-token response slicing or fabricated assistant/user history. Actual llama.cpp support for context shifting is runtime/model dependent.
- **Bounded retention with real headroom.** `prepareGeneration()` attempts to reserve `streamingDecisionHeadroom(n_ctx)` (1/8 of context, minimum 128, maximum 1024) plus 96 template/output tokens for llama.cpp. The engine retains the *fitted* prompt through numeric `n_keep`, not an unconditional `-1` on a nearly saturated context. Untrusted optional material is pruned before authoritative user/task data. It rejects genuinely impossible contexts.
- **Truthful generation limits.** `finish_reason=length` does not establish whether the server hit `max_tokens`, context capacity or a separate server limit. Outcomes now record the requested generation count, retained prompt size, server-reported completion tokens, and context-shift evidence. Never treat partial tool JSON as executable.
- **No silent terminal pause on the first incomplete construction decision.** On an incomplete source-build turn with no final answer and no complete call, `constructionInferenceRecovery()` can request up to two new, *independent* model decisions inside the existing agent loop, using real checkpoint evidence and actually offered tools. There is no raw-reasoning replay, fake user instruction, second model, or hidden execution bypass. Only a genuine model tool call can perform a native edit, after validation and permission review.
- **Boundaries stay real.** Cancellation, content filtering, absence of tools, repeated nonproductive turns, unsupported context shifting, and underlying model/chat-template problems can still stop an attempt. The user receives an accurate paused/blocked task with its evidence and can Resume; an infinite guarantee would be misleading. Frontend/Tauri/GGUF integration is a separate release gate.

Regression tests: `tests/construction-inference-recovery.test.cjs`, `tests/dce-inference-streaming.test.cjs`, and the existing continuous generation/context-window suites.

## Dream Construction Engine — 4K context rollover for models without context shifting (2026-11-22)

A llama.cpp process may launch with `--context-shift` and still explicitly report
`context shift=unsupported` for the loaded model/template. With `n_ctx=4096`,
`max_tokens=-1` is **not** an unlimited response: when the cache cannot shift,
`finish_reason=length` can occur after just a few hundred generated tokens if
nearly all context was consumed by the input. `n_keep` cannot enable a feature
that the active inference backend does not support.

For source-code construction tasks on small-context models:

- `buildConstructionDecisionContext()` constructs the next natural model turn
  from the **original, unabridged goal**, newest user instruction, Spark identity,
  current registered tool name, real construction checkpoint, verification
  ledger, and the latest **executed** tool result (bounded as untrusted data).
  Prior unfinished model reasoning and speculative progress are never replayed
  or promoted into verified fact. All full original data remains saved.
- With an **unsupported** context shift, `prepareGeneration()` reserves about
  40% of the actual context for the response, and the stage selector offers
  one real callable contract in 4K/8K source-construction turns. These are
  input-side planning decisions, not mid-generation output segmentation.
- `streamContinuousAnswer()` requests a finite output window on explicitly
  non-shifting llama.cpp servers, bounded by the measured remaining context.
  The native stream is still one backend request for one complete decision.
  When shifting is genuinely supported/unknown, llama.cpp retains the original
  `max_tokens=-1` policy, with a short preserved prefix on supported models.
- If a model repeatedly uses its entire finite budget for reasoning without
  returning an answer or valid tool call, Solarium checkpoints the unfinished
  task and reports the backend limit. No amount of summarization guarantees
  continuation of an unsupported KV cache or a model's hidden reasoning.
- Earlier assistant/tool exchanges can be reconstituted by **verified** tool
  state across turns. No unverified source write or partial tool-call JSON is
  executed. The existing project permissions, original user request, task
  persistence, and model-loading behavior remain authoritative.

Regression coverage: `tests/dce-context-rollover.test.cjs`,
`tests/dce-inference-streaming.test.cjs`, and
`tests/construction-inference-recovery.test.cjs`. A real local GGUF/llama.cpp
4K and larger-context Windows/Tauri acceptance test is still mandatory.


## DCE Phase 03 — Tool-aware 4K input repair (November 22, 2026)

When source construction reaches planning after a genuine native `inspect_project`, its next request must retain that **actual initial inspection observation**, even though it was not an LLM tool message. The mandatory construction packet is now small and authoritative: original user goal (unabridged), latest request, Spark persona, user-authored project instructions, current stage, confirmation ledger, and advertised registered tool identities. Detailed metadata and previous tool outputs are distinct **optional** system messages and can be paged away only from the temporary inference request. All saved originals and task checkpoints remain intact.

On a `contextShift=unsupported`, `n_ctx=4096` backend, the desired 40% response runway is an input-fitting preference, not a hard blocker. After paging optional evidence, completed older tool exchanges, and secondary schemas, the fitter can reduce that runway while still preserving a meaningful >=512-token *first action* window. A truly oversized mandatory persona+request+single tool remains a transparent blocked input, not a fabricated model decision. This does not make one 4K model response infinitely long, and it does not impose a new mid-stream cutoff.

Newer llama.cpp servers may expose `POST /v1/chat/completions/input_tokens`. When supported, Solarium counts the same actual tool declarations, `tool_choice`, and merged system prompt that will be submitted to `/v1/chat/completions`, and uses the positive numeric count *without a second manual tool-schema charge*. On older servers, a 404, bad shape, zero count or unavailable endpoint returns to the existing chat-template tokenizer plus conservative tool-schema estimate. A zero token count returned by that older tokenizer is also treated as invalid and replaced by a conservative estimate. Counting is read-only and never invokes the model to think. Cancellation is respected; no special model reload or tool execution is introduced.

Regression fixtures include the observed ~3262-token prompt and 4096 capacity, 80 varied inspection sizes, one native request with a real tool call, accurate schema counting and older-server fallback. Tests: `npm run test:inference:inputfix`. The desktop frontend dependency build and a live 4K GGUF acceptance session are separate release gates.
