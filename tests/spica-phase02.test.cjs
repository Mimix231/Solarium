'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let ts;
try { ts = require('typescript'); } catch { ts = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript')); }
const text = name => fs.readFileSync(path.join(root, name), 'utf8');
function moduleFrom(file, mocks = {}) {
  const js = ts.transpileModule(text(file), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: file, reportDiagnostics: true,
  });
  if (js.diagnostics?.length) throw Error(ts.formatDiagnostics(js.diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }));
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array,
    AbortController, DOMException, setInterval, clearInterval, console,
    require(id) { if (Object.hasOwn(mocks, id)) return mocks[id]; throw Error(`Unexpected module dependency ${id} in ${file}`); },
  };
  vm.runInNewContext(js.outputText, context, { filename: file });
  return module.exports;
}
const eventsModule = moduleFrom('src/spica/build-events.ts');
const { SpicaBuildJournal, stageForCommand, stageStatus, terminalText, SPICA_EVENT_LIMIT, SPICA_OUTPUT_LIMIT } = eventsModule;

function fixture({ failCommand, changedInstall = false, storedConflict = false, target = 'desktop' } = {}) {
  const source = { 'src/main.tsx': 'export const answer = 42;\n' };
  const sha = value => createHash('sha256').update(value).digest('hex');
  const record = { scope: { kind: 'project', id: 'proj' }, title: 'Fixture', version: 1,
    data: { appId: 'test-app', revision: 7, graph: { name: 'Fixture' } } };
  const receipt = { target: target === 'web' ? 2 : 1, appId: 'test-app', revision: 7, graph: sha('{}'), files: { 'src/main.tsx': sha(source['src/main.tsx']) } };
  const files = {
    'src/main.tsx': storedConflict ? 'user edited managed source' : source['src/main.tsx'],
    'src/custom.ts': 'custom code',
    '.spica-ownership.json': JSON.stringify(receipt, null, 2) + '\n',
  };
  const runs = [];
  const mocks = {
    '../engine/creator': {
      inspectGeneratedFile: async (_, file) => ({ exists: Object.hasOwn(files, file), current: files[file] || '' }),
      inspectProjectEnvironment: async () => ({ rootEntryCount: 3, dependenciesInstalled: true }),
      applyProjectChanges: async (_, changes) => { changes.forEach(c => { files[c.path] = c.content; }); return changes; },
    },
    '../engine/intelligence/commands': {
      projectSourceSnapshot: async () => ({ sha256: 'source-before' }),
      invokeProject: async (command, args) => {
        if (command === 'spica_lock_fingerprints') return { npm: 'lockA', cargo: 'lockB' };
        if (command === 'spica_web_lock_fingerprints') return { npm: 'webLock' };
        if (command === 'spica_executable_hash') return 'executableHash';
        if (command === 'spica_web_artifact_hash') return 'webHash';
        if (command === 'run_spica_scenario') return [{ phase: 'initial', state: 'passed', completed: 2, durationMs: 12 }];
        throw Error(`Unexpected native command ${command}, ${JSON.stringify(args)}`);
      },
      runProjectCommand: async (_root, id, _web, signal, onOutput) => {
        runs.push(id);
        onOutput?.({ stream: 'stdout', chunk: `${id} executed\n` });
        const failed = id === failCommand;
        return { command_id: id, run_id: `run-${runs.length}`, exit_code: failed ? 1 : 0,
          timed_out: false, cancelled: Boolean(signal?.aborted), source_before: changedInstall && id.startsWith('install:') ? 'old' : 'source-before',
          source_after: 'source-before', duration_ms: 11, output_complete: true };
      },
    },
    '../foundation/store': {
      foundationStore: { batch: async () => {}, list: async () => [] },
      newRecord: (_type, _id, scope, title, data) => ({ scope, title, data, version: 1, updatedAt: new Date().toISOString() }),
    },
    '../domain/types': { uid: () => 'id123' },
    './repository': { notifySpicaChange: () => {}, SpicaRepository: class { async read() { return record; } } },
    './graph': { stableGraphJson: () => '{}', collectionUpgrade: () => [], compileGraph: () => ({ program: {
      scenarios: [{ id: 'smoke', label: 'Smoke', steps: [{}, {}] }],
    } }) },
    './build-events': eventsModule,
    './target-lowering': {lowerSpicaTarget:()=>({kind:'spica-app-ir',version:1}), spicaTargetVersion:{desktop:1,web:2}},
    './emit': { emitTauri: () => source, emitWeb: () => source, TARGET_VERSION: 1,
      OWNERSHIP_PATH: '.spica-ownership.json', CUSTOM_PATH: 'src/custom.ts', customSource: 'custom code' },
  };
  return { module: moduleFrom('src/spica/export.ts', mocks), record, runs, files };
}

