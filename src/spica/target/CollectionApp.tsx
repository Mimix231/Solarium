import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Collection, RecordValue } from '../graph';
import { checkCapability, recordDefaults, type Program } from '../program';
import { allRecords, type CollectionRecord, type CollectionStore } from '../data';
export type { CollectionRecord, CollectionQuery, CollectionStore } from '../data';

export function RecordFields({ fields, storage, values, onChange }: {
  fields: Collection['fields']; storage: CollectionStore; values: Record<string, RecordValue>; onChange(key: string, value: RecordValue): void;
}) {
  const [references, setReferences] = useState<Record<string, CollectionRecord[]>>({});
  const [error, setError] = useState('');
  const keys = fields.flatMap(field => field.type === 'reference' ? [field.collection] : []).join(',');
  useEffect(() => {
    let live = true;
    if (keys) void Promise.all([...new Set(keys.split(','))].map(async id => [id, await allRecords(storage, id)] as const))
      .then(entries => { if (live) setReferences(Object.fromEntries(entries)); })
      .catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [keys, storage]);
  return <>{fields.map(field => {
    const props = { 'data-spica-part': 'record-input-' + field.key, 'data-spica-field': field.key };
    const value = values[field.key];
    return <label key={field.key} data-spica-part={'record-field-' + field.key}>
      {field.label}
      {field.type === 'boolean' ? <input {...props} type="checkbox" checked={value === true}
        onChange={event => onChange(field.key, event.target.checked)} /> : field.type === 'reference' ?
        <select {...props} value={typeof value === 'number' ? value : ''}
          onChange={event => onChange(field.key, event.target.value ? Number(event.target.value) : null)}>
          <option value="">None</option>
          {typeof value === 'number' && !(references[field.collection] ?? []).some(row => row.id === value) && <option value={value}>Saved reference {value}</option>}
          {(references[field.collection] ?? []).map(row => <option key={row.id} value={row.id}>{String(row.values.title)}</option>)}
        </select> : field.multiline ? <textarea {...props} rows={10} maxLength={16000} aria-required={field.required}
          value={String(value ?? '')} onChange={event => onChange(field.key, event.target.value)} /> :
        <input {...props} type="text" maxLength={16000} aria-required={field.required} value={String(value ?? '')}
          onChange={event => onChange(field.key, event.target.value)} />}
    </label>;
  })}{error && <p role="alert">{error}</p>}</>;
}

export function CollectionApp({ collection, storage, fixedFilter, program, refreshKey = 0 }: {
  collection: Collection; storage: CollectionStore; fixedFilter?: string; program?: Program; refreshKey?: number;
}) {
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState<string | null>(fixedFilter ?? null);
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<CollectionRecord[]>([]);
  const [more, setMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<CollectionRecord | null>(null);
  const [values, setValues] = useState(() => recordDefaults(collection));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(false);
  const writing = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void storage.list({ collection: collection.id, query, archived, filter, offset }).then(page => {
        if (!active) return;
        setRows(page.rows);
        setMore(page.more);
        setAvailable(true);
        setLoading(false);
      }).catch(reason => {
        if (!active) return;
        setError(String(reason));
        setAvailable(false);
        setLoading(false);
      });
    }, query ? 120 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, archived, collection.id, filter, offset, refresh, refreshKey, storage]);

  function select(record: CollectionRecord | null) {
    if (dirty && !window.confirm('Discard the unsaved changes to this ' + collection.singular + '?')) return;
    setSelected(record);
    setValues({ ...recordDefaults(collection), ...record?.values });
    setDirty(false);
    setStatus('');
    setError('');
  }

  async function save(nextArchived = selected?.archived ?? false) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      checkCapability(program, 'records.write');
      const saved = await storage.save({
        collection: collection.id, id: selected?.id ?? null, expected: selected?.revision ?? null, archived: nextArchived, values,
      });
      setSelected(saved);
      setValues(saved.values);
      setDirty(false);
      setStatus(nextArchived ? 'Archived' : 'Saved');
      setRefresh(value => value + 1);
    } catch (reason) { setError(String(reason)); }
    finally { writing.current = false; setBusy(false); }
  }

  return <div className="spica-collection">
    <section className="spica-record-list" aria-label={collection.label} data-spica-part="record-sidebar">
      <div className="spica-record-heading"><h2 data-spica-part="record-sidebar-heading">{collection.label}</h2>
        <button type="button" data-spica-part="record-new" disabled={!available || busy} onClick={() => select(null)}>New {collection.singular}</button></div>
      <label data-spica-part="record-search-label">Search {collection.label.toLowerCase()}
        <input type="search" data-spica-part="record-search" maxLength={256} value={query} onChange={event => { setQuery(event.target.value); setOffset(0); }} />
      </label>
      <label className="spica-inline" data-spica-part="record-archived-label"><input type="checkbox" data-spica-part="record-archived"
        checked={archived} onChange={event => { setArchived(event.target.checked); setOffset(0); }} /> Show archived</label>
      {!fixedFilter && collection.fields.some(field => field.type === 'boolean' && field.filter) &&
        <label data-spica-part="record-filter-label">Filter {collection.label.toLowerCase()}
          <select data-spica-part="record-filter" value={filter ?? ''} onChange={event => { setFilter(event.target.value || null); setOffset(0); }}>
            <option value="">All</option>
            {collection.fields.filter(field => field.type === 'boolean' && field.filter)
              .map(field => <option key={field.key} value={field.key}>{field.label} only</option>)}
          </select>
        </label>}
      <div aria-busy={loading}>
        {rows.length ? <ul>{rows.map(row => <li key={row.id}>
          <button type="button" data-spica-part="record-row" disabled={busy} aria-current={row.id === selected?.id ? 'true' : undefined}
            onClick={() => select(row)}>{String(row.values.title)}</button>
        </li>)}</ul> : <p data-spica-part="record-empty">{loading ? 'Loading…' : 'No matching ' + collection.label.toLowerCase() + '.'}</p>}
      </div>
      {(offset > 0 || more) && <div className="spica-app-actions" data-spica-part="record-pagination">
        <button type="button" data-spica-part="record-previous" disabled={loading || offset === 0} onClick={() => setOffset(value => value - 50)}>Previous page</button>
        <button type="button" data-spica-part="record-next" disabled={loading || !more} onClick={() => setOffset(value => value + 50)}>Next page</button>
      </div>}
    </section>
    <form className="spica-record-editor" data-spica-part="record-editor" onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }}>
      <h2 data-spica-part="record-editor-heading">{selected ? 'Edit ' + collection.singular : 'New ' + collection.singular}</h2>
      <fieldset disabled={!available || busy} data-spica-part="record-fields">
        <RecordFields fields={collection.fields} storage={storage} values={values} onChange={(key, value) => {
          setValues(old => ({ ...old, [key]: value })); setDirty(true);
        }} />
      </fieldset>
      <div className="spica-app-actions" data-spica-part="record-actions">
        <button type="submit" data-spica-part="record-save" disabled={!available || busy || !dirty}>Save {collection.singular}</button>
        {selected && <button type="button" data-spica-part="record-archive" disabled={!available || busy || dirty}
          onClick={() => void save(!selected.archived)}>{selected.archived ? 'Restore' : 'Archive'}</button>}
      </div>
      <p role="status" data-spica-part="record-status">{dirty ? 'Unsaved changes' : status}</p>
      {error && <p role="alert" data-spica-part="record-error">{error}</p>}
    </form>
  </div>;
}
