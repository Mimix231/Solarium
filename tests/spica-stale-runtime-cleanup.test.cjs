'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cleaner = path.resolve(__dirname, '../scripts/clean-spica-misplaced-runtime-blocks.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spica-stale-runtime-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(cleaner, path.join(root, 'scripts/clean-spica-misplaced-runtime-blocks.cjs'));
  const base = path.join(root, 'src/spica/runtime/blocks/data-records');
  const canonical = path.join(base, 'runtime/storage/record-read.ts');
  const stale = path.join(base, 'storage/record-read.ts');
  const write = (filename, contents) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, contents);
  };
  const source = (location, body = 'return {value: 1};') =>
    `import { defineRuntimeBlock } from '${location}';\n` +
    `export default defineRuntimeBlock({id:'spica.runtime.record_read',version:'1',` +
    `async execute(){${body}}});\n`;
  const run = (...args) => spawnSync(process.execPath,
    [path.join(root, 'scripts/clean-spica-misplaced-runtime-blocks.cjs'), ...args],
    { cwd: root, encoding: 'utf8' });
  return { root, canonical, stale, write, source, run };
}

test('stale older-phase runtime blocks are identified and deleted only after semantic comparison', t => {
  const f = fixture(t);
  // These two relative imports resolve to the exact same adapter module.
  f.write(f.canonical, f.source('../../../../adapter'));
  f.write(f.stale, f.source('../../../adapter'));
  let result = f.run('--check');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /verified old runtime copies remain/);
  assert.equal(fs.existsSync(f.stale), true);
  result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Removed verified duplicate/);
  assert.equal(fs.existsSync(f.stale), false);
  assert.equal(fs.existsSync(f.canonical), true);
  assert.equal(f.run('--check').status, 0);
});

test('a divergent obsolete runtime block must not be discarded', t => {
  const f = fixture(t);
  f.write(f.canonical, f.source('../../../../adapter'));
  f.write(f.stale, f.source('../../../adapter', 'return {value: 2};'));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Divergent V2 block/);
  assert.equal(fs.existsSync(f.stale), true);
  assert.equal(fs.existsSync(f.canonical), true);
});

test('a unique misplaced runtime block must not be discarded', t => {
  const f = fixture(t);
  f.write(f.stale, f.source('../../../adapter'));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no canonical implementation exists/);
  assert.equal(fs.existsSync(f.stale), true);
});

test('legitimate legacy descriptors remain untouched', t => {
  const f = fixture(t);
  f.write(f.stale, 'export default defineSpicaBlock({id:"record_read"});\n');
  assert.equal(f.run().status, 0);
  assert.equal(fs.existsSync(f.stale), true);
});

test('flat category file from Phase 4-8 is detected and removed before schema-1 registry scan', t => {
  const f = fixture(t);
  const flat = path.join(f.root, 'src/spica/runtime/blocks/data-records/save-note.ts');
  const canonicalFlat = path.join(f.root, 'src/spica/runtime/blocks/data-records/runtime/save-note.ts');
  f.write(flat, `import { defineRuntimeBlock } from '../../adapter';\n` +
    `export default defineRuntimeBlock({id:'spica.runtime.save_note',version:'1'});\n`);
  f.write(canonicalFlat, `import { defineRuntimeBlock } from '../../../adapter';\n` +
    `export default defineRuntimeBlock({id:'spica.runtime.save_note',version:'1'});\n`);
  const before = f.run('--check');
  assert.equal(before.status, 1);
  assert.match(before.stderr, /save-note\.ts/);
  const clean = f.run();
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(fs.existsSync(flat), false);
  assert.equal(fs.existsSync(canonicalFlat), true);
  assert.equal(f.run('--check').status, 0);
});

test('old category/family placement resolves canonical block by ID even after category rename', t => {
  const f = fixture(t);
  const old = path.join(f.root, 'src/spica/runtime/blocks/appearance/glass-surface.ts');
  const current = path.join(f.root, 'src/spica/runtime/blocks/visual-appearance/runtime/glass-surface.ts');
  f.write(old, `import { defineRuntimeBlock } from '../../adapter';\n` +
    `export default defineRuntimeBlock({id:'spica.runtime.glass_surface',version:'1'});\n`);
  f.write(current, `import { defineRuntimeBlock } from '../../../adapter';\n` +
    `export default defineRuntimeBlock({id:'spica.runtime.glass_surface',version:'1'});\n`);
  const clean = f.run();
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(fs.existsSync(old), false);
  assert.equal(fs.existsSync(current), true);
});

test('flat category divergent source is never removed', t => {
  const f = fixture(t);
  const flat = path.join(f.root, 'src/spica/runtime/blocks/data-records/save-note.ts');
  const current = path.join(f.root, 'src/spica/runtime/blocks/data-records/runtime/save-note.ts');
  f.write(flat, `import { defineRuntimeBlock } from '../../adapter';\n` +
    `export default defineRuntimeBlock({id:'spica.runtime.save_note',version:'1',changed:true});\n`);
  f.write(current, `import { defineRuntimeBlock } from '../../../adapter';\n` +
    `export default defineRuntimeBlock({id:'spica.runtime.save_note',version:'1'});\n`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Divergent V2 block/);
  assert.equal(fs.existsSync(flat), true);
  assert.equal(fs.existsSync(current), true);
});

test('checked-in block folders contain no misplaced V2 runtime sources', () => {
  const result = spawnSync(process.execPath, [cleaner, '--check'],
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