test('journal retains unique, revision-scoped events without unbounded UI growth', () => {
  const journal = new SpicaBuildJournal('run-abc', 42);
  let observations = 0;
  const stop = journal.subscribe(() => observations++);
  for (let i = 0; i < SPICA_EVENT_LIMIT + 40; i++) journal.record({ stage: 'compile', status: i % 2 ? 'passed' : 'running', message: 'Real event' });
  assert.equal(journal.events.length, SPICA_EVENT_LIMIT);
  assert.equal(journal.events[0].graphRevision, 42);
  assert.equal(journal.events.at(-1).eventId, 'run-abc:280');
  assert.equal(stageStatus(journal.events, 'compile'), 'passed');
  assert.equal(stageStatus(journal.events, 'scenario-test'), 'queued');
  stop(); const before = observations;
  journal.record({ stage: 'compile', status: 'failed', message: 'Command failed' });
  assert.equal(observations, before);
});

test('actual project commands map to specific, distinct timeline stages', () => {
  assert.equal(stageForCommand('script:check:toolchain'), 'validate');
  assert.equal(stageForCommand('install:cached'), 'prepare');
  assert.equal(stageForCommand('script:setup:native'), 'prepare');
  assert.equal(stageForCommand('script:build'), 'compile');
  assert.equal(stageForCommand('script:test:native'), 'native-test');
  assert.equal(stageForCommand('script:build:desktop'), 'desktop-build');
});

test('terminal output is bounded and does not interpret ANSI escape controls', () => {
  const ansi = '\u001b[31mRED\u001b[0m\u001b]52;c;clipboard-data\u0007\nOK';
  assert.equal(terminalText('', ansi), 'RED\nOK');
  assert.equal(terminalText('a'.repeat(SPICA_OUTPUT_LIMIT), 'new').length, SPICA_OUTPUT_LIMIT);
  assert.throws(() => new SpicaBuildJournal('', 7));
  assert.throws(() => new SpicaBuildJournal('valid', -1));
});

test('real source export announces success only after source ownership has been verified', async () => {
  const { module, record } = fixture();
  const notices = [];
  const result = await module.exportSpica('/project', record, event => notices.push(event));
  assert.equal(result.length, 0);
  assert.deepEqual(notices.map(e => e.status), ['running', 'passed']);
  assert.equal(notices.at(-1).stage, 'generate');
  const blocked = fixture({ storedConflict: true });
  const conflicts = [];
  await assert.rejects(blocked.module.exportSpica('/project', blocked.record, event => conflicts.push(event)), /Managed source differs/);
  assert.equal(conflicts.at(-1).status, 'failed');
});

test('native verification records only checks with actual successful command evidence', async () => {
  const { module, record, runs } = fixture();
  const notices = [];
  const result = await module.verifySpica('/project', record, false, new AbortController().signal, undefined, undefined, event => notices.push(event));
  assert.equal(result.state, 'passed');
  assert.equal(result.checks.length, 4);
  assert.equal(result.runtime.length, 1);
  assert.deepEqual(runs, ['script:check:toolchain', 'script:build', 'script:test:native', 'script:build:desktop']);
  assert.ok(notices.some(e => e.stage === 'native-test' && e.status === 'passed' && e.commandRunId));
  assert.ok(notices.some(e => e.stage === 'desktop-build' && e.status === 'passed'));
  assert.ok(notices.some(e => e.stage === 'scenario-test' && e.status === 'passed'));
  assert.ok(!notices.some(e => e.stage === 'launch' && e.status === 'passed'), 'Verification must not claim native launch');
});

