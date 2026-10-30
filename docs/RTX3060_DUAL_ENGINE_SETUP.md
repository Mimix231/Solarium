# RTX 3060 12 GB + 64 GB RAM — two-engine setup

Solarium 0.1 supports **independent llama.cpp and vLLM servers running at the same time**. They do not combine weights or increase the speed of one model by themselves. Choose either one from Chat's model selector, associate an engine with a Spark, or use **Models → Dual-engine comparison** to send the same prompt to both in parallel.

## Prerequisites

- Windows 11/10 x64, recent NVIDIA drivers, an RTX 3060 12 GB, and a working Tauri desktop build.
- Node.js 22+, npm, Rust toolchain, Microsoft C++ Build Tools, WebView2 (for `npm run desktop:dev`).
- A GGUF file for llama.cpp and an appropriate Hugging Face model for vLLM.
- For vLLM, enable WSL2 and install Ubuntu (`wsl --install -d Ubuntu` in an elevated PowerShell terminal, then complete Ubuntu setup). Restart if prompted.
- In WSL, check `nvidia-smi` and `python3 --version`. Make sure `python3 -m venv /tmp/solarium-check-venv` works; install `python3-venv` in Ubuntu if necessary, then delete the test environment. The vLLM Python installer needs internet access and may download several gigabytes of CUDA/PyTorch dependencies.

## Step 1 — Install llama.cpp

1. Open **Solarium → Models → llama.cpp**.
2. Keep **NVIDIA CUDA 12** selected and click **Install / update**.
3. The native installer fetches official llama.cpp release archives and their GitHub `sha256:` asset digests. It checks digest and size, rejects unsafe archive paths, and extracts into the app-data `engines/` directory. If the release does not publish a digest or no compatible archive exists, it fails closed rather than installing unverified binaries.
4. Select your own GGUF and the **Dual-engine balanced** preset. The initial preset uses 20 llama.cpp GPU layers; adjust it for your specific model and available VRAM.
5. Start llama.cpp on port **8080**. Allow time for model loading. Register `http://127.0.0.1:8080` and discover its loaded ID.

**Note:** If your NVIDIA driver cannot run the provided CUDA build, update your official NVIDIA driver or select the CPU binary. CPU mode will not give RTX acceleration. Official release naming can change; the installer reports an error rather than guessing an unknown binary.

## Step 2 — Install vLLM inside WSL2

1. Open **Solarium → Models → vLLM** and keep distribution `Ubuntu` (or enter your existing WSL distro name).
2. Verify `nvidia-smi` works **inside** that WSL distro.
3. Click **Install vLLM in WSL2**. This executes the included `scripts/install-vllm-wsl.sh` in WSL2 and installs `vllm` into a dedicated virtual environment at `./runtime/vllm/venv` (accessed from WSL with `wslpath`). The script refuses to install as root.
4. The default small-model starting point is `Qwen/Qwen2.5-1.5B-Instruct` (a Hugging Face ID, not a promise that it is the best choice for your tasks). The model will be downloaded by vLLM; license/network access remain your responsibility.
5. Start vLLM on port **8000**, with `--gpu-memory-utilization 0.35` and `--max-model-len 4096` initially. Once loaded, register `http://127.0.0.1:8000`, choose **vLLM**, and discover the actual model ID.

If WSL2 localhost forwarding is disabled or unavailable, configure WSL2 appropriately. Solarium deliberately refuses model endpoints outside loopback, so it will not silently make your vLLM server accessible to the LAN.

## Step 3 — Check concurrent VRAM use

1. Click **Refresh GPU** to get NVIDIA's used/free memory figures. Or run `nvidia-smi` in a terminal.
2. Choose the **Dual-engine balanced** preset. If memory runs out, lower llama.cpp GPU layers, reduce model size, lower context sizes, or switch llama.cpp to CPU, keeping vLLM on the GPU.
3. Both services can be *running* without answering simultaneously. To verify simultaneous requests, select two registered models and use **Run both** under **Dual-engine comparison**.
4. Compare actual output, measured first-token latency, and reported/estimated token throughput. Results are model-specific; they do not imply one inference engine is universally faster.

### Troubleshooting

- **CUDA out-of-memory:** 12 GB VRAM is a hard physical limit. 64 GB system RAM can support CPU-side processing but does not become another 64 GB of VRAM. Prefer 1B–3B models for vLLM when another GGUF model is on the GPU.
- **vLLM executable not found:** Use the dedicated WSL2 installer. The launcher looks in its standard virtualenv first and then checks `PATH`.
- **No model connected:** Starting a process does not mean the model has finished loading. Wait, then use **Discover ID** / **Inspect**.
- **Model gives empty answer:** Inspect model/chat template support and the selected endpoint before assuming reasoning or tool support.
- **Server process exits immediately:** The native launcher currently reports startup initiation rather than following child-process logs. Launch the engine manually in a terminal to read its error output.
- **vLLM GGUF issues:** vLLM's GGUF support may be experimental; prefer a vLLM-supported weight format for the WSL2 engine, and use llama.cpp for GGUF.

### Security

- Downloads require manual user action.
- The installer uses only official GitHub release assets with a published SHA-256 digest.
- Server binds and registered endpoints remain loopback-only.
- Solarium passes model identifiers as process arguments, not through a shell.
- Installation scripts install dependencies from package registries and should be reviewed before execution.

**Log privacy:** The desktop app saves process diagnostics under `./runtime/logs/`; those diagnostics may include model names, errors, request details, or model-generated text. Use **View logs** in the Models page for troubleshooting, and handle diagnostic output as potentially private information.


## Runtime location and release-tag installer fix

The Models view now shows an exact **Local runtime folder**. In development, this is `./runtime` within the Solarium project; for a packaged portable executable it is `./runtime` alongside the executable. If the application resides on `D:`, the engine downloads will go to `D:`. Release folder names are now generated from GitHub's **numeric release ID**, not its free-form tag, eliminating the old **Unsafe release version.** failure without weakening path validation. Verified SHA-256 checks are still required before extracting any binary archives.

vLLM runs under WSL2, but its Python environment and caches are stored through the Windows mount at `./runtime/vllm/venv`, `./runtime/huggingface`, `./runtime/cache`, and `./runtime/tmp`. Using a Windows-mounted filesystem for Python environments can be slower or fail with particular WSL/antivirus/mount configurations. If that happens, install vLLM in an ext4-based WSL distribution and connect Solarium to its loopback endpoint; this alternate setup is not fully portable. WSL2 itself, host GPU drivers, system Python, and existing model files are not relocated by this change.

**Before trying the installer again:** close Solarium, replace your previous source with this update, run the native desktop application from your desired drive, and click **Install / update**. If an older server executable path is saved, the successful install automatically replaces it. No need to delete the old binaries first.
