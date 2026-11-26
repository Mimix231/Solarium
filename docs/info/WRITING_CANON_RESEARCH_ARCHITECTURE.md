# Solarium 0.1 Writing, Canon and Research Contract

Read with [INFERENCE_ARCHITECTURE.md](INFERENCE_ARCHITECTURE.md) and [SOURCE_AND_ACTION_ARCHITECTURE.md](SOURCE_AND_ACTION_ARCHITECTURE.md).

## Stable authoring

`writing/repository.ts` owns stable Writing Document IDs, rich content, revisions, categories and recovery drafts. Tiptap/ProseMirror schema 1 JSON is the editable authority; Markdown is the portable projection. Raw HTML is escaped, unsupported document/link schemas fail validation, and remote image embeds cannot enter the trusted editor. A document is not clipped to the current model context or legacy output setting.

Each save creates an immutable revision with a parent revision and compare-and-swap against the current document. Recovery drafts are separate records/bodies and cannot silently replace a user's edited revision. Selection rewrites capture exact text and revision; applying a stale selection is rejected. The rich editor supplies headings, lists, formatting, undo/redo, find/replace, revision comparison/restore, source/cast links, and Markdown/TXT/DOCX/HTML/print export. Printing uses a sandboxed document. Export contains real current content, never a placeholder.

Categories form a user-created tree within one owner and Story World. Cross-owner/story parenting, duplicate siblings and cycles are forbidden. Deleting a category retains its documents. Full import/export retains related revisions, provenance and stable identities or explicitly remaps them into a chosen owner.

`WritingDraftStream` consumes existing answer deltas only. It uses the existing writing-fence assembler, stable message/block identity and serialized periodic recovery writes. It never requests more tokens or restarts reasoning. A completed fence can be checkpointed as a completed draft before a subsequent genuine tool turn. Cancelled/unclosed fences remain recoverable and incomplete.

## Long chapters

`writing/long-task.ts` recognizes explicit long character/word targets. Length is measured from actual prose (Unicode code points for characters); headings/scene breaks are ordinary document text, not fabricated padding. Requested length, model context and legacy output budget are independent. All native responses still use one `streamContinuousAnswer`/one HTTP request and `max_tokens: -1` on the same loaded llama.cpp model.

A `writing_task` holds the exact user goal, length target, scene plan, explicit continuity constraints, accepted scenes, next scene, stop reason, and document revision. Planning is a finished assistant operation. Each scene is a new planned document operation with the original user request, current scene, relevant source/continuity material, recent accepted outcomes and exact prose tail. Only after that scene's native response reports a natural end is it accepted and committed. No generated reasoning is injected into a later prompt, no synthetic user “continue” message is added, and no active stream is interrupted at a token quota. Meaningful further development can be planned after completed saved scenes if the model underwrites the target.

The one visible writing artifact points to one saved document. Partial prose is checkpointed while streaming. Concurrent user edits cause a revision conflict and preserve recovery text. Repeated paragraphs/whole scenes are rejected before acceptance; this is a focused repetition check, not a guarantee of literary quality. Only an actual finished response plus the measured length requirement can complete the task. Backend capacity, transport failure, missing answer, unknown termination and User Stop leave the task incomplete. Explicit user Resume can recover partial prose as document data; it never reconstructs the interrupted reasoning channel.

Native context shifting is backend/model dependent. It bounds active KV memory and can evict older tokens. It does not create unlimited recall, train a small model to write well, or guarantee infinite generation. `GenerationOutcome` records natural EOS, tool calls, context/output capacity, unknown stop, input rejection, transport failure and cancellation. Unsupported/unknown shifting stays unsupported/unknown. Finite backends are not presented as universally unbounded.

## Story Worlds, cast and evidence

`stories/repository.ts` stores original/fanfiction/mixed worlds, canon anchor, continuity/spoiler point, divergence, narrative settings and branches. A story character is separate from the assistant Spark. Cast names and aliases deduplicate within their world. Character cards contain sectioned typed claims, per-field provenance, confidence/review/lock state, history, knowledge and relationships. Portraits are local data, not arbitrary remote URLs.

