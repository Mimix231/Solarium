> **Creator Workspace update:** See [Creator Workspace guide](docs/CREATOR_WORKSPACE.md) for project chats, formatting, attachments, web reading, code files and expanded anime avatar options. This update intentionally does not add a planning/verification agent.

# Solarium 0.1

**Local AI, personal identities.** Solarium is an open-source Tauri 2 desktop application for chatting with local llama.cpp, vLLM (WSL2), and Ollama models through customizable AI personalities called **Sparks**. The interface uses React, TypeScript, Material UI, and six distinct CSS themes.


### Solarium 0.1 — Context Window Guard (latest update)

Before inference, Solarium checks the active model context and excludes older chat turns from the temporary request when necessary. llama.cpp now uses one native `max_tokens: -1` stream with managed context shifting; it no longer restarts Dona's reasoning every 2,048 tokens. vLLM uses one finite context-sized stream. See `docs/NATIVE_STREAM_REASONING_FIX.md` and `docs/CONTEXT_WINDOW_GUARD.md`.

## Getting started

Prerequisites: Node.js 22+, npm, and a locally selected GGUF. You can install llama.cpp inside the Windows desktop app. For **desktop** builds, install a recent Rust toolchain, platform development dependencies, and the Tauri 2 prerequisites (on Windows: WebView2 and Microsoft C++ Build Tools).

```bash
npm install
npm run dev
```

To open the desktop version (requires Rust and platform prerequisites):

```bash
npm run desktop:dev
```

To create a desktop installer:

```bash
npm run desktop:build
```

### Install and use llama.cpp + vLLM concurrently

The **desktop** Models page can download official digest-verified llama.cpp binaries for Windows x64, launch a GGUF model on `127.0.0.1:8080`, install vLLM into an isolated WSL2 Ubuntu environment in `./runtime/vllm` (without cloning an existing Ubuntu distro), and launch it independently on `127.0.0.1:8000`. Both endpoints can stay running; separate registered models use a shared OpenAI-compatible streaming transport. An optional Ollama endpoint can be registered on `127.0.0.1:11434`.

**RTX 3060 12 GB warning:** Two independent engines compete for the same VRAM, and 64 GB system RAM is not equivalent to GPU memory. The balanced starting profile uses 20 llama.cpp GPU layers and a vLLM memory fraction of 0.35. You may need smaller models, fewer GPU-offloaded layers, or llama.cpp CPU inference to prevent CUDA out-of-memory. Running both engines does not inherently make one response faster.

See **[docs/RUNTIME_FOLDERS_AND_WSL_FIX.md](docs/RUNTIME_FOLDERS_AND_WSL_FIX.md)** for the current runtime folder layout, installer migration and Windows/WSL2 troubleshooting. The older RTX3060 guide documents the original design and may contain obsolete paths. The desktop installers download binaries and Python dependencies only after you click the relevant installation button. Live compatibility and speed still need verification on your hardware.

### Spark DNA

Open **Sparks → Edit → Personality** to choose **Simple**, **Advanced**, or **Raw**. Raw mode preserves pasted text (up to 64,000 characters), and accepts `.txt`/`.md` imports without rewriting them. Advanced mode separates identity, voice, behavior, relationship preferences, work style, and personal boundaries. The full prompt can be previewed; the built-in playground sends a test prompt to the Spark's selected inference engine with tools disabled. A long raw personality may exceed a small model's context length; increase context size or shorten the persona if the server rejects it.

### Avatars

**Sparks → Edit → Appearance** supports four optional expression-specific portrait images (Neutral, Curious, Happy, Focused) in addition to SVG layer options. These are local image assets, not model-generated expressions.

## Included subsystems

