import { useMemo, useRef, useState } from 'react';
import type { AppPlan, Collection, CollectionField, RecordValue } from '../graph';
import { allCollections, executeFlow, recordDefaults, recordProblem, type FlowTrace, type ScenarioStep } from '../program';
import { allRecords, csvCellValue, exportRecords, prepareImport, readCsvTable, stageCsvRows, stageImport, type CollectionStore, type CsvTransform } from '../data';
import { CollectionApp, RecordFields } from './CollectionApp';
import { ModelLibrary } from './ModelLibrary';
import { GameApp } from './GameApp';
import { SpicaAction } from './ui/SpicaControls';

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
  const [active, setActive] = useState(program.startScreen ?? program.screens[0]!.id);
  const screen = program.screens.find(item => item.id === active) ?? program.screens[0]!;
  const collection = screen.view === 'game' ? undefined : allCollections(plan).find(item => item.id === screen.collection);
  const [drafts, setDrafts] = useState<Record<string, Record<string, RecordValue>>>({});
  const values = drafts[screen.id] ?? (collection ? recordDefaults(collection) : {});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const running = useRef<AbortController | null>(null);

  function navigate(id: string) {
    if (running.current || transferring) return;
    setActive(id); setError(''); setStatus('');
    onAction?.({ action: 'screen', screen: id });
  }

  async function submit() {
    if (screen.view !== 'form' || !collection || running.current) return;
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

  const transfer = (dataset: Collection) => <RecordTransfer collection={dataset} storage={storage} review={screen.view === 'review'}
    mapping={screen.view === 'review' && Boolean(screen.mapping)}
    allowImport={program.grants.includes('files.open') && program.grants.includes('records.write')}
    allowExport={program.grants.includes('files.export') && (screen.view !== 'review' || screen.export !== false)}
    transform={program.csvTransform && program.grants.includes('custom.transform') ? transform : undefined}
    needsTransform={Boolean(program.csvTransform)} saveExport={saveExport ?? downloadRecords}
    onBusy={setTransferring} onImported={() => setRefresh(value => value + 1)} />;
  return <section className="spica-workflow" data-spica-busy={busy || transferring ? 'true' : 'false'}>
    <nav aria-label="App screens" className="spica-screen-nav" data-spica-part="screen-nav">
      <strong>{plan.name}</strong>
      {program.screens.map(item => <SpicaAction key={item.id} part={'route-' + item.id} route={item.id} emphasis={item.id === screen.id}
        selected={item.id === screen.id} disabled={busy || transferring} onClick={() => navigate(item.id)}>{item.label}</SpicaAction>)}
    </nav>
    <section key={screen.id} className="spica-screen" data-spica-screen={screen.id} data-spica-collection={collection?.id}
      data-spica-part={'screen-' + screen.id} aria-label={screen.label}>
      {(screen.intro || screen.buttons?.length) ? <header className="spica-screen-intro" data-spica-part={'intro-' + screen.id}>
        {screen.intro && <p>{screen.intro}</p>}
        <div className="spica-app-actions">{screen.buttons?.map(button => <SpicaAction key={button.id} disabled={busy || transferring}
          part={`button-${screen.id}-${button.id}`} onClick={() => navigate(button.screen)}>{button.label}</SpicaAction>)}</div>
      </header> : null}
      {screen.view === 'game' ? <GameApp scene={screen.scene} /> : !collection ? <p role="alert">The screen collection is unavailable.</p> :
      screen.view === 'form' ? <form className="spica-record-editor" data-spica-part="record-editor"
        onSubmit={event => { event.preventDefault(); void submit(); }}>
        <h2 data-spica-part="record-editor-heading">{screen.label}</h2>
        <fieldset disabled={busy} data-spica-part="record-fields" data-spica-layout={screen.layout}>
          <RecordFields fields={screen.fields.map(key => collection.fields.find(field => field.key === key)!)} storage={storage} values={values}
            onChange={(key, value) => {
              setDrafts(old => ({ ...old, [screen.id]: { ...values, ...old[screen.id], [key]: value } }));
              if (value !== null) onAction?.({ action: 'fill', field: key, value });
            }} />
        </fieldset>
        <div className="spica-app-actions" data-spica-part="record-actions">
          <SpicaAction type="submit" emphasis part="record-save" submitFlow={screen.submit} disabled={busy}>{screen.submitLabel ?? `Save ${collection.singular}`}</SpicaAction>
          {busy && <SpicaAction onClick={() => running.current?.abort()}>Stop after current operation</SpicaAction>}
        </div>
      </form> : screen.view === 'models' ? <ModelLibrary collection={collection.id} storage={storage} program={program} /> :
        <div className="spica-record-workspace" data-spica-review-layout={screen.view === 'review' ? screen.layout : undefined}>
        {screen.view === 'review' && transfer(collection)}
        <CollectionApp collection={collection} storage={storage} fixedFilter={screen.view === 'list' ? screen.filter : undefined} initialQuery={screen.view === 'list' ? screen.query : undefined}
          table={screen.view === 'table' ? screen.table : undefined} program={program} refreshKey={refresh} />
        {(screen.view === 'list' || screen.view === 'table') && (program.grants.includes('files.open') || program.grants.includes('files.export')) && transfer(collection)}
      </div>}
      {status && <p className="spica-flow-message" data-spica-flow-status role="status">{status}</p>}
      {error && <p className="spica-flow-message" data-spica-flow-alert role="alert">{error}</p>}
    </section>
  </section>;
}