Claims distinguish canonical evidence, AU overrides, inference and unknown/unverified material. Machine-created canonical claims require exact short excerpts from available scoped sources and cannot overwrite locked claims. Manual canon edits require explicit user confirmation. Source locators and spoiler/continuity boundaries apply to retrieval and claims. A branch copies/remaps its world identities without altering the source world.

Continuity packs select relevant cast/facts for the current task. A deterministic consistency review flags saved constraints and contradictions as suggestions; it does not establish perfect voice, world knowledge or semantic consistency and never silently rewrites prose. Unknown canon fields remain unknown. Relevant event and knowledge-state records are available separately from appearance/personality fields.

## Exact-scene research

`research/research.ts` identifies entities/events/arc/chapter intent, plans queries, ranks candidates and reads actual pages before claiming scene evidence. Search hits and snippets are not proof that a page was read. The visual grid shows real lifecycle states and failed/ambiguous matches. The Arc 7 arrow regression distinguishes the forest/tree incident from the later poisoned-arrow event. A result should retain the actual page URL, title, locator, retrieval time/hash and a short supporting passage.

Saved evidence is scoped and enabled explicitly. Sources and web pages remain untrusted. Web OFF permits local authoring, dossiers and saved-source retrieval, while blocking background/provider web calls. General entity recognition and local ranking are useful heuristics, not exhaustive franchise knowledge. Unsupported/blocked pages and search-provider limitations remain visible.

## Required acceptance

Run source/storage/schema/revision/selection/scope/permission/long-stream and inference regressions; TypeScript, lint, production build and Rust checks/tests. Separately exercise native SQLite, rich-editor edits/restart, actual source retrieval, valid exports and real GGUF generation. Controlled 50k transport fixtures prove storage/stream behavior only. Real-model quality, chronology, voice, throughput and capacity need separate observed evidence. See `DAILY_USE_VERIFICATION.md` for the current run.

## Chat-first authoring and character avatars

The ordinary writing surface is `InlineWritingBlock`: actual chapter prose, edit/read controls, serialized autosaving with immutable revisions, continuation and Markdown/DOCX export in chat. Revision/history tools remain optional. Completed normal writing fences commit their durable draft automatically unless a concurrent user edit changed the revision. A generated display fence is not a claimed external filesystem write. CAS conflicts preserve recovery text rather than overwriting a user edit.

`StoryCast` selects a story and edits portrait/voice/personality/motives/relationships/knowledge cards in chat. Portraits remain local image data. User profiles are locked against machine replacement. `remember_character_fact` requires a verbatim statement from the latest explicit user correction; research cannot claim that authority. Cast, confirmed events and explicit per-character knowledge are selected even for a generic "next chapter" request. Unknown knowledge means the character does not know; omitted knowledge is unspecified, never omniscience.

`stories/memory.ts` accepts event metadata only after prose is saved, matching an exact passage and the document revision. It saves `story_established` events, never external canon or new locked identity. Scene plans and stopped scenes do not become events. Accepted scene memories refresh the next operation's context. Editing away an event's supporting passage retracts it from active recall while retaining the original record for inspection. Automatic metadata capture is part of authoring the selected story and respects an explicit `remember_story_event` deny; explicitly called memory tools retain Ask/Auto/YOLO permission handling. No review studio is required to write or use saved cast memories.
Characters can be opened in chat to see recent memories and their exact saved passages. Convenience-profile knowledge is a timeline baseline, with the event order retained; later established revelations can advance it without rewriting the user's protected profile or treating prior ignorance as permanent. Explicit never/always constraints remain fixed. Duplicate names/aliases cannot silently merge or overwrite an existing avatar card. A text-only model may assign an explicitly requested portrait as an opaque chat attachment reference; it never receives/describes unseen pixels, and ordinary image analysis still requires vision support.

## Connected conversation and artifact recovery

A chapter request inherits explicitly approved outline beats, dialogue formatting and an applicable length preference from its retained conversation brief. It does not invent a 50k default for an unspecified request. A completed fence is structural evidence only; approved-beat drafting and measured length remain separate. Existing unplanned chapters can be continued with their stable document ID, immutable previous revisions and additional message bindings. Linking a previously unscoped chapter to its selected story preserves owner boundaries and all original bodies. A covered beat in existing prose requires its exact supporting passage.

