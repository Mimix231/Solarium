# Solarium 0.1 — Writing, Canon Research & Character Foundation

> **Status:** PLANNED — implementation specification for Codex, not a claim of working features.  
> **Prepared:** 2026-10-30  
> **Product:** Solarium, local-first open-source AI creation workspace  
> **Milestone:** A single, coordinated major implementation of a serious Writing Block system, precise fandom-aware research, story worlds, character dossiers, and categorised writing storage.  
> **Dependencies:** Existing Solarium source; `AGENTS.md`; `docs/info/INFERENCE_ARCHITECTURE.md`; and the companion `SOLARIUM_INTELLIGENCE_AND_KNOWLEDGE_FOUNDATION.md` plan.  
> **Audience:** Codex implementers, reviewers, testers, and future Solarium maintainers.  
> **Deliverable:** Running code, migrations, tests, UI, documentation, and honest validation results—not another proposal.

---

## 0. Mandatory instructions for Codex

**Implement this as one integrated product milestone, not a collection of disconnected mockups.** Read the complete specification before editing code. Inspect the actual checked-out repository and reconcile the named paths/interfaces below with what exists now. The provided paths are based on a prior Solarium 0.1 source snapshot; the current checkout is the final source of truth.

1. **Keep Solarium at version 0.1.** Preserve Sparks, avatars, themes, projects and conversations, Code Blocks, inference engines, Ask/Auto/YOLO, Visual Actions, and existing user data.
2. **Respect the inference architecture contract.** Never add forced 2,048-token HTTP restarts, synthetic "continue thinking" messages, separate reasoning quotas, arbitrary reasoning-only failure counters, or per-segment model reloads. Use the existing native continuous llama.cpp stream, and honor backend capabilities. This milestone is about writing, retrieval, storage, and tool orchestration **around** inference.
3. **Do real work.** A chapter is only *saved* after storage confirms the write. A website is only *read* after the actual content fetch succeeds. A character claim is only *verified* if it is supported by a retrievable source. Visual progress must reflect real events.
4. **Do not erase the existing Writing Block.** Add migrations and adapters so existing Markdown blocks and saved assets still load. New structured documents extend, rather than destroy, compatibility.
5. **Do not confuse Sparks with story characters.** A Spark is the user's AI assistant persona; story characters are editable entities in a story bible. One Spark can author multiple stories containing different characters without contaminating the Spark's personality.
6. **Avoid invented canon.** When research cannot substantiate an exact detail, distinguish unknown, tentative, fan interpretation, and intentional alternate-universe changes. Do not fill every profile section with guesses for the sake of completion.
7. **Do not fetch or inject copyrighted full chapters without authorization.** Use source discovery, restrained excerpts where permitted, structured paraphrases, chapter/scene references, and citations. Don't reproduce long passages from a copyrighted source to populate a character sheet.
8. **Keep Web Search OFF authoritative.** When disabled, no internet requests from automatic search, manual tool calls, site previews, background revalidation, favicons, or page metadata lookups unless the user explicitly changes that permission. Local saved references remain usable.
9. **Respect scoped persistence.** Chat Sources are for one conversation; Project Sources for that project; Story Bible/Character Library for an explicitly linked story world. No global cross-story leaks.
10. **Use existing permissions.** Ask/Auto/YOLO apply to actual filesystem/tool operations; YOLO is not permission to leave the project scope or bypass web/network restrictions.
11. **Make every significant feature discoverable.** A user must be able to create story worlds, create categories, save/move writing, open character cards, start chapters, trigger research, and review sources without manually crafting JSON.
12. **Run real checks and fix errors.** Use `npm test`, `npm run check`, `npm run lint`, `npm run build`, `cargo check` in `src-tauri`, and end-to-end desktop tests where available. Report blockers and unverified items without inventing success.
13. **All updates must be atomic and recoverable.** Do not overwrite a large document or character profile with partially streamed or invalid output. Preserve drafts and versions on cancellation or crash.
14. **Maintain a provenance chain.** A reference, a profile statement based on it, a scene using that statement, and any later correction must remain traceable without displaying ugly JSON in the interface.
15. **Test with an actual hard fandom scene.** Re:Zero Arc 7's jungle arrow incident is a mandatory benchmark; a broad "Re:Zero facts" search is not enough.

### Deliverables checklist

- [ ] Reworked streaming Writing Block with editable, persistent rich-text document representation.
- [ ] Writing Library supporting arbitrary categories and per-chat/per-project/story associations.
- [ ] Story Worlds and Story Bibles with structured lore, outline, characters, chronology, relationships, and canon/AU settings.
- [ ] Character dossier creator: section-by-section grounded fields, user editing, provenance, versions, and independent story character scope.
- [ ] Precise search system with entity/arc/scene query planning, domain-specific ranking, page reading, evidence extraction, and citations.
- [ ] Source-to-character and source-to-chapter linking, without loading an entire webpage into a single field.
- [ ] Live writing and editing integrated with chat and Visual Actions; truthful saved/unsaved states.
- [ ] Validation, migrations, test fixtures, and documentation.
- [ ] Working end-to-end example from a specific canon event to researched character cards to a new story chapter.

---

## 1. Product vision: an actual authoring environment

Solarium is not solely a roleplay chat interface. A person should be able to ask a Spark such as Dona or Echidna to **research a fictional canon, assemble a reliable story bible, write scenes or chapters, revise them, organise them into a library, and export them**. The result must be a real editable document with persistent knowledge rather than a wall of chat text that becomes inaccessible later.

The writing experience must satisfy several different users:

- A **fanfiction writer** who cares about canon accuracy, character voices, chronology, and a specific scene from an existing series.
- An **original-fiction writer** who creates entirely new characters and settings with no web research.
- A **mixed/AU writer** who deliberately changes one canonical fact but expects everything else to remain internally consistent.
- A **screenplay or game narrative designer** who needs scenes, acts, dialogue, lore, relationships, and choice paths.
- A **general author** who needs chapters, articles, essays, reports, documentation, and editable long-form content.

The core interaction should be natural:

> "Dona, research the scene where Subaru is struck by an arrow in the jungle in Re:Zero Arc 7, create grounded profiles for the characters relevant to my fanfic, then write a new chapter exploring an alternative outcome. Save it under my Re:Zero project's `Alternative Routes / Arc 7` category."

Expected: real research with citations; evidence/uncertainty where necessary; structured character records; a streaming Writing Block; an actual persisted chapter in the chosen category; a succinct final report. The user should not need to manually instruct twenty individual tools.

### 1.1 Design pillars

**Correctness before confidence.** If Solarium finds the wrong arc/chapter, it must not silently build a profile based on it.  
**Personality without contamination.** Dona can sound like Dona, but her wording must not overwrite Subaru's, Rem's, or other story characters' canon traits.  
**User control.** Canon, AU changes, narrator voice, chapter revisions, categories, and character interpretations are editable.  
**Local-first.** Writing, cards, categories, and saved research remain usable without the internet.  
**One coherent UI.** A Writing Block, profile card, research grid, scene outline, and library item share the same underlying data and link together.  
**No imaginary actions.** Streaming proposed text is not an actual saved document until persistence confirms it.

### 1.2 Explicit non-goals

- No mandatory cloud account, paid search, or online model.
- No promise of perfect canon or perfect character imitation. The system should be auditable and improvable, not magically omniscient.
- No automatic importing of entire copyrighted novels or fan translations into the prompt or permanent local storage.
- No forced prompt truncation to make room for enormous story bibles; retrieval selects relevant sections.
- No separate personality trainer per fandom character.
- No model-image generation requirement; portraits are optional user-provided/generated assets, subject to user rights.
- No additional sidebar full of fake progress labels or another special reasoning budget.

---

## 2. Existing architecture to integrate—not rewrite

Inspect these actual modules or their current equivalents before changing them:

| Existing area | Baseline code | What to extend / preserve |
|---|---|---|
| Writing and other streamed blocks | `src/blocks/protocol.ts`, `ContentBlock`, `BlockStreamAssembler`, `parseMessageParts()` | Maintain ordinary Markdown compatibility and stable streaming block IDs; introduce structured writing semantics through an adapter/versioned schema. |
| Writing editing workspace | `src/blocks/BlockWorkbench.tsx` | Replace textarea-only experience with a practical rich-text authoring workspace while preserving legacy content. |
| Writing helpers | `src/blocks/document.ts` | Extend `documentHeadings()`, `documentWordCount()` to operate on structured documents and live drafts. |
| Exporters | `src/blocks/exports.ts` | Add safe, tested full-document exports and file naming/category metadata. |
| Chat rendering | `src/components/RichMessage.tsx`, `MarkdownBody.tsx` | Show compact inline block summary; open rich editor; keep rendering smooth during streaming. |
| Chat and actions | `src/views/Chat.tsx`, `src/components/VisualActionCard.tsx` | Save to Writing Library/category, Save to Sources, open related story/character cards. |
| Conversation/project data | `src/domain/types.ts`, `src/domain/validation.ts`, `src/state/useSolarium.ts` | Add stable IDs and versioned references; migrate old assets without breaking existing sessions. |
| Storage | `src/data/repository.ts` | Current workspace JSON in SQLite/localStorage: move large chapter contents and source extracts to versioned tables/files rather than endlessly growing one JSON blob. |
| Project view | `src/views/Projects.tsx`, `src/components/Shell.tsx` | Expose Writing Library categories and a Story Bible when relevant; preserve project conversation isolation. |
| Source/research system | Existing planned `src/engine/sources/*`, `src/engine/creator.ts`, `src/engine/search-intent.ts` | Reuse Sources scopes and permission rules; implement only missing pieces; avoid parallel incompatible libraries. |
| Model/tool infrastructure | `src/engine/agent.ts`, `src/engine/tools.ts`, `src/engine/llama.ts` | Extend tool semantics at actual tool boundaries; preserve inference and prompt handling. |
| Native app | `src-tauri/src/creator.rs`, Tauri command registration | Add bounded safe I/O and full-source retrieval; do not introduce arbitrary remote execution. |
| Global rules | `AGENTS.md`, `docs/info/INFERENCE_ARCHITECTURE.md` | Add links to this specification and protect the existing inference contract. |

