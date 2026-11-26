# Persistent Semantic Stream Theory (PSST)

**A proposed inference architecture for continuous, purpose-aware language generation with bounded GPU memory, persistent character storage, and recoverable neural context**

Research proposal and engineering specification · Version 0.1 · November 2026

## Abstract

Persistent Semantic Stream Theory, abbreviated PSST, proposes that a language model's ability to produce a long, coherent response should not depend entirely on the number of previously generated tokens that can remain resident in GPU memory. A conventional autoregressive transformer combines several different functions within one computational process: predicting the next token, interpreting its previous output, maintaining contextual continuity, representing the original request, and deciding whether generation should end. These functions are related, but they need not all share the same storage medium, update frequency, or lifetime.

The theory introduces a Persistent Stream Engine (PSE), a model-aware inference runtime that owns the decoding loop of an existing pretrained language model. Its primary responsibilities are to preserve the identity of an ongoing generation, maintain an exact and durable record of generated characters and token IDs, manage a bounded active neural context, recover relevant information from older history, and estimate whether the requested output is complete. A later experimental extension adds a learned recurrent controller and a neural memory adapter, allowing persistent numerical state to influence the frozen base model without requiring full model retraining.

The engine is not an autonomous agent, a task planner, a collection of cooperating chatbots, or a system that periodically asks the model to continue. It is part of the inference process itself. Its behavior should emerge from continuous feedback between the base model, the stream, and the memory subsystem. The user submits a request once; the model generates one logical response, even if the runtime internally changes its cache representation many times. The objective is not literally infinite output, perfect recall, or consciousness. It is practical continuity under finite computational resources, improved resistance to pathological repetition, and a more reliable relationship between useful progress and termination.

This paper distinguishes established techniques, engineering proposals, and unproven research hypotheses. It does not report experimental results. All numerical targets and example configurations are proposed starting points unless explicitly identified as calculations or findings from cited work.

## The underlying problem and the central hypothesis

The motivating observation is that some locally hosted open-weight language models appear to restart an answer or fall into repetitive generation after a particular number of tokens, such as 4,096. It is tempting to interpret this as evidence that these models were trained to produce loops. That interpretation is too broad. A model may repeat because of its learned probability distribution, but a restart at an exact configurable boundary can also originate in the inference server, client, chat template, cache management, retry logic, or an incorrectly handled end-of-sequence token. Those possibilities must be separated experimentally. A controller built to solve a model weakness will not fix a client that accidentally starts a second request, and a repaired client will not eliminate genuine autoregressive degeneration.

A decoder-only model estimates a conditional distribution over its vocabulary given preceding tokens. In compact notation, if X is the original prompt and Y is the generated sequence, the model represents the probability of the answer as a product of conditional probabilities:

`p(Y | X) = product over t of p(y_t | X, y_1, ..., y_(t-1))`

This decomposition is an effective mechanism for learning language, but it creates a dependence between future behavior and earlier generated behavior. During normal teacher-forced training, the model receives a preceding sequence drawn from the training corpus. At inference time, it receives its own sampled sequence. An erroneous transition may therefore change the distribution from which the next token is selected. Repetition can become self-reinforcing, especially if the history makes a repetitive continuation look increasingly probable. The difference between training on reference prefixes and decoding from model-generated prefixes is one aspect of exposure bias. It is not the only cause of repetition, and it does not imply that every model will repeat.

The model also has a limited effective context. Its configured context window, its trained positional range, its usable recall over that range, and its maximum output length are different quantities. A context window of 8,192 tokens might contain the prompt and generated answer together. A server may enforce a smaller output limit. A model advertised with a very long context might still fail to recall a particular fact buried within it. Removing a generation limit does not expand the positional range or magically allocate more memory. Streaming merely controls the delivery of generated output. It is not an independent form of intelligence and cannot generate language without the underlying neural computation.

The central hypothesis of PSST is that the state required to continue a useful response can often be represented more economically than the complete neural history of every token in that response. Exact historical content must remain available, but not every historical token needs to occupy a high-precision KV cache slot on the GPU at every moment. A relatively short active context can carry recent syntax and local reasoning. Persistent state can carry information about the request, earlier commitments, open dependencies, and important semantic relationships. An external archive can retain exact facts and generated code. A memory selection mechanism can restore information when it becomes relevant again.

This is a conditional hypothesis, not a claim that arbitrary information can be compressed without loss. Some tasks require access to essentially all preceding information, and a fixed-size recurrent vector cannot encode an unbounded sequence of arbitrary independent facts exactly. If a task requires a random identifier from the distant past, a vague semantic representation of that identifier is inadequate. If it requires every item from a long table, the engine must retrieve those items, process them, or admit that the requested computation cannot be completed under its resource limits. Information can be stored cheaply in an archive, but using it still requires computation and a way for the model to interpret it.

