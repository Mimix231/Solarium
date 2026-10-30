# Solarium 0.1 — Visual Action Engine 2.0

## Goals

This release removes the visible Activity rail. Existing `AgentEventEmitter` audit records and Rust-backed filesystem/network/check tools are deliberately preserved. Visual work is attached to the assistant's actual conversation turn; reopening the chat retrieves the completed records from the saved workspace.

### Real events, not simulated progress

- **Research:** the public search operation reports its real query and returned pages. Website tiles have `Found`, `Reading`, `Read`, or `Failed` states. Finding a result does not mean it was read. The grid records the first four relevant results, and opens up to two pages during automatic research; model-called search tools may return more.
- **Project inspection:** uses Solarium's actual native directory/manifests tool. Only successful reads produce completed inspection actions.
- **Code generation/editing:** incremental OpenAI-compatible streamed function-call arguments can be previewed in the existing syntax-highlighted Live Workspace. Code remains uncommitted until the existing permission-scoped Rust project tool returns successfully. Each operation has a stable ID so the temporary editor is replaced by a confirmed result rather than shown as a second action.
- **Project checks:** outputs are received from the existing native streaming terminal command. Exit codes and timeout results determine the final status.
- **Writing:** `solarium-writing` fences create a visually streamed draft in the writing workspace. The result says *draft created in chat*, NOT *file saved*. Saving as an asset remains a user action.
- **Inline formats:** regular Markdown tables, KaTeX equations, JSON charts, and simple `mermaid` `flowchart LR/TB` diagrams remain visual content inside messages, not invented execution records. The Mermaid subset is intentionally non-executable.

### Lifecycles

Operations flow through `running → completed | failed | denied`. The UI displays progress from actual tool-stream data. It never determines success by parsing the Spark's prose. Once finished, the work surface returns to Chat and the completed operation folds into a small inline card. Cards can be expanded or reopened in the full Live Workspace.

Interrupted active operations reload with a failed/unconfirmed indicator; Solarium never labels an interrupted process completed. Project operations retain the Ask/Auto/YOLO tool permission boundaries and the Web Search switch.

### Files and data

- `src/engine/visual-actions.ts`: bounded operation identity, merge, recovery, research source states.
- `src/state/useSolarium.ts`: durable action records, conversation ownership, rewind/delete cleanup; old audit log remains available internally.
- `src/domain/validation.ts`: validates saved operations and discards orphaned records.
- `src/components/VisualActionCard.tsx`: compact expandable operation cards and research grid.
- `src/components/LiveWorkspace.tsx`: unchanged code highlighting, enhanced search grid and document preview.
- `src/engine/agent.ts`: stable operation identifiers, corrected development-tool availability, optional first-turn required tool choice, verified native outcomes.
- `src/views/Chat.tsx`: replaces the Activity rail with conversation-linked actions and automated workspace transitions.
- `src/blocks/workflow.ts`: safe subset renderer for user/model-generated diagrams.

### Constraints and troubleshooting

The backend must *actually emit* a compatible structured tool call to create or modify a project. The UI does not turn arbitrary model prose or fenced code into disk writes. A model without a compatible tool-use template may fail to invoke tools, even with YOLO selected. The newly requested `tool_choice: "required"` for the initial implementation turn is a standard OpenAI-compatible request but must be supported by the installed llama.cpp/vLLM server; unsupported models can reject it. Later model turns use `auto` to permit a final answer. If files aren't changed, Solarium reports that rather than claiming success.

Stored visual previews are bounded and are not backups of the real project. Inspect the source folder to verify actual writes. A task is complete only when the relevant operations' native results confirm it.

## Checks

Run in the project directory on Windows: `npm install`, `npm test`, `npm run check`, `npm run lint`, `npm run build`, `npm run desktop:dev`. Also test against a live tool-capable GGUF and test actual source writes in a disposable sample project. Native Rust and end-to-end GPU tool calling cannot be certified from a headless environment without Cargo, a Windows desktop, and the selected inference model.
