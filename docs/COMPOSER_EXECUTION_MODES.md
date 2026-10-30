# Solarium 0.1 — Composer execution modes

The chat composer now exposes three modes. This setting is saved in the local
Solarium workspace and defaults to **Ask** for existing installations.

| Mode | Real tool access | Confirmation policy |
| --- | --- | --- |
| Ask | Registered tools only | Prompt for every tool operation, including project inspection. |
| Auto | Registered tools only | Automatically permit read-only operations. Project-file changes require one approval per message/task; executable project checks (npm/Cargo) need another task-scoped approval. Subsequent operations in the approved category can proceed during **that reply only**. |
| YOLO | Registered tools only | Run the supported project tools, including code writes and fixed project-check commands, without confirmation dialogs. |

YOLO is for projects you trust: `npm test`, `npm run build`, and other approved
project scripts can execute user-supplied code and may change files. YOLO does
**not** enable arbitrary shell commands or grant access outside the attached
project folder. The Rust path validation and file-change checks remain active.

Other conditions apply in **every** mode:

- **Web Search OFF** disables the model's web tools, even in YOLO.
- **No linked project directory** prevents project file tools from running.
- **Blocked tools** in Settings are denied in all modes.
- Actual tool operations, not model-generated claims, determine Activity results.
- Cancelling generation also rejects pending approvals and prevents the next tool call.
- Auto's task grants are discarded after the reply; they do not survive a new
  conversation, retry, project switch, or application restart.

## Files changed

- `src/views/Chat.tsx`: fixes nullable changeset approval and adds the mode selector.
- `src/engine/action-permissions.ts`: centralized deterministic permission policy.
- `src/engine/agent.ts`: uses the policy for automatic inspection and model-called tools, with task-scoped grants.
- `src/domain/types.ts`, `src/domain/defaults.ts`, `src/domain/validation.ts`: saved preference and safe migration.
- `src/views/Settings.tsx`: blocks tools independently of the selected composer mode.
- `src/engine/tools.ts`: accurate tool descriptions.
- `tests/composer-action-modes.test.cjs`: mode, persistence and safety regressions.

## Install and validate

Copy the update patch over the project files without deleting your `runtime/`
folder or database. From the project root, run:

    npm install
    npm test
    npm run check
    npm run lint
    npm run build
    npm run desktop:dev

The full frontend typecheck and Rust build need to be run on a machine with the
complete npm and Cargo dependencies; the available core regression tests are
not a substitute for a complete Tauri build.