This proposal uses the word awareness in a narrow operational sense. A purpose-aware stream can retain a representation of its original instructions, track evidence of progress, recover relevant historical information, and estimate whether it should stop. It does not imply that the system possesses subjective experience or knows its own correctness with certainty. Any awareness score is a model prediction or an observable measurement, not a direct measure of consciousness. A controller can be confident and wrong. The design must include mechanisms for detecting uncertainty rather than treating confidence as proof.

## Representation, storage, and the cost of context

The most direct way to investigate the VRAM problem is to calculate what the hardware actually stores. During ordinary incremental transformer inference, the key and value vectors produced by attention layers for previous tokens are commonly retained in a KV cache. New tokens can attend to those earlier vectors without recomputing the entire prefix at every step. This improves latency, but the storage cost increases with the number of retained tokens. For a uniform decoder architecture, a rough cache payload estimate is:

`KV_bytes = batch_size * retained_tokens * layers * 2 * kv_heads * head_dimension * bytes_per_element`

The factor of two represents keys and values. This formula assumes equal layer dimensions, a conventional dense cache, and no additional metadata or padding. Architectures with hybrid attention, differing layer sizes, sliding attention, compressed latent caches, or other attention variants need architecture-specific accounting. Quantization can introduce scales, zero points, residual buffers, alignment overhead, and temporary decompression tensors. The formula is an estimate of payload size, not a prediction of total GPU memory allocation.

For example, consider a hypothetical decoder with 32 layers, 8 KV heads, 128 dimensions per head, a batch size of one, and 16-bit cache elements. Each retained token requires 131,072 bytes of raw KV storage, or 128 KiB. At 4,096 tokens, the cache payload is 512 MiB. At 8,192 it is 1 GiB. At 32,768 it is 4 GiB. At 262,144 it is 32 GiB. These values exclude model weights, CUDA allocations, attention workspaces, logits, and the controller. Even a GPU with 12 GiB of VRAM could not contain the last cache in this hypothetical configuration, regardless of how small the original text is.

The actual visible text may be only around one megabyte for 262,144 tokens if the content averages approximately four UTF-8 bytes per token. That average is illustrative and varies widely across languages, code, whitespace, and tokenizer design. The original token IDs themselves could also be archived cheaply: storing one 32-bit integer per token requires exactly 1 MiB for 262,144 IDs before any indexing overhead. These estimates reveal why saving text or token IDs to RAM is easy while retaining all neural activations is expensive. A transformer cache is a representation of how information participates in attention, not an ordinary file containing the text.

Changing a pretrained model's tokenizer to make each character a token does not solve this problem. A model's token embedding table and output projection are associated with a fixed learned vocabulary. A token ID has meaning because of the weights learned during training. Reassigning IDs to letters would generally destroy that relationship. Adding a new vocabulary of characters and learning embeddings for it would be a model adaptation problem, and characters would often require more decoding steps than subword tokens. An English word that occupies one token might require five or six character positions. If every position receives its own conventional attention cache, the resulting memory consumption can increase rather than decrease.

PSST preserves the original vocabulary. It proposes a representation boundary between neural tokens and the visible character stream. Internally, the base model continues to predict tokens. Externally, the engine decodes these tokens into text, maintains exact byte and character offsets, and stores the resulting output in a persistent archive. That is the safe initial interpretation of token-to-character conversion. The model does not need to be taught a new vocabulary merely to let the runtime store its output as text. The longer-term research question is whether the model can be adapted to consume compressed representations derived from groups of characters or bytes instead of maintaining a distinct long-term neural entry for every token.

There are several Unicode details that matter in a real implementation. UTF-8 uses between one and four bytes for a Unicode scalar value. A user-visible grapheme can consist of multiple scalar values, such as a letter with combining marks or a compound emoji. Some tokenizers divide UTF-8 byte sequences across tokens; a token may therefore end halfway through a character. Other tokenizers use spaces or normalization rules that cannot safely be reversed by naively decoding each token independently and joining strings. A robust implementation uses the tokenizer's supported incremental decoding mechanism or an equivalent verified byte-level decoder. It retains an unfinished byte sequence until it can emit valid text. It records the exact original token sequence separately from displayed text because decoding and re-encoding may not always recover the same segmentation.

A critical distinction exists between offloading and compression. Offloading keeps the original data, generally in a slower memory tier, subject to implementation details. It can preserve normal full-attention behavior within the model's supported range, but its host memory requirement still grows and bandwidth may become the bottleneck. Lossy compression replaces the original representation with a smaller one; it can reduce memory and computation but may alter the probability distribution. Selective eviction removes data from the active representation, leaving the model unable to attend to it directly unless the engine restores it or provides an alternative representation. None of these techniques should be marketed as equivalent to the others.

