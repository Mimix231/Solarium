import { applyProjectChanges, inspectGeneratedFile, inspectProjectEnvironment, type ProjectFileChange } from '../engine/creator';
import { invokeProject, projectSourceSnapshot, runProjectCommand, type CommandResult } from '../engine/intelligence/commands';
import { foundationStore, newRecord } from '../foundation/store';
import { uid } from '../domain/types';
import { notifySpicaChange, SpicaRepository, type SpicaRecord } from './repository';
import { collectionUpgrade, stableGraphJson, type AppPlan, type CollectionField } from './graph';
import type { FlowTrace, Scenario } from './program';
import type { ScenarioReport } from './target/scenario';

const checks = ['script:check:toolchain', 'script:build', 'script:test:native', 'script:build:desktop'] as const;
const hash = async (content: string) => Array.from(new Uint8Array(await crypto.subtle.digest(
  'SHA-256', new TextEncoder().encode(content),
)), byte => byte.toString(16).padStart(2, '0')).join('');
interface Receipt { target: number; appId: string; revision: number; graph: string; files: Record<string, string> }
export interface ExportConflict { path: string; current: string; proposed: string }
export interface ExportReview { conflicts: ExportConflict[]; changes: ProjectFileChange[]; current: boolean; addedFields: CollectionField[] }
export interface BuildEvidence {
  appId: string;
  root: string;
  revision: number;
  graph: string;
  target: number;
  source: string;
  executableSha?: string;
  state: 'running' | 'passed' | 'failed' | 'cancelled';
  checks: CommandResult[];
  runtime?: RuntimeEvidence[];
  locks?: Record<string, string>;
  diagnostic?: string;
}

export interface RuntimeEvidence { id: string; runId: string; reports: (ScenarioReport & { trace?: FlowTrace[] })[] }

async function runStandaloneScenario(root: string, source: string, executableSha: string, scenario: Scenario, signal: AbortSignal): Promise<RuntimeEvidence> {
  if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
  const runId = uid().replaceAll('-', '');
  const cancel = () => { void invokeProject('cancel_project_command', { root, runId }).catch(() => {}); };
  const timer = setInterval(() => { if (signal.aborted) cancel(); }, 100);
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const reports = await invokeProject<RuntimeEvidence['reports']>('run_spica_scenario', { root, source, executableSha, runId,
      scenario: scenario.id, reopen: Boolean(scenario.reopened?.length) });
    return { id: scenario.id, runId, reports };
  } finally { clearInterval(timer); signal.removeEventListener('abort', cancel); }
}

export async function inspectExport(root: string, record: SpicaRecord): Promise<ExportReview> {
  const { emitTauri, TARGET_VERSION, OWNERSHIP_PATH, CUSTOM_PATH, customSource } = await import('./emit');
  const source = emitTauri(record.data);
  const ownership = await inspectGeneratedFile(root, OWNERSHIP_PATH);
  let prior: Receipt | null = null;
  if (ownership.exists) {
    try { prior = JSON.parse(ownership.current) as Receipt; } catch { throw Error('SPICA export ownership file is unreadable.'); }
    if (prior?.appId !== record.data.appId || prior.target !== TARGET_VERSION ||
        !Number.isSafeInteger(prior.revision) || !prior.files || typeof prior.files !== 'object' ||
        Object.keys(prior.files).length !== Object.keys(source).length ||
        Object.keys(source).some(path => !/^[a-f0-9]{64}$/.test(prior!.files[path] ?? ''))) {
      throw Error('The destination belongs to another app or requires an export format migration.');
    }
  }
  if (!prior && (await inspectProjectEnvironment(root)).rootEntryCount > 0) {
    throw Error('The first export needs an empty linked folder. Choose a dedicated destination in Project Settings.');
  }
  const receipt: Receipt = { target: TARGET_VERSION, appId: record.data.appId, revision: record.data.revision, graph: await hash(stableGraphJson(record.data.graph)), files: {} };
  const changes: ProjectFileChange[] = [];
  const conflicts: ExportConflict[] = [];
  let previousCollection: AppPlan['collection'];
  for (const [path, proposed] of Object.entries(source)) {
    receipt.files[path] = await hash(proposed);
    const actual = await inspectGeneratedFile(root, path);
    if (path === 'src/plan.json' && prior && actual.exists && await hash(actual.current) === prior.files[path]) {
      previousCollection = (JSON.parse(actual.current) as AppPlan).collection;
    }
    if (prior && actual.exists && actual.current === proposed) continue;
    if (prior ? !actual.exists || await hash(actual.current) !== prior.files[path] : actual.exists) {
      conflicts.push({ path, current: actual.current, proposed });
    } else if (!actual.exists || actual.current !== proposed) {
      changes.push({ path, content: proposed, expected: actual.exists ? actual.current : null });
    }
  }
  const custom = await inspectGeneratedFile(root, CUSTOM_PATH);
  if (!custom.exists) changes.push({ path: CUSTOM_PATH, content: customSource, expected: null });
  const manifest = JSON.stringify(receipt, null, 2) + '\n';
  if (ownership.current !== manifest) changes.push({ path: OWNERSHIP_PATH, content: manifest, expected: ownership.exists ? ownership.current : null });
  return { conflicts, changes, current: conflicts.length === 0 && changes.length === 0,
    addedFields: conflicts.length ? [] : collectionUpgrade(previousCollection, record.data.graph.collection) };
}

async function assertCurrent(record: SpicaRecord): Promise<void> {
  const latest = await new SpicaRepository(record.scope.id).read();
  if (latest?.version !== record.version || latest.data.appId !== record.data.appId) throw Error('SPICA graph changed during the operation. Reload its latest revision.');
}

