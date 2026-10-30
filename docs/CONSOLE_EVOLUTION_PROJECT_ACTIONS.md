# Solarium 0.1 — Console Evolution / Project Chats / Real Actions

## What changed

- **Solarium Home:** original, Wii U-inspired channel launcher with glossy, dimensional tiles, theme-driven materials, keyboard-operable buttons, responsive tiles and reduced-motion support. Existing Conversations, Spark Studio, Code Workspace and Runtime Center remain accessible from the navigation rail. The theme CSS affects the wider application shell, not only Home.
- **Conversations sidebar:** a discoverable **Create project** button and an always-visible list of projects. Click a project to see **only conversations assigned to it**, and click **All conversations** for conversations not assigned to any project. The new-conversation button inherits the selected project's ID. Branches also inherit the parent project's ID.
- **Create Project:** name, optional active Spark, preferred model, and folder choice. Project may be chat-only, linked to an existing directory, or created as a new directory inside a user-selected parent. Directory creation is performed by a Tauri command; it is never silently created by a React mock. The existing Projects settings page still allows linking a directory later.
- **Persistent Channels:** create shortcuts from Home to a project/Spark combination. These survive restart through workspace validation and SQLite/localStorage storage.
- **Real Creator Tools:** inspect project, list files, read file, search source contents, apply multi-file changes, replace one exact source fragment, run allowlisted build/test/git checks, web search and read webpages. Project tools require a project with a linked folder. Write/change and check tools **always ask for approval**. The change dialog shows file diffs; the backend enforces relative paths, symlink confinement, optimistic expected-file verification, size limits, backups, and rollback of already-touched files on partial batch failures.
- **Activity:** statuses originate in the real tool executor, not generated text; failed checks are flagged as failures. A bounded per-conversation tool event history is stored in the workspace. The activity panel automatically opens when a tool is actually requested.
- **Model Tool Calling:** where a GGUF chat template supports function/tool calls but the inference server cannot report it, use the explicit **Enable tool calling** toggle under Models. This exposes real tool definitions. If the model or server cannot call tools, writing an action-oriented prompt alone cannot make it operate on files.
- **Runtime process lifecycle:** Windows Job Objects with KILL_ON_JOB_CLOSE protect *newly spawned* Windows children from becoming orphans if Solarium crashes; on normal exit the app also stops its managed processes. The dedicated WSL vLLM distro is terminated on normal exit only when Solarium launched the managed WSL client. An already-running compatible loopback model endpoint can be reused; its process is treated as external and is **never killed or claimed as owned**. An unrelated process occupying the selected port is not terminated.

## How to start a project chat

1. Open Conversations (left navigation) and click **Create project**.
2. Enter the name. Optionally choose an existing folder or a parent directory in which to create a new folder, and select the Spark/model.
3. Confirm creation. The project's name is now selected in the Conversations sidebar.
4. Click **New project conversation**. It is stored with this `projectId`, and will not appear when **All conversations** is selected.
5. In **Projects** settings you can link a directory later and set project-only instructions. The project folder contents are untouched if you delete a project in Solarium.

## Tool execution contract

- Request -> model emits a structured tool call -> Solarium applies project/web permission rules -> user approves sensitive actions -> Tauri performs actual action -> actual result or error returned to the model -> event status recorded.
- No operation is called completed before the native tool or HTTP operation reports its result.
- `apply_project_changes` creates/modifies up to 12 source files, and accepts `expected: null` only when a file does not exist. For an existing file, the exact `expected` content must match the file on disk. `replace_project_text` requires a unique exact fragment in an existing file.
- Native project operations only work on a user-linked directory and are confined to that directory. `run_project_check` permits npm check/test/build, Cargo check, git diff/stat and git status; arbitrary shell commands are intentionally not exposed.
- Actual test execution results include stdout/stderr, exit code, and timeouts; a compiler failure cannot be displayed as a completed check.
- Tool history keeps the tool name, status and bounded output. It does not persist fabricated AI claims or internal reasoning.

## Inference ownership details

The default is **stop Solarium-managed llama.cpp when Solarium exits**. Newly spawned Windows processes are attached to a kill-on-close Job Object. If the port is already occupied and `/v1/models` advertises the same requested GGUF/model, Solarium may use the endpoint without taking ownership or stopping it on exit. If the model does not match, it returns an explicit port conflict error instead of killing an unrelated process. This also allows a compatible server orphaned by *older* Solarium versions to be reused. Windows process management requires actual Windows testing.

## Limits and validation

- Existing Markdown formatting, images, PDFs/DOCX, static HTML/CSS/JS previews, web search and source extraction remain available; **isolated React/TSX compilation and unrestricted command execution are not added**.
- Small or incompatible local models might ignore tools or produce invalid tool-call JSON. The Model tool toggle is available for compatible chat templates whose capabilities are not advertised. Actual tool execution needs a running local inference server.
- The current runtime does not support a full coding-agent sandbox: model-proposed changes require explicit review and cannot execute arbitrary commands.
- The development environment in which this archive was prepared could execute the TypeScript core test suite and TS/TSX syntax parse, but did not have installed frontend dependencies, a Rust compiler, Windows process APIs, or access to your RTX 3060. A complete frontend and native build must be verified on your computer.

Run on your Windows installation: `npm install`, `npm test`, `npm run check`, `npm run lint`, `npm run build`, `npm run desktop:dev`. Test closing Solarium with llama.cpp running, reopening it, and selecting the same GGUF. Test a new and existing project folder, global vs project chat isolation, and an approved source change with a real TypeScript check.
