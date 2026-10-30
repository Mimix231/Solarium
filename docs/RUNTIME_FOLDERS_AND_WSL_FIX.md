# Solarium 0.1 — Runtime folder and WSL installation fix

## What changed

Previously, vLLM installation failed with **"WSL could not export the installed 'Ubuntu' distro"**. The installer tried to copy a pre-existing Ubuntu instance, regardless of whether it was installed or initialized.

The new Rust `vllm_installer::install()` does **not** export any distro or require Ubuntu to be installed. It downloads a stable official Ubuntu 24.04 LTS WSL root filesystem from `releases.ubuntu.com`, verifies its SHA-256 digest against Ubuntu's published checksum list, and imports a **private** distribution named `Solarium-vLLM` into the local runtime. Windows WSL2 features and a working NVIDIA driver are still required.

### Directory layout (development project at E:\ChatGPTProjects\Solarium)

```text
E:\ChatGPTProjects\Solarium\
└── runtime\
    ├── llama-cpp\             # llama-server.exe, its DLLs, installed.json
    ├── vllm\
    │   ├── linux\             # ext4.vhdx, WSL2's private Linux filesystem
    │   ├── downloads\         # temporary verified Ubuntu image, removed after import
    │   └── install.log        # vLLM/Ubuntu package-installation output
    ├── installer\jobs.json   # durable history and progress
    └── logs\                  # inference-server output
```

The Linux Python environment (`/opt/solarium/vllm/venv`) and model caches live *inside* `runtime/vllm/linux/ext4.vhdx`, not directly as editable Windows files. Windows manages the WSL kernel and registration, so some WSL system components stay in the Windows installation; the large managed virtual disk stays with Solarium.

## Installation procedure

1. **Close Solarium**, back up your project and `runtime` directory. Do not delete the existing installation or its model files.
2. Apply the source patch (or extract the full updated source project).
3. Run `npm install`, then `npm run check`, `npm run build`, and `npm run desktop:dev`.
4. Solarium moves the existing numbered llama.cpp directory from `runtime/engines/llama-<id>-cuda12` to `runtime/llama-cpp` at application startup when safe. If a llama server is still running, stop it and retry. Completed install-job paths are updated automatically.
5. Open **Runtime Center** and select **Install / update** under vLLM. It downloads the official Ubuntu image, imports the managed distro into `runtime/vllm/linux`, and installs the Python packages inside it. You **do not need to install Ubuntu yourself**.
6. Confirm the distro with `wsl --list --verbose`; it should include `Solarium-vLLM`, version 2. Confirm the virtual disk exists under `runtime/vllm/linux`.
7. In **Models**, choose your GGUF or vLLM-compatible model and start the appropriate server.

## Windows requirements and troubleshooting

- WSL2 must be enabled. If `wsl --status` reports that WSL is not installed, run `wsl --install --no-distribution` in **administrator PowerShell**, reboot if requested, and retry. The installer never enables Windows features as administrator without consent.
- NVIDIA drivers must support WSL2 GPU passthrough. In Windows, run `nvidia-smi`; in the managed distro, use `wsl -d Solarium-vLLM -u root -- nvidia-smi` after import.
- First vLLM installation downloads a Linux image, PyTorch and supporting packages, so allow multiple gigabytes of disk and download space. Detailed Python setup output is in `runtime/vllm/install.log`.
- If a **previous version** successfully registered `Solarium-vLLM` under `runtime/wsl` rather than the new `runtime/vllm`, the installer refuses to overwrite it. **Do not run `wsl --unregister` without verifying a backup first**; unregistering a WSL distro permanently removes its filesystem. You may use a documented WSL VHD backup/export and import migration instead.
- If a failed new import leaves files under `runtime/vllm/linux` without a registered distro, the installer provides an actionable error and preserves the data for inspection. Back up the files before clearing the failed directory.
- The prior **failed/interrupted** install history is retained; it does not mean the new installer failed. Click **Install / update** to create a fresh job.

## Verification status

TypeScript syntax parsing, the compiled core-domain TypeScript test suite, and the project's Node integration tests were run in the authoring environment. Rust compilation, the Windows-specific WSL import, the official Ubuntu download, and GPU inference still require testing on a Windows computer with Cargo/WSL2/NVIDIA installed. Do not assume those platform checks passed.
