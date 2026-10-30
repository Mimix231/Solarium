const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');

// Installer cannot be executed without Windows + WSL + CUDA + internet. Verify
// the script's safety boundary and exercise its argument validation here.
test('managed vLLM script only accepts the internal Linux runtime and is valid bash', (t) => {
  if (process.platform === 'win32') return t.skip('Bash syntax check is run on Linux CI.');
  const script = path.join(root, 'scripts/install-vllm-wsl.sh');
  const syntax = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const rejected = spawnSync('bash', [script, '/mnt/c/Users/unsafe runtime'], { encoding: 'utf8' });
  assert.equal(rejected.status, 2);
  assert.match(rejected.stderr, /managed \/opt\/solarium/);
  const content = fs.readFileSync(script, 'utf8');
  assert.match(content, /venv="\$runtime\/vllm\/venv"/);
  assert.match(content, /HF_HOME="\$runtime\/huggingface"/);
  assert.doesNotMatch(content, /pip install --user/);
});

test('llama asset detection traverses releases instead of assuming the latest stable asset', () => {
  const installer = fs.readFileSync(path.join(root, 'src-tauri/src/llama_installer.rs'), 'utf8');
  const runtime = fs.readFileSync(path.join(root, 'src-tauri/src/runtime.rs'), 'utf8');
  const rust = fs.readFileSync(path.join(root, 'src-tauri/src/lib.rs'), 'utf8');
  assert.match(installer, /releases\?per_page=30/);
  assert.match(installer, /select_bundle_across_releases/);
  assert.match(installer, /sha256:/);
  assert.match(installer, /enclosed_name/);
  assert.doesNotMatch(installer, /client\.get\([^)]*releases\/latest/);
  assert.match(runtime, /base\.join\("runtime"\)/);
  const wsl = fs.readFileSync(path.join(root, 'src-tauri/src/vllm_installer.rs'), 'utf8');
  assert.match(wsl, /"--import"/);
  assert.doesNotMatch(wsl, /"--export"/);
  assert.match(wsl, /runtime\.join\("vllm"\)/);
  assert.match(wsl, /"linux"/);
  assert.match(wsl, /select_image/);
  assert.match(wsl, /SHA256SUMS/);
  assert.match(wsl, /wsl_text/);
  assert.match(wsl, /source of truth/);
  assert.match(installer, /runtime\.join\("llama-cpp"\)/);
  assert.match(installer, /migrate_legacy_install/);
  assert.doesNotMatch(installer, /let install_name = format!/);
  assert.match(rust, /vllm_installer::install/);
  assert.doesNotMatch(rust, /install_vllm_into_wsl/);
  assert.doesNotMatch(rust, /app_data_dir\(\)/);
});