The target GPU budget must include more than the persistent cache. A practical limit is derived by measuring the model weights after loading, reserving space for the largest expected forward pass and temporary tensors, allocating the controller's maximum working set, and leaving a safety margin. The engine should query real allocation and peak usage rather than assume that the nominal memory capacity is available. It should also measure CPU memory and disk growth. A system that claims constant memory because it moves an unlimited cache into RAM is only constant in GPU residency, not in total resource consumption. Likewise, a bounded context does not make total generation time constant. Each generated token requires computation, so a longer output still takes longer to produce.

The proposed architecture aims for bounded GPU cache residency while allowing exact external transcript growth. In asymptotic terms, if W is the active window, N is the logical stream length, and A is the fixed size of the model and controller, a possible GPU memory target is O(A + W), with external transcript storage O(N). A simple attention implementation that examines W positions per token has O(W) attention work per decoding step, in addition to the model's other computations. Retrieval, memory writes, cache reconstruction, and long-context prefill add overhead. This is a meaningful target only if the achieved quality justifies the reduced information available to the model at each step.

## The Persistent Stream Engine as an inference architecture

The following diagram describes data flow, not a sequence of prompts or a mandatory plan for the model:

```text
                      ORIGINAL USER REQUEST
                                |
                  Persistent session and intent
                                |
                     +----------v----------+
                     | Frozen causal model |
                     | embeddings, layers, |
                     | attention, LM head  |
                     +-----+----------^----+
                           |          |
                  logits, hidden      | selected memory,
                  activations         | context and adapters
                           |          |
                 +---------v----------+----------+
                 |      Persistent Stream Engine |
                 | sampling, state, cache policy,|
                 | memory retrieval, termination |
                 +--------+------------+---------+
                          |            |
                 +--------v----+  +----v----------+
                 | Active KV   |  | Exact archive |
                 | GPU budget  |  | RAM / SSD     |
                 +-------------+  +----+----------+
                                       |
                              semantic and exact index
                                       |
                               memory retrieval
                                       |
                               committed text stream
```

The engine distinguishes two counters. A logical token index increases monotonically for the duration of the response. A physical cache slot is a position within a finite storage allocation and can be reused when data is retired. These counters are not interchangeable. The model also has positional coordinates used by its attention implementation. Those coordinates may be related to logical positions, but their interpretation depends on the model's positional encoding and cache policy. A robust runtime maintains an explicit mapping between logical history, physical residency, and model positions instead of assuming that cache index 4,096 is necessarily logical position 4,096 forever.

At initialization the engine resolves the model revision, tokenizer, chat template, generation configuration, precision, device placement, and memory budget. It records the original request separately from the formatted input. It performs a single prompt prefill and obtains the initial cache and logits. It creates a session with an empty generated transcript, a reproducible sampling state, a record of the intended output, and a position map. The session ID remains stable until an explicit new user request or a deliberate branch. No internal cache maintenance operation is permitted to silently create a new assistant response.

The following state variables illustrate the distinction between persistent and ephemeral state:

```text
SessionState
    session_id, model_revision, tokenizer_revision
    original_request, formatted_prompt
    logical_token_count, committed_byte_count
    sampling_state, generation_configuration
    active_cache, physical_to_logical_map, model_positions
    archive_handle, memory_index, protected_spans
    intent_representation, recurrent_memory
    repetition_evidence, completion_evidence
    pending_output, latest_checkpoint, stop_reason
```

A correct autoregressive loop has an important temporal relationship between model inputs and predicted tokens. The logits obtained after processing a prefix predict the next token. After that next token has been selected, it must be fed back into the model exactly once to extend the prefix and compute logits for its successor. If the prompt prefill already produced the first logits, the runtime must not process the last prompt token a second time with the complete cache. If an adapter changes the cache before the next prediction, it must account for whether the pending logits still correspond to the active state. Using logits computed from a stale cache and then advancing an incompatible replacement cache can create subtle discontinuities.

A simplified conceptual loop is shown below. Names represent interfaces that would need to be implemented for the selected model and library; this is not runnable Python as written.