| Phase | Included in 0.1 |
| --- | --- |
| 1. Design system | Compact 3-column layout, MUI theme tokens, six separate themes (`crystal`, `obsidian`, `aurora`, `material`, `slate`, `solar`), density settings, optional motion reduction. |
| 2. Spark Studio | Spark CRUD, traits, advanced and raw Spark DNA, personality imports, live prompt preview and testing, preferred models, per-Spark import and export, avatar assignment. |
| 3. Local models | Loopback llama.cpp connection, `/v1/models`, `/props`, SSE streaming, best-effort capability inspection, independent llama.cpp/vLLM process start/stop on Tauri, a digest-verified Windows llama.cpp installer, a WSL2 vLLM installer, and sampling controls. |
| 4. Conversations | Multi-chat history and search, explicit Spark and model selection, persisted messages, four interaction modes, stop generation. |
| 5. Memory | Local, user-approved, editable memory library with per-Spark scope and enabled/disabled toggles. **No automatic extraction.** |
| 6. Activity and tools | Ordered event emitter, actual SSE reasoning parsing and tool records, permissions and one-time approval dialog, built-in time/calculator/memory-search tools. |
| 7. Avatars | Portrait, orb, and glyph styles; color and expression controls, hair/accessory layers, image import, per-expression portrait images, opt-in lightweight CSS animation. |
| 8. Optimization / QA | Selective Zustand subscriptions, activity-event coalescing, reduced-motion CSS, strict TypeScript settings, modular engines, performance measurements, memory-use inspection, concurrent dual-engine mock-stream tests, and unit/integration tests. |

These are **initial implementations**, not claims of feature parity with mature editors, professional avatar builders, or fully autonomous agents. This release does not include face tracking, generated avatar images, full web-browsing tools, fully automatic GPU tuning, or measured real-hardware engine comparisons.

## Testing

```bash
npm test          # TypeScript syntax and core TS compile; 17 tests, including mocked LLM SSE and tool flow
npm run check     # Full frontend TypeScript types (requires npm install)
npm run lint      # ESLint (requires npm install)
npm run build     # Frontend production build (requires npm install)
npm run desktop:build # Native platform build (requires Rust, cargo, and platform toolchain)
```

**Validation limitation of this package's authoring environment:** the environment did not have network access to npm or a Rust/Cargo compiler. The core TypeScript compilation, mock-stream integration tests, and source syntax validation were run; **frontend production compilation, ESLint against installed libraries, real llama.cpp inference, and the native Tauri build could not be executed**. After `npm install`, run the remaining checks locally before treating the release as production-ready.

## Architecture

```text
src/
  components/      MUI window shell, theme picker, avatar SVG renderer
  views/           Chat, Spark Studio, model manager, memory library, settings
  domain/          Strongly typed profiles, prompts, validations and defaults
  engine/          OpenAI-compatible backend adapters, SSE transport, reasoning, tools, performance metrics and optimization presets
  data/            SQLite (Tauri) / localStorage (browser preview) workspace persistence
  state/           Zustand store, actions, debounced serialized storage writes
  themes/          One theme CSS file per design language, plus shared layout CSS
src-tauri/
  src/lib.rs       Native llama.cpp and WSL2 vLLM lifecycle and installer and Tauri plugins
  capabilities/   Least required desktop dialog and SQL permissions
```

### Security and privacy

- Desktop application uses SQLite in its app data directory. Browser development uses origin-local `localStorage`. Imported images are embedded as data URLs in that local workspace; maximum input size 1.5 MB.
- Model requests only go to `http://localhost`, `http://127.0.0.1`, or `http://[::1]`. No cloud inference API is configured; installation may download from official GitHub and Python package repositories when the user explicitly installs an engine. Tool permissions default to **ask**; unrecognized tools default to **deny**.
- No automatic memory creation or uploading conversations. Users approve shared/global and private Spark memories explicitly.
- The model's generated reasoning is shown **only if emitted through actual native reasoning fields or a `<think>` tag**. Status messages do not pretend to be hidden model reasoning.
- Imported workspaces/Sparks should be treated as untrusted data; review behavioral instructions before using them with a model. JSON data is not executed as code.

### Developer notes

- `composeSparkInstructions()` in `src/domain/persona.ts` assembles identity, mode, traits, explicit examples and memory context separately from inference capability detection.
- `adapterFor()` in `src/engine/backends.ts` chooses the inference backend; `streamLlamaTurn()` in `src/engine/llama.ts` handles incremental SSE and reasoning/tool-call deltas; `runAgent()` in `src/engine/agent.ts` executes supported tools with permission mediation.
- `AgentEventEmitter` in `src/engine/activity.ts` is the **sole source** of ordered run events. The UI does not create a separate synthetic activity projector.
- The `workspace` database currently stores one validated, versioned JSON snapshot per workspace to keep version 0.1 migrations small; a future schema should normalize large messages and attachments into separate tables.
- Large local model inference will use substantially more memory and CPU/GPU than the interface. Animation is cosmetic and is reduced with the corresponding preference or OS setting.

