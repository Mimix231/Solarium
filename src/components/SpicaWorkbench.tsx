import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Chip, Dialog, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { AutoAwesomeOutlined, CloseOutlined, PlayArrowOutlined, StopCircleOutlined } from '@mui/icons-material';
import { useSolarium } from '../state/useSolarium';
import { chooseDirectory } from '../engine/desktop';
import { readCommandOutput } from '../engine/intelligence/commands';
import { withLocalWork } from '../engine/work-lifecycle';
import type { CreatorProject } from '../domain/types';
import { onSpicaChange, SpicaRepository, type SpicaRecord } from '../spica/repository';
import { stableGraphJson, type GraphEdit, type Preference } from '../spica/graph';
import { commandPassed, currentSpicaTargetBuild, exportSpica, inspectExport, launchSpicaApp, latestSpicaBuild, prepareSpica,
  spicaDependenciesReady, verifySpica, type BuildEvidence, type ExportReview } from '../spica/export';
import { SpicaWarehouse } from './SpicaWarehouse';
import { SpicaWorkflows } from './SpicaWorkflows';
import { SpicaResearch } from './SpicaResearch';
import { SpicaBuildStream } from './spica/SpicaBuildStream';
import { SpicaCodeDiff, type SpicaSourceChange } from './spica/SpicaCodeDiff';
import { SpicaBuildTimeline } from './spica/SpicaBuildTimeline';
import { SpicaLivePreviewPane } from './spica/SpicaLivePreviewPane';
import type { SpicaExportTarget } from '../spica/target-lowering';
import { SpicaBuildJournal, terminalText, isAbort, type SpicaBuildEvent } from '../spica/build-events';
import { uid } from '../domain/types';
import '../views/spica.css';

const tabs = [['build', 'Build Stream'], ['changes', 'Changes'], ['logs', 'Build Logs'], ['tests', 'Test Results'], ['inspect', 'Inspect']] as const;
type Tab = typeof tabs[number][0];

