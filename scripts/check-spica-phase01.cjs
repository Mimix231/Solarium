#!/usr/bin/env node
'use strict';
/** Offline focused registry/Program compatibility check independent of the Creator UI deps. */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');
let ts;
try { ts = require('typescript'); }
catch { ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript')); }
const root = path.resolve(__dirname, '..');
const print = diagnostics => ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
});
const generate = spawnSync(process.execPath, [path.join(root,'scripts/generate-spica-registry.cjs'),'--check'], { cwd: root, encoding: 'utf8' });
process.stdout.write(generate.stdout || ''); process.stderr.write(generate.stderr || '');
if (generate.status !== 0) process.exit(generate.status || 1);
const configPath = path.join(root, 'tsconfig.spica-phase01.json');
const json = ts.readConfigFile(configPath, ts.sys.readFile);
if (json.error) { console.error(print([json.error])); process.exit(1); }
const parsed = ts.parseJsonConfigFileContent(json.config, ts.sys, root, undefined, configPath);
if (parsed.errors.length) { console.error(print(parsed.errors)); process.exit(1); }
const program = ts.createProgram(parsed.fileNames, parsed.options);
const result = program.emit();
const diagnostics = ts.getPreEmitDiagnostics(program).concat(result.diagnostics);
if (diagnostics.length || result.emitSkipped) {
  console.error(print(diagnostics));
  process.exit(1);
}
const out = path.join(root, '.spica-phase01-test');
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}\n');
console.log(`Focused TypeScript compiler passed (${parsed.fileNames.length} entrypoints).`);
const tests = spawnSync(process.execPath, ['--test',path.join(root, 'tests/spica-phase01.test.cjs')], {
  cwd: root, encoding: 'utf8', stdio: 'inherit',
});
process.exit(tests.status || (tests.error ? 1 : 0));
