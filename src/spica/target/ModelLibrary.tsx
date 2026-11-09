import { useEffect, useRef, useState } from 'react';
import { allRecords, type CollectionRecord, type CollectionStore } from '../data';
import { meshRenderer, readStl, stlLimit, type Mesh } from '../mesh';
import { checkCapability, type Program } from '../program';

export function ModelLibrary({ storage, collection, program }: { storage: CollectionStore; collection: string; program: Program }) {
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<CollectionRecord[]>([]);
  const [more, setMore] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<CollectionRecord | null>(null);
  const [model, setModel] = useState<{ name: string; digest: string; mesh: Mesh } | null>(null);
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    let live = true;
    void storage.list({ collection, query, archived: false, filter: null, offset }).then(page => {
      if (live) { setRows(page.rows); setMore(page.more); }
    }).catch(reason => { if (live) setError(String(reason)); });
    return () => { live = false; };
  }, [collection, offset, query, refresh, storage]);

  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(''); setStatus('');
    try { await action(); } catch (reason) { setError(String(reason)); }
    finally { pending.current = false; setBusy(false); }
  }

  function open(file: File) {
    return perform(async () => {
      checkCapability(program, 'files.open');
      if (!/\.stl$/i.test(file.name) || file.size > stlLimit) throw Error('Choose an STL file up to 20 MiB.');
      const buffer = await file.arrayBuffer();
      const mesh = readStl(buffer);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), byte => byte.toString(16).padStart(2, '0')).join('');
      const existing = (await allRecords(storage, collection, digest)).find(row => row.values.digest === digest) ?? null;
      setSelected(existing);
      setTags(String(existing?.values.tags ?? ''));
      setModel({ name: file.name, digest, mesh });
      setStatus(`Opened ${file.name} · ${mesh.triangles.toLocaleString()} triangles`);
    });
  }

  function saveTags() {
    return perform(async () => {
      checkCapability(program, 'records.write');
      const values = selected?.values ?? (model && { title: model.name, digest: model.digest, triangles: String(model.mesh.triangles), tags: '' });
      if (!values) throw Error('Open a model before saving tags.');
      const saved = await storage.save({ collection, id: selected?.id ?? null, expected: selected?.revision ?? null,
        archived: false, values: { ...values, tags: tags.trim() } });
      setSelected(saved); setStatus('Tags saved.'); setRefresh(value => value + 1);
    });
  }

  return <div className="spica-collection">
    <aside className="spica-record-list" aria-label="Saved models" data-spica-part="record-sidebar">
      <h2>Saved models</h2>
      <label>Search names or tags<input type="search" value={query} maxLength={256} onChange={event => { setQuery(event.target.value); setOffset(0); }} /></label>
      <ul>{rows.map(row => <li key={row.id}><button type="button" disabled={busy} aria-current={row.id === selected?.id ? 'true' : undefined}
        onClick={() => { if (model?.digest !== row.values.digest) setModel(null); setSelected(row); setTags(String(row.values.tags)); }}>
        {String(row.values.title)} {row.values.tags && <small> · {String(row.values.tags)}</small>}
      </button></li>)}</ul>
      {!rows.length && <p>No matching models.</p>}
      {offset > 0 && <button type="button" onClick={() => setOffset(value => value - 50)}>Previous page</button>}
      {more && <button type="button" onClick={() => setOffset(value => value + 50)}>Next page</button>}
    </aside>
    <section className="spica-record-editor" data-spica-part="record-editor">
      <h2>{model?.name ?? String(selected?.values.title ?? 'Open an STL')}</h2>
      <label>Open STL<input type="file" accept=".stl" disabled={busy || !program.grants.includes('files.open')}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void open(file); }} /></label>
      {!program.grants.includes('files.open') && <p>File open permission is disabled.</p>}
      {model ? <><MeshCanvas mesh={model.mesh} /><p>{model.mesh.triangles.toLocaleString()} triangles · {model.mesh.size.map(value => value.toPrecision(4)).join(' × ')} units</p></> :
        selected ? <p>Open the original STL to show its geometry. Its saved tags are available below.</p> : null}
      {(model || selected) && <form onSubmit={event => { event.preventDefault(); void saveTags(); }}>
        <label>Tags<input value={tags} maxLength={1000} onChange={event => setTags(event.target.value)} /></label>
        <button type="submit" disabled={busy} data-spica-part="record-save">Save tags</button>
      </form>}
      <p role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
    </section>
  </div>;
}

function MeshCanvas({ mesh }: { mesh: Mesh }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const display = useRef<ReturnType<typeof meshRenderer> | null>(null);
  const angles = useRef({ yaw: -.5, pitch: .4, zoom: 1.55 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [error, setError] = useState('');
  function draw() { const { yaw, pitch, zoom } = angles.current; display.current?.draw(yaw, pitch, zoom); }
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    setError('');
    try { display.current = meshRenderer(element, mesh); }
    catch (reason) { setError(String(reason)); return; }
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    draw();
    return () => { observer.disconnect(); display.current?.dispose(); display.current = null; };
  }, [mesh]);
  return <><canvas ref={canvas} className="spica-mesh" tabIndex={0} aria-label="STL preview. Drag or use arrow keys to rotate."
    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY }; }}
    onLostPointerCapture={() => { drag.current = null; }}
    onPointerMove={event => {
      if (!drag.current) return;
      angles.current.yaw += (event.clientX - drag.current.x) * .012;
      angles.current.pitch += (event.clientY - drag.current.y) * .012;
      drag.current = { x: event.clientX, y: event.clientY }; draw();
    }} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') angles.current.yaw += event.key === 'ArrowLeft' ? -.16 : .16;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') angles.current.pitch += event.key === 'ArrowUp' ? -.16 : .16;
      if (event.key === '+' || event.key === '-') angles.current.zoom = Math.max(.3, Math.min(3, angles.current.zoom + (event.key === '+' ? .15 : -.15)));
      draw();
    }} />{error && <p role="alert">{error}</p>}</>;
}