```python
session = engine.open_session(request, model_config)
result = backend.prefill(session.formatted_prompt)
session.install_initial_state(result)

while session.running:
    if limits.cancelled_or_exhausted(session):
        session.stop(limits.reason(session))
        break

    memory_action = memory.policy(session, result)
    if memory_action.changes_conditioning:
        result = backend.recondition(session, memory_action)

    scores = controller.adjust_logits(result.logits, session)
    candidate = sampler.draw(scores, session.rng)

    if candidate in session.eos_ids:
        decision = completion.evaluate_eos(session, result)
        if decision.accept:
            session.stop("model_eos")
            break
        if not decision.can_safely_continue:
            session.stop("incomplete_or_uncertain")
            break
        candidate = sampler.draw_without_eos(scores, session.rng)

    proposal = session.stage(candidate)
    verdict = controller.inspect(proposal, session)
    if verdict.retry:
        result = recovery.restore(session, verdict.checkpoint)
        continue

    result = backend.decode_one(candidate, session.active_cache)
    session.advance_model_state(result, candidate)
    controller.observe(result, candidate, session)
    archive.commit_eligible(session)
    transport.publish_committed(session)

    if completion.should_stop_at_boundary(session):
        session.stop("controller_completion")
        break

transport.flush(session)
engine.close_session(session)
```

The real loop must make retries safe and finite. A checkpoint includes the relevant cache state, logical position, controller state, decoder state, and random generator state. Restoring it must not overwrite text that was already committed to a user-visible append-only stream. An engine can retain a short speculative suffix before publishing, reject that suffix if it detects a problem, and then regenerate from a valid checkpoint. Alternatively, if the user interface explicitly supports revisions, it can issue a separate revision event rather than pretending previously displayed characters never existed. A basic text stream cannot retract arbitrary earlier text. The engine should never silently regenerate a committed prefix and append the regenerated material as if it were new progress.

Persistent character storage should be committed transactionally. The engine may batch a few token updates for efficiency, but each published range needs a unique monotonically increasing offset. A transport reconnect should resume from the last acknowledged committed offset rather than trigger a new model call. A server restart must distinguish restoration from a durable checkpoint from starting a fresh response. If the neural cache was not persisted, exact token replay may be necessary to reconstruct its state; if the active history was already approximate, the reconstruction must use the same policy and compatible model configuration. Archiving token IDs is not sufficient to guarantee bit-identical continuation across different kernels, quantization schemes, or nondeterministic GPU executions.

