#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch { ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript')); }
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src/spica/build-events.ts');
const program = ts.createProgram([file], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], strict: true, skipLibCheck: true, noUnusedLocals: true,
  noUnusedParameters: true, noUncheckedIndexedAccess: true, noEmit: true,
});
const errors = ts.getPreEmitDiagnostics(program);
if (errors.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  process.exit(1);
}
console.log('Phase 02 strict build-event TypeScript contracts: PASS');
const test = spawnSync(process.execPath, ['--test', path.join(root, 'tests/spica-phase02.test.cjs')], { cwd: root, stdio: 'inherit' });
process.exit(test.status ?? 1);