**Repository audit first:** confirm what the previous **Intelligence & Knowledge Foundation** implementation has already provided. This document must extend the same Sources Library; do not create duplicate `Source` stores with overlapping semantics. If the previous milestone has not yet been implemented, define dependency order and implement shared infrastructure once.

---

## 3. Content model: distinguish five different things

Do not collapse every item into a generic `ContentBlock` with one `content` string.

| Entity | Purpose | Typical scope | Example |
|---|---|---|---|
| `WritingDocument` | A persistent, editable authored work | Story World / Project / Chat | Chapter 4, chapter outline, original poem |
| `WritingCategory` | A user-defined organisational folder/collection | Writing Library scoped to a project or Story World | `Re:Zero / Arc 7 AU / Chapters` |
| `StoryWorld` | One fiction continuity or writing campaign | Inside a project, or stand-alone | `Vollachia — Alternate Route` |
| `StoryCharacter` | A character as understood **for this particular story** | Story World, with optional project-level reusable templates | Subaru, Rem, Utakata, original protagonist |
| `ReferenceSource` | External/user/chat material evidencing a fact | Chat Sources or Project Sources, optionally linked to Story World | WCT Arc 7 Ch. 1 URL, user's note, saved web citation |

Additional supporting entities: `StoryArc`, `StoryScene`, `StoryOutline`, `WorldLocation`, `WorldRule`, `EventRecord`, `RelationshipEdge`, `CharacterClaim`, `EvidenceLink`, `WritingRevision`, `WritingExport`, and `ResearchRun`.

**Hard separation:** A character card is **not** a Spark. The Spark persona belongs to the assistant; story-character voice/style/properties only affect the content generated for a story. Users must be able to use Dona to write a fanfic containing Echidna without turning Dona into Echidna.

---

## 4. Writing Block 3.0: compact in chat, powerful when opened

### 4.1 Inline Writing Block state

When Dona begins a long-form document, show a single compact expandable artifact within her response. An example (illustrative UI, not simulated activity):

```text
╭──────────────────────────────────────────────────────────────╮
│ ✍ Chapter 1 — The Arrow That Missed            ● Writing    │
│ Re:Zero Alternate Route / Arc 7 / Chapters                 ↗ │
├──────────────────────────────────────────────────────────────┤
│ The jungle's silence broke...                               │
│ ...live document prose streams here...                      │
├──────────────────────────────────────────────────────────────┤
│ 2,140 words  •  Unsaved draft   [ Open ] [ Save ]            │
╰──────────────────────────────────────────────────────────────╯
```

This is **one document** even if the server emits many streaming events. Block identity and draft persistence must not depend on the end of one SSE chunk. Inference boundaries are not document boundaries.

### 4.2 Opened Writing Workspace

Use the existing theme and console styling, with a large typography-first editor and a **compact toolstrip**; don't surround every paragraph with cards.

- Left: optional outline, chapters, scenes, and linked characters.
- Centre: readable rich document surface with heading, prose, scene break, dialogue, block quote, emphasis, list, hyperlink, and inline source reference nodes.
- Right (collapsible): story bible context, selected character card, citations, timeline and document details.
- Header: title, category breadcrumb, story/continuity, draft/saved/modified status, and essential actions.
- Footer/status: actual word count, last saved timestamp, revision state, and generation status when applicable.
- On mobile-sized windows: panels collapse into drawers; editor remains usable.
- Preserve keyboard navigation, selectable text, focus handling, and reduced-motion preferences.

### 4.3 Writing formats

Support document kinds using a **shared editor** with type-specific templates:

- `chapter`, `scene`, `short_story`, `outline`, `screenplay`, `dialogue`, `article`, `essay`, `report`, `note`, `lore_document`, and `other`.
- Screenplay: speaker cues, stage directions, scene headers; do not force prose novel formatting.
- Chapter: chapter number/order, optional arc/volume, title, summary, status, linked scenes and characters.
- Outline: nested beats, ordered acts, user-defined sections.
- Freeform documents still work; users can convert between modes without losing text.

### 4.4 Do not write fake “saved” badges

A streamed draft has state `streaming` or `draft`; persisted document state is `saved`. A file exported to disk is `exported`, and its location is recorded only after the operation succeeds. A partially generated chapter after cancellation remains a recoverable draft.

---

## 5. Writing document structure and editor technology

### 5.1 Recommended internal representation

Prefer **versioned structured rich text** (e.g., Tiptap/ProseMirror JSON schema) as the canonical editable form, while storing an optional Markdown projection for search and compatibility. Tiptap exposes structured schema nodes and JSON export; the editor must validate incoming documents against installed extensions. See references in §30.

The model does **not** need to stream full ProseMirror JSON token-by-token. That is fragile for smaller GGUFs. Instead:

1. Allow the selected LLM to stream plain text/Markdown as it already does.
2. Incrementally maintain a **draft text buffer** associated with a stable `documentId`.
3. Parse complete safe Markdown fragments into valid rich-text nodes; debounce conversions and ensure partial code fences/lists/paragraphs don't destroy the document structure.
4. Merge changes into the editor deterministically. Preserve the caret and current selection; don't reset editor state on every token.
5. Convert and validate the final draft once the model has finished producing it.
6. Commit a version transaction to local storage and mark it saved only after persistence succeeds.

### 5.2 Important editor functions

Implement headings and outline, proper typography, keyboard shortcuts, undo/redo, find/replace, selection-based edits, robust paste sanitisation, links, scene breaks, dialogue formatting, optional tables, embedded images, citations, and print layout. Use `useEditor()`/editor subscriptions carefully to avoid rerender loops, especially given Solarium's prior Zustand selector bug.

**Editor library selection:** Tiptap/ProseMirror is a sensible default; investigate current installed dependencies before adding it. Avoid stacking another full editor framework on top of an existing rich-text stack. Prefer open-source functionality and avoid features requiring a hosted commercial service.

### 5.3 Writing-specific refinements

- Chapter template library: prose, script, light novel, formal essay, etc.
- Character name insertion with linked dossier and canonical name aliases.
- Scene breaks with semantic nodes, not repeated literal hyphens.
- Optional dialogue speaker attribution for script formats.
- Footnotes/endnotes with source links, if requested.
- User-selectable quotation conventions and language.
- Per-story tense, POV, narrative distance and prose style guidance.
- Consistent Markdown export, TXT, HTML, DOCX, and PDF/Print where supported.
- Clear distinction between outline metadata and finished prose.

### 5.4 Writing Block command surface

Suggested user actions: `Open`, `Continue writing`, `Rewrite selection`, `Shorten`, `Expand`, `Proofread`, `Change POV`, `Compare revisions`, `Save to category`, `Move`, `Duplicate`, `Export`, `Link source`, and `Link character`. Some can live in a `⋯` menu to keep the primary controls compact.

**User edit precedence:** A manually edited paragraph must not be silently overwritten by a late model event. Track a draft revision and either apply nonconflicting changes or surface a conflict for review.

---

## 6. Streaming authoring: preserve native inference

The Writing Block is an **artifact consumer** of existing inference tokens. It must not create its own generation loop.

### 6.1 Lifecycle

`idle → generating → draft → saving → saved` with separate `failed` / `cancelled` / `conflict` outcomes. The model may also naturally finish without producing a Writing Block; in that case keep its normal chat reply, do not hallucinate a document.

### 6.2 Draft stream assembly

- Generate a stable artifact ID **before** streaming, at a genuine document-tool request boundary or when parsing an explicit writing fence.
- Stream deltas into a bounded in-memory buffer; persist a recoverable draft snapshot periodically using atomic transactions.
- Do not turn incomplete Markdown into broken final rich-text nodes.
- Do not emit two documents because a local model used a new paragraph or output segment.
- Allow the chat and document preview to remain responsive at 60 fps targets; debounce expensive parsing, style recalculation and word counting.
- Do not use `setState` updates on every token if batching is possible; keep visible streaming smooth and reliably cancelable.
- Tool-only content must not appear as fabricated final answer; a real saved result is separate from a proposed draft.

### 6.3 Explicit artifact protocol