## License

MIT. Solarium is free software; models used with Solarium may have their own separate licenses.


## Portable engine installations (`./runtime`)

The **Models → Inference Engines** screen shows the exact path used. In `npm run desktop:dev`, Solarium uses `<project>/runtime`; in a packaged **portable** executable, it uses `<directory containing Solarium.exe>/runtime`. The runtime folder contains official llama.cpp binary downloads, vLLM's WSL-accessible Python virtual environment, Hugging Face caches, and engine logs. Solarium does not determine this from the shell's current working directory.

**For a D: drive runtime, put the Solarium project or portable executable on D:** (for example, `D:\Apps\Solarium\runtime`). If installed in a protected location such as `C:\Program Files`, Windows may deny writing alongside the executable. Use a writable portable location instead. The installer reports a clear error in this case rather than writing to AppData silently. Existing models and the conversation database are **not** moved automatically. WSL2's Ubuntu distribution, CUDA drivers, Python system packages, and other Windows components may still be on C:; only Solarium-managed vLLM environment/caches and engine installations are located under runtime.

Any earlier installation under `%APPDATA%` remains untouched. Reinstall with the new Models page, then remove the old runtime folder manually only after you have verified you no longer need it.

---

## October 2026 update — Engine installers, Anime Avatars, GGUF Chat Picker

This source archive includes the latest Solarium 0.1 changes: reliable llama.cpp release asset discovery across prereleases, validated staged downloads with progress, an isolated Solarium-managed vLLM WSL2 clone rooted in `./runtime`, seven fruit-inspired themes, a full anime-style layered SVG Spark Avatar Studio, and a GGUF model directory preference with a chat composer model picker that actually loads GGUFs before chatting.

**Start here:** [docs/LOCAL_RUNTIME_AND_AVATARS.md](docs/LOCAL_RUNTIME_AND_AVATARS.md) for Windows setup and known limitations. [VALIDATION.md](VALIDATION.md) describes which checks actually passed and which Windows-native checks remain unverified.


## Spark Evolution (October 2026)

This update adds an independent, persistent **Runtime Center**, an embedded **Anime Avatar Studio**, **Spark Worlds**, **Conversation Branches**, **Spark Laboratory**, **Spark Teams**, **Companion/Workspace** layouts, and expressive individual fruit stylesheets. The interface remains Solarium 0.1.

See [docs/SPARK_EVOLUTION.md](docs/SPARK_EVOLUTION.md) for architecture, installation steps and known limitations, and [VALIDATION.md](VALIDATION.md) for verified test status.


## Continuous generation, Thinking & web relevance

Solarium uses **one native inference stream** for an assistant answer instead of constructing artificial user prompts at 2,048-token boundaries. Managed llama.cpp loads its model once, enables context shifting and streams with `max_tokens: -1`; vLLM uses its available finite context for a single stream. Real model-generated reasoning appears in a compact expandable **Thinking** bar, and a reasoning-only response is preserved if the backend finishes without an answer. See [`docs/NATIVE_STREAM_REASONING_FIX.md`](docs/NATIVE_STREAM_REASONING_FIX.md) for details.


## Universal Content Blocks (Creator Workspace update)

Chat now supports streamed writing, code, table, chart, research, image, equation, file proposal, terminal result and static-preview blocks. Open the expandable editor for saving, version history, file export and explicit reviewed project writes. See [`docs/UNIVERSAL_CONTENT_BLOCKS.md`](docs/UNIVERSAL_CONTENT_BLOCKS.md) for examples, limitations and regression-test guidance.

## Rendering Engine 2.0 update

See [`docs/RENDERING_ENGINE_2.md`](docs/RENDERING_ENGINE_2.md) for the inline formatting, safer interactive preview, multi-file code preview, writing workspace, web-search relevance and partial-generation recovery changes. This release remains Solarium 0.1; frontend and native Windows builds require local verification.

## Reasoning & Character Evolution (0.1)

See [`docs/REASONING_CHARACTER_EVOLUTION.md`](docs/REASONING_CHARACTER_EVOLUTION.md) for avatar features and the updated native reasoning stream. Existing runtime and Spark data are left intact.


### Inference development contract

Before modifying model inference, reasoning, context fitting, or tool calls, read [the inference architecture contract](docs/info/INFERENCE_ARCHITECTURE.md). The repository `AGENTS.md` also requires it.
