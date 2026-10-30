# Solarium 0.1 — Live Workspace Execution

## What this changes

Live Activity now prioritizes **actual search, inspection, code generation, editing, process execution, and file-save events**, rather than repeating vague inference states. The chat's central region can temporarily become a read-only live workspace when a model sends a real file-edit tool call, a tool searches/opens a website, or an approved project check executes. A Chat button is always available, and the conversation returns automatically shortly after a completed operation. You can reopen the last workspace in the same conversation.

### Source streaming

For a llama.cpp/vLLM model that produces **streamed OpenAI-compatible `tool_calls`**, Solarium observes partial JSON tool-call arguments for `apply_project_changes` and `replace_project_text`. It extracts the actual proposed file paths and source fragments and displays them live in syntax-highlighted tabs. Only the model-emitted source is displayed. Incoming code is *not written* to disk while streaming.

After the complete tool call arrives, the existing Ask/Auto/YOLO permissions decide whether Solarium may apply the change. The native Rust `apply_project_changes` / `replace_project_text` commands check that paths belong to the linked project and that expected source content matches before writing. An Activity entry says **Saving** only when the authorized native file-write operation starts, and **Saved** only after the native tool reports success.

If the GGUF/server doesn't emit native tool calls, Solarium cannot infer a file creation merely from an ordinary prose/code response. Such output stays in chat as code or writing blocks; it is never falsely labeled an on-disk file. If a provider emits tool calls only once, at the end rather than incrementally, the workspace can only display the completed proposed code, not characters that were never streamed.

### Website activity

For explicitly requested research, the research view shows the actual search query, selected result URLs, and available retrieved content snippets. Search result discovery and page content retrieval are separate operations. Web Search OFF still prohibits model-directed web tools. Website content is untrusted data, not executable instructions.

### Real terminal output

New Rust command `run_project_check_stream` retains the same strict allowlist as `run_project_check`: npm check/test/build, Cargo check, and Git status/diff. It uses a Tauri 2 IPC channel to report **real stdout/stderr bytes as the process writes them**; it never displays fabricated successful-check output. The original command remains in the code for callers that only need the final result. An existing three-minute command timeout remains; this is *not* an LLM generation or reasoning budget. Note that cancelling an LLM request does not yet guarantee cancellation of an already-started native project-check subprocess.

### Main code paths

- `src/engine/llama.ts`: forwards incremental tool-call JSON deltas.
- `src/engine/continuous-generation.ts`: forwards those deltas without adding LLM request/reasoning budgets.
- `src/engine/live-workspace.ts`: typed work updates and display-only partial JSON file previews.
- `src/engine/agent.ts`: emits real tool-operation lifecycle events, staged-source updates and check output.
- `src/engine/creator.ts`: Tauri 2 channel bridge for check output.
- `src-tauri/src/creator.rs`: native check command that streams captured stdout/stderr.
- `src/views/Chat.tsx`: temporary live workspace with manual Chat/Workspace toggles.
- `src/components/LiveWorkspace.tsx`: themed, syntax-highlighted file preview and actual web/terminal output.
- `src/domain/validation.ts`: retains operation events when conversation state is reloaded.

## Verification and limits

The regression suite was extended with streaming tool-call, escaped-content, multifile, and operation-persistence tests. It passes in the source environment. Full frontend compilation and native Rust compilation **remain unverified** here because npm frontend dependencies and Cargo are unavailable. Test those steps on your own Windows system before relying on the new Tauri channel command.

Windows commands, from the project root:

1. `npm install`
2. `npm test`
3. `npm run check`
4. `npm run lint`
5. `npm run build`
6. `npm run desktop:dev`

Test with a **tool-calling GGUF** and a linked project folder. Ask to create a small TSX component, then watch Live Workspace as the model streams `apply_project_changes` arguments. Confirm the file only appears on disk after the tool returns successfully, and that completed checks report their actual exit code. A model that produces only prose cannot be forced to produce tool calls by changing the UI.