Attention sinks are a relevant established technique. StreamingLLM showed that retaining certain initial token positions together with a moving recent window can stabilize language modeling over very long streams in tested models, without fine-tuning. This does not make those initial positions a semantic summary, nor does it grant access to every evicted token. PSST would use a compatible sink-and-window approach as a stability baseline, then separately evaluate whether exact retrieval and learned persistent state improve recall. The research paper is available at [Efficient Streaming Language Models with Attention Sinks](https://arxiv.org/abs/2309.17453).

The positional problem must be treated as a model-specific engineering issue. Many decoder models use rotary positional embeddings, commonly called RoPE, to encode position-dependent relationships in attention. Simply moving an old key tensor into an arbitrary cache slot does not necessarily change the position represented by that key. Similarly, resetting absolute position counters every time the window fills can produce incompatible query-key relationships. The adapter must understand whether its backend stores rotated or unrotated keys, how attention masks are constructed, and what positional transformations are valid. Some streaming implementations shift or re-encode positions according to a particular algorithm; others use absolute positions within an extended range. A cache implementation for one architecture should not be assumed correct for another merely because both expose a `past_key_values` field.

Another subtlety is that an old KV entry encodes more than its token identity. It was produced from hidden activations conditioned on the preceding history visible when the token was processed. Replaying the same token in a different reconstructed context may produce different keys and values. Copying an old key from a different prefix into a current cache may be a useful approximation in some systems, but it is not generally equivalent to ordinary full-prefix attention. PSST should expose this distinction through separate memory modes instead of presenting every restored span as an exact neural restoration.

## Persistent semantic state, memory retrieval, and the proposed neural bridge

The first useful version of persistent memory can be built without training another large language model. The exact archive can be indexed by token ranges, character ranges, line numbers, lexical terms, and optional embeddings. The current local context and original request can provide a retrieval query. For code, a parser can index declarations, imports, file paths, function signatures, and references. For a long explanatory answer, paragraph boundaries and definitions may be useful. These are indexing choices, not an execution plan. They organize information already present in the stream rather than prescribe what the model must write next.

Memory entries should retain provenance. An entry derived from the user request is an instruction or source fact, not a model-generated claim. An entry derived from generated text is evidence of what the assistant has previously written, not independent proof that the claim is true. An entry derived from a compiler error, test result, or external document has its own provenance and time. Generated content may contain quoted instructions or fictional text; it must remain data when recalled instead of automatically acquiring authority over the original request. This distinction prevents memory retrieval from amplifying an earlier hallucination or treating an embedded instruction as a new command.

The `precision_class` identifies the required fidelity. A statement such as the general purpose of an application may be summarized. A function name, numerical constant, cryptographic identifier, exact quotation, file path, or user-specified constraint may require literal recovery. A semantic vector can be used to locate the relevant record, but the engine should retrieve the exact record whenever a precise value matters. Retrieval and representation are separate operations: a fuzzy search can identify a source, while a lossless archive supplies its content.

A simple retrieval score can combine semantic similarity with lexical overlap, dependency relevance, recency, protected status, and estimated retrieval cost. An illustrative score for an archive entry i is:

`score(i) = a*semantic(i) + b*lexical(i) + c*dependency(i) + d*recency(i) + e*importance(i) - f*cost(i)`

This is a proposed ranking function, not a trained model or proven metric. The coefficients must be tuned using held-out tasks. A memory entry's age should not make a unique early constraint inaccessible, and semantic similarity should not dominate exact symbol matching. The selected set must fit a defined memory budget. A greedy selection may be sufficient for the first implementation; later versions could learn to optimize utility under a token or byte cost. The system should also record why an entry was selected so retrieval failures can be analyzed.

There are several plausible ways to feed retrieved information back into the frozen model. The easiest is a context reconstruction mechanism that assembles selected exact history and recent output in a bounded model-compatible representation, then performs a new prefill of that internal working context. This is not a new user-facing answer and need not send a natural-language request to continue. Nevertheless, it changes the model's conditioning and may incur noticeable latency. The engine should be transparent about using reconstructed context rather than call this a fully continuous native transformer state. Rebuilding on every token would defeat much of the performance benefit, so the frequency and cost must be measured.

A more advanced alternative is a memory-aware attention adapter. Selected historical representations are encoded as additional keys and values, or exposed through a small cross-attention path, while the original attention computation retains its local context. The adapter can use learned projections that map external memory into the dimensionality and distribution expected by selected layers. A frozen model is not automatically able to interpret arbitrary vectors supplied in this manner. The adapter must be trained or otherwise calibrated. Without an appropriate training objective, it could inject noise, distort attention, or make the base model less reliable than a simple text retrieval baseline.

The most ambitious version of PSST includes a persistent recurrent semantic state. Let h_t represent a compact observation derived from the model's hidden activations after processing token t. Let x_t represent the generated token and relevant local features. Let I represent the original intent. Let r_t represent information obtained from external memory. Let m_t be the controller's recurrent state. A conceptual update is:

`m_t = F_theta(m_(t-1), h_t, x_t, I, r_t)`

A gated recurrent unit, a small state-space network, or another bounded-state architecture could implement F. A separate projection produces the signal that is returned to the model:

`z_t = G_phi(m_t, I, r_t)`

The variables theta and phi represent trainable controller and adapter parameters. The base model's parameters remain frozen during the first research phase. The output z_t can influence selected hidden layers, memory slots, or token probabilities. The objective is to let information persist across cache changes without requiring the model to repeatedly regenerate an explicit explanation of its progress. A persistent state does not need to contain human-readable sentences, but it must encode useful information in a form that the downstream model can exploit.

The mechanism needs an explicit method for conditioning the model on its persistent state. The following options increase in complexity. A logit adapter adds a learned residual to the vocabulary logits. It is straightforward to implement and can influence repetition or stopping behavior, but it cannot reliably create missing factual knowledge from an arbitrary semantic vector. A hidden-state residual adapter injects a learned projection into selected transformer layers and can potentially affect deeper representations. A soft-memory or prefix adapter provides learned memory vectors that participate in attention. A cross-attention adapter provides a dedicated path from model queries to external memory entries. Each option requires careful handling of training, masks, positions, and numerical stability.

A useful design for a residual adapter is `h'_t = h_t + gate_t * P(m_t, r_t)`, where the gate is constrained and the projection is initialized to have little or no effect. The model initially behaves close to its unmodified baseline. During training, the gate learns when an external representation helps. It should be possible to disable the adapter at inference time and compare the resulting distribution. A conservative adapter can be preferable to an unconstrained controller that overrides the base model's language ability. The goal is memory augmentation, not to replace the model's learned knowledge with arbitrary signals.

The training objective must demonstrate that the persistent state actually carries useful information beyond the local window. One experiment presents the model with a long prefix containing several facts or dependencies, then asks it to continue after the relevant information has been removed from its active cache. The full-context model or a reference continuation serves as a teacher. The controller observes the sequence as the cache moves. It learns to encode and recover information that improves prediction after eviction. The same task is evaluated with and without the controller, under the same memory budget. If the controller performs no better than the recent-window baseline, a visually impressive state representation has not achieved the intended function.

A distillation objective could combine next-token cross-entropy on reference continuations with a divergence between the teacher and student distributions. A proposed loss is:

`L = L_next + lambda_d*KL(p_teacher || p_student) + lambda_r*L_recall + lambda_c*L_completion + lambda_g*L_gate`

The teacher uses more context where possible, while the student uses the bounded active window and persistent memory. The recall term rewards correct recovery of older information. The completion term teaches appropriate termination. The gate term discourages excessive intervention. The components should first be studied separately, since combining them too early makes it difficult to determine which change caused an improvement or a regression. Teacher predictions are not ground truth for facts; exact task labels and verifiable outputs remain valuable supervision.

Training data should include natural language, long-form technical writing, source-code continuations, dialogue, synthetic key-value recall, adversarial distractors, and examples where old information becomes relevant unexpectedly. Artificial recall tasks make evaluation precise, but success on them alone is insufficient. The dataset should include legitimate repetitions, changing requirements, paraphrases of earlier claims, and scenarios where the correct response is short despite a long prompt. It should distinguish a requested repeated structure from unwanted degeneration. It should also include situations in which a distant fact is irrelevant so the controller learns not to inject memories merely because they exist.

A practical training curriculum starts with short sequences and artificially small working windows. For example, a 512-token active window over a 2,048-token sequence can expose context eviction without requiring enormous VRAM. A later experiment can increase the window and sequence length. Truncated backpropagation through time can limit recurrent training memory, but detaching the state too frequently may weaken learning of long-range relationships. Teacher logits and selected observations can be computed offline, stored, and reused where the architecture permits. Training a small adapter on precomputed observations can be much cheaper than end-to-end adaptation, although it cannot teach every interaction between the adapter and the frozen network.

Several existing research directions support pieces of this proposal. [Recurrent Memory Transformer](https://arxiv.org/abs/2207.06881) explores carrying learned memory across segments using special memory representations. [Long Context Compression with Activation Beacon](https://arxiv.org/abs/2401.03462) studies compact activations for longer-context processing. [Dynamic Memory Compression](https://proceedings.mlr.press/v235/nawrot24a.html) explores adapting pretrained models to compress attention memory. [Plug and Play Language Models](https://arxiv.org/abs/1912.02164) demonstrates a form of external activation steering for generation. These works support the plausibility of particular mechanisms; they do not establish that the entire PSST architecture will work, nor that these mechanisms can be combined without additional training or loss of quality.

The original character-level idea also suggests a more distant research direction. [Byte Latent Transformer](https://arxiv.org/abs/2412.09871) studies processing bytes in dynamically constructed patches using a different architecture. It is not a drop-in replacement for the tokenizer of an arbitrary pretrained model. PSST could eventually develop a character- or byte-derived memory encoder that groups content into variable-sized semantic patches and learns to represent them as memory vectors compatible with the base model. Ordinary tokens would still be used for generation until a separately trained architecture supports a different output representation. The potential advantage is not that one character costs less than one token in a conventional transformer, but that a group of characters can sometimes be represented by fewer learned memory units than its original neural history.

## Controlling repetition, continuity, and completion

A purpose-aware stream needs more than an external archive. It needs a mechanism that distinguishes meaningful continuation from accidental recurrence. A single repetition penalty cannot do this reliably. Repeated tokens may be essential for syntax, poetry, quotations, lists, tabular data, or programming. Conversely, a model may repeat the same argument in different words while producing no exact token-level duplication. The controller must therefore evaluate repetition at several resolutions and distinguish evidence of a loop from evidence of ordinary structure.

The least expensive detector maintains rolling hashes of token n-grams and recently committed character spans. It looks for repeated sequences, periodicity, duplicated introductions, and recurring long substrings. A semantic detector can compare embeddings of recent and historical passages, but similarity alone is not evidence of a fault. A paragraph that explains a previous concept in more depth may be useful. The controller can combine overlap, recurrence interval, lexical novelty, semantic change, task-specific structure, and the model's uncertainty. It should require multiple signals or a high-confidence exact recurrence before intervening. For coding, syntax-aware comparisons should distinguish reuse of an idiom from duplication of an entire implementation or declaration.

A practical control policy uses graduated interventions. At low risk, generation proceeds unchanged. At moderate risk, the controller may apply a bounded penalty to candidates that would extend a detected cycle. At high risk, it may request relevant memory, adjust a sampling parameter within an authorized range, or regenerate a short uncommitted suffix from a checkpoint. If recovery attempts are exhausted, it terminates with an explicit degeneration status. Repetition recovery is finite; a runtime that repeatedly retries the same failed generation has merely replaced a visible loop with an internal one.

A conceptual logit adjustment is `L'_t(v) = L_t(v) + alpha*C_t(v) + beta*P_t(v) - gamma*R_t(v)`, where v is a candidate vocabulary token, C is estimated continuity, P is estimated useful progression, and R is estimated loop risk. In a real implementation these scores need to be defined and calibrated. A candidate token does not generally reveal its semantic consequence in isolation. Early versions should apply cheap penalties only to tokens that extend verified recurring patterns. More ambitious versions can score a small set of candidate continuations with limited lookahead, or learn an adapter that predicts useful steering signals. The controller should preserve the base model's distribution whenever evidence is weak; overaggressive changes can damage fluency, introduce hallucinations, or prevent valid code from being generated.

Completion presents a different problem. The standard EOS probability is learned from training examples and is a valuable signal, not an obstacle to be removed. Disabling EOS simply because the user wants unlimited streaming may make a correctly completed model continue into irrelevant material. The goal is generation until the job is done, not generation until every available resource has been consumed. The controller should generally respect model EOS, while allowing carefully bounded intervention when there is strong evidence that a required output remains unfinished. There must also be explicit stop conditions for cancellation, errors, time or resource ceilings, and persistent degeneration. None should be mislabeled as successful completion.

The completion estimator can consume original intent, local hidden observations, generated history, memory evidence, structural validity, and optional external validation. For an explanation, it may estimate whether the requested questions have been addressed. For a code artifact, it can use parsed syntax, file completeness, or actual test results when available. A closing Markdown fence is evidence that a code block is syntactically closed, not proof that its program works. A passing compiler establishes that a program compiled, not that it satisfies every requirement. The detector must avoid making stronger claims than its evidence supports. It must also not mistake length for quality: a complete one-sentence answer is preferable to ten pages of filler when one sentence satisfies the user.

## Implementation and experimental validation

The first practical implementation should be a standalone Python research package using PyTorch and Hugging Face Transformers. The original pretrained model and tokenizer should be loaded from pinned revisions, and the installed library version should be recorded. A modest reference model such as [Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct) is a reasonable starting point. Its published model card specifies a 32,768-token context and an 8,192-token generation configuration; it is not a native 256K-output model. Using such a model makes short-context experiments practical and ensures that crossing its supported limits is treated as a research experiment rather than a guaranteed feature.

The engine should define a backend interface with prefill, single-token decoding, position handling, cache inspection, checkpoint restoration, and optional activation hooks. Sampling and stop conditions should live in the runtime rather than a frontend. Use a native append-only token archive and incremental UTF-8 decoder. SQLite can hold session metadata and indexes, while binary files can store contiguous token IDs, text bytes, and optional tensor blocks. PyTorch can implement the experimental controller. A future optimized backend may use llama.cpp, CUDA kernels, C++, or another compatible inference library; Rust or TypeScript may handle application integration. Porting should follow correctness and profiling rather than precede them.

This is one possible organization; the actual interfaces are more important than the folder names. Build the initial engine around strict incremental decoding equivalence. Given identical prompt formatting and greedy decoding, the custom loop should reproduce the reference output for a short sequence. Compare the first-step logits and selected subsequent logits within numerical tolerance. Then test that every selected token is consumed exactly once, that the recorded text decodes correctly from the stored tokens, and that reconnecting a frontend does not restart generation. Test non-English scripts, emoji, whitespace, multiline code, and special tokens. Explicitly test EOS, max-length handling, cancellation, server disconnects, and cache allocation failures before implementing semantic interventions.

A boundary-specific diagnostic should vary output limits and active context limits independently. Record the prompt token count, generated token count, logical sequence ID, request count, cache length, physical slot index, position IDs, EOS events, stop reasons, and a rolling hash of the output. If the client makes a second request at the failure boundary, investigate the client or server. If the first-token distribution appears again after a cache change, investigate conditioning and position handling. If a loop emerges with a correct full cache well before any limit, investigate sampling and the model distribution. If moving a configured threshold also moves the failure boundary, that is useful evidence of a runtime-related problem, but not conclusive proof of the exact bug.

The next implementation should establish measured memory accounting. Use the model's actual configuration rather than the hypothetical 32-layer example. Measure allocated and reserved CUDA memory, peak usage after prefill, peak usage during decoding, CPU RAM, archive size, and transfer overhead. Test full caching within the model's supported range, then cache quantization and offloading, then a compatible rolling window. Hugging Face documents [KV cache strategies](https://huggingface.co/docs/transformers/kv_cache) and [generation strategies](https://huggingface.co/docs/transformers/generation_strategies). Its APIs may change, so pin and verify versions. [KIVI](https://arxiv.org/abs/2402.02750) is relevant to low-precision cache research. None of these features automatically solves loss of semantic context after eviction.

For a 12 GiB consumer GPU, begin with a small model, batch size one, and a 2K- or 4K-token active cache. Measure headroom rather than assuming that 8K will fit with every training configuration. Once inference is stable, try 8K and appropriate low-precision weights or cache representations. For smaller GPUs, CPU or partial offloading may be necessary. Adapter training may require a smaller model, short sequences, gradient accumulation, checkpointing, or precomputed teacher features. Inference feasibility does not guarantee training feasibility. A 256K-token output is a stress-test target, not a normal default or a promise of good latency.

The experimental comparisons should hold the base model, tokenizer, prompt, sampling configuration, and random seeds constant where practical. Use a standard full-cache baseline where it fits; an offloaded full-cache baseline where feasible; a sliding-window or sink-plus-window baseline; a bounded-window system with exact archive retrieval; and the proposed learned-controller system. Add one component at a time and include ablations for the recurrent state, retrieval, repetition penalties, and completion estimator. Report when the full-context baseline cannot fit or exceeds the supported position range instead of treating an unavailable baseline as a failed answer.

The benchmark suite needs several types of tasks. Synthetic recall should place exact random identifiers or numbers at controlled distances and test whether they can be recovered after eviction. Long-form generation should measure duplication, topic drift, contradictions, and fulfillment of the initial request. Code-generation workloads should measure identifier consistency, syntax validity, compilation, and actual tests where applicable. Boundary tests should deliberately place a definition or incomplete sentence near a cache transition. Completion tasks should include short correct answers, long complete answers, and plausible incomplete answers. Legitimate repetitions, such as a requested refrain or repeated syntax, must be tested to ensure that loop prevention does not incorrectly suppress them. Evaluate a range of distances, lengths, sampling seeds, and languages, not only a favorable demonstration.

The primary engineering measures are peak GPU memory, GPU memory growth after warm-up, host memory growth, throughput, first-token latency, time spent retrieving or reconstructing context, and total output length. The primary behavioral measures are exact recall accuracy, relevant semantic recall, duplicate or periodic output rate, task success, premature termination, unnecessary continuation, and consistency across context transitions. A metric such as repetition rate should have a documented definition and ideally be paired with examples. A controller that merely truncates every response would exhibit little repetition but fail task completion. Likewise, a system that streams indefinitely would have high output length and poor usefulness. Success must be measured jointly.

A proposed initial research milestone is reliable logical continuation across multiple 4K boundaries while keeping GPU residency inside a measured budget. A later milestone is 32K and then 256K cumulative tokens with meaningful quality measurements, not just a generated counter. Another milestone is measurable recall improvement over a recent-window baseline at equal GPU memory. The learned memory adapter earns its place only if it outperforms simpler exact retrieval or achieves comparable quality with a better resource trade-off. If the controller's benefit disappears when evaluated on unfamiliar tasks or models, the result should be documented rather than presented as a universal breakthrough.

Instrumentation is especially important because the theory is about mechanisms that are largely invisible in a typical chat interface. The engine should record cache events, selected memory IDs, controller scores, intervention counts, EOS decisions, committed offsets, and actual memory usage. Telemetry values must represent real measurements or explicitly labeled estimates. A frontend may show the logical stream length, current active cache size, GPU usage, retrieval events, and stop reason. It should not claim that a decorative awareness percentage proves the model understands its work. For integration into Solarium, the engine could expose a local event stream and a cancellation interface while retaining all inference control in the backend. The application should consume committed text events; it should not simulate continuity by issuing repeated requests to the model.

## Conclusion: separating the lifetime of a stream from the lifetime of its cache

The theory is intentionally falsifiable. If a bounded working context plus external retrieval cannot maintain sufficient task coherence, the design needs revision. If the learned state provides no benefit beyond a simple retrieval mechanism, it should not be retained merely because it sounds sophisticated. If completion detection causes frequent premature stops, native EOS may be the better default. If an exact 4,096-token restart is caused by a frontend bug, the correct remedy is to repair that bug before attributing it to model architecture. The first objective is a correct, instrumented engine. The second is useful bounded-memory generation. The third is experimentally demonstrated semantic persistence. The final ambition is reliable, resource-aware generation across long streams on ordinary hardware, without requiring the original pretrained model to be rebuilt from scratch.

This is not a claim of an unlimited-context model, a conscious AI, or a completed invention. It is a proposed systems architecture and a testable research program. Its most important principle is that the engine should never confuse the exhaustion of a temporary computational representation with the exhaustion of the user's request. When the work is complete, it should stop; when the work remains incomplete and continuation is feasible, it should preserve its progress; when it cannot proceed reliably, it should report that limitation instead of silently restarting or producing endless repetition.
