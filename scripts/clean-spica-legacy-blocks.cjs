#!/usr/bin/env node
'use strict';
/**
 * Phase 09: safely retire the old src/spica/blocks source directory.
 * Run after relocating sources into src/spica/runtime/blocks and regenerating both registries.
 * Only removes the old directory when every file is already present, byte-identically,
 * in the canonical tree. Never discards divergent/unknown code.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const canonical = path.join(root, 'src', 'spica', 'runtime', 'blocks');
const obsolete = path.join(root, 'src', 'spica', 'blocks');
const checkOnly = process.argv.includes('--check');
function verifyRegistry(script) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), '--check'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${script} disagrees with canonical source: ${result.stderr || result.stdout}`);
}
function filesUnder(dir, base = dir) {
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw new Error(`Refusing to process symlink: ${full}`);
    if (item.isDirectory()) files.push(...filesUnder(full, base));
    else if (item.isFile()) files.push(path.relative(base, full));
    else throw new Error(`Unsupported directory entry: ${full}`);
  }
  return files;
}
try {
  if (!fs.existsSync(canonical)) throw new Error(`Canonical SPICA block tree is missing: ${canonical}`);
  const official = filesUnder(canonical);
  if (!official.some(p => p.endsWith('.ts'))) throw new Error('Canonical SPICA block tree has no TypeScript sources');
  verifyRegistry('generate-spica-registry.cjs');
  verifyRegistry('generate-spica-runtime-registry.cjs');
  const stale = fs.existsSync(obsolete) ? filesUnder(obsolete) : [];
  const conflicts = stale.filter(relative => {
    const next = path.join(canonical, relative);
    return !fs.existsSync(next) || !fs.readFileSync(path.join(obsolete, relative)).equals(fs.readFileSync(next));
  });
  if (conflicts.length) throw new Error(`Refusing to delete unmerged or divergent files in obsolete tree: ${conflicts.slice(0, 20).join(', ')}${conflicts.length > 20 ? ' ...' : ''}`);
  if (stale.length && checkOnly) throw new Error(`Obsolete tree still exists with ${stale.length} duplicate files; run without --check to remove it`);
  if (fs.existsSync(obsolete) && !checkOnly) fs.rmSync(obsolete, { recursive: true });
  if (fs.existsSync(obsolete) && checkOnly) throw new Error('Obsolete SPICA block tree still exists');
  console.log(`SPICA block cleanup verified: ${official.length} canonical files; ${stale.length} duplicate obsolete files ${checkOnly ? 'checked' : 'removed'}; no obsolete tree remains.`);
} catch (error) {
  console.error('SPICA cleanup FAILED:', error.message);
  process.exitCode = 1;
}
