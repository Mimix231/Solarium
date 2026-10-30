# Solarium 0.1 — Spark Evolution update

This is an **update of the existing Solarium 0.1 codebase**, not a new app or a major-version release.

## What changed

### Runtime Center

The *Runtime Center* icon in the rail opens the new engine installer. The Rust backend now owns installation jobs, which means an installation does not stop or lose its progress when a React screen unmounts. Progress is published as `solarium-install-job` events, and the app-level Zustand store also polls `get_install_jobs` every two seconds. The title bar offers a global in-progress indicator, including cancellation requests. Runtime Center can also read existing engine logs directly.

Installation records are saved under `./runtime/installer/jobs.json`. If the application exits during an installation, a `running` or `cancelling` job is restored as `interrupted` and can be retried. This is **not automatic byte-resume**: the installer retries verified downloads. If a job is cancelled, llama.cpp checks cancellation during download and extraction; vLLM checks at safe WSL stage boundaries, so cancelling a WSL export/import or pip stage may take time. No unsupported pause control is shown.

llama.cpp is still installed from official GitHub releases with SHA-256 verification. vLLM still requires an existing WSL2 Ubuntu installation; its managed Linux filesystem stays under `./runtime/wsl/`, on the same drive as the Solarium runtime. This process does not relocate the WSL system installation, NVIDIA drivers, or Windows dependencies.

After a successful llama.cpp installation, Solarium copies the installed `llama-server.exe` path into `preferences.llamaExecutable` automatically. The existing model controls and GGUF dropdown still work.

### Anime Avatar Studio

Open **Spark Studio → edit a Spark → Appearance**. Appearance is now a complete embedded editor, not a set of legacy dropdowns plus a second modal. You can customize independent front hairstyles, bangs, side locks/braids, brows, pupils, mouth, faces, clothing, two accessory slots, colors, body width, offset and zoom, and eight expression slots. Local SVG rendering, layered preset import/export, optional raster portraits, and undo/redo remain available. Lightweight CSS blinking and breathing animations respect reduced-motion settings.

The artwork is a programmatic 2D vector anime portrait renderer. It is **not** equivalent to a diffusion or hand-illustrated anime portrait generator, and it is not a full-body rigging system.

### Spark Worlds

The **Spark Worlds** workspace stores private character lore or project reference entries per Spark. Entries are selectively retrieved using deterministic local token matching and passed to the language model as reference material, explicitly labelled as untrusted notes. This is not embeddings-based semantic search; there are no external requests.

### Conversation branching

Use **Branch from here** below a conversation message. Solarium copies messages up to that selected message into a new session and preserves `parentSessionId` and `forkMessageId`, leaving the original conversation unchanged. The sidebar marks branches with an arrow.

### Spark Laboratory

Store repeatable personality test prompts, run them against the selected **already-running** local model, inspect actual model outputs, evaluate expected phrases, and record your own 1–5 rating. Expected phrase checks measure only literal text matches, not overall personality accuracy.

### Spark Teams

Select up to four Sparks and a loaded local model. Solarium invokes each Spark **sequentially**, passing prior generated output to the next role. It stores separate contributions and errors in a team-run report. This makes multi-persona use possible on a 12 GB GPU without forcing simultaneous model loads. No tools are executed on behalf of the team run.

### Companion / Workspace

The title bar toggles **Companion** or **Workspace** layouts. Workspace exposes the additional knowledge, test, and team shortcuts alongside the existing conversation history. It does not alter the selected Spark or invalidate current chats.

### Distinctive fruit themes

Strawberry is now cream-white, ruby-red and leaf-green, with a botanical sidebar, red accents and strawberry decorations. Kiwi features a brown rind rail, citrus-green surface and seed graphics. Cherry, Peach, Lime, Blueberry and Tangerine likewise use separate layouts/materials/illustrative CSS details rather than accent recoloring. Each theme has its own stylesheet. The pre-existing non-fruit themes remain.

## How to run

From the extracted `solarium-0.1` project directory:

1. Install Node.js 22+, Rust, and the Windows Tauri build prerequisites.
2. Run `npm install` (internet required to obtain dependencies).
3. Run `npm test` and `npm run check`.
4. Run `npm run lint` and `npm run build`.
5. Run `npm run desktop:dev`; open **Runtime Center**.

Back up the existing Solarium project and workspace before replacing source files. The data schema stays at version 1 and the validator safely fills new optional collections for old workspaces.

## Known constraints

- A verified real Windows Tauri build and engine installation on the RTX 3060 were not available in this development environment. Do **not** assume that native installer behavior has been hardware-validated.
- vLLM installation can take substantial disk space and time. It uses a dedicated WSL2 virtual disk and is not a native Windows executable.
- Multi-Spark tool execution, true semantic retrieval, downloadable community avatar packs, and image-generation-based portraits are **not** implemented here.
- Runtime Center does not promise byte-level resume or cancellation of a running WSL export/import subprocess; it records interrupted jobs and allows retries.
