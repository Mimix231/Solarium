import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useSolarium } from '../state/useSolarium';
import { chooseDirectory } from '../engine/desktop';
import { readCommandOutput, runProjectCommand } from '../engine/intelligence/commands';
import { withLocalWork } from '../engine/work-lifecycle';
import type { CreatorProject } from '../domain/types';
import { SpicaRepository, type SpicaRecord } from '../spica/repository';
import type { GraphEdit, Preference } from '../spica/graph';
import { commandPassed, currentSpicaBuild, exportSpica, inspectExport, launchSpicaApp, latestSpicaBuild, verifySpica, type BuildEvidence, type ExportReview } from '../spica/export';
import { SpicaPreview, type PreviewMode } from '../components/SpicaPreview';
import './spica.css';

export function SpicaStudio() {
  const workspace = useSolarium(state => state.workspace);
  const project = workspace.projects?.find(item => item.id === workspace.activeProjectId);
  return <div className="spica-studio">
    {project ? <Studio key={project.id} project={project} /> :
      <Stack gap={2} maxWidth={440}>
        <Typography variant="h5">SPICA App Builder</Typography>
        <Typography color="text.secondary">Choose a project to build and export a standalone app.</Typography>
        <TextField select label="Project" value="" onChange={event => {
          const state = useSolarium.getState();
          state.selectProject(event.target.value);
          state.setView('spica');
        }}>
          {(workspace.projects ?? []).map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
        </TextField>
        <Button onClick={() => useSolarium.getState().setView('projects')}>Manage projects</Button>
      </Stack>}
  </div>;
}

function Studio({ project }: { project: CreatorProject }) {
  const repository = useMemo(() => new SpicaRepository(project.id), [project.id]);
  const [record, setRecord] = useState<SpicaRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState(project.name.slice(0, 80));
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewMode>('closed');
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
  const abort = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const refreshId = useRef(0);

  const refresh = useCallback(async (current: SpicaRecord | null, isActive: () => boolean = () => true) => {
    const id = ++refreshId.current;
    const root = project.folder;
    setReview(null);
    setCurrentBuild(false);
    const [last, status] = await Promise.all([
      latestSpicaBuild(project.id),
      current && root ? inspectExport(root, current) : null,
    ]);
    const valid = Boolean(current && root && status?.current && last?.state === 'passed' && await currentSpicaBuild(root, current));
    if (id !== refreshId.current || !isActive()) return;
    setEvidence(last?.root === root ? last : null);
    setReview(status);
    setCurrentBuild(valid);
  }, [project.folder, project.id]);
  useEffect(() => {
    let live = true;
    void repository.read().then(async current => {
      if (!live) return;
      setRecord(current);
      setLoaded(true);
      await refresh(current, () => live);
    }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [repository, refresh]);

  async function perform(label: string, action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(label);
    setError('');
    setNotice('');
    try { await action(); } catch (reason) { setError(String(reason)); }
    finally { pending.current = false; setBusy(''); }
  }
  async function edit(operation: readonly GraphEdit[] | 'undo' | 'redo') {
    if (!record) return;
    await perform('Saving graph', async () => {
      const changed = await repository.update(record.data.revision, operation);
      setRecord(changed);
      setNotice('Saved graph revision ' + changed.data.revision);
      await refresh(changed);
    });
  }
  async function runBuild(setup: boolean, network = false) {
    if (!record || !project.folder) return;
    const root = project.folder;
    if (!setup) setPreview(mode => mode === 'closed' ? 'dock' : mode);
    await perform(setup ? 'Preparing dependencies' : 'Verifying standalone build', async () => {
      const controller = new AbortController();
      abort.current = controller;
      setLog('');
      setLogRun('');
      setLogMore(false);
      setCurrentBuild(false);
      const output = ({ stream, chunk }: { stream: string; chunk: string }) =>
        setLog(old => (old + (stream === 'stderr' ? '[stderr] ' : '') + chunk).slice(-48000));
      try {
        await withLocalWork('spica:' + project.id, 'SPICA build', undefined, controller.signal, async signal => {
          if (setup) {
            if (!(await inspectExport(root, record)).current) throw Error('Export the current graph first.');
            for (const id of [network ? 'install:network' : 'install:cached', 'script:setup:native']) {
              const result = await runProjectCommand(root, id, network, signal, output);
              setLogRun(result.run_id);
              if (result.exit_code !== 0 || result.timed_out || result.cancelled) throw Error(id + ' failed. Read the command output.');
            }
            setNotice('Node dependencies and Rust lockfile prepared.');
          } else {
            const written = await exportSpica(root, record);
            if (written.length) setLog('Exported ' + written.length + ' files for graph revision ' + record.data.revision + '.\n');
            if (signal.aborted) throw new DOMException('Stopped', 'AbortError');
            setReview(await inspectExport(root, record));
            const result = await verifySpica(root, record, false, signal, output);
            setEvidence(result);
            setCurrentBuild(result.state === 'passed');
            if (result.state !== 'passed') throw Error(result.diagnostic ?? result.state);
            setNotice('Standalone build and native tests passed for revision ' + result.revision + '.');
          }
        });
      } finally { abort.current = null; }
    });
  }
  async function showLog(runId: string, stream: 'stdout' | 'stderr', offset = 0) {
    if (!project.folder) return;
    await perform('Reading command log', async () => {
      const page = await readCommandOutput(project.folder!, runId, stream, offset);
      setLogRun(runId);
      setLogStream(stream);
      setLogOffset(page.nextOffset);
      setLogMore(page.hasMore);
      setLog(old => offset ? old + page.text : page.text);
    });
  }

  const graph = record?.data.graph;
  const page = graph?.pages.find(item => item.id === pageId) ?? graph?.pages[0];
  const control = graph?.controls.find(item => item.id === controlId && item.page === page?.id);
  const launch = record && project.folder && currentBuild && !busy ? () => void perform('Launching app', async () => {
    const pid = await launchSpicaApp(project.folder!, record);
    setNotice('Started the verified app · Process ' + pid);
  }) : undefined;
  return <>
    <header className="spica-heading">
      <div>
        <Typography fontSize={11} letterSpacing={2} color="text.secondary">APP BUILDER · WINDOWS DESKTOP</Typography>
        <Typography variant="h5">{graph?.name ?? 'SPICA'}</Typography>
        <Typography color="text.secondary" fontSize={13}>{project.name}{record && ' · Revision ' + record.data.revision}</Typography>
      </div>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button onClick={() => useSolarium.getState().setView('projects')}>Project settings</Button>
        {graph && <Button onClick={() => {
          const state = useSolarium.getState();
          const existing = state.workspace.sessions.find(session => session.projectId === project.id);
          if (existing) state.openSession(existing.id);
          else state.createSession(undefined, project.id);
        }}>Ask a Spark</Button>}
        {project.folder && <Button onClick={() => useSolarium.getState().setView('code')}>Code Studio</Button>}
      </Stack>
    </header>
    {error && <Alert severity="error">{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}
    {busy && <Stack direction="row" gap={1} alignItems="center" role="status">
      <Typography>{busy}…</Typography>{abort.current && <Button color="warning" onClick={() => abort.current?.abort()}>Stop</Button>}
    </Stack>}
    {!loaded ? <Typography>Reading saved graph…</Typography> : !record || !graph || !page ? <Stack gap={2} maxWidth={440}>
      <Typography>Start with a blank app or a reusable settings, notes, or tasks recipe.</Typography>
      <TextField label="App name" value={name} onChange={event => setName(event.target.value)} />
      <Stack direction="row" gap={1} flexWrap="wrap">
        {(['blank', 'settings', 'notes', 'tasks'] as const).map(recipe => <Button key={recipe} disabled={!!busy || !name.trim()} variant="outlined"
          onClick={() => void perform('Creating graph', async () => {
            const created = await repository.create(name.trim(), recipe);
            setRecord(created);
            await refresh(created);
          })}>{recipe === 'blank' ? 'Create blank app' : 'Use ' + recipe + ' recipe'}</Button>)}
      </Stack>
    </Stack> : <>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button disabled={!!busy || !record.data.undo.length} onClick={() => void edit('undo')}>Undo</Button>
        <Button disabled={!!busy || !record.data.redo.length} onClick={() => void edit('redo')}>Redo</Button>
        <Button onClick={() => setPreview('dock')} variant={preview === 'closed' ? 'outlined' : 'contained'}>Preview app</Button>
        <Button disabled={!!busy} onClick={() => void perform('Reloading graph', async () => {
          const saved = await repository.read(); setRecord(saved); await refresh(saved);
        })}>Reload</Button>
      </Stack>
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
          <LabelForm key={graph.name} label="App title" initial={graph.name} button="Rename app" busy={!!busy}
            onSubmit={value => edit([{ op: 'rename', name: value }])} />
          {!graph.collection && <LabelForm label="Page label" button="Add page" busy={!!busy} onSubmit={value => {
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
            <RecordToggleForm busy={!!busy} onEdit={edit} />
          </> : control ? <>
            <Typography fontSize={13} color="text.secondary">{control.widget} → {control.preference} → Persistent preferences</Typography>
            <LabelForm key={control.id + control.label} label="Control label" initial={control.label} button="Save label" busy={!!busy}
              onSubmit={value => edit([{ op: 'label_setting', key: control.preference, label: value }])} />
            <Button color="warning" disabled={!!busy} onClick={() => void edit([{ op: 'remove_setting', key: control.preference }])}>Remove setting</Button>
          </> : <SettingForm key={page.id} page={page.id} busy={!!busy} onEdit={edit} />}
        </section>
      </div>
      <div className="spica-test-layout" data-docked={preview === 'dock'}>
      <section className="spica-panel" aria-label="Export and verification">
        <Typography fontWeight={700}>Standalone output</Typography>
        <Typography color="text.secondary" fontSize={13} sx={{ overflowWrap: 'anywhere' }}>{project.folder || 'Link an empty destination folder for the first export.'}</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <Button disabled={!!busy} onClick={() => void perform('Choosing destination', async () => {
            const folder = await chooseDirectory();
            if (folder) useSolarium.getState().updateProject(project.id, { folder });
          })}>{project.folder ? 'Change destination' : 'Choose destination'}</Button>
          <Button variant="outlined" disabled={!!busy || !project.folder} onClick={() => void perform('Exporting sources', async () => {
            const written = await exportSpica(project.folder!, record);
            setNotice(written.length ? 'Exported ' + written.length + ' files.' : 'Current graph already exported.');
            await refresh(record);
          })}>Export source</Button>
          <Button disabled={!!busy || !review?.current} onClick={() => void runBuild(true)}>Prepare from cache</Button>
          <Button disabled={!!busy || !review?.current} onClick={() => {
            if (window.confirm('Download the declared npm dependencies with install scripts disabled?')) void runBuild(true, true);
          }}>Download npm dependencies</Button>
          <Button variant="contained" disabled={!!busy || !review || !!review.conflicts.length} onClick={() => void runBuild(false)}>Test &amp; Preview</Button>
          {launch && <Button onClick={launch}>Launch verified app</Button>}
          <Chip size="small" label={currentBuild ? 'Current build passed' : review?.current ? 'Current graph exported' : 'Export pending'} />
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
        {review?.conflicts.map(conflict => <details key={conflict.path}>
          <summary>Managed file edited · {conflict.path}</summary>
          <div className="spica-layout">
            <div>Current on disk<pre>{conflict.current || '(missing or empty)'}</pre></div>
            <div>Proposed export<pre>{conflict.proposed}</pre></div>
          </div>
        </details>)}
        {evidence && <Typography fontSize={12} color="text.secondary">Last verification · revision {evidence.revision} · {evidence.state === 'running' && !busy ? 'interrupted' : evidence.state} · source {evidence.source.slice(0, 12)}</Typography>}
        {evidence?.checks.map(result => <Stack key={result.run_id} direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography fontSize={12}>{result.command_id} · {commandPassed(result) ? 'passed' : 'failed'}</Typography>
          <Button size="small" onClick={() => void showLog(result.run_id, 'stdout')}>stdout</Button>
          <Button size="small" onClick={() => void showLog(result.run_id, 'stderr')}>stderr</Button>
        </Stack>)}
        {log && <pre aria-label="Command output">{log}</pre>}
        {logMore && <Button onClick={() => void showLog(logRun, logStream, logOffset)}>Read next log page</Button>}
      </section>
      <SpicaPreview record={record} mode={preview} onMode={setPreview} onEdit={style => edit([style])} saving={!!busy}
        verification={busy || (currentBuild ? `Standalone build passed · r${record.data.revision}` : 'Sample app · Build needed')}
        error={error} onLaunch={launch} />
      </div>
    </>}
  </>;
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