export function SpicaWorkbench({ project, open, onClose, agentBusy, agentLog, onStopAgent, onPrompt }: {
  project: CreatorProject; open: boolean; onClose(): void; agentBusy: boolean; agentLog?: string;
  onStopAgent(): void; onPrompt(text: string): void;
}) {
  const repository = useMemo(() => new SpicaRepository(project.id), [project.id]);
  const webEnabled = useSolarium(state => state.webEnabled);
  const [record, setRecord] = useState<SpicaRecord | null>(null);
  const [exportTarget, setExportTarget] = useState<SpicaExportTarget>('desktop');
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(project.name.slice(0, 80));
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [tab, setTab] = useState<Tab>('build');
  const [surface, setSurface] = useState<'design' | 'warehouse' | 'workflows' | 'research'>('design');
  const [pageId, setPage] = useState('general');
  const [controlId, setControl] = useState('');
  const [review, setReview] = useState<ExportReview | null>(null);
  const [evidence, setEvidence] = useState<BuildEvidence | null>(null);
  const [currentBuild, setCurrentBuild] = useState(false);
  const [log, setLog] = useState('');
  const [logOffset, setLogOffset] = useState(0);
  const [logRun, setLogRun] = useState('');
  const [logStream, setLogStream] = useState<'stdout' | 'stderr'>('stderr');
  const [logMore, setLogMore] = useState(false);
  const [buildEvents, setBuildEvents] = useState<SpicaBuildEvent[]>([]);
  const [sourceSnapshot, setSourceSnapshot] = useState<{ revision: number; changes: SpicaSourceChange[] } | null>(null);
  const journal = useRef<SpicaBuildJournal | null>(null);
  const journalUnsubscribe = useRef<(() => void) | null>(null);
  const pendingOutput = useRef('');
  const outputFrame = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const refreshId = useRef(0);

  const refresh = useCallback(async (current: SpicaRecord | null, isActive: () => boolean = () => true) => {
    const id = ++refreshId.current;
    const root = project.folder;
    const last = await latestSpicaBuild(project.id, exportTarget);
    if (id !== refreshId.current || !isActive()) return;
    setEvidence(last?.root === root ? last : null);
    if (last?.revision !== current?.data.revision || last?.state !== 'passed') setCurrentBuild(false);
    const status = current && root ? await inspectExport(root, current, exportTarget).catch(() => null) : null;
    const valid = Boolean(current && root && status?.current && last?.state === 'passed' && await currentSpicaTargetBuild(root, current, exportTarget));
    if (id !== refreshId.current || !isActive()) return;
    setReview(status);
    setCurrentBuild(valid);
  }, [project.folder, project.id, exportTarget]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    let request = 0;
    const read = () => {
      const id = ++request;
      const active = () => live && id === request;
      void repository.read().then(async current => {
        if (!active()) return;
        setRecord(current);
        setLoaded(true);
        await refresh(current, active);
      }).catch(reason => { if (active()) { setError(String(reason)); setReview(null); setCurrentBuild(false); } });
    };
    const unsubscribe = onSpicaChange(project.id, read);
    read();
    return () => { live = false; unsubscribe(); };
  }, [open, project.id, repository, refresh]);
  useEffect(() => () => {
    abort.current?.abort(); journalUnsubscribe.current?.();
    if (outputFrame.current !== null) cancelAnimationFrame(outputFrame.current);
  }, []);
  function flushOutput() {
    if (outputFrame.current !== null) cancelAnimationFrame(outputFrame.current);
    outputFrame.current = null;
    const chunk = pendingOutput.current;
    pendingOutput.current = '';
    if (chunk) setLog(old => terminalText(old, chunk));
  }
  function appendOutput(stream: string, chunk: string) {
    pendingOutput.current = terminalText(pendingOutput.current, (stream === 'stderr' ? '[stderr] ' : '') + chunk);
    if (outputFrame.current === null) outputFrame.current = requestAnimationFrame(flushOutput);
  }
  useEffect(() => {
    setBuildEvents([]); setSourceSnapshot(null); setLog(''); setTab('build');
    pendingOutput.current = '';
    if (outputFrame.current !== null) { cancelAnimationFrame(outputFrame.current); outputFrame.current = null; }
    journalUnsubscribe.current?.(); journal.current = null;
  }, [project.id]);

  function startJournal(revision: number): SpicaBuildJournal {
    journalUnsubscribe.current?.();
    const next = new SpicaBuildJournal(uid(), revision);
    journal.current = next;
    journalUnsubscribe.current = next.subscribe(events => setBuildEvents([...events]));
    return next;
  }
  function closeWorkbench() {
    abort.current?.abort();
    onClose();
  }

  async function perform(label: string, action: () => Promise<void>) {
    if (pending.current || agentBusy) return;
    pending.current = true;
    setBusy(label);
    setError('');
    setWarning('');
    setNotice('');
    try { await action(); } catch (reason) {
      if (isAbort(reason) || journal.current?.events.at(-1)?.status === 'cancelled') setWarning('Operation cancelled; no successful verification was recorded.');
      else setError(String(reason));
    }
    finally { pending.current = false; setBusy(''); }
  }
  async function saveEdit(operation: readonly GraphEdit[] | 'undo' | 'redo') {
    if (!record) return false;
    let saved = false;
    await perform('Saving graph', async () => {
      const changed = await repository.update(record.data.revision, operation);
      saved = true;
      setRecord(changed);
      setNotice('Saved graph revision ' + changed.data.revision);
      await refresh(changed);
    });
    return saved;
  }
  async function edit(operation: readonly GraphEdit[] | 'undo' | 'redo') {
    await saveEdit(operation);
  }
  async function runBuild(setup: boolean, network = false) {
    if (!record || !project.folder) return;
    const root = project.folder;
    const current = record;
    const target = exportTarget;
    setTab('build');
    await perform(setup ? 'Preparing dependencies' : 'Verifying standalone build', async () => {
      const controller = new AbortController();
      abort.current = controller;
      const build = startJournal(current.data.revision);
      setLog('');
      setLogRun('');
      setLogOffset(0);
      setLogMore(false);
      setCurrentBuild(false);
      const output = ({ stream, chunk }: { stream: string; chunk: string }) => appendOutput(stream, chunk);
      try {
        await withLocalWork('spica:' + project.id, 'SPICA build', undefined, controller.signal, async signal => {
          if (setup) {
            build.record({ stage: 'generate', status: 'skipped', message: 'Preparing dependencies only; source export was not requested.' });
          } else {
            // Keep the actual proposed source snapshots: inspecting *after* export
            // would correctly report no pending edits, hiding the real code diff.
            const before = await inspectExport(root, current, target);
            setSourceSnapshot({ revision: current.data.revision, changes: before.changes.map(({ path, content, expected }) => ({ path, content, expected })) });
            const written = await exportSpica(root, current, build.record, target);
            if (written.length) output({ stream: 'stdout', chunk: `Exported ${written.length} source files for revision ${current.data.revision}.\n` });
            if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
            setReview(await inspectExport(root, current, target));
          }
          if (setup || !await spicaDependenciesReady(root, target)) {
            const prepared = await prepareSpica(root, current, network && useSolarium.getState().webEnabled,
              signal, output, result => setLogRun(result.run_id), build.record, target);
            setLogRun(prepared.results.at(-1)?.run_id ?? '');
            if (!prepared.ok) throw Error('Dependency preparation failed. Inspect the actual command output.');
            setNotice(target === 'web' ? 'Web dependencies prepared.' : 'Node dependencies and Rust lockfile prepared.');
          } else {
            build.record({ stage: 'prepare', status: 'skipped', message: `Existing ${target} dependency lockfiles are ready.` });
          }
          if (setup) return;
          const result = await verifySpica(root, current, false, signal, output,
            command => setLogRun(command.run_id), build.record, target);
          setEvidence(result);
          setCurrentBuild(result.state === 'passed');
          if (result.state !== 'passed') throw Error(result.diagnostic ?? result.state);
          build.record({ stage: 'preview', status: 'passed',
            message: target === 'web' ? 'Web bundle verified. The graph preview is not a hosted web app.' : 'Native checks passed. The interactive sample-data graph preview is available.' });
          setNotice(`${target} verification passed for revision ${result.revision}.`);
        });
      } catch (reason) {
        const last = build.events.at(-1);
        if (last?.status !== 'cancelled' && last?.status !== 'failed') {
          build.record({ stage: last?.stage ?? 'validate', status: isAbort(reason, controller.signal) ? 'cancelled' : 'failed',
            message: `Build ${isAbort(reason, controller.signal) ? 'cancelled' : 'stopped'}: ${String(reason)}` });
        }
        throw reason;
      } finally { flushOutput(); abort.current = null; }
    });
  }
  async function showLog(runId: string, stream: 'stdout' | 'stderr', offset = 0) {
    if (!project.folder) return;
    try {
      const page = await readCommandOutput(project.folder!, runId, stream, offset);
      setLogRun(runId);
      setLogStream(stream);
      setLogOffset(page.nextOffset);
      setLogMore(page.hasMore);
      setLog(old => offset ? old + page.text : page.text);
    } catch (reason) { setError(String(reason)); }
  }

  const graph = record?.data.graph;
  const previous = record?.data.undo.at(-1);
  const page = graph?.pages.find(item => item.id === pageId) ?? graph?.pages[0];
  const control = graph?.controls.find(item => item.id === controlId && item.page === page?.id);
  const locked = Boolean(busy || agentBusy);
  const currentEvidence = evidence?.revision === record?.data.revision && evidence?.root === project.folder &&
    evidence?.platform === exportTarget;
  const running = currentEvidence && evidence?.state === 'running' && locked;
  const verified = currentEvidence && currentBuild && evidence?.state === 'passed';
  const launch = exportTarget === 'desktop' && record && project.folder && verified && !locked ? () => void perform('Launching app', async () => {
    const current = record;
    const active = journal.current?.revision === current.data.revision ? journal.current : startJournal(current.data.revision);
    active.record({ stage: 'launch', status: 'running', message: 'Launching previously verified native executable.' });
    try {
      const pid = await launchSpicaApp(project.folder!, current);
      active.record({ stage: 'launch', status: 'passed', message: `Native application process ${pid} started.` });
      setNotice('Started the verified app · Process ' + pid);
    } catch (reason) {
      active.record({ stage: 'launch', status: 'failed', message: `Native launch failed: ${String(reason)}` });
      throw reason;
    }
  }) : undefined;
  const chooseFolder = () => void perform('Choosing destination', async () => {
    const folder = await chooseDirectory();
    if (folder) useSolarium.getState().updateProject(project.id, { folder });
  });
  const status = busy || (running ? evidence?.activeScenario ? 'Running ' + evidence.activeScenario : evidence?.activeCheck ?? 'Preparing verification' :
    verified ? 'Verified build ready' : 'Interactive preview');
  const codeChanges = sourceSnapshot != null && sourceSnapshot.revision === record?.data.revision
    ? sourceSnapshot.changes : (review?.changes ?? []);
  const graphDiff = previous && graph ? { path: 'graph-revision.json', expected: stableGraphJson(previous, 2), content: stableGraphJson(graph, 2) } : undefined;
  return <Dialog className="spica-workbench-dialog" open={open} onClose={closeWorkbench} maxWidth={false} keepMounted
    onDragOver={event => event.stopPropagation()} onDrop={event => event.stopPropagation()}
    aria-labelledby="spica-workbench-title" slotProps={{ paper: { className: 'spica-workbench' } }}>
    <header className="spica-workbench-header spica-heading">
      <Stack direction="row" gap={1.3} alignItems="center">
        <span className="spica-workbench-mark" aria-hidden="true"><AutoAwesomeOutlined fontSize="medium" /></span>
        <div>
          <Typography id="spica-workbench-title" variant="h6">SPICA · {graph?.name ?? 'Build an app'}</Typography>
          <Typography color="text.secondary" fontSize={12}>{project.name}{record && ' · Revision ' + record.data.revision} · {status}</Typography>
        </div>
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
        <TextField select size="small" label="Export target" value={exportTarget} disabled={locked}
          onChange={event => {setExportTarget(event.target.value as SpicaExportTarget);setReview(null);setCurrentBuild(false);setSourceSnapshot(null);}}>
          <MenuItem value="desktop">Desktop (Tauri)</MenuItem>
          <MenuItem value="web">Web (Vite)</MenuItem>
        </TextField>
        <Chip size="small" color={verified ? 'success' : busy ? 'info' : 'default'} variant="outlined"
          label={verified ? `Verified ${exportTarget} build` : busy ? 'Operation running' : 'Graph preview'} />
        {launch && <Button variant="outlined" startIcon={<PlayArrowOutlined />} onClick={launch}>Launch verified</Button>}
        <Button onClick={closeWorkbench} startIcon={<CloseOutlined />} aria-label="Close SPICA workbench">Close</Button>
      </Stack>
    </header>
    {!loaded ? <Typography className="spica-workbench-empty">{error || 'Reading saved graph…'}</Typography> : !record || !graph || !page ? <Stack className="spica-workbench-empty" gap={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography>Ask your Spark to build an app in this project. Link an empty output folder to export and test it.</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button disabled={locked} onClick={chooseFolder}>{project.folder ? 'Change output folder' : 'Choose output folder'}</Button>
        <Button disabled={locked} variant="contained" onClick={() => onPrompt('Build a SPICA app that ')}>Ask Spark to build</Button>
      </Stack>
      <details>
      <summary>Create a graph manually</summary>
      <TextField size="small" label="App name" value={name} onChange={event => setName(event.target.value)} />
      <Stack direction="row" gap={1} flexWrap="wrap">
        {(['blank', 'settings', 'notes', 'tasks'] as const).map(recipe => <Button key={recipe} disabled={locked || !name.trim()} variant="outlined"
          onClick={() => void perform('Creating graph', async () => {
            const created = await repository.create(name.trim(), recipe);
            setRecord(created);
            await refresh(created);
          })}>{recipe === 'blank' ? 'Create blank app' : 'Use ' + recipe + ' recipe'}</Button>)}
      </Stack>
      </details>
    </Stack> : <div className="spica-workbench-grid">
      <section className="spica-workbench-evidence" aria-label="App changes and checks">
      <nav className="spica-workbench-tabs" aria-label="App evidence">
        {tabs.map(([id, label]) => <Button key={id} size="small" aria-pressed={tab === id}
          variant={tab === id ? 'contained' : 'text'} onClick={() => setTab(id)}>{label}</Button>)}
      </nav>
      <div className="spica-workbench-tab">
      {error && <Alert severity="error">{error}</Alert>}
      {warning && <Alert severity="warning">{warning}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {tab === 'build' && <SpicaBuildStream events={buildEvents} output={log} active={!!busy} evidence={!busy && evidence?.revision === record.data.revision ? evidence : null} onOpenLogs={() => setTab('logs')} />}
      {tab === 'inspect' && <>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <div className="spica-surface-nav" role="group" aria-label="Builder workspace">
          {([['design', 'Design'], ['warehouse', 'Warehouse'], ['workflows', 'Workflows'], ['research', 'Research']] as const).map(([id, label]) =>
            <Button key={id} aria-pressed={surface === id} variant={surface === id ? 'contained' : 'text'} onClick={() => setSurface(id)}>{label}</Button>)}
        </div>
        <Button disabled={locked || !record.data.undo.length} onClick={() => void edit('undo')}>Undo</Button>
        <Button disabled={locked || !record.data.redo.length} onClick={() => void edit('redo')}>Redo</Button>
        <Button disabled={locked} onClick={() => void perform('Reloading graph', async () => {
          const saved = await repository.read(); setRecord(saved); await refresh(saved);
        })}>Reload</Button>
      </Stack>
      {surface === 'warehouse' && <SpicaWarehouse graph={graph} busy={locked} onEdit={edit} />}
      {surface === 'workflows' && <SpicaWorkflows graph={graph} busy={locked} onEdit={edit} />}
      {surface === 'research' && <SpicaResearch projectId={project.id} />}
      {surface === 'design' &&
      <div className="spica-layout">
        <section className="spica-panel" aria-label="App outline">
          <Typography fontWeight={700}>App outline</Typography>
          <ul className="spica-outline">
            {graph.pages.map(item => <li key={item.id}>
              <button aria-current={item.id === page.id ? 'true' : undefined} onClick={() => { setPage(item.id); setControl(''); }}>{item.label}</button>
              <ul>{graph.controls.filter(c => c.page === item.id).map(c => <li key={c.id}>
                <button aria-current={c.id === control?.id ? 'true' : undefined} onClick={() => { setPage(item.id); setControl(c.id); }}>{c.label}</button>
              </li>)}</ul>
            </li>)}
          </ul>
          <LabelForm key={graph.name} label="App title" initial={graph.name} button="Rename app" busy={locked}
            onSubmit={value => edit([{ op: 'rename', name: value }])} />
          {!graph.collection && <LabelForm label="Page label" button="Add page" busy={locked} onSubmit={value => {
            const id = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 34);
            return edit([{ op: 'add_page', id: 'page_' + id, label: value }]);
          }} />}
        </section>
        <section className="spica-panel" aria-label="Property inspector">
          <Typography fontWeight={700}>{graph.collection ? graph.collection.label : control ? control.label : page.label} properties</Typography>
          {graph.collection ? <>
            <Typography fontSize={13} color="text.secondary">SQLite collection · recipe version {graph.collection.recipeVersion}</Typography>
            <ul>{graph.collection.fields.map(field => <li key={field.key}>{field.label} · {field.type}
              {field.type === 'boolean' && field.filter ? ' · list filter' : ''}</li>)}</ul>
            <RecordToggleForm busy={locked} onEdit={edit} />
          </> : control ? <>
            <Typography fontSize={13} color="text.secondary">{control.widget} → {control.preference} → Persistent preferences</Typography>
            <LabelForm key={control.id + control.label} label="Control label" initial={control.label} button="Save label" busy={locked}
              onSubmit={value => edit([{ op: 'label_setting', key: control.preference, label: value }])} />
            <Button color="warning" disabled={locked} onClick={() => void edit([{ op: 'remove_setting', key: control.preference }])}>Remove setting</Button>
          </> : <SettingForm key={page.id} page={page.id} busy={locked} onEdit={edit} />}
        </section>
      </div>}
      </>}
      {tab === 'changes' &&
      <section className="spica-panel" aria-label="Export and verification">
        <Typography fontWeight={700}>Standalone output</Typography>
        <Typography color="text.secondary" fontSize={13} sx={{ overflowWrap: 'anywhere' }}>{project.folder || 'Link an empty destination folder for the first export.'}</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <Button disabled={locked} onClick={chooseFolder}>{project.folder ? 'Change destination' : 'Choose destination'}</Button>
          <Button variant="outlined" disabled={locked || !project.folder || !!review?.conflicts.length} onClick={() => void perform('Exporting sources', async () => {
            const written = await exportSpica(project.folder!, record, undefined, exportTarget);
            setNotice(written.length ? 'Exported ' + written.length + ' files.' : 'Current graph already exported.');
            await refresh(record);
          })}>Export source</Button>
          <Button disabled={locked || !review?.current} onClick={() => void runBuild(true)}>Prepare from cache</Button>
          {webEnabled && <Button disabled={locked || !review?.current} onClick={() => {
            if (window.confirm('Download the declared npm dependencies with install scripts disabled?')) void runBuild(true, true);
          }}>Download npm dependencies</Button>}
          <Chip size="small" label={verified ? 'Current build passed' : review?.current ? 'Current graph exported' : 'Export pending'} />
        </Stack>
        {review && !review.current && !review.conflicts.length && <Typography fontSize={12} color="text.secondary">
          Test &amp; Preview exports the current design before running the checks.
        </Typography>}
        {review?.addedFields.length ? <Alert severity="info">
          Collection fields for this export. The standalone app will apply the schema on launch.
          <ul>{review.addedFields.map(field => <li key={field.key}>
            {field.label} ({field.key}) · {field.type} · default {JSON.stringify(field.initial)}
            {field.type === 'boolean' && field.filter ? ' · list filter' : ''}
          </li>)}</ul>
        </Alert> : null}
        <SpicaCodeDiff revision={record.data.revision} changes={codeChanges} conflicts={review?.conflicts}
          graphDiff={graphDiff} origin={sourceSnapshot?.revision === record.data.revision ? 'Last export attempt' : 'Pending export'} />
      </section>}
      {tab === 'logs' && <section className="spica-panel" aria-label="Build logs">
        {!evidence?.checks.length && !log && !agentLog && <Typography color="text.secondary">Command output appears here during a build.</Typography>}
        {evidence?.checks.map(result => <Stack key={result.run_id} direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography fontSize={12}>{result.command_id} · {commandPassed(result) ? 'passed' : 'failed'}</Typography>
          <Button size="small" onClick={() => void showLog(result.run_id, 'stdout')}>stdout</Button>
          <Button size="small" onClick={() => void showLog(result.run_id, 'stderr')}>stderr</Button>
        </Stack>)}
        {logRun && !evidence?.checks.some(check => check.run_id === logRun) && <Stack direction="row" gap={1}>
          <Button size="small" onClick={() => void showLog(logRun, 'stdout')}>Setup stdout</Button>
          <Button size="small" onClick={() => void showLog(logRun, 'stderr')}>Setup stderr</Button>
        </Stack>}
        {log && <pre aria-label="Native command output">{log}</pre>}
        {agentLog && <details><summary>Spark conversation log (not native verification)</summary><pre>{agentLog}</pre></details>}
        {logMore && <Button onClick={() => void showLog(logRun, logStream, logOffset)}>Read next log page</Button>}
      </section>}
      {tab === 'tests' && <section className="spica-panel" aria-label="Test results">
        {evidence ? <Typography fontSize={13}>Revision {evidence.revision} · {evidence.state === 'running' && !locked ? 'interrupted' : evidence.state}
          {evidence.revision !== record.data.revision ? ' · earlier graph' : ''} · source {evidence.source.slice(0, 12)}</Typography> :
          <Typography color="text.secondary">Run Test &amp; Preview to collect build and scenario results.</Typography>}
        {evidence?.diagnostic && <Alert severity={evidence.state === 'cancelled' ? 'warning' : 'error'}>{evidence.diagnostic}</Alert>}
        {evidence?.checks.map(check => <Typography key={check.run_id} fontSize={13}>{check.command_id} · {commandPassed(check) ? 'passed' : 'failed'}</Typography>)}
        {evidence?.runtime?.map(result => <details key={result.runId}>
          <summary>{result.id} · {result.reports.map(report => `${report.phase} ${report.state}`).join(' · ')}</summary>
          {result.reports.map(report => <div key={report.phase}><Typography fontSize={13}>
            {report.phase} · {report.completed} steps · {Math.round(report.durationMs)} ms{report.diagnostic && ` · ${report.diagnostic}`}
          </Typography>{report.failedStep && <pre>{JSON.stringify(report.failedStep, null, 2)}</pre>}</div>)}
        </details>)}
      </section>}
      </div>
      </section>
      <div className="spica-workbench-preview">
        <SpicaLivePreviewPane record={record} verified={Boolean(verified)} locked={locked} open={open} onClose={closeWorkbench}
          onEdit={edit} onProgramEdit={operation => saveEdit([operation])} />
      </div>
    </div>}
    <footer className="spica-workbench-footer">
      <SpicaBuildTimeline events={buildEvents} target={exportTarget} evidence={!busy && evidence?.revision === record?.data.revision && evidence?.platform === exportTarget ? evidence : null} />
      <Stack className="spica-workbench-footer-actions" direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Typography fontSize={11} color="text.secondary" role="status">{status}</Typography>
        {(abort.current || (agentBusy && running)) && <Button color="warning" startIcon={<StopCircleOutlined />}
          onClick={() => abort.current ? abort.current.abort() : onStopAgent()}>Cancel run</Button>}
        {record && <Button variant="contained" disabled={locked || !review || !!review.conflicts.length}
          startIcon={<PlayArrowOutlined />} onClick={() => void runBuild(false)}>Test &amp; Preview</Button>}
      </Stack>
    </footer>
  </Dialog>;
}

