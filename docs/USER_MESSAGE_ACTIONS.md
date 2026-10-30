# Solarium 0.1 — User message actions

Three compact actions now appear under each **user** chat bubble:

- **Copy** places the user message text on the clipboard. Attached files are not copied to the clipboard.
- **Edit** opens an inline, multiline editor populated with the original text. **Save & retry** updates that message in place and generates a fresh response. **Cancel** or Escape dismisses editing without changing the conversation. Ctrl+Enter / Cmd+Enter also saves and retries.
- **Retry** keeps the selected user prompt and regenerates its assistant reply without changing the user prompt.

Both retry paths remove every message **after** the selected user message, including later user follow-ups, so no obsolete replies can enter the regenerated model context. Earlier messages remain untouched. A model load or preflight web-search error does not delete existing replies; the history is only rewound once the model is ready to start generating.

Both actions use the same `runAgent()` and continuous generation pipeline as sending a new message. The current Spark, selected session model, project and attachments are preserved. Any partial response produced before a later generation failure is retained according to the existing chat behavior.

## Changed functions and files

- `src/domain/conversations.ts`: `rewindChatSession(source, messageId, editedContent?)` is a pure helper for safe conversation truncation and optional editing.
- `src/state/useSolarium.ts`: `rewindUserTurn(sessionId, messageId, editedContent?)` persists the revised message history.
- `src/views/Chat.tsx`: `send(request)` supports new-message and retry paths, with `copyUserMessage()` and `retryUserMessage()` providing user actions.
- `src/themes/base.css`: `.user-message-bubble` and `.user-message-actions` keep the buttons compact and outside the message bubble.
- `tests/user-message-actions.test.cjs`: regression tests for text editing, deletion of obsolete replies, attachment preservation, model and project preservation, custom titles and invalid targets.

## Validation

- `npm test`: 61 tests passed.
- All 49 TS/TSX source files passed the repository syntax parser.
- Core domain/engine TypeScript compilation passed.
- Full app TypeScript, production frontend build, and native Tauri compilation were **not verified** in this environment because dependencies were unavailable. `npm install` timed out here and `tsc --noEmit` cannot resolve `vite/client` until dependencies are installed.

On Windows, run `npm install`, `npm run check`, `npm run lint`, `npm run build`, `npm test`, and then `npm run desktop:dev`.
