# Solarium 0.1 — Local Engines, GGUF Library, Fruit Themes and Anime Avatars

## Before you begin

Solarium Desktop is currently a **development project**, not a verified Windows release. Install Node.js, Rust, the Tauri/Windows build prerequisites, and the Visual Studio C++ build tools first. For NVIDIA CUDA inference, update your Windows NVIDIA driver.

Run `npm install` followed by `npm run desktop:dev` from the extracted Solarium project folder. Never replace a running installation's `runtime/` folder or your database while updating the source. Back up your workspace from Settings first.

## llama.cpp: verified official Windows assets

Go to **Inference Engines → llama.cpp → NVIDIA CUDA 12 → Install / update**. The installer:

1. Checks the newest 30 official GitHub release entries, including prereleases instead of assuming the stable release has Windows binaries.
2. Finds a Windows x64 CUDA 12 (or CPU) binary archive using compatible asset naming patterns.
3. Downloads into a temporary directory under `./runtime/engines`.
4. Verifies each downloaded archive against its SHA-256 digest from GitHub release metadata and checks its byte length.
5. Unpacks only safe enclosed ZIP paths and rejects symlinks.
6. Atomically promotes a staged release and returns `llama-server.exe` when found.
7. Shows download and extract status in the Models view.

If GitHub does not publish a trusted SHA-256 digest, the installer **does not execute or install the unverified binary**. An existing manually installed `llama-server.exe` can still be selected through Browse. Installation verifies integrity and presence of the executable; full CUDA compatibility is checked only when a model is loaded on the actual machine.

Engine files live at `./runtime/engines`. The project directory is the runtime root in development; a portable release uses the folder beside its executable. Put the portable app in a writable location, not Program Files.

## vLLM: isolated managed WSL2 filesystem

On Windows, install WSL2 and a source Ubuntu distribution first; set the **WSL distribution** field to its name (typically `Ubuntu`). Ensure it has Python 3.10+, `python3-venv`, and working WSL2 GPU passthrough (`/dev/dxg`).

Click **Install / update managed vLLM**. Solarium asks before duplicating the WSL distro because the clone may occupy **several gigabytes**. It exports your source distro to a temporary archive, imports it as `Solarium-vLLM` under `./runtime/wsl/Solarium-vLLM`, then removes the temporary archive. The managed distro's Linux ext4 VHDX filesystem contains `/opt/solarium/vllm/venv`, Hugging Face downloads, Python wheel caches, Triton caches and CUDA caches. Large Linux dependencies aren't installed into an NTFS-mounted Python venv, and the source Ubuntu distro is not modified by the vLLM package installation.

The original WSL installation, WSL Windows components, graphics drivers, and source Ubuntu distro remain managed by Windows and are not relocated. The Solarium-managed Linux filesystem *is* placed beneath the chosen portable Solarium folder, on the corresponding drive. Do not delete `runtime/wsl/Solarium-vLLM` while its distro is registered: unregister it using Windows' WSL tooling first if you intend to remove it permanently.

vLLM serves a Hugging Face-compatible model on port 8000; llama.cpp serves your selected GGUF on port 8080. Both servers can be running, but they share the RTX 3060's **12 GB physical GPU VRAM**, so two loaded models may exceed available CUDA memory. The default dual-engine preset reduces but does not eliminate that risk. vLLM's GGUF loading remains experimental; prefer its native supported model formats.

## Choose a GGUF model folder once

1. Open **Settings → Local GGUF model library**.
2. Select **Choose folder** and point it at your folder containing `.gguf` models (subfolders up to four levels deep are scanned).
3. Click **Scan GGUFs** when files are added or moved. The folder preference survives app restarts; the app refreshes its catalog on entering the chat view.
4. Open **Chat** and use the model picker **above the message field**. Files from your GGUF folder are grouped separately from other registered local inference backends.
5. Selecting a GGUF instructs Solarium to load that file in the managed llama.cpp server, waits for `/v1/models` readiness, and stores the actual reported model ID. If loading fails, it shows an error and logs rather than claiming the model is ready. Sending another message also checks that the chosen GGUF is loaded.

The catalog reads file names, paths and sizes only; it does not upload models. Scanning ignores filesystem symlinks and empty GGUF files. Browser-only development cannot open Windows folder dialogs or run engines: use the Tauri Desktop window for the local runtime.

## Spark Anime Avatar Studio

Open **Sparks → Edit Spark → Appearance → Open Avatar Studio**.

The full-height, three-panel editor provides layered SVG anime busts and a visual gallery for **7 haircuts, 3 bangs, 3 face types, 3 eye types, 4 outfit types and 6 accessories**. Colors can be changed independently for hair, hair highlights, eyes, skin, outfit, trim and background. Sliders adjust blush, eye size, hair volume, portrait zoom and position. Five original character presets are included. Neutral, Happy, Curious and Focused expressions share an editable base, with optional custom PNG/JPEG/WebP expression portraits.

The editor supports undo/redo for up to 40 recent changes, JSON preset imports/exports (validated like normal Spark profiles), optional imported finished portraits and export to a 1024×1024 PNG. Presets are Solarium-original vector assets; no copyrighted anime asset bundle is embedded. Everything renders offline without a diffusion model.

## Themes

The original six themes are retained. Seven additional self-contained CSS themes are located under `src/themes/<theme>/<theme>.css`: **Peach, Cherry, Lime, Blueberry, Tangerine, Kiwi and Strawberry**. The theme selector previews each. Each has distinct backgrounds, opacity, borders and surface treatment, not just an accent-color substitution.

## Troubleshooting

- **Installer reports no compatible release:** GitHub releases might have changed their naming or the API might not include matching Windows assets. Review `src-tauri/src/llama_installer.rs` and read the returned error. CPU distribution or manual Browse remains available.
- **Installer reports no SHA-256 digest:** For safety, this installer only accepts assets with GitHub-published hashes. Do not bypass verification unless you independently verify the download from the official publisher.
- **Windows CUDA DLL missing or OOM:** Check **Inference Engines → View logs** and reduce GPU layers, context length or vLLM's memory fraction; ensure the NVIDIA drivers are compatible.
- **Managed WSL installation fails:** WSL2 must be installed and the chosen source distro must exist. A clone can require substantial disk space. Open `wsl -l -v` on Windows and confirm `Solarium-vLLM` is available.
- **GGUF dropdown empty:** Set the directory in Settings, click Scan and verify the files have `.gguf` extensions and nonzero file sizes. Native folder selection requires Tauri Desktop.
- **Fonts or avatar colors look different:** All character layers are vector shapes with locally defined palette values. Animation can be disabled by the per-Spark switch or global reduced-motion setting.

## Implementation boundaries

Model compatibility is hardware- and server-version-dependent; the exact Windows CUDA and WSL2 paths have **not been tested on the user's PC**. Unit tests and TypeScript source parsing do not substitute for a real native Windows build or GPU inference test. Run `npm run build`, `npm run lint`, `cargo test --manifest-path src-tauri/Cargo.toml`, and `npm run desktop:build` on a fully provisioned Windows development machine before distributing binaries.