test('a real failing native check cannot be promoted into a passing build', async () => {
  const { module, record } = fixture({ failCommand: 'script:build' });
  const notices = [];
  const result = await module.verifySpica('/project', record, false, new AbortController().signal, undefined, undefined, event => notices.push(event));
  assert.equal(result.state, 'failed');
  assert.ok(notices.some(e => e.stage === 'compile' && e.status === 'failed'));
  assert.ok(!notices.some(e => e.stage === 'native-test' && e.status === 'passed'));
  assert.ok(!notices.some(e => e.stage === 'preview' && e.status === 'passed'));
});

test('a cancelled run remains cancelled and contains no passing check', async () => {
  const { module, record } = fixture();
  const controller = new AbortController(); controller.abort();
  const notices = [];
  const result = await module.verifySpica('/project', record, false, controller.signal, undefined, undefined, event => notices.push(event));
  assert.equal(result.state, 'cancelled');
  assert.ok(notices.some(e => e.status === 'cancelled'));
  assert.ok(!notices.some(e => e.status === 'passed'));
});

test('dependency install may legitimately change lockfile source fingerprint', async () => {
  const { module, record, runs } = fixture({ changedInstall: true });
  const notices = [];
  const result = await module.prepareSpica('/project', record, false, new AbortController().signal, undefined, undefined, event => notices.push(event));
  assert.equal(result.ok, true);
  assert.deepEqual(runs, ['install:cached', 'script:setup:native']);
  assert.equal(notices.at(-1).status, 'passed');
});

test('workbench stays one centered overlay with actual diff, preview and real event wiring', () => {
  const source = text('src/components/SpicaWorkbench.tsx');
  assert.match(source, /<Dialog className="spica-workbench-dialog"/);
  assert.match(source, /<SpicaBuildStream events=\{buildEvents\}/);
  assert.match(source, /<SpicaCodeDiff/);
  assert.match(source, /<SpicaLivePreviewPane record=\{record\}/);
  assert.match(source, /<SpicaBuildTimeline events=\{buildEvents\}/);
  assert.ok(source.indexOf('const before = await inspectExport') < source.indexOf('const written = await exportSpica'));
  assert.match(source, /verifySpica\(root, current, false, signal, output,/);
  assert.match(source, /abort\.current\?\.abort\(\)/);
  assert.doesNotMatch(source, /setTimeout\(/);
  const diff = text('src/components/spica/SpicaCodeDiff.tsx');
  assert.match(diff, /<DiffEditor/);
  assert.match(diff, /renderSideBySide: true/);
  assert.match(diff, /conflict\.current/);
  const css = text('src/views/spica.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /@media \(max-width: 760px\)/);
});


test('web export verifies browser bundle only and never claims native tests or Tauri launch', async () => {
  const {module,record,runs}=fixture({target:'web'});
  const result=await module.verifySpica('/project',record,false,new AbortController().signal,undefined,undefined,undefined,'web');
  assert.equal(result.state,'passed');
  assert.equal(result.target,2);
  assert.equal(result.platform,'web');
  assert.equal(result.executableSha,'webHash');
  assert.deepEqual(runs,['script:build:web','script:test:web']);
  assert.equal(result.runtime.length,0);
  assert.ok(!runs.some(id=>id.includes('native')||id.includes('desktop')));
});

test('web dependency preparation avoids native setup commands', async()=>{
  const {module,record,runs}=fixture({target:'web'});
  const ready=await module.prepareSpica('/project',record,false,new AbortController().signal,undefined,undefined,undefined,'web');
  assert.equal(ready.ok,true);
  assert.deepEqual(runs,['install:cached']);
});