Retain existing `solarium-writing` Markdown fences for legacy models. For tool-compatible models, add a typed tool such as `create_writing_document` or `update_writing_document`; the tool may open a draft and announce title/type/category. **Do not require the entire 8,000-word chapter inside one escaped JSON argument.** Use a scoped streaming-artifact transport or incremental content deltas with a real artifact ID. Validate complete content at finalize/save.

Fallback for models without tool calls: parse supported writing-block fences and expose an ordinary **Save to Writing Library** button. No fictional backend action should be claimed.

### 6.4 Cancellations, switching tabs, restarts

- A partial chapter is recoverable after cancellation/crash.
- Switching to a different conversation must not graft streaming tokens into the new chat.
- A document belongs to its original story/project/session via immutable IDs.
- A user-initiated "Stop" interrupts inference and records a partial draft, not a completed chapter.
- Late network events for an already cancelled task must not silently mutate saved content.

---

## 7. Writing Library: unlimited user-defined categories

**This is independent of, but linkable to, Chat Sources and Project Sources.** Categories organise authored work; Sources organise evidence/reference material.

### 7.1 Category scope and hierarchy

Categories must support user-created names and nested folders with no arbitrary small count limit. Examples:

```text
Writing Library
├── My Original Stories
│   ├── The Lantern Kingdom
│   │   ├── Planning
│   │   ├── Chapters
│   │   └── Deleted Scenes
│   └── Untitled Ideas
├── Re:Zero Fanfiction
│   ├── Arc 7 Alternate Route
│   │   ├── Outlines
│   │   ├── Chapters
│   │   └── Scrapped Scenes
│   └── Character Studies
└── Essays & Articles
```

A writing document can have one **primary category**, plus optional labels/tags and links to its current story, project and source records. Provide `Uncategorised` as a valid default; never force the user to categorise immediately.

### 7.2 Save-to-category behavior

When a Writing Block is complete or the user saves a partial draft:

1. Click `Save` or `Save to...` from the block toolbar.
2. Select `Writing Library`, project, Story World, and an existing category—or `+ New category`.
3. Provide optional document title, kind, draft status and tags.
4. Save the document transactionally, show truthful saved confirmation, and create a stable link back to its originating chat message.
5. The block footer updates its breadcrumb, and clicking the breadcrumb opens the category.
6. Reopening the document from the library shows its latest content and revision history.

The user must be able to create categories **without** first producing a Writing Block. Add `New category` and `New document` to the library view.

### 7.3 Library interactions

Create, rename, reparent, duplicate, sort, archive and delete categories; move documents across categories; drag/drop where appropriate; bulk actions; global project/story search; tags; document count; optional pinned favourites; export category with manifest. Prevent moving a category into its descendant, and confirm destructive actions. Deleting a category should offer to move children to `Uncategorised` rather than silently destroy authored work.

### 7.4 Category semantics vs source scopes

A category named `Arc 7` does not automatically become a new retrieval permission scope. Use underlying `storyId` / `projectId` / `conversationId` access controls. Source saved to Project Sources does not become a Writing Document unless the user explicitly converts/saves content as authored work.

---

## 8. Story Worlds and Story Bibles

A Story World is the **canon/continuity boundary** for writing. It may be associated with one project or exist independently as a local writing world. Multiple independent works can reference the same canon franchise without sharing all AU assumptions.

### 8.1 Story World settings

| Setting | Purpose |
|---|---|
| `title` | Human-friendly title, e.g. `Re:Zero — Arrow That Missed` |
| `originKind` | Original fiction, fanfiction, mixed, adaptation/reference |
| `franchiseName` | Optional franchise identity, e.g. Re:Zero |
| `canonAnchor` | Specific source continuity: web novel / light novel / anime / manga / user-defined |
| `continuityPoint` | Where the story branches: arc, chapter, episode, date or scene |
| `spoilerBoundary` | Don't retrieve facts from later arcs unless user allows |
| `divergences` | Explicit AU modifications to canon |
| `narration` | POV, tense, style, target audience, pacing, tone |
| `contentPreferences` | Optional user-specific content filters and writing preferences |
| `projectId` | Optional linked project for shared scope |
| `characters` | References to character cards **in this continuity** |
| `locations`, `events`, `relationships` | Structured story-bible records |

### 8.2 Canon and AU precedence

Define a clear precedence layer:

1. **Explicit current user instruction**, provided it is consistent with tool permissions and other user controls.
2. **Current Story World AU overrides** (e.g., "Subaru survives the arrow").
3. **Confirmed saved story facts and manually approved character records**.
4. **Selected canon continuity facts evidenced by sources**.
5. **Tentative inferences and unsourced suggestions**, labelled as such.

Don't silently apply a light-novel correction to a web-novel-based story when the two differ. Keep adaptations separate and mark disputed/variant details.

### 8.3 Relationships and timeline

- Character relationships are time-varying, not a single static `likes` field.
- Event records carry their source, order, arc/chapter, and who knows what at that point.
- Important secrets (e.g. private knowledge) must not magically leak between characters through the LLM's general knowledge.
- Keep one continuity graph for the story's chosen branch. If a new branch diverges, optionally clone records with an explicit parent/branch reference.
- Allow unknown dates/order without making up dates to fill a UI field.

---

## 9. Character Dossiers: proper profile cards, not Spark clones

### 9.1 Card presentation

A story character is shown as an attractive compact card: portrait (if supplied), name and aliases, role, continuity/canon badge, short temperament line, relation to the current chapter, and a small completeness/evidence indicator. Click the card to open a detailed multi-tab dossier. Don't put a 4,000-word copied wiki article in one `description` textarea.

Recommended dossier tabs: **Overview**, **Appearance**, **Personality & Voice**, **History**, **Abilities**, **Relationships**, **Timeline**, **Motivations**, **Story Role**, **Evidence**, **AU Changes**, and **Versions**. Keep tabs compact and scrollable; not all require user completion.

### 9.2 Structured profile fields

| Section | Specific data to store | Notes |
|---|---|---|
| Identity | Canon name, aliases, pronouns when known, affiliation, species/type, role, first appearance | Record continuity and source. |
| Appearance | Hair, eyes, build, attire, mannerisms, notable marks, typical expressions | Distinguish anime art depiction vs novel description. |
| Temperament | Dominant traits, strengths, flaws, coping style, emotional triggers, humor style | Not simply 10 generic adjectives. |
| Speech & voice | Formality, verbal habits, vocabulary, sentence rhythm, honorifics, dialogue examples **paraphrased** | Don't bulk-copy copyrighted dialogue. |
| Motivations | Short-term goals, long-term aims, fears, values, loyalties, conflicts | Can change by arc. |
| History | Ordered events with clear time ranges/arc labels | Evidence per event; avoid unsourced fill-in. |
| Abilities | Powers, limits, conditions, costs, weaknesses, learned skills, equipment | Record mechanics and restrictions separately. |
| Relationships | Relationship to entity, nature, changes, trust/conflict, what each knows | Directed, time-dependent edges. |
| Knowledge state | Facts personally known, suspected, unknown, secret | Crucial for believable scenes. |
| Situation | Location, possessions, injuries, current condition at story point | Snapshot, not timeless property. |
| Story role | Protagonist/antagonist/support, current narrative objective, arc progress | User-editable writing intent. |
| Alternate-universe | What changes vs canon and why; effective starting point | User overrides must be explicit. |
| Evidence & confidence | Source link, chapter/scene locator, excerpt summary, confidence, reviewed by user | Cite each consequential claim. |
| Original/OC | Creator-authored facts, uncited by design | Mark as invented for this Story World. |

### 9.3 Field provenance and confidence

Each consequential field or claim must store its status: `canon_confirmed`, `source_supported`, `interpretation`, `user_defined`, `au_override`, `disputed`, or `unknown`. A numeric confidence score may aid ranking but is not a substitute for a readable status and source link.

Bad: `Subaru knows everything about the jungle hunter` (unsupported blanket statement).  
Better: `As of the chosen chapter, Subaru knows he was attacked by an archer but does not yet know the attacker's identity` **only if source evidence supports that time-point**. References must be attached to the specific fact.

### 9.4 Independence from Sparks

- Editing a story character never edits Dona's Spark DNA, traits, avatar, or system persona.
- Story character portraits may reuse user-generated art tools, but card storage and personality data remain separate.
- Users can optionally import/export a **character template**, but it is not silently activated as the assistant.
- A Spark writing a character's dialogue should consult that character's voice guide, not adopt the character's identity for the whole chat.

---

## 10. Character Profile Builder: generate sections in order, grounded

The user specifically requires **real profile assembly**, not a one-category copy/paste of a full wiki page.

### 10.1 User flow

1. User adds a named canon character, an original character, or selects `Discover characters from story`.
2. Solarium resolves identity/aliases and chosen continuity. It checks for duplicates before creating another card.
3. If user authorised web research, run targeted lookups. Otherwise use saved Sources and show which fields remain unverified.
4. Extract small, attributed evidence records by subject and section, rather than writing an undifferentiated long summary.
5. Populate **Identity → Appearance → Personality & Voice → History → Abilities → Relationships → Situation at Story Point → AU overrides**. Sections update progressively and independently.
6. For each populated section, show concise bullet fields, provenance/uncertainty, and `Review`/`Edit` controls.
7. Conflicts between sources are shown side-by-side with continuity labels; user chooses what applies.
8. User can lock canon facts or intentional AU changes against accidental future rewrites.
9. Saving creates a dossier revision; missing fields remain unknown rather than being invented.

