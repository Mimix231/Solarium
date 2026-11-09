import { useRef, useState } from 'react';
import type { AppPlan, Collection, RecordValue } from '../graph';
import { allCollections, executeFlow, recordDefaults, type FlowTrace, type ScenarioStep } from '../program';
import { allRecords, exportRecords, prepareImport, type CollectionStore, type CsvTransform } from '../data';
import { CollectionApp, RecordFields } from './CollectionApp';
import { ModelLibrary } from './ModelLibrary';

export type SaveExport = (name: string, body: string, format: 'csv' | 'json') => Promise<string | null>;

export async function downloadRecords(name: string, body: string, format: 'csv' | 'json') {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([body], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' }));
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return name;
}

interface WorkflowProps {
  plan: AppPlan; storage: CollectionStore; saveExport?: SaveExport; transform?: CsvTransform;
  onTrace?(trace: FlowTrace[]): void; onAction?(step: ScenarioStep): void;
}

export function WorkflowApp({ plan, storage, saveExport, transform, onTrace, onAction }: WorkflowProps) {
  const program = plan.program!;
  const [active, setActive] = useState(program.screens[0]!.id);
  const screen = program.screens.find(item => item.id === active) ?? program.screens[0]!;
  const collection = allCollections(plan).find(item => item.id === screen.collection)!;
  const [drafts, setDrafts] = useState<Record<string, Record<string, RecordValue>>>({});
  const values = drafts[screen.id] ?? recordDefaults(collection);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const running = useRef<AbortController | null>(null);

  function navigate(id: string) {
    if (running.current) return;
    setActive(id); setError(''); setStatus('');
    onAction?.({ action: 'screen', screen: id });
  }

  async function submit() {
    if (screen.view !== 'form' || running.current) return;
    const flow = program.flows.find(flow => flow.id === screen.submit)!;
    const controller = new AbortController();
    running.current = controller;
    onAction?.({ action: 'submit' });
    setBusy(true); setError(''); setStatus('');
    try {
      const result = await executeFlow(flow, collection, program, values, next => storage.save({ collection: collection.id,
        id: null, expected: null, archived: false, values: next }), controller.signal);
      onTrace?.(result.trace);
      if (result.saved) {
        setDrafts(old => { const next = { ...old }; delete next[screen.id]; return next; });
        setRefresh(value => value + 1);
      }
      if (result.error) {
        setError(result.saved ? `The record was saved. ${result.error}` : result.error);
        return;
      }
      if (result.screen) setActive(result.screen);
      setStatus(result.status ?? (result.saved ? 'Record saved.' : 'Action finished.'));
    } finally { running.current = null; setBusy(false); }
  }

  return <section className="spica-workflow" data-spica-busy={busy ? 'true' : 'false'}>
    <nav aria-label="App screens" className="spica-screen-nav" data-spica-part="screen-nav">
      <strong>{plan.name}</strong>
      {program.screens.map(item => <button key={item.id} type="button" data-spica-route={item.id} data-spica-part={'route-' + item.id}
        disabled={busy} aria-current={item.id === screen.id ? 'page' : undefined} onClick={() => navigate(item.id)}>{item.label}</button>)}
    </nav>
    <section key={screen.id} className="spica-screen" data-spica-screen={screen.id} data-spica-collection={collection.id}
      data-spica-part={'screen-' + screen.id} aria-label={screen.label}>
      {screen.view === 'form' ? <form className="spica-record-editor" data-spica-part="record-editor"
        onSubmit={event => { event.preventDefault(); void submit(); }}>
        <h2 data-spica-part="record-editor-heading">{screen.label}</h2>
        <fieldset disabled={busy} data-spica-part="record-fields">
          <RecordFields fields={screen.fields.map(key => collection.fields.find(field => field.key === key)!)} storage={storage} values={values}
            onChange={(key, value) => {
              setDrafts(old => ({ ...old, [screen.id]: { ...values, ...old[screen.id], [key]: value } }));
              if (typeof value === 'string' || typeof value === 'boolean') onAction?.({ action: 'fill', field: key, value });
            }} />
        </fieldset>
        <div className="spica-app-actions" data-spica-part="record-actions">
          <button type="submit" data-spica-submit={screen.submit} data-spica-part="record-save" disabled={busy}>Save {collection.singular}</button>
          {busy && <button type="button" onClick={() => running.current?.abort()}>Stop after current operation</button>}
        </div>
      </form> : screen.view === 'models' ? <ModelLibrary collection={collection.id} storage={storage} program={program} /> : <>
        <CollectionApp collection={collection} storage={storage} fixedFilter={screen.filter} program={program} refreshKey={refresh} />
        {(program.grants.includes('files.open') || program.grants.includes('files.export')) &&
          <RecordTransfer key={collection.id} collection={collection} storage={storage} allowImport={program.grants.includes('files.open') && program.grants.includes('records.write')}
            allowExport={program.grants.includes('files.export')} transform={program.csvTransform && program.grants.includes('custom.transform') ? transform : undefined}
            needsTransform={Boolean(program.csvTransform)} saveExport={saveExport ?? downloadRecords} onImported={() => setRefresh(value => value + 1)} />}
      </>}
      {status && <p className="spica-flow-message" data-spica-flow-status role="status">{status}</p>}
      {error && <p className="spica-flow-message" data-spica-flow-alert role="alert">{error}</p>}
    </section>
  </section>;
}

function RecordTransfer({ collection, storage, allowImport, allowExport, transform, needsTransform, saveExport, onImported }: {
  collection: Collection; storage: CollectionStore; allowImport: boolean; allowExport: boolean; transform?: CsvTransform;
  needsTransform: boolean; saveExport: SaveExport; onImported(): void;
}) {
  const [staged, setStaged] = useState<Record<string, RecordValue>[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (error) { setError(String(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  function choose(file: File) {
    void run(async () => {
      setStaged(null);
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : file.name.toLowerCase().endsWith('.json') ? 'json' : null;
      if (!format || file.size > 8_000_000) throw Error('Choose a CSV or JSON file up to 8 MB.');
      if (format === 'csv' && needsTransform && !transform) throw Error('This CSV needs its named custom block and grant. Build and run the export to load the custom module.');
      setStaged(await prepareImport(collection, await file.text(), format, transform));
    });
  }
  function download(format: 'csv' | 'json') {
    void run(async () => {
      const rows = await allRecords(storage, collection.id);
      const name = await saveExport(collection.id + '.' + format, exportRecords(collection, rows, format), format);
      setMessage(name ? `${rows.length} active records exported · ${name}` : 'Export cancelled.');
    });
  }
  return <details className="spica-transfer">
    <summary>Import and export</summary>
    {allowImport && storage.import && <label>Review an import<input type="file" accept=".csv,.json" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (file) choose(file);
    }} /></label>}
    {staged && <div className="spica-import-review">
      <p>{staged.length} validated rows. Review before importing.</p>
      <ul>{staged.slice(0, 5).map((row, index) => <li key={index}>{String(row.title)}</li>)}</ul>
      <button type="button" disabled={busy || !allowImport} onClick={() => void run(async () => {
        const count = await storage.import!(collection.id, staged);
        setStaged(null); setMessage(`${count} records imported.`); onImported();
      })}>Import reviewed rows</button>
      <button type="button" disabled={busy} onClick={() => setStaged(null)}>Discard import</button>
    </div>}
    {allowExport && <div className="spica-app-actions">
      <button type="button" disabled={busy} onClick={() => download('csv')}>Export active rows as CSV</button>
      <button type="button" disabled={busy} onClick={() => download('json')}>Export active rows as JSON</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
  </details>;
}
