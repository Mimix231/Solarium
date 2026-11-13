import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Collection, RecordValue } from '../graph';
import { checkCapability, matchesRecord, recordDefaults, type Program, type RecordSort, type RecordTable } from '../program';
import { allRecords, csvCellValue, type CollectionRecord, type CollectionStore } from '../data';
import { SpicaAction, SpicaTextInput, SpicaOptionSelect, SpicaToggle } from './ui/SpicaControls';
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
    const part = 'record-input-' + field.key;
    const value = values[field.key];
    return <div key={field.key} className="spica-material-record-field" data-spica-part={'record-field-' + field.key}>
      {field.type === 'boolean' ? <SpicaToggle part={part} label={field.label} checked={value === true}
        onChange={next => onChange(field.key, next)} /> : field.type === 'reference' ?
        <div className="spica-material-field"><span>{field.label}</span>
          <SpicaOptionSelect part={part} label={field.label} value={typeof value === 'number' ? value : ''}
            onChange={next => onChange(field.key, next ? Number(next) : null)}>
            <option value="">None</option>
            {typeof value === 'number' && !(references[field.collection] ?? []).some(row => row.id === value) &&
              <option value={value}>Saved reference {value}</option>}
            {(references[field.collection] ?? []).map(row => <option key={row.id} value={row.id}>{String(row.values.title)}</option>)}
          </SpicaOptionSelect></div> : field.type === 'choice' ?
        <div className="spica-material-field"><span>{field.label}</span>
          <SpicaOptionSelect part={part} label={field.label} value={String(value ?? '')}
            onChange={next => onChange(field.key, next)}>
            {field.choices.map(choice => <option key={choice}>{choice}</option>)}
          </SpicaOptionSelect></div> :
        <SpicaTextInput part={part} field={field.key} label={field.label} value={String(value ?? '')}
          type={field.type === 'number' ? 'number' : 'text'} min={field.type === 'number' ? field.min : undefined}
          max={field.type === 'number' ? field.max : undefined}
          multiline={field.type === 'text' && !!field.multiline} rows={field.type === 'text' && field.multiline ? 6 : undefined}
          required={field.type === 'text' ? !!field.required : false}
          onChange={next => onChange(field.key, field.type === 'number' ? csvCellValue(field, next) : next)} />}
    </div>;
  })}{error && <p role="alert">{error}</p>}</>;

}