The incremental block scanner recognizes a repeated writing opener inside an active writing block as malformed control syntax, preserves every prose passage and records a structural issue. Original chat text remains unchanged. Already-saved malformed Markdown is recovered for reading only; saving the readable formatting is an explicit new revision. Code samples in articles remain code. Reading wraps long lines. Four-word overlap checks flag substantial repeated passages; semantic coherence and voice use a separate reading assessment.

Character setup from conversation is grounded in exact human statements with message IDs and quotations. User facts, assistant interpretations, sourced canon and accepted events remain distinct. A per-event optional belief has its own supporting prose quote and is displayed separately from confirmed world truth. Removing that passage retracts the active belief. Retrieval ranks accessible claims/events offline and retains distant private knowledge alongside recent events instead of treating only the last two events as relevant. Whole selected claims retain their values; omitted fields remain available via the story-memory reader.

A fresh chapter with an explicitly accepted outline and no numerical length target executes those saved beats directly. It does not ask the model to plan the same outline again. Each actual scene still requires naturally completed prose and its supporting passage. Length-driven expansion and continuation of existing prose retain their distinct planning operation. The approved-four-beat regression requires exactly four native scene responses.

When a model copies a quotation with punctuation/case differences, an unambiguous identical lexical sequence can locate the ORIGINAL human passage. Only that original passage is persisted as userQuote/value; the proposed argument remains unchanged in the audit archive. Different words, omitted negation and ambiguous repeated passages are rejected. This is source alignment, not permission to promote paraphrases or inferred facts.
## Fiction categories and chapter presentation

Settings groups use Story Worlds. Categories select an arc and edition. Each category can hold a versioned profile for an existing character identity with full local section bodies up to 50,000 Unicode characters per field. A personal group can be copied into the active owner by an explicit chat selection. A chapter task records its cast selection and retrieved references. Relevant profile excerpts, exact evidence and established scene memories feed subsequent scenes.

The chapter planner reserves its conclusion and can insert further development before it when accepted prose is short. A proposed ending can complete the task only after natural generation and the saved prose reaching the requested length. Chapter scene boundaries use semantic Markdown rules. Settings → Fiction controls their presentation in the reading block. Numbered scene labels from generation are omitted from saved prose.

New long narrative plans group connected actions into longer scenes. Each scene schedules two complete developments, each with its own observable outcome. A naturally finished response must quote the passage where the action happened before the controller checkpoints that development. The next development starts from that exact checkpoint inside the same scene. The scene advances only after both developments and the scene's share of the requested length pass. The committed prose revision and the task's scene index update atomically. A stopped or rejected development remains recoverable without creating a completed scene or a story memory.

## Fanfiction chapters and the chapter reader

Fanfiction chapter requests use a default minimum of 82,000 characters. A length
in chat, an explicit request without a target, or the world's configured length
can change it. The writer plans advancing scenes and a reserved conclusion.
Each scene needs its observable outcome and a supporting passage. A shorter
scene with a completed action can be saved. Later scenes receive the exact prose ending, recent outcomes, earlier
consequences and the saved cast. Further action develops before the conclusion
when cumulative prose is short. Chapter completion uses a readback of the saved
revision and the original length requirement. Existing tasks keep their saved
scene or development schedule.

After a reported capacity stop, the writer saves the real draft. It archives
an interrupted clause and uses it as a hint when continuing from the last
complete sentence. If the planned action remains open, the chapter task saves
the relevant draft passages and a specific next beat with the same scene index.
A natural stop before the action ends can use the same checkpoint. The scene
spacer is inserted only after an accepted scene. The continuation overlay shows
actual save and cast progress, continuity notes and the next beat. Native Stop
keeps the last checkpoint available for explicit Resume.

The Spark checks actual prose against active profiles and user instructions.
It can recover missing outcome metadata by selecting a numbered passage. Voice,
private knowledge and out-of-context behavior may trigger a live correction.
Only the addressed original passages can be replaced, and revised passages are
checked again before acceptance. The original output is retained in the local
archive. A review is a model assessment and can miss subtle voice or context.
An exact copied opening can be removed when new prose follows it. Small
remaining repetitions can use the same passage correction.