export async function exportSpica(root: string, record: SpicaRecord) {
  const review = await inspectExport(root, record);
  if (review.conflicts.length) throw Error('Managed source differs from the previous export: ' + review.conflicts.map(c => c.path).join(', ') + '. Review the differences in SPICA.');
  await assertCurrent(record);
  const applied = review.changes.length ? await applyProjectChanges(root, review.changes) : [];
  await assertCurrent(record);
  if (!(await inspectExport(root, record)).current) throw Error('Export files changed during writeback. Review the current source.');
  return applied;
}

export const commandPassed = (result: CommandResult) => result.exit_code === 0 &&
  !result.timed_out && !result.cancelled && result.source_before === result.source_after;

export async function latestSpicaBuild(projectId: string) {
  return (await foundationStore.list<BuildEvidence>({ collection: 'spica_build', scopes: [{ kind: 'project', id: projectId }] }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.data ?? null;
}

export async function currentSpicaBuild(root: string, record: SpicaRecord) {
  const evidence = await latestSpicaBuild(record.scope.id);
  if (!evidence || evidence.state !== 'passed' || !evidence.executableSha || evidence.root !== root || evidence.revision !== record.data.revision ||
      evidence.appId !== record.data.appId || evidence.graph !== await hash(stableGraphJson(record.data.graph)) ||
      !(await inspectExport(root, record)).current || evidence.source !== (await projectSourceSnapshot(root)).sha256) return null;
  if (evidence.executableSha !== await invokeProject<string>('spica_executable_hash', { root }).catch(() => null)) return null;
  return evidence;
}

export async function launchSpicaApp(root: string, record: SpicaRecord) {
  await assertCurrent(record);
  const evidence = await currentSpicaBuild(root, record);
  if (!evidence) throw Error('The executable needs a current passing build. Test this revision again.');
  await assertCurrent(record);
  return invokeProject<number>('launch_spica_app', { root, source: evidence.source, executableSha: evidence.executableSha });
}

export async function verifySpica(root: string, record: SpicaRecord, webEnabled: boolean, signal: AbortSignal,
  onOutput?: Parameters<typeof runProjectCommand>[4], onResult?: (result: CommandResult) => void): Promise<BuildEvidence> {
  if (!(await inspectExport(root, record)).current) throw Error('Export the current graph before verifying its standalone app.');
  const { TARGET_VERSION } = await import('./emit');
  const locks = Object.fromEntries(await Promise.all(['package-lock.json', 'src-tauri/Cargo.lock'].map(async path => {
    const file = await inspectGeneratedFile(root, path);
    if (!file.exists) throw Error(`Missing ${path}. Prepare the exported dependencies from cache first.`);
    return [path, await hash(file.current)];
  })));
  const data: BuildEvidence = {
    appId: record.data.appId, root, revision: record.data.revision, graph: await hash(stableGraphJson(record.data.graph)),
    target: TARGET_VERSION, source: (await projectSourceSnapshot(root)).sha256, state: 'running', checks: [], locks,
  };
  const evidence = newRecord('spica_build', uid(), record.scope, record.title, data);
  await foundationStore.batch([{ record: evidence, expected: null }]);
  notifySpicaChange(record.scope.id);
  const persist = async () => {
    const expected = evidence.version;
    await foundationStore.batch([{ record: { ...evidence, version: expected + 1, updatedAt: new Date().toISOString() }, expected }]);
    evidence.version++;
  };
  try {
    for (const id of checks) {
      await assertCurrent(record);
      const result = await runProjectCommand(root, id, webEnabled, signal, onOutput);
      data.checks.push(result);
      onResult?.(result);
      await persist();
      if (result.cancelled || result.timed_out || result.exit_code !== 0)
        throw Error(id + ' ended with ' + (result.cancelled ? 'cancellation' : result.timed_out ? 'a timeout' : 'exit ' + result.exit_code) + '. Command log ' + result.run_id);
      if (!commandPassed(result) || result.source_after !== data.source)
        throw Error('Source changed during ' + id + '. Command log ' + result.run_id);
    }
    await assertCurrent(record);
    if (!(await inspectExport(root, record)).current || (await projectSourceSnapshot(root)).sha256 !== data.source) {
      throw Error('Project source changed during verification. Run it again against the current export.');
    }
    data.executableSha = await invokeProject<string>('spica_executable_hash', { root });
    data.runtime = [];
    for (const scenario of record.data.graph.program?.scenarios ?? []) {
      await assertCurrent(record);
      onOutput?.({ stream: 'stdout', chunk: `\nRunning ${scenario.label} in the built app with isolated SQLite data.\n` });
      const result = await runStandaloneScenario(root, data.source, data.executableSha, scenario, signal);
      data.runtime.push(result);
      await persist();
      const failed = result.reports.find(report => report.state === 'failed');
      if (failed) throw Error(`${scenario.label} · ${failed.diagnostic ?? 'Scenario failed.'}`);
      if (result.reports[0]?.completed !== scenario.steps.length ||
          (scenario.reopened?.length && result.reports[1]?.completed !== scenario.reopened.length)) throw Error(`Incomplete scenario evidence for ${scenario.id}.`);
      onOutput?.({ stream: 'stdout', chunk: `${scenario.label} passed ${result.reports.map(report => `${report.phase} (${report.completed} steps)`).join(' and ')}.\n` });
    }
    if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
    await assertCurrent(record);
    data.state = 'passed';
  } catch (error) {
    data.state = signal.aborted ? 'cancelled' : 'failed';
    data.diagnostic = String(error);
  }
  await persist();
  notifySpicaChange(record.scope.id);
  return data;
}