export function CollectionApp({ collection, storage, fixedFilter, initialQuery = '', program, refreshKey = 0, table }: {
  collection: Collection; storage: CollectionStore; fixedFilter?: string; initialQuery?: string; program?: Program; refreshKey?: number; table?: RecordTable;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [archived, setArchived] = useState(false);
  const [filter, setFilter] = useState<string | null>(fixedFilter ?? null);
  const [sort, setSort] = useState<RecordSort | undefined>(table?.sort);
  const [onlyMatches, setOnlyMatches] = useState(false);
  const badge = table?.badge;
  const where = onlyMatches ? badge?.when : undefined;
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

  // A Spark can add or remove fields while this preview remains mounted. Keep
  // the editor draft for surviving keys, hydrate new fields with schema defaults,
  // and discard keys no longer in the graph rather than requiring a remount.
  useEffect(() => {
    setValues(previous => {
      const defaults = recordDefaults(collection);
      const next = Object.fromEntries(Object.entries(defaults).map(([key, value]) =>
        [key, Object.hasOwn(previous, key) ? previous[key] : value])) as Record<string, RecordValue>;
      return Object.keys(previous).length === Object.keys(next).length &&
        Object.entries(next).every(([key, value]) => previous[key] === value) ? previous : next;
    });
  }, [collection]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void storage.list({ collection: collection.id, query, archived, filter, offset, sort, where }).then(page => {
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
  }, [query, archived, collection.id, filter, offset, refresh, refreshKey, storage, sort, where]);

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

  return <div className="spica-collection" data-spica-record-view={table ? 'table' : undefined}>
    <section className="spica-record-list" aria-label={collection.label} data-spica-part="record-sidebar">
      <div className="spica-record-heading"><h2 data-spica-part="record-sidebar-heading">{collection.label}</h2>
        <SpicaAction part="record-new" emphasis disabled={!available || busy} onClick={() => select(null)}>New {collection.singular}</SpicaAction></div>
      <div data-spica-part="record-search-label"><SpicaTextInput label={'Search ' + collection.label.toLowerCase()}
        type="search" part="record-search" maxLength={256} value={query}
        onChange={next => { setQuery(next); setOffset(0); }} /></div>
      <div className="spica-inline" data-spica-part="record-archived-label"><SpicaToggle part="record-archived"
        label="Show archived" checked={archived} onChange={next => { setArchived(next); setOffset(0); }} /></div>
      {!fixedFilter && collection.fields.some(field => field.type === 'boolean' && field.filter) &&
        <div data-spica-part="record-filter-label" className="spica-material-field"><span>Filter {collection.label.toLowerCase()}</span>
          <SpicaOptionSelect part="record-filter" label="Filter records" value={filter ?? ''}
            onChange={next => { setFilter(next || null); setOffset(0); }}>
            <option value="">All</option>
            {collection.fields.filter(field => field.type === 'boolean' && field.filter)
              .map(field => <option key={field.key} value={field.key}>{field.label} only</option>)}
          </SpicaOptionSelect>
        </div>}
      {table && <div className="spica-table-controls">
        <div className="spica-material-field"><span>Sort by</span><SpicaOptionSelect label="Sort by" inputAttributes={{ 'data-spica-sort': '' }} value={sort?.field ?? ''} onChange={field => {
          setSort(field ? { field, direction: sort?.direction ?? 'asc' } : undefined); setOffset(0);
        }}>
          <option value="">Recently changed</option>
          {collection.fields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
        </SpicaOptionSelect></div>
        {sort && <div className="spica-material-field"><span>Direction</span><SpicaOptionSelect label="Sort direction" inputAttributes={{ 'data-spica-sort-direction': '' }} value={sort.direction}
          onChange={next => { setSort({ ...sort, direction: next === 'desc' ? 'desc' : 'asc' }); setOffset(0); }}><option value="asc">Ascending</option><option value="desc">Descending</option></SpicaOptionSelect></div>}
        {badge && <SpicaToggle part="record-table-filter" label={badge.yes + ' only'} checked={onlyMatches}
          onChange={next => { setOnlyMatches(next); setOffset(0); }} />}
      </div>}
      <div aria-busy={loading}>
        {rows.length && table ? <div className="spica-import-table" tabIndex={0} aria-label={collection.label + ' table'} data-spica-part="record-table">
          <table>
            <thead><tr><th scope="col">Record</th>{table.columns.map(key => <th scope="col" key={key}>{collection.fields.find(field => field.key === key)?.label}</th>)}
              {badge && <th scope="col">{badge.label}</th>}</tr></thead>
            <tbody>{rows.map(row => {
              const matches = badge ? matchesRecord(row.values, badge.when) : false;
              return <tr key={row.id}><th scope="row"><SpicaAction part="record-row" selected={row.id === selected?.id} disabled={busy}
                onClick={() => select(row)}>{String(row.values.title)}</SpicaAction></th>
                {table.columns.map(key => <td key={key}>{String(row.values[key] ?? '')}</td>)}
                {badge && <td><span className="spica-record-badge" data-spica-part="record-badge" data-spica-match={matches}>{matches ? badge.yes : badge.no}</span></td>}
              </tr>;
            })}</tbody>
          </table>
        </div> : rows.length ? <ul>{rows.map(row => <li key={row.id}>
          <SpicaAction part="record-row" selected={row.id === selected?.id} disabled={busy}
            onClick={() => select(row)}>{String(row.values.title)}</SpicaAction>
        </li>)}</ul> : <p data-spica-part="record-empty">{loading ? 'Loading…' : 'No matching ' + collection.label.toLowerCase() + '.'}</p>}
      </div>
      {(offset > 0 || more) && <div className="spica-app-actions" data-spica-part="record-pagination">
        <SpicaAction part="record-previous" disabled={loading || offset === 0} onClick={() => setOffset(value => value - 50)}>Previous page</SpicaAction>
        <SpicaAction part="record-next" disabled={loading || !more} onClick={() => setOffset(value => value + 50)}>Next page</SpicaAction>
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
        <SpicaAction type="submit" emphasis part="record-save" disabled={!available || busy || !dirty}>Save {collection.singular}</SpicaAction>
        {selected && <SpicaAction part="record-archive" disabled={!available || busy || dirty}
          onClick={() => void save(!selected.archived)}>{selected.archived ? 'Restore' : 'Archive'}</SpicaAction>}
      </div>
      <p role="status" data-spica-part="record-status">{dirty ? 'Unsaved changes' : status}</p>
      {error && <p role="alert" data-spica-part="record-error">{error}</p>}
    </form>
  </div>;
}