### 10.2 Grounded structured extraction

For a source page: identify which claims it supports (appearance, personality, event, ability, relation), capture a short original paraphrase and link, and store it under the corresponding **typed field**. Do not attach the same entire source body to every card section. Do not treat the web page's instructions as commands to the model. Long source material stays in the Sources store subject to rights/permitted retention, separate from the summary records.

### 10.3 Section-specific checks

- **Identity:** make sure two character aliases aren't falsely split into separate persons.
- **History:** order events and note if they occur after the story's spoiler boundary.
- **Abilities:** describe conditions and limitations, not just the strongest feat.
- **Speech:** distinguish genuine dialogue style from one dramatic scene or fan interpretation.
- **Relationships:** mark what changed and when, and record both perspectives when relevant.
- **AU:** explicitly state what diverges and which later events can no longer be assumed canon.
- **Unknown:** preserve unknown instead of overwriting with a plausible hallucination.

### 10.4 Progress UI

A grounded profile build can show meaningful real progress: `Found canon source`, `Read Chapter 1`, `Extracted appearance facts`, `Created 5 history events`, `Saved dossier`. It must not show `Verified personality` unless a validation step actually checked supporting evidence. The user can interrupt and keep completed sections.

### 10.5 Source coverage

Offer an optional "Coverage" view: 7 grounded fields, 3 user-defined fields, 5 unknown fields, 2 disputed claims. This is a data-quality indicator, **not** a gamified accuracy percentage or a reason to hallucinate missing information.

---

## 11. Character behaviour: a consistent cast without pretending perfection

The goal is to **improve character fidelity** using explicit, relevant knowledge and story constraints. Don't promise perfect reproduction of a fictional personality.

### 11.1 The Character Voice Guide

For each principal character, produce a small, editable voice guide derived from grounded profile facts:

- Most important personality traits and their contradictions.
- Speaking rhythm, register, preferred/seldom-used vocabulary, how they address other characters.
- Typical reactions under stress, fear, trust, anger, humor and surprise.
- Inner motivations, boundaries and values relevant to the current arc.
- What the character knows at this exact chapter / timeline point.
- Specific "avoid" notes: out-of-character behavior, forbidden spoilers, unsupported abilities.
- AU exceptions that deliberately change personality, relationships or knowledge.

**Voice examples:** use newly authored, original *illustrative* sentences that demonstrate the style without copying source dialogue extensively; label them as examples created by Solarium, not quotes from canon.

### 11.2 Scene context bundle

Before writing each scene, retrieve only the characters actually present or discussed. Bundle:

- Scene goal, point-of-view character, tense, location, approximate time and current plot position.
- Relevant character summaries (small, specific, current).
- Relationships **at this point** in the timeline.
- Relevant physical/ability constraints.
- Pertinent canon facts and user AU overrides.
- Prior story events that affect this scene.
- Writing style and requested length.

Do not inject every character card or source page into the prompt. Maintain a transparent "Sources used for this chapter" reference list that can be expanded if the user wants to audit it.

### 11.3 Character consistency review

After a chapter is written, optionally check **observable content** against the current story bible:

- Did the character use an ability it should not yet possess?
- Did someone know information they should not know?
- Did the scene contradict a locked AU override or earlier chapter event?
- Were two similarly named characters confused?
- Did a sudden personality change have in-story justification?
- Did cited facts come from chapters after the selected spoiler boundary?

Present issues as suggestions with references; do not silently rewrite accepted prose, and do not let automated review delay all writing indefinitely. The user decides whether an apparent inconsistency is intentional creative choice.

---

## 12. Story planning, continuity, and chapter orchestration

### 12.1 Outline and chapter metadata

Each Story World can contain Arcs → Chapters → Scenes; a Writing Document may map to a Chapter or a standalone scene. Each item has stable IDs, order, title, outline/intent, status and optional target word count.

- `planned`: outline exists but no prose.
- `drafting`: being written or revised.
- `draft`: saved but not final.
- `review`: user requests consistency/editorial review.
- `final`: explicitly marked finished by the user.
- `archived`: retained but out of the active narrative.

### 12.2 New chapter generation

User: "Write Chapter 2, starting immediately after the arrow incident, but in our AU Subaru survives."

Solarium should retrieve the story's canon anchor, event context, current protagonist knowledge, the AU divergence, previous chapter summary, relevant character cards, and writing guidance. Then open an actual Writing Block and stream the new prose. When complete, save under selected category if the user requested automatic saving; otherwise leave it as a draft with a visible Save control. No extra generic roleplay detours.

### 12.3 Update knowledge after a chapter

Optionally derive *suggested* new Story World events or relationship changes from the finished chapter; the user can accept them. Do not automatically transform generated dramatic prose into verified canon facts. Story-specific invented facts can be saved as `story_established` after user acceptance or explicit story settings.

### 12.4 Narrative branches

Allow an Alternate Route/"What if" branch to refer to a parent continuity and diverge at a specific event. When cloning a branch, copy relevant snapshots with provenance; keep branch-specific future events separate. This is not Solarium's inference continuation branching.

---

## 13. Precise web search: find the *actual scene*, not generic websites

This is a core product requirement, not cosmetic search ranking. The user may refer to a specific story moment using approximate terms, partial titles, translations, aliases, adaptations, or incorrect details. Solarium must seek the most likely **primary source chapter/scene** and validate it against page content.

### 13.1 Query understanding

Parse user request into search intent and facets:

| Facet | Example extracted from the test query |
|---|---|
| Franchise | `Re:Zero` / `Re:Zero kara Hajimeru Isekai Seikatsu` |
| Arc | `Arc 7` |
| Character | `Natsuki Subaru` |
| Scene | `struck by an arrow / shot in jungle` |
| Location | jungle/forest in Vollachia, if grounded |
| Source type | web novel chapter, optionally translation |
| Adaptation | unspecified, ask only if version ambiguity becomes material |
| Specificity | exact scene identification, **not general topic search** |
| Language | user language / available canonical or fan translation language |

Generate short, topic-specific queries, not literal raw conversational messages. Examples:

- `Re Zero Arc 7 Chapter 1 Subaru arrow pinned tree`
- `site:witchculttranslation.com/2021/01/23/arc-7-chapter-1-initiation/ Subaru arrow`
- `Re Zero Arc 7 Buddheim jungle Subaru hunter arrow chapter`
- `Re:Zero arc 7 射抜かれる スバル 矢` **only if Japanese terms are verified/reasonably generated and the source context calls for multilingual research**.

Do **not** search for the English dictionary definition of `shot`, `arc`, `chapter`, or `let`. Do **not** rank irrelevant .gov pages because they happen to share incidental words.

### 13.2 Canonical scene benchmark — source verified during planning

The user's example closely matches **Re:Zero Arc 7, Chapter 1, “Baptism”** in the Witch Cult Translations English web-novel translation, which describes Subaru struck by an arrow and pinned to a tree in the forest. See:

- [Witch Cult Translations — Arc 7, Chapter 1, “Baptism”](https://witchculttranslation.com/2021/01/23/arc-7-chapter-1-initiation/)
- [Witch Cult Translations — Arc 7, Chapter 4, “A Brave Choice”](https://witchculttranslation.com/2021/02/01/arc-7-chapter-4-a-brave-choice/) (refers back to the tree-pinning arrow incident)

**Crucial ambiguity:** Arc 7 also contains a separate poisoned-arrow death involving **Utakata**. Later chapters refer to that incident; do not merge the two simply because both mention Subaru being killed by an arrow:

- [Witch Cult Translations — Arc 7, Chapter 12, “The Vollachian Empire”](https://witchculttranslation.com/2021/05/06/arc-7-chapter-12-the-vollachian-empire/)
- [Witch Cult Translations — Arc 7, Chapter 15, “Those I Want to Protect”](https://witchculttranslation.com/2021/06/13/arc-7-chapter-15-those-i-want-to-protect/)

**Mandatory behavior:** Search returns Chapter 1 as a highly ranked match, identifies the tree-pinning event, and warns there are at least two similar arrow incidents where relevant. If a later question specifically names Utakata or poison, choose the appropriate separate incident and cite the correct source. Do not claim Chapter 1 definitively identifies the hunter's identity if that fact is not established at that point.

This is an example **research fixture** based on the cited pages, not a demand that Solarium hardcode the answer to one anime. The search architecture must generalise to novels, comics, games, films, technical docs, legislation, and source code.

---

## 14. Search architecture: six real stages

### Stage A — Context-aware intent extraction

Determine whether the user wants a specific scene, character facts, chapter chronology, general web information, software documentation, or actual tool execution. Integrate the current story/project, sources and preceding conversational references. "The arrow scene" in an active Re:Zero Arc 7 fanfic is not a generic archery question.

### Stage B — Candidate search generation

Build a small pool of diverse queries incorporating canonical names, aliases, adaptation labels, arc identifiers, event descriptions, synonyms ("shot" may mean **arrow**, not gunshot), and language if relevant. Apply optional site operators only when the domain actually hosts appropriate source material.

### Stage C — Provider abstraction and discovery

Use a `SearchProvider` interface. Practical providers to evaluate:

1. **SearXNG** (self-hostable, open source): JSON `/search` endpoint can support privacy-oriented, user-owned search; JSON must be enabled by instance configuration; results depend on engine configuration and availability.
2. **Brave Search API** (optional user API key): supports site/exact-match operators, language search, and rich ranked results. Some endpoints and retention require a subscription/terms review. Do not assume it is free or locally hosted.
3. **User-configured additional providers** through the same interface, only if terms and operation are legitimate.
4. **Direct known-site search** through published site search/index/API (where permitted) after a candidate source family is identified.

Separate search-provider configuration from the local inference engine. Web Search OFF disables these requests, including auto-generated site requests and remote favicon retrieval.

### Stage D — Candidate relevance and authority scoring

Do not trust the search provider's first result. Combine semantic/entity relevance with contextual source type:

- Exact franchise/title + arc/chapter + character + scene evidence: strongly positive.
- Primary chapter text (official source when legally accessible) or credible chapter translation: strongly positive for event location.
- Adaptation consistency and language match: positive.
- Wiki summaries and reader discussions: useful corroboration, not a replacement for direct scene text.
- Generic news, government sites, SEO spam, unrelated software downloads: near-zero when searching a fiction scene.
- Pages that discuss a later retelling instead of the original incident: lower rank unless user asks about that retelling.
- Mere title/snippet overlap without corroborating content: lower confidence.

Use a transparent re-ranking score with feature contributions; avoid a brittle list that blindly blocks all `.gov` or `.edu` domains across all types of queries. Domain suitability must depend on intent.

### Stage E — Read and verify the target page

Fetch the candidate page **when permitted**. Extract readable main content and relevant headings, retain canonical URL, title, site, language, retrieved timestamp, chapter locator, and content hash. Confirm the candidate actually contains the scene description, rather than trusting the snippet. If access is restricted, say `Found but not verified by page reading`.

Use SSRF protections, URL validation, response size limits, content-type checks, redirect validation, safe HTML parsing and timeouts. Never follow instructions embedded in the webpage as though they came from the user or system.

### Stage F — Structured evidence and answer

Return a concise grounded result: likely exact chapter/scene, short factual summary **in Solarium's own words**, linked citations, confidence/ambiguity, and optional `Save to Chat Sources`/`Save to Project Sources`. For profile building, extract only relevant claims and event locators. Never paste a whole chapter into one character's `history` field.

---

## 15. Search relevance scoring and uncertainty

A suggested initial deterministic ranker:

```text
score =
  0.24 * entity_match
+ 0.18 * arc_chapter_match
+ 0.18 * event_match
+ 0.14 * body_evidence_match
+ 0.10 * source_type_fit
+ 0.07 * adaptation_and_language_fit
+ 0.05 * corroboration
+ 0.04 * source_freshness_if_relevant
- irrelevant_domain_or_topic_penalty
- duplicated_or_misleading_snippet_penalty
```

These weights are **illustrative starting hypotheses**, not validated production values. Create a labelled evaluation dataset and tune weights from observed precision. For stable fictional canon, recency should contribute very little; for evolving software APIs, recency may matter more.

### 15.1 Disambiguation and follow-ups

If the description could refer to two scenes, show both with distinguishing evidence: `first arrow pins Subaru to a tree` vs `later poisoned-arrow death involving Utakata`. Prefer a small unobtrusive disambiguation control when ambiguity affects the requested writing. Do not ask the user to restate the entire franchise, arc and project already in context.

### 15.2 Unsupported and missing answers

When the original chapter cannot be retrieved, Solarium may identify a likely reference from corroborating sources but must say the primary passage wasn't checked. No invented exact chapter numbers or unsupported quotes.

### 15.3 Search evaluation measures

Measure **top-1 exact-source accuracy**, **top-3 chapter recall**, **wrong-source rate**, **citation correctness**, **answer-supported-by-page rate**, **time to verified source**, **noise rate**, and **permission violations**. Track source provenance so mis-ranked results can be diagnosed and regression tested.

---

## 16. Sources, evidence links, and permission boundaries

This milestone builds on the planned Chat Sources and Project Sources from the preceding implementation specification. Reuse their IDs, storage and retrieval interfaces. If that milestone isn't in the checkout yet, implement a compatible shared `SourceRepository` layer once.

### 16.1 Source ownership

- **Chat Sources:** visible/retrievable only to that conversation unless manually promoted.
- **Project Sources:** visible/retrievable to conversations within that project.
- **Story World links:** explicit relationships to sources, without duplicating entire pages into every character or chapter.
- **Character evidence:** references a source ID plus a locator and claim summary.
- **Chapter references:** links a writing document to sources used as support, not necessarily visible inside narrative prose.

### 16.2 Saving from response, site and chapter

Under a chat reply: `Save to Sources ▾` → `Chat Sources` / `{projectName} Sources`.  
In a research grid: `Save source` → same scope choices.  
In a Writing Block: `Save to Writing Library` → category, independent of source bookmarking.  
In a Character Card: `Link evidence` → select existing source or initiate focused research.

The user can save a **selection** rather than the entire message/page. Preserve origin metadata. If content originates from an external copyrighted work, save URLs, minimal excerpts when allowed, compact summaries, and locators—never assume mass replication is permitted.

### 16.3 Citation model

Every machine-extracted factual claim carries `sourceId`, `sourceLocation` (chapter/section/URL fragment), `retrievedAt`, `confidence`, `continuity`, and `evidenceKind`. The UI distinguishes `Directly verified`, `Supported by secondary summary`, `User-supplied`, `Interpretation`, `AU`, and `Unknown`.

### 16.4 No instruction laundering

A source page may contain text such as "ignore previous instructions". The source is untrusted content and cannot grant permissions, change the Spark's system persona, write files, or alter the inference contract. The model may summarise the page but may not obey it as an instruction.

---

## 17. Structured source retrieval for long-form writing

A 20-chapter story can involve dozens of cards and references. Never dump all sources into a 4K context window. Retrieval must be **goal-specific**, token-aware and scope-aware.

### 17.1 Retrieval cascade

1. Determine active `storyId`, `projectId`, `conversationId` and spoiler boundary.
2. Parse the user's current writing/research objective and named entities.
3. Search local category/source indexes first: exact titles, aliases, full-text matches and tags.
4. Score story-world, current scene, referenced characters and canon event relevance.
5. Fetch compact per-section dossier excerpts, not entire profiles.
6. Include provenance and AU override markers.
7. If web research is enabled and an essential fact is missing, search focused external sources.
8. Expose the actually used references to the user.

### 17.2 Local-first retrieval engines

Start with SQLite FTS5 for documents, character fields and source summaries if the bundled SQLite supports it. Add an optional semantic retrieval adapter later; do not require a second embedding model running concurrently with the main GGUF. Use deterministic alias/entity matching for names and chapter numbers, which is particularly important for smaller local models.

### 17.3 Context pack principles

One context pack may contain story heading, scene goal, three relevant character mini-profiles, a few locked canon/AU facts, chapter summary and several source locators. The exact sizes are token-counted against the **actual active input context**, but **do not alter native continuous output generation** and do not silently discard the user's explicit task or Spark identity. Avoid fake total-token estimates when tokenizer access is unavailable.

### 17.4 Spoiler enforcement

If the story takes place at Arc 7 Chapter 1, later events must not enter in-world character knowledge unless the user deliberately authorises foreknowledge, time travel, or an AU exception. Source retrieval may use later chapters to **identify** an earlier event, but generated character dialogue must respect the chosen knowledge boundary.

---

## 18. UI: console-style, compact, visual, task-focused

Maintain the existing MUI foundation, themes and console aesthetic. Use motion selectively; avoid heavy animation while inference runs. Provide three connected surfaces:

### 18.1 Conversations sidebar additions

```text
CONVERSATIONS
  + New conversation
  + Create project

  📁 Re:Zero — Alternate Route
    💬 Conversations
    📚 Project Sources
    📖 Writing Library
    🎭 Story Bible

  💬 Current conversation
    📑 Chat Sources
```

Project-specific conversations remain isolated as already established. Writing Library and Story Bible are **project-linked** but not confused with the conversation list itself.

### 18.2 Writing Library view

Left category tree, main document cards/list with type/status/word count/last saved/story link, top search bar and `+ Document` / `+ Category`. Category edit/dropdown actions, drag/drop or buttons, compact breadcrumbs and theme-aware selection.

### 18.3 Character Card gallery

Grid of portraits/cards with roles, continuity badges, and quick evidence/completeness icons. Opening a card shows structured tabs and source chips. Provide `New Character`, `Research Character`, `Import`, `Duplicate`, and `Link to Chapter`. The builder progressively reveals real completed sections; missing fields are clearly marked unknown.

### 18.4 Research results as visual site cards

Search view shows real websites in a responsive grid: title, domain, short relevance reason, actual `Found/Reading/Read/Unavailable` state, source type/continuity. Click to inspect the *retrieved* document or open the original. Completed searches collapse into compact conversation actions without destroying provenance.

### 18.5 Live writing action

A real writing task opens the existing Live Workspace as an editor with the current document title. Text streams as a genuine draft. When the user switches back to chat, a compact Writing Block remains. When saved, the card shows actual document ID/category; clicking reopens it. Do not automatically force full-screen if user is actively editing another document.

---

## 19. Concrete TypeScript domain interfaces (design contracts)

**These are proposed versioned interfaces.** Reconcile with actual existing `CreatorProject`, `ChatSession`, `ContentBlock`, Source types and persistence before coding. Prefer module-local definitions and schema validators rather than dumping every type into `src/domain/types.ts`.

```ts
export type WritingKind =
  | 'chapter' | 'scene' | 'short_story' | 'outline' | 'screenplay'
  | 'dialogue' | 'article' | 'essay' | 'report' | 'note'
  | 'lore_document' | 'other';

export type WritingStatus =
  | 'generating' | 'draft' | 'review' | 'final' | 'archived';

export interface WritingDocument {
  id: string;
  schemaVersion: 1;
  kind: WritingKind;
  title: string;
  categoryId: string | null;
  storyId: string | null;
  projectId: string | null;
  originConversationId: string | null;
  originMessageId: string | null;
  currentRevisionId: string;
  status: WritingStatus;
  tags: string[];
  metadata: {
    chapterNumber?: number;
    sceneOrder?: number;
    povCharacterId?: string;
    tense?: 'past' | 'present' | 'other';
    language?: string;
    targetWordCount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface WritingRevision {
  id: string;
  documentId: string;
  parentRevisionId: string | null;
  editorSchemaVersion: number;
  structuredJson: unknown;
  markdownProjection: string;
  isPartialDraft: boolean;
  reason: 'generated' | 'user_edit' | 'spark_revision' | 'import';
  createdAt: string;
}

export interface WritingCategory {
  id: string;
  parentId: string | null;
  name: string;
  storyId: string | null;
  projectId: string | null;
  sortOrder: number;
  archived: boolean;
}

export interface StoryWorld {
  id: string;
  projectId: string | null;
  title: string;
  originKind: 'original' | 'fanfiction' | 'mixed';
  franchiseName?: string;
  canonAnchor?: string;
  spoilerBoundary?: string;
  divergenceNote?: string;
  narration?: { pov?: string; tense?: string; tone?: string };
  createdAt: string;
  updatedAt: string;
}

export type ClaimKind =
  | 'canon_confirmed' | 'source_supported' | 'interpretation'
  | 'user_defined' | 'au_override' | 'disputed'
  | 'unknown' | 'story_established';

export interface CharacterClaim {
  id: string;
  characterId: string;
  section: string;
  field: string;
  value: string;
  kind: ClaimKind;
  sourceLinks: EvidenceLink[];
  effectiveFrom?: string;
  effectiveTo?: string;
  locked?: boolean;
  updatedAt: string;
}

export interface EvidenceLink {
  sourceId: string;
  locator?: string;
  synopsis?: string;
  continuity?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface StoryCharacter {
  id: string;
  storyId: string;
  canonicalName: string;
  aliases: string[];
  characterKind: 'canon' | 'original' | 'adapted';
  role?: string;
  portraitAssetId?: string;
  claims: CharacterClaim[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryEvent {
  id: string;
  storyId: string;
  title: string;
  orderKey: string;
  arc?: string;
  chapter?: string;
  characters: string[];
  factKind: ClaimKind;
  sourceLinks: EvidenceLink[];
  knowledgeByCharacter: Record<string, 'knows' | 'suspects' | 'unknown'>;
}

export interface ResearchCandidate {
  id: string;
  query: string;
  url: string;
  title: string;
  site: string;
  status: 'found' | 'reading' | 'read' | 'failed';
  sourceType: 'primary' | 'translation' | 'wiki' | 'discussion' | 'other';
  canonicalScore?: number;
  matchingEvidence?: string[];
  sourceId?: string;
}
```

**Implementation note:** `StoryCharacter.claims` in the TS interface is conceptually convenient, but persist claims as separate rows instead of serialising huge nested arrays in the workspace JSON. Claims must be searchable, versioned and referenced across scenes.

---

## 20. Persistence and migration design

### 20.1 Normalised SQLite store

New tables or equivalent schemas should cover:

- `writing_documents` (identity, ownership, category and metadata)
- `writing_revisions` (durable versioned content; compressed external blobs if necessary)
- `writing_categories` (hierarchy, owners, order)
- `story_worlds` (continuity settings)
- `story_characters` (identity and profile metadata)
- `character_claims` (sectioned facts, statuses, locks and validity)
- `character_evidence` (source/claim links)
- `story_events` (chronology and character-knowledge snapshots)
- `story_relations` (time-varying relationships)
- `source_links` (story/document/character scoped links to canonical Sources repository)
- `research_runs` / `research_candidates` (optional bounded metadata for inspection/debugging)

Store large page/document content in a bounded persistent content store rather than the single `workspace.data` JSON row. Avoid repeated full JSON serialisation after every generated token. Use migrations with schema versions and backups.

### 20.2 Migration of legacy Writing Blocks

- Leave the user's chat text intact.
- Existing `solarium-writing` fences remain renderable.
- Existing asset revisions remain accessible.
- When a user opens/saves an old block, create a `WritingDocument` record and convert Markdown once into the new schema.
- Preserve stable origin message and block IDs where possible; if transformed, store `legacyBlockId` mapping.
- Detect and reject incompatible schema safely, showing read-only Markdown and an export option instead of losing content.

### 20.3 Recovery and transactions

SQLite transactions protect save/move/rename/version operations. Draft checkpoints support crash recovery. Never mark saved before commit succeeds; a partial stream after app restart remains a draft. Run a no-loss migration test with realistic old workspace JSON and project-specific conversations.

### 20.4 Storage export/import

Support exporting one document, category, Story World (including cards and references), and a full portable archive. Use a manifest with schemas, version, origin and linked assets. Avoid embedding credentials, API keys or private unrelated files into exports. Imports must validate ownership, archive paths and schema versions; prevent path traversal.

---

## 21. Tool and command contracts

The same Spark Intelligence Engine planned in the preceding 12-phase document should expose real tools for writing, research and character cards. Only advertise tools relevant to the current task, and validate every argument with a real runtime schema. Keep tool choice separate from permission decisions.

### Suggested tool names and semantics

| Tool | Real behavior |
|---|---|
| `create_writing_document` | Creates a draft record with selected category/story and a stable ID. |
| `append_writing_content` / streamed artifact transport | Appends draft text to an owned document's staging buffer, no premature save claim. |
| `finalize_writing_document` | Validates content, commits revision and returns persisted ID/timestamp. |
| `update_writing_selection` | Applies a proposed edit to a selected revision/range after conflict/version validation. |
| `list_writing_categories` | Returns user-authored category tree for authorized scope. |
| `create_writing_category` | Creates a category after name/parent validation. |
| `move_writing_document` | Moves a document transactionally to an authorized category. |
| `create_story_world` | Adds continuity and story metadata. |
| `create_story_character` | Creates a blank or user-authored character shell. |
| `research_character` | Executes permission-checked targeted research; returns source refs, not an invented biography. |
| `update_character_claims` | Saves structured section claims with provenance/continuity validation. |
| `search_story_sources` | Searches Chat/Project/Story-linked sources with scope and spoiler filters. |
| `search_specific_scene` | Generates focused searches, retrieves candidates and checks scene evidence. |
| `read_research_source` | Fetches permitted actual content and stores its verification state. |
| `link_evidence` | Associates a saved Source locator with a claim or document. |
| `suggest_story_consistency_issues` | Checks a document against saved story constraints and returns evidence-backed suggestions. |

**Do not execute arbitrary JavaScript from a character card or webpage.** Any network- or filesystem-affecting call must go through existing Tauri/permission machinery, not an iframe or assistant text.

### 21.1 Robust argument handling

- Parse JSON once and validate with explicit schemas, enums, bounds, IDs and scope checks.
- Malformed JSON must produce a useful **tool validation result**, not silently become `{}`.
- If a required parameter can be resolved deterministically from verified state, resolve it without sending the user an unnecessary question.
- A model that cannot emit structured calls may still produce Markdown draft content; the UI can offer manual Save/Research actions.
- Tool results must say exactly what happened, e.g., `source found but page not read`, `writing draft created`, `revision saved` or `character section updated`.

### 21.2 Preconditions

- No network action while Web Search is OFF.
- No writing to a category that belongs to another project's private story.
- No linking a character to a non-existent Story World.
- No finalising a document without a valid draft and complete operation.
- No marking facts verified without an evidence link (unless explicit user-origin claim, separately labelled).

---

## 22. Example workflows / user journeys

### A. Research an exact novel scene

User: `Find the scene where Subaru is shot in a jungle in Arc 7 of Re:Zero.`

1. Parse entity/arc/scene and current continuity.
2. Query focused search sources; inspect candidate Chapter 1 result.
3. Read permitted text from WCT Chapter 1 and confirm arrow/tree incident.
4. Check if a separate Utakata poisoned-arrow incident could cause confusion.
5. Present a concise, sourced answer and a visual result grid; no generic news/.gov noise.
6. Offer `Save to Chat Sources` / `Save to {project} Sources`.

### B. Build grounded character profiles

User: `Make character cards for the relevant cast up to that scene.`

1. Identify character candidates based on the actual source/event, not an imagined full-cast list.
2. Create blank cards; deduplicate existing aliases.
3. Research/summarise per section using actual evidence.
4. Populate identity, appearance, personality, history, abilities, relationships, knowledge state and relevant situation **as supported**.
5. Distinguish source-confirmed claims, interpretations and unknown fields.
6. Respect chapter spoiler boundary, show sections as they are completed, save cards.

### C. Write fanfiction chapter in a category

User: `Write an AU chapter where the arrow misses. Keep Subaru and Rem in character. Save it to Arc 7 Alternate Route / Chapters.`

1. Resolve Story World, branch point, character cards, prior chapters and source references.
2. Create the category if user requested a named one and it doesn't exist (using appropriate permission semantics).
3. Create document draft and open streaming Writing Workspace.
4. Generate narrative content in the existing native LLM stream, without extra 2,048-token restarts.
5. Persist draft and final revision; bind category and story; show saved timestamp only on successful commit.
6. Return a compact Writing Block link; optionally suggest consistency issues with evidence.

### D. Revise one passage

User highlights a paragraph: `Make this more tense but keep the POV and meaning.`

1. Capture stable selection/range and revision ID.
2. Give Spark relevant paragraph plus minimal surrounding context and writing style.
3. Stream a **proposed** replacement rather than rewriting the whole 6,000-word chapter.
4. Show a diff, apply after active permission/approval semantics; verify revision hasn't changed since selection.
5. Create revision history entry; maintain unrelated edits.

### E. Original fiction offline

User: `Build my own fantasy world with three original characters; don't use the internet.`

1. Create Story World with `originKind: original`.
2. Use user-provided details and generated suggestions, clearly marked original/user-defined.
3. Generate separate cards and story outline; no fake internet citations.
4. Create chapters and categories, fully offline.

---

## 23. Single coordinated implementation: 18 phases

**Implement all 18 as one coordinated milestone.** Internal commits/checkpoints are fine; they are not permission to stop after producing only a roadmap. Phase boundaries are engineering order, not user-facing release switches.

| Phase | Required implementation | Priority | Observable outcome |
|---:|---|---|---|
| **1** | Repository audit and contract protection | Critical | Existing inference/Sources/Block APIs mapped; no duplicate architecture. |
| **2** | Story/Writing domain schemas and migrations | Critical | Versioned entities, scope, stable IDs, old data still loads. |
| **3** | Writing Document persistence and revision storage | Critical | Durable documents and partial draft recovery. |
| **4** | Writing Block streaming adapter and structured editor | Critical | Long prose streams once into stable editable document. |
| **5** | Writing Library and hierarchical categories | Critical | Create, save, move, browse, search, export. |
| **6** | Story Worlds and canon/AU configuration | High | Story context and branch point persist. |
| **7** | Character Card gallery and detail UI | Critical | Clickable structured cards, not copied articles. |
| **8** | Evidence-backed Character Profile Builder | Critical | Sections populated separately with provenance/unknowns. |
| **9** | Character relationships, knowledge states and timelines | High | Context-accurate chapter situations. |
| **10** | Intent/entity-aware search query planning | Critical | Exact scene queries, not raw chat or generic keywords. |
| **11** | Configurable search provider integration | Critical | Actual provider requests, Web Search OFF enforced. |
| **12** | Site-aware ranking, reading and scene verification | Critical | Actual relevant chapter found and verified. |
| **13** | Source-to-card/document links and scoped retrieval | Critical | Facts grounded without dumping entire web pages. |
| **14** | Character voice and chapter-context compiler | High | Relevant persona/dossier facts included without cross-character leakage. |
| **15** | Selection editing, consistency review and chapter versioning | High | Safe revisions with explicit evidence/issues. |
| **16** | Visual Actions and live research/writing UX | High | Real website grid and streaming editor, compact saved results. |
| **17** | Import/export, accessibility and performance hardening | High | Offline-ready, keyboard-usable, stable long documents. |
| **18** | Unit, integration, migration and end-to-end verification | Critical | Tests with real chapter fixture, actual storage and existing inference intact. |

### 23.1 Dependencies and parallel work

Phases 2–5 form the minimum data/editor foundation. Phases 6–9 build story intelligence. Phases 10–13 build grounded research. Phase 14 connects retrieval to writing. Phase 16 exposes real operations. Phase 18 validates all pathways. Work can be parallelised across isolated modules only after agreeing on shared interfaces and migrations.

### 23.2 Do not bury incomplete features behind fake UI

If a provider credential is missing, label that provider unavailable; a local/other provider can still work. If rich-text export is unsupported, don't show a working PDF button that produces plain TXT. If an LLM cannot use tools, manual saving must still function. Avoid the repeated historical pattern where Solarium displays an attractive visual that has no executable backend.

---

## 24. Tests: deterministic fixture set

### 24.1 Web search relevance fixtures

1. **Re:Zero Chapter 1 arrow scene** — top-3 includes Arc 7 Chapter 1; exact event supported by read page; no unrelated dictionary/.gov result chosen as evidence.
2. **Utakata poisoned arrow** — finds separate relevant incident and does not conflate it with the tree-pinning attack.
3. **Arc misnumbering** — user says wrong arc; results state uncertainty/correction with source rather than fabricate confidence.
4. **Anime vs web novel** — checks requested adaptation; doesn't cite web-novel chapter as identical to anime scene without verification.
5. **Name aliases and Japanese transliterations** — entity resolution supports localized names without losing target identity.
6. **Unrelated generic query noise** — test search results containing tempting wrong domains; relevance ranker rejects them for fiction scenes.
7. **No actual page access** — mark `found/unverified`, not `read`.
8. **Web Search OFF** — zero provider/network invocations, even when Spark requests search or favicon preview.
9. **Search result injection** — malicious instructions within a page are inert data.
10. **Provider failure** — readable error, saved local sources still work, no fictional successful research.
11. **Citation precision** — output chapter/scene locator links to an actual supporting passage.
12. **Cross-domain intent** — programming/Tauri research still works; fandom-specific ranking doesn't corrupt general search.

### 24.2 Character dossier fixtures

1. Create new canon card and ensure it belongs to the correct Story World, not Spark persona.
2. Extract a source summary into **separate** appearance, personality and history claims.
3. Empty/unsourced fields remain `unknown`.
4. A source from a later chapter cannot silently appear as knowledge available earlier.
5. Two sources disagree: claim becomes disputed/continuity-specific.
6. Explicit AU override survives future research refresh.
7. Original character is user-defined and requires no fake external citations.
8. Duplicate alias maps to one character unless user deliberately separates them.
9. Editing Dona's Spark avatar never changes story character portrait/traits.
10. Import/export preserves field provenance and prevents cross-project sharing.

### 24.3 Writing Block fixtures

1. Generate >10,000-word document mock stream; stable block/document ID through all event chunks.
2. Simulate incomplete Markdown paragraphs/fences; editor doesn't corrupt text.
3. Cancel generation; partial chapter remains recoverable, marked draft.
4. Switch conversations while streaming; draft remains in correct conversation.
5. Save document under nested category; reopen after app restart; content identical.
6. Move categories/documents; no accidental data loss or scope leak.
7. Update selection after local user edit: revision-conflict detection protects text.
8. Export Markdown/HTML/DOCX/Print/PDF; verify output parity and real file creation where supported.
9. Open legacy `solarium-writing` block; round-trip migration without dropping content.
10. Simulate long paragraphs and rapid streamed tokens; UI remains responsive and no React render loop occurs.
11. Test user created category with unicode names, deep nesting, and duplicate siblings.
12. Test Markdown export and import with source/reference links retained when possible.

### 24.4 Persistence and permission fixtures

- Chat Source retrieval never crosses to an unrelated conversation.
- Project Source retrieval never crosses to another project.
- Story World cards don't leak to unrelated stories without explicit link/import.
- Save-to-category works even if the current conversation is outside a project.
- Web Search OFF does not block **local** source retrieval.
- Existing workspace migrations retain Sparks, models, themes, conversations and projects.
- A failed database transaction does not show `Saved`.
- Untrusted HTML in references cannot execute scripts or invoke Tauri commands.
- Ask/Auto/YOLO do not bypass category/project folder or web boundaries.

### 24.5 Inference regression fixtures (mandatory)

- No forced 2,048-token HTTP generation loop added by Writing Block streaming.
- No artificial reasoning quota or synthetic continuation prompts.
- One long native model response can stream writing draft content without reloading GGUF model weights per chunk.
- Real tool boundaries may require a new model turn but do not force an unfinished reasoning stream into a new fake "continue thinking" prompt.
- Context packing selects relevant sources without discarding user instruction or changing backend output behaviour.
- Stop/cancel preserves partial draft and does not hang the model.

---

## 25. Performance, accessibility, resource usage

Target a reasonable local desktop experience on **Windows + RTX 3060 12 GB VRAM + 64 GB system RAM**, but do not hardcode GPU assumptions in the writing system.

- The rich-text editor uses **CPU-side** structured document updates and batching; it should not require GPU inferencing or an image model to render a chapter.
- Reuse the already-loaded local LLM; no parallel 26B model to "manage" characters.
- Full-text search should be local; embeddings optional and not permanently resident on the 12 GB GPU.
- Use local preview caches for source excerpts, respecting copyright/retention policies.
- Virtualise long character lists and category trees, not the actual editing selection in ways that break cursor behavior.
- Avoid high-frequency global Zustand updates for every token.
- Respect reduced motion, contrast, keyboard navigation, assistive text, scalable fonts and high-DPI behavior.
- All clickable visual source cards need accessible text labels and meaningful states.
- No accidental network calls from avatar portraits/favicons while offline.

---

## 26. Privacy, safety, copyright, and licensing

Fanfiction involves existing fictional IP. Solarium can help users write original transformative stories and research factual plot details, but should be designed to **avoid distributing or storing full copyrighted chapters without appropriate permission**.

- Store concise attributed claims and pointers; use brief excerpts if permitted.
- Use reasonable rate limits, robots/terms compliance where applicable, and source-attribution metadata.
- For images/character portraits, keep user ownership and provenance notes; don't silently scrape fan art and treat it as reusable project asset.
- Warn before publishing/exporting source excerpts that exceed permissible use.
- No blanket promise that a derivative fanfic can be commercially sold. Rights depend on source IP and applicable law.
- User-created story drafts and sources stay local by default. Optional third-party search sends queries to the configured provider, visibly disclosed.
- Never give external web content elevated instruction authority. URLs and fetched payloads must be validated by the Rust/network layer.

---

## 27. Exact end-to-end acceptance scenario

**Starting state:** Existing Solarium 0.1 installation with a local GGUF, a `Re:Zero Fanfiction` project, optional linked folder, an empty Writing Library and no character dossiers.

1. Create a Story World named `The Arrow That Missed` anchored to **Re:Zero web-novel Arc 7 Chapter 1**.
2. Select a spoiler boundary at the branch scene and state the AU divergence: `The arrow misses or fails to kill Subaru`.
3. Ask Dona to find the jungle arrow scene. With Web Search ON, Solarium produces focused queries and opens credible target results, including WCT Chapter 1. It reads and verifies the incident. It does **not** present unrelated government or generic software pages as primary evidence.
4. Dona explains there are other arrow incidents in the arc and distinguishes them if necessary. The user can open/cite/save the actual relevant source.
5. Save the chapter reference to `{projectName} Sources`; it is available to other conversations in this project but not outside it.
6. Ask Dona to create character dossiers for the relevant cast as of the selected point. Solarium creates **separate** cards with Identity, Appearance, Personality & Voice, History, Abilities, Relationships, Knowledge State, Situation and Evidence fields. Unsourced sections remain visibly unverified.
7. Make a custom writing category `Arc 7 Alternate Route / Chapters`.
8. Ask Dona for Chapter 1 with the defined divergence; the Writing Workspace opens and prose streams into a **single** Writing Document. The user can inspect and edit it while retaining the current Spark.
9. Save the chapter into the selected category. Reopen after restart. Word count, title, category, revision and linked characters remain intact.
10. Highlight a paragraph and ask Dona to rewrite it while preserving character voices. Review an actual proposed diff; only the selection is replaced after safe apply.
11. Run a consistency review; Solarium checks the story's known facts and flags potential contradictions as suggestions, not silent changes.
12. Export the chapter and Story World. Confirm real files are created and valid.
13. Turn Web Search OFF; the library and saved source references still work, with no background HTTP requests.
14. Switch to an unrelated original-fiction project; Re:Zero notes/cards/sources do not leak into its inference context.
15. Inspect any real tool action in Visual Actions; reported `read`, `saved`, and `verified` statuses are backed by actual operation results.

**Success criteria:** The user can go from a specific niche canon reference to a substantiated, organised, editable fanfiction chapter **without manually copy-pasting wiki pages into prompts and without having to direct each individual tool operation**.

---

## 28. Acceptance criteria by subsystem

### Writing

- One stable editable Writing Block for each created document, streaming smoothly and saving reliably.
- Persistent categories created by user, scoped to appropriate project/story.
- Revision history and targeted selection editing preserve user-authored changes.
- All active UI controls perform real operations or explain a concrete unavailable capability.

### Search

- High-relevance, exact-event retrieval rather than generic web search.
- Explicit evidence/read status and link to actual source.
- Correctly distinguishes similar events; records ambiguity and version.
- No Web Search permission bypass.

### Character cards

- Proper sectioned fields, per-field provenance, timeline-aware knowledge and voice guide.
- No raw webpage dumped into a single property.
- Separate from Spark personality.
- User can edit/lock/override and reuse in appropriate story continuity.

### Integration

- Sources Library, Visual Actions, chat, Writing Library, Story Bible and project context all reference stable IDs.
- Existing chat/project/theme/avatars/assets and model inference continue working.
- Migration and crash recovery are tested.
- Full check results are truthful.

---

## 29. Code organisation guidance and completion report

Prefer a clean directory structure consistent with the repository:

```text
src/
  writing/
    types.ts
    schema.ts
    stream-assembler.ts
    repository.ts
    categories.ts
    revisions.ts
    editor-bridge.ts
  stories/
    types.ts
    characters.ts
    evidence.ts
    timeline.ts
    voice-context.ts
    story-repository.ts
  research/
    search-provider.ts
    scene-intent.ts
    query-planner.ts
    relevance-ranker.ts
    page-reader.ts
    evidence-extractor.ts
  components/
    WritingWorkspace.tsx
    WritingLibrary.tsx
    StoryWorldSettings.tsx
    CharacterGallery.tsx
    CharacterDossier.tsx
    ResearchGrid.tsx
  engine/
    ... existing agent, source and tool orchestration ...
src-tauri/src/
    ... existing backend plus scoped storage/network commands as required ...
```

Do **not** mechanically create every listed file if related implementation already exists elsewhere. Codex must integrate, not duplicate. In documentation, add:

- `docs/info/WRITING_CANON_RESEARCH_ARCHITECTURE.md` — current actual implementation contracts.
- A link to this spec from root `AGENTS.md` so future code changes preserve the writing/canon/source invariants.
- Clear migration notes and realistic limitations.

A final implementation report must specify: actual changed code paths; DB migrations; how Writing Library categories work; how character evidence is structured; configured web search provider(s); sample exact-scene result with verified URL; model/tool limitations; tests passed/failed; and anything blocked by missing tools. Do not claim full application integration is complete based only on syntax and mock tests.

---

## 30. External technical references and verified scenario sources

These are **planning references**, not permission to ingest entire copyrighted works or to assume provider pricing/features cannot change. Recheck documentation at implementation time.

### Fiction-scene regression sources

- Witch Cult Translations, [Arc 7, Chapter 1 — “Baptism”](https://witchculttranslation.com/2021/01/23/arc-7-chapter-1-initiation/) — arrow strikes and pins Subaru to a tree; primary English translation example for the given scene.
- Witch Cult Translations, [Arc 7, Chapter 4 — “A Brave Choice”](https://witchculttranslation.com/2021/02/01/arc-7-chapter-4-a-brave-choice/) — later references to that arrow attack.
- Witch Cult Translations, [Arc 7, Chapter 12 — “The Vollachian Empire”](https://witchculttranslation.com/2021/05/06/arc-7-chapter-12-the-vollachian-empire/) — refers to Utakata's separate poisoned-arrow incident.
- Witch Cult Translations, [Arc 7, Chapter 15 — “Those I Want to Protect”](https://witchculttranslation.com/2021/06/13/arc-7-chapter-15-those-i-want-to-protect/) — distinguishes jungle-hunter and Utakata arrow events.

### Provider/editor references

- [Tiptap schema documentation](https://tiptap.dev/docs/editor/core-concepts/schema) — strict node/attribute schema and validation.
- [Tiptap React integration](https://tiptap.dev/docs/editor/getting-started/install/react) — React editor setup, JSON export and editor state subscriptions.
- [SearXNG Search API](https://docs.searxng.org/dev/search_api.html) — self-hosted search; JSON output must be enabled.
- [Brave Search API overview](https://api-dashboard.search.brave.com/documentation) and [search operators](https://api-dashboard.search.brave.com/documentation/resources/search-operators) — optional provider, domain/entity query refinements.

---

## 31. Final instruction to Codex

**Build the complete system.** The major feature is not an attractive page of empty character cards or a Writing Block that is just a textarea; it is the integrated ability to **find an exact source, verify what it says, structure characters and continuity, generate an editable chapter, store that chapter in the user's chosen category, and retrieve only relevant facts later**.

First audit existing code, then implement and integrate all eighteen phases. Preserve the native inference architecture and user data. Test niche exact-source retrieval, schema migrations, long streaming writing, permission boundaries, source evidence, and the end-to-end AU chapter journey. Fix actual errors and report remaining limitations. Keep Solarium 0.1 and its local-first identity intact.

**End of specification.**