`save_fiction_profiles` stores original summaries in the active Story World.
Appearance, personality, voice, abilities, history, motives, relationships,
knowledge and AU constraints have independent fields. A cited field needs an
exact passage from an enabled scoped source that matches the active continuity.
Uncited summaries are labelled AU drafts. Existing fields and user locks take
precedence. Character cards show those origins and lock only fields the user
changes. The Fiction settings include narrative style notes and dialogue layout.
The drafting prompt uses those choices, the cast's traits and private knowledge,
and relevant source passages to guide original fiction.

The web preparation stage reads the actual selected page and saves the readable
source. Explicit source arc, chapter and edition resolve independently of the
fanfiction's chapter number. Exact chapter, premise and cast references have
different roles. Web ON can follow a verified page's actual chapter links.
The native story reader saves a bounded readable snapshot. Chapter excerpts
keep evidence from late in the page alongside the opening and relevant details.
Later chapters reuse enabled pages attached to the story and prior chapter
tasks when their continuity boundaries match. Web OFF permits this local
recall. Profile claims may have different versions by arc, chapter and edition.
The draft receives the applicable version and human world rules separately
from what each character knows. The Spark can prepare profiles with the saved
evidence. Failed readings or profile saves remain visible in the Work Log.
At a specified opening, unlocated draft events stay out of active recall.
An explicit cast list scopes character retrieval and the continuation display.
The planning, drafting, and review requests retain a concise excerpt of the
read chapter with its exact source point when that evidence is available.
An authorized profile save can retain explicit disclosure restrictions and
stated limits on a character's knowledge verbatim, with the original user
message ID. Those restrictions remain distinct from facts in a web excerpt.

A fiction-chat mention can prepare a card during discussion or planning.
The Spark identifies the mentioned fictional character. Available source
evidence feeds a naturally finished profile-drafting stream, so the sections
can appear live even when a backend buffers tool arguments. The preview is
provisional until the registered scoped save succeeds. Personality, appearance,
history and abilities use separate summaries. Empty placeholders do not enter
active recall. Authorized new detail can fill an old generated placeholder.
User-locked text remains authoritative. Ambiguous standalone names can be
answered without creating a world. The character dialog can open the saved
profile from a different arc or edition.

In chat, `[Group > Category]` resolves the exact existing fiction destination.
It can select a personal library category without creating a chat copy.
Following mentions use the selected destination until the user changes it.
The completed save writes real category profile records with revisions and
preserves fields authored by the user. A chapter can read the selected
category while retaining its own document owner and saved scene history.
Named lists become individual cast candidates. A profile save validates each
name and rejects a list supplied as the identity of one card.

Each Fiction group can store its author’s story brief. Planning, drafting and
review use the brief with the selected continuity point and character
profiles. Important character fields retain their named attribution. The
review can check family and history against those records and can identify
direct appearance conflicts for an exact passage repair. A chapter’s tone
leaves room for the characters to respond to individual situations.

Search results are checked against the current public query before they gain
selectable IDs. The scoped audit retains what the provider actually returned.
A weak or failed Bing response can offer an explicit Mwmbl fallback for the same topic
in chat. A weak result may also suggest a shorter public query with the same
subject. The Spark must call the search tool explicitly for either option.
The public search terms and observed results stay with the archived research
record. General pages need relevant terms in a coherent excerpt before they can
become evidence. New general research topics recall saved material by the
current request. Only matching observed links, followed
references and URLs supplied by the user can be read.
Fiction research offers the unread supplied references first. The Spark calls
the registered page reader for each source, and attempted URLs leave the list.

The inline writing block offers a larger reader with scene navigation, speaker
labels, separated narration, rich editing and export. The reading surface uses the current durable
revision or a compatible recovery draft. `Name: dialogue` formatting only
uses speakers identified by the printed label or nearby speech attribution.
Dialogue can stand on its own even when the speaker is unclear. The user's
scene spacer applies to both readers. Recoverable stops continue in the
active chapter with the visible overlay. An explicit chat request can
continue a deliberately stopped chapter from its saved document.
