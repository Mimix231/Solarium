#!/usr/bin/env bash
# Runs only inside the Solarium-vLLM WSL2 distro. Its ext4.vhdx is stored
# beneath Windows <Solarium>/runtime/vllm/linux, never in /mnt/c or on NTFS.
set -euo pipefail
if [ "${1:-}" != "/opt/solarium" ]; then echo 'Expected managed /opt/solarium environment.' >&2; exit 2; fi
runtime=/opt/solarium
if [ ! -c /dev/dxg ] && [ ! -e /dev/dxg ]; then
  echo 'CUDA GPU passthrough is not available in this WSL2 distro. Check your Windows NVIDIA drivers and WSL2.' >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; assert sys.version_info >= (3,10)' 2>/dev/null; then
  echo 'The WSL distro requires Python 3.10 or later.' >&2; exit 1
fi
# The official Ubuntu WSL rootfs is a minimal Linux installation. Install all
# prerequisites in this private distribution; never touch the user's distro.
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv python3-pip ca-certificates >/dev/null
if ! python3 -m venv --help >/dev/null 2>&1; then echo 'Unable to install python3-venv in managed Ubuntu.' >&2; exit 1; fi
mkdir -p "$runtime/vllm" "$runtime/huggingface" "$runtime/cache/vllm" "$runtime/cache/cuda" "$runtime/cache/triton" "$runtime/tmp"
export XDG_CACHE_HOME="$runtime/cache" HF_HOME="$runtime/huggingface" VLLM_CACHE_ROOT="$runtime/cache/vllm" CUDA_CACHE_PATH="$runtime/cache/cuda" TRITON_CACHE_DIR="$runtime/cache/triton" TMPDIR="$runtime/tmp" PIP_CACHE_DIR="$runtime/cache/pip"
venv="$runtime/vllm/venv"
if [ ! -x "$venv/bin/python" ]; then python3 -m venv "$venv"; fi
"$venv/bin/python" -m pip install --disable-pip-version-check --upgrade pip
"$venv/bin/python" -m pip install --disable-pip-version-check vllm
"$venv/bin/python" -m pip show vllm >/dev/null
"$venv/bin/vllm" --help >/dev/null
printf 'Verified vLLM in managed WSL2 distro: %s\n' "$venv/bin/vllm"