function RecordToggleForm({ busy, onEdit }: { busy: boolean; onEdit(edits: readonly GraphEdit[]): Promise<void> }) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [initial, setInitial] = useState(false);
  const [filter, setFilter] = useState(true);
  return <Stack component="form" gap={1} onSubmit={event => {
    event.preventDefault();
    void onEdit([{ op: 'add_record_toggle', key: key.trim(), label: label.trim(), initial, filter }]);
  }}>
    <TextField required size="small" label="Record field key" value={key} onChange={event => setKey(event.target.value)} />
    <TextField required size="small" label="Record field label" value={label} onChange={event => setLabel(event.target.value)} />
    <label><input type="checkbox" checked={initial} onChange={event => setInitial(event.target.checked)} /> Enabled by default</label>
    <label><input type="checkbox" checked={filter} onChange={event => setFilter(event.target.checked)} /> Show list filter</label>
    <Button type="submit" variant="outlined" disabled={busy}>Add record toggle</Button>
  </Stack>;
}

function LabelForm({ label, initial = '', button, busy, onSubmit }: {
  label: string; initial?: string; button: string; busy: boolean; onSubmit(value: string): Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  return <Stack component="form" direction="row" gap={1} onSubmit={event => {
    event.preventDefault();
    void onSubmit(value.trim());
  }}>
    <TextField fullWidth size="small" label={label} value={value} onChange={event => setValue(event.target.value)} />
    <Button type="submit" disabled={busy || !value.trim() || value.trim() === initial}>{button}</Button>
  </Stack>;
}

function SettingForm({ page, busy, onEdit }: {
  page: string; busy: boolean; onEdit(edits: readonly GraphEdit[]): Promise<void>;
}) {
  const [kind, setKind] = useState<Preference['type']>('boolean');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [initial, setInitial] = useState('');
  const [checked, setChecked] = useState(false);
  const [choices, setChoices] = useState('System, Light, Dark');
  const [multiline, setMultiline] = useState(false);
  const options = choices.split(',').map(option => option.trim()).filter(Boolean);
  function submit(event: FormEvent) {
    event.preventDefault();
    void onEdit([{ op: 'add_setting', key: key.trim(), label: label.trim(), page, type: kind,
      initial: kind === 'boolean' ? checked : kind === 'choice' ? initial || options[0] || '' : initial,
      ...(kind === 'choice' ? { choices: options } : kind === 'text' ? { multiline } : {}),
    }]);
  }
  return <Stack component="form" onSubmit={submit} gap={1.5}>
    <TextField select label="Control type" size="small" value={kind} onChange={event => { setKind(event.target.value as Preference['type']); setInitial(''); }}>
      <MenuItem value="boolean">Toggle switch</MenuItem>
      <MenuItem value="text">Text input</MenuItem>
      <MenuItem value="choice">Choice menu</MenuItem>
    </TextField>
    <TextField required label="Preference key" size="small" value={key} onChange={event => setKey(event.target.value)} helperText="Example: show_tips" />
    <TextField required label="Setting label" size="small" value={label} onChange={event => setLabel(event.target.value)} />
    {kind === 'boolean' ? <label><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} /> Enabled by default</label> :
      <TextField size="small" label="Default value" value={initial} onChange={event => setInitial(event.target.value)} />}
    {kind === 'choice' && <TextField size="small" label="Options separated by commas" value={choices} onChange={event => setChoices(event.target.value)} />}
    {kind === 'text' && <label><input type="checkbox" checked={multiline} onChange={event => setMultiline(event.target.checked)} /> Multiline</label>}
    <Button type="submit" variant="contained" disabled={busy}>Add connected setting</Button>
  </Stack>;
}
