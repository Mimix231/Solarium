# Solarium 0.1 — Project Intelligence and Action Reliability

## Purpose

This update addresses an observed failure in a Video Editor project: after explaining a Tauri 2 / React / MUI / Rust video-editor implementation roadmap, the selected Spark lost the project requirements and asked the user what they were building when asked to implement Phase 1. It also fixes automatic irrelevant dictionary web searches and improves rendering of model-exposed reasoning.

## What a Spark actually knows

In `src/engine/agent.ts`, `runAgent()` assembles a project-aware prompt using `buildProjectAwareness()` from `src/engine/project-context.ts`. The briefing distinguishes:

- The active project's **name**, editable **description/objective**, and optional instructions.
- Whether a source folder is **attached**. A saved path is not treated as proof that the filesystem can actually be accessed.
- The **original user goal** within the same conversation, relevant earlier user instructions, and a short historical roadmap excerpt when present. Previous assistant text is identified as a *proposal*, not accomplished work.
- The latest user request, which is always a separate real chat turn.

Only the conversation's own history is used; other projects' conversations are not added. When an old conversational turn is excluded from an inference request due to the model's limited context window, the compact project-awareness briefing still carries the key user-supplied objective.

`prepareGeneration()` in `src/engine/context-window.ts` now prioritizes retaining actual user/project context. It accepts a smaller **request output allowance** before unnecessarily trimming conversation turns. This does not introduce a reasoning budget or change llama.cpp's continuous native inference stream.

### Project folder status

The **Create Project** dialog has an optional Project Objective field. Existing projects expose that field in Project Settings. A linked folder and an unlinked folder are presented distinctly in Project Settings and Chat.

If a user requests changes to an unlinked project, the application explains how to attach a folder and does **not** claim that it inspected or changed files. An attached folder gets a real permission-controlled inspection before an implementation task, using the existing Rust-backed `inspect_project` operation. The Activity panel emits completion only after that command returns a valid result. Directory contents are explicitly treated as untrusted data.

## Action requests and tools

`src/engine/task-intent.ts` differentiates software-modification requests from how-to questions and unrelated creative writing. The application does not require a mandatory Agent/Chat mode selector.

For a project with an attached source folder and a tool-compatible selected model:

1. Confirm the model and project selection.
2. Ask for project inspection permission according to the saved permission settings.
3. Execute *real* `inspect_project` using the Rust filesystem tools, or report denial/failure.
4. Provide the validated inspection snapshot to the Spark; do not invent inspected files.
5. Offer reviewed project read/edit/check tools to the model. Changes still require user approval, and real check output is recorded by the existing activity pipeline.

**Technical limitation:** Tool schemas and calls must be supported by the loaded model/chat template. Solarium cannot make an ordinary text-only model write project files simply by changing its persona. For an implementation request with unavailable tool calling, Solarium clearly points to **Models → Enable tool calling** or a compatible GGUF instead of pretending files were created. Increasing the actual loaded model context may also be necessary if a Spark's essential prompt and tool definitions do not fit.

## Web search

Enabling Web Search grants permission; it no longer triggers an automatic web request for every message. Automatic browsing happens only when the message explicitly requests online research and isn't primarily an application-modification command. Vague requests such as “look up current Phase 1 references” are anchored to the linked project's description and earlier user objective, so a video-editor project does not search for a dictionary definition of “let.” Models with Web Search OFF are still denied search/open-web tool calls.

## Thinking

The existing single, compact Thinking panel now renders model-exposed reasoning with the same safe Markdown renderer used for chat. This enables headings, lists, code, and inline emphasis without HTML injection. It does not simulate thoughts, change the inference engine's reasoning lifecycle, or add generation-cycle indicators.

## Files changed

- `src/engine/project-context.ts`: project briefing, conversation anchors, verified inspection formatting.
- `src/engine/task-intent.ts`: distinguish actionable project modification from questions, creative writing, and research.
- `src/engine/agent.ts`: inject project awareness; perform real permission-controlled preinspection; expose actionable tools only when supported.
- `src/engine/context-window.ts`: context-first truncation and actionable error if mandatory tool schemas cannot fit.
- `src/engine/llama.ts`: require-tools metadata for explicit action requests.
- `src/engine/search-intent.ts`, `src/engine/tools.ts`, `src/views/Chat.tsx`: relevance-aware, explicitly triggered online research.
- `src/components/ThinkingPanel.tsx`, `src/themes/blocks.css`: safe compact Markdown reasoning view.
- `src/components/CreateProjectDialog.tsx`, `src/views/Projects.tsx`: editable project objective, linked-folder state, attach/unlink controls.
- Tests and `tsconfig.test.json` include the new logic and regression cases.

## Local verification

From the Solarium project directory:

1. `npm install`
2. `npm test`
3. `npm run check`
4. `npm run lint`
5. `npm run build`
6. `npm run desktop:dev`

Use the *actual* linked project directory to test a request like: “Let's start with Phase 1, the skeleton. Can you set this up for me in the project folder?” Solarium must retain the original tech stack and project purpose, distinguish linked/unlinked source folder status, and record only performed operations as complete.

The archive does not include existing GGUFs, installed inference engines, application databases, or user chat data. Back up your project before applying a patch. Native Windows/Tauri and live GGUF validation need to be performed on the target Windows computer.