const reviewPageSize = 15;
function RecordTransfer({ collection, storage, review, mapping, allowImport, allowExport, transform, needsTransform, saveExport, onBusy, onImported }: {
  collection: Collection; storage: CollectionStore; allowImport: boolean; allowExport: boolean; transform?: CsvTransform;
  review: boolean; mapping: boolean; needsTransform: boolean; saveExport: SaveExport; onBusy(busy: boolean): void; onImported(): void;
}) {
  const [staged, setStaged] = useState<Record<string, RecordValue>[] | null>(null);
  const [table, setTable] = useState<Awaited<ReturnType<typeof readCsvTable>> | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const pending = useRef(false);
  const problems = useMemo(() => staged?.map(row => recordProblem(collection, row)) ?? [], [collection, staged]);
  const invalid = problems.filter(Boolean).length;
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); onBusy(true); setError(''); setMessage('');
    try { await action(); } catch (error) { setError(String(error)); }
    finally { pending.current = false; setBusy(false); onBusy(false); }
  }
  function choose(file: File) {
    void run(async () => {
      setStaged(null); setTable(null); setPage(0);
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : file.name.toLowerCase().endsWith('.json') ? 'json' : null;
      if (!format || file.size > 8_000_000) throw Error('Choose a CSV or JSON file up to 8 MB.');
      if (format === 'csv' && needsTransform && !transform) throw Error('This CSV needs its named custom block and grant. Build and run the export to load the custom module.');
      const text = await file.text();
      if (mapping && format === 'csv') {
        const incoming = await readCsvTable(text, transform);
        setColumns(incoming.headers.map(header => collection.fields.some(field => field.key === header) ? header : ''));
        setTable(incoming);
        return;
      }
      setStaged(await (review && format === 'csv' ? stageImport : prepareImport)(collection, text, format, transform));
    });
  }
  function download(format: 'csv' | 'json') {
    void run(async () => {
      const rows = await allRecords(storage, collection.id);
      const name = await saveExport(collection.id + '.' + format, exportRecords(collection, rows, format), format);
      setMessage(name ? `${rows.length} active records exported · ${name}` : 'Export cancelled.');
    });
  }
  const content = <>
    {review && <p>{mapping ? 'Choose which fields receive the CSV columns, then correct invalid rows.' :
      <>CSV columns use these field keys: <code>{collection.fields.map(field => field.key).join(', ')}</code>.</>}</p>}
    {allowImport && storage.import ? <label>Review an import<input type="file" data-spica-import-file accept=".csv,.json" disabled={busy} onChange={event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (file) choose(file);
    }} /></label> : review ? <p>Import requires the file and record write grants.</p> : null}
    {table && <fieldset className="spica-column-map" disabled={busy} data-spica-part="csv-column-map">
      <legend>Map CSV columns</legend>
      {table.headers.map((header, index) => <label key={header}>{header}<select data-spica-map-column={index + 1} value={columns[index]}
        onChange={event => { const value = event.target.value; setColumns(old => old.map((key, column) => column === index ? value : key)); }}>
        <option value="">Skip column</option>
        {collection.fields.map(field => <option key={field.key} value={field.key}
          disabled={columns.some((key, column) => column !== index && key === field.key)}>{field.label}</option>)}
      </select></label>)}
      <button type="button" data-spica-stage-csv disabled={!columns.includes('title')} onClick={() => void run(async () => {
        setStaged(stageCsvRows(collection, table, columns)); setTable(null);
      })}>Review mapped rows</button>
      <button type="button" onClick={() => setTable(null)}>Discard import</button>
    </fieldset>}
    {staged && <div className="spica-import-review" data-spica-staged={staged.length} data-spica-invalid={invalid}>
      <p role="status">{staged.length} rows staged · {invalid ? `${invalid} to correct` : 'Ready to import'}</p>
      {review ? <>
        <div className="spica-import-table" tabIndex={0} aria-label="Staged CSV rows">
          <table>
            <thead><tr><th scope="col">Row</th>{collection.fields.map(field => <th key={field.key} scope="col">{field.label}</th>)}<th scope="col">Validation</th></tr></thead>
            <tbody>{staged.slice(page * reviewPageSize, (page + 1) * reviewPageSize).map((row, offset) => {
              const index = page * reviewPageSize + offset;
              return <tr key={index} data-spica-csv-row={index + 1}>
                <th scope="row">{index + 1}</th>
                {collection.fields.map(field => <td key={field.key}><ReviewCell field={field} row={index + 1} value={row[field.key]}
                  disabled={busy} onChange={value => setStaged(old => old?.map((item, rowIndex) => rowIndex === index ? { ...item, [field.key]: value } : item) ?? null)} /></td>)}
                <td>{problems[index] ?? 'Valid'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {staged.length > reviewPageSize && <div className="spica-app-actions">
          <button type="button" data-spica-csv-previous disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Previous rows</button>
          <span>Rows {page * reviewPageSize + 1}–{Math.min(staged.length, (page + 1) * reviewPageSize)}</span>
          <button type="button" data-spica-csv-next disabled={(page + 1) * reviewPageSize >= staged.length || busy} onClick={() => setPage(page + 1)}>Next rows</button>
        </div>}
      </> : <ul>{staged.slice(0, 5).map((row, index) => <li key={index}>{String(row.title)}</li>)}</ul>}
      <button type="button" data-spica-transfer="import" disabled={busy || !allowImport || invalid > 0} onClick={() => void run(async () => {
        const count = await storage.import!(collection.id, staged);
        setStaged(null); setMessage(`${count} records imported.`); onImported();
      })}>Import reviewed rows</button>
      <button type="button" disabled={busy} onClick={() => setStaged(null)}>Discard import</button>
    </div>}
    {allowExport && <div className="spica-app-actions">
      <button type="button" data-spica-transfer="csv" disabled={busy} onClick={() => download('csv')}>Export active rows as CSV</button>
      <button type="button" disabled={busy} onClick={() => download('json')}>Export active rows as JSON</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert" data-spica-transfer-alert>{error}</p>}
  </>;
  return review ? <section className="spica-transfer" aria-label="Import and export" data-spica-part="record-transfer">
    <h2>Review and transfer</h2>{content}
  </section> : <details className="spica-transfer"><summary>Import and export</summary>{content}</details>;
}

function ReviewCell({ field, row, value, disabled, onChange }: {
  field: CollectionField; row: number; value?: RecordValue; disabled: boolean; onChange(value: RecordValue): void;
}) {
  const label = `Row ${row} · ${field.label}`;
  if (field.type === 'boolean') {
    const valid = typeof value === 'boolean';
    return <select aria-label={label} data-spica-csv-field={field.key} disabled={disabled} value={valid ? String(value) : 'invalid'}
      onChange={event => onChange(event.target.value === 'true')}>
      {!valid && <option value="invalid" disabled>Invalid · {String(value ?? '')}</option>}
      <option value="true">True</option><option value="false">False</option>
    </select>;
  }
  if (field.type === 'choice') return <select aria-label={label} data-spica-csv-field={field.key} disabled={disabled}
    value={String(value ?? '')} onChange={event => onChange(event.target.value)}>
    {!field.choices.includes(String(value)) && <option disabled value={String(value ?? '')}>Invalid · {String(value ?? '')}</option>}
    {field.choices.map(choice => <option key={choice}>{choice}</option>)}
  </select>;
  const change = (text: string) => onChange(csvCellValue(field, text));
  return field.type === 'text' && field.multiline
    ? <textarea aria-label={label} data-spica-csv-field={field.key} rows={2} maxLength={16000} disabled={disabled} value={String(value ?? '')} onChange={event => change(event.target.value)} />
    : <input aria-label={label} data-spica-csv-field={field.key} inputMode={field.type === 'number' ? 'decimal' : undefined}
      maxLength={16000} disabled={disabled} value={String(value ?? '')} onChange={event => change(event.target.value)} />;
}
