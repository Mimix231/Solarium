import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { nativeSearchProvider, type ResearchPage } from '../research/research';
import { SourceRepository, type RetrievedSource } from '../sources/repository';
import { SpicaResearchRun } from '../spica/research-run';
import { useSolarium } from '../state/useSolarium';

function newRun() {
  return new SpicaResearchRun(
    () => {
      const { workspace, webEnabled } = useSolarium.getState();
      return nativeSearchProvider(workspace.preferences.searchProvider ?? { kind: 'bing' }, webEnabled);
    },
    () => useSolarium.getState().webEnabled,
  );
}

export function SpicaResearch({ projectId }: { projectId: string }) {
  const online = useSolarium(state => state.webEnabled);
  const provider = useSolarium(state => state.workspace.preferences.searchProvider?.kind ?? 'bing');
  const [run, setRun] = useState(newRun);
  const [snapshot, setSnapshot] = useState(() => run.snapshot());
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState('');
  const [compareId, setCompareId] = useState('');
  const [local, setLocal] = useState<RetrievedSource[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef<AbortController | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; pending.current?.abort(); };
  }, []);
  useEffect(() => { if (!online) pending.current?.abort(); }, [online]);

  const observation = snapshot.sources.find(source => source.id === selected);
  const references = observation?.page ? run.links(observation.id) : [];
  const others = snapshot.sources.filter(source => source.id !== selected && source.page?.text);
  const comparison = observation?.page?.text && others.some(source => source.id === compareId) ? run.compare(selected, compareId) : null;
  const disableRead = !online || Boolean(busy) || !snapshot.readsLeft;
  const disableSearch = !online || Boolean(busy) || !snapshot.searchesLeft || !query.trim();

  async function perform(label: string, action: (signal: AbortSignal) => Promise<string>, network = false) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const result = await action(controller.signal);
      if (active.current) setNotice(controller.signal.aborted && network ? 'Research stopped.' : result);
    } catch (reason) {
      if (active.current) {
        if (controller.signal.aborted && network) setNotice('Research stopped.');
        else setError(String(reason));
      }
    } finally {
      pending.current = null;
      if (active.current) { setSnapshot(run.snapshot()); setBusy(''); }
    }
  }
  function search(fallback: boolean) {
    void perform('Searching the web', async signal => {
      const { returned, shortlisted, relevance } = await run.search(query, signal, fallback ? 'fallback' : 'primary');
      return relevance === 'matched' ? `${shortlisted} candidates from ${returned} public results. Select a page to retrieve evidence.` :
        returned ? `Weak matches in ${returned} public results. Refine the query or read a known page.` : 'No public HTTPS results from this query.';
    }, true);
  }

  return <section className="spica-panel" aria-label="Project research">
    <div className="spica-heading">
      <div>
        <Typography variant="h6">Research evidence</Typography>
        <Typography fontSize={13} color="text.secondary">Search public pages, follow returned references, and save retrieved passages to this project’s Sources.</Typography>
      </div>
      <Button aria-pressed={online} variant={online ? 'contained' : 'outlined'} onClick={() => useSolarium.getState().setWebEnabled(!online)}>
        Web Search {online ? 'ON' : 'OFF'}
      </Button>
    </div>
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
      <Chip size="small" label={`${snapshot.searchesLeft} searches left · ${snapshot.readsLeft} page reads left`} />
      <Chip size="small" label={{bing:'Bing RSS',searxng:'SearXNG',duckduckgo:'DuckDuckGo',mwmbl:'Mwmbl'}[provider]} />
      <Button size="small" disabled={!!busy} onClick={() => {
        const next = newRun();
        setRun(next);
        setSnapshot(next.snapshot());
        setSelected('');
        setCompareId('');
        setNotice('');
        setError('');
      }}>New evidence run</Button>
    </Stack>
    {snapshot.sources.length > 0 && <Stack gap={0.5} sx={{ p:1.5, borderRadius:2, bgcolor:'action.hover' }} aria-label="Research next action">
      <Typography variant="caption" fontWeight={700}>Evidence-led next action</Typography>
      {(() => {const next=run.nextActions(query).recommendations[0];return <Typography fontSize={12} color="text.secondary">
        {next ? `${next.tool}: ${next.reason}` : 'No further evidence operation recommended. Check the sources or end this run.'}
      </Typography>})()}
    </Stack>}
    <Stack component="form" gap={1} onSubmit={event => { event.preventDefault(); if (!disableSearch) search(false); }}>
      <TextField fullWidth size="small" label="Research query" value={query} onChange={event => setQuery(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 280 } }} helperText="A web search sends this query to the selected provider." />
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button type="submit" variant="outlined" disabled={disableSearch}>Search web</Button>
        {provider === 'bing' && <Button type="button" disabled={disableSearch} onClick={() => search(true)}>Try DuckDuckGo</Button>}
        <Button type="button" disabled={!!busy || !query.trim()} onClick={() => void perform('Reading project Sources', async () => {
          const repository = new SourceRepository({ projectId, sessionId: null });
          const results = await repository.retrieve(query, { maxChunks: 8, maxChars: 4800 });
          if (active.current) setLocal(results);
          return results.length ? `Found ${results.length} saved passages.` : 'No matching saved passages in this project.';
        })}>Search saved Sources</Button>
      </Stack>
    </Stack>
    <details>
      <summary>Read a specific page</summary>
      <Stack component="form" direction="row" gap={1} sx={{ mt: 1 }} onSubmit={event => {
        event.preventDefault();
        if (disableRead || !query.trim() || !url.trim()) return;
        void perform('Retrieving page', async signal => {
          const id = await run.readUrl(url, query, signal);
          if (active.current) { setSelected(id); setCompareId(''); }
          return 'Retrieved the requested page.';
        }, true);
      }}>
        <TextField fullWidth size="small" type="url" label="Public HTTPS URL" value={url} onChange={event => setUrl(event.target.value)}
          helperText="The reader locates passages using the research query above." />
        <Button type="submit" variant="outlined" disabled={disableRead || !query.trim() || !url.trim()}>Read URL</Button>
      </Stack>
    </details>
    {busy && <Stack direction="row" gap={1} alignItems="center" role="status">
      <Typography>{busy}…</Typography>
      {['Searching the web', 'Retrieving page', 'Following reference'].includes(busy) &&
        <Button color="warning" onClick={() => pending.current?.abort()}>Stop</Button>}
    </Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    {notice && <Alert severity="info">{notice}</Alert>}
    {local?.length ? <details open>
      <summary>Saved passages · {local.length}</summary>
      {local.map(source => <div className="spica-evidence" key={source.chunkId}>
        <strong>{source.title}</strong><Typography fontSize={12}>{source.location}</Typography>
        {source.origin.kind === 'web' && <Typography fontSize={12} color="text.secondary">{source.origin.url} · {source.origin.readState === 'read' ? 'Retrieved' : 'Search hit'}</Typography>}
        <pre>{source.excerpt}</pre>
      </div>)}
    </details> : null}
    {snapshot.sources.length > 0 && <div className="spica-layout">
      <ul className="spica-warehouse-list spica-evidence-list" aria-label="Research observations">
        {snapshot.sources.map(source => <li key={source.id}>
          <button aria-pressed={selected === source.id} onClick={() => { setSelected(source.id); setCompareId(''); }}>
            <strong>{source.title || source.url}</strong>
            <span>{source.status === 'read' ? 'Retrieved' : source.status === 'unavailable' ? 'Unavailable' :
              source.origin === 'search' ? 'Search hit' : source.origin === 'reference' ? 'Reference' : 'Provided URL'}</span>
          </button>
        </li>)}
      </ul>
      <section className="spica-panel spica-warehouse-detail" aria-label="Retrieved evidence">
        {!observation ? <Typography color="text.secondary">Select an observation to inspect it.</Typography> : <>
          {observation.page ? <Evidence page={observation.page} /> : <>
            <Typography fontWeight={700}>{observation.title || observation.url}</Typography>
            <code>{observation.url}</code>
            {observation.diagnostic && <Alert severity="warning">{observation.diagnostic}</Alert>}
            {observation.excerpt && <Typography fontSize={13}>Search snippet · {observation.excerpt}</Typography>}
            <Button variant="outlined" disabled={disableRead} onClick={() => void perform('Retrieving page', async signal => {
              const page = await run.read(observation.id, signal);
              return page.text ? 'Retrieved the page and located matching passages.' : 'Page retrieved. No matching passages were returned.';
            }, true)}>{observation.status === 'unavailable' ? 'Retry page' : 'Read page'}</Button>
          </>}
          {observation.parentId && <Typography fontSize={12} color="text.secondary">Reference from {observation.parentId}</Typography>}
          {observation.page && <>
            {references.length > 0 && <details>
              <summary>Follow a returned reference</summary>
              {references.map(link => <Button size="small" key={link.url} disabled={disableRead} title={link.title}
                onClick={() => void perform('Following reference', async signal => {
                  const id = await run.follow(observation.id, link.url, signal);
                  if (active.current) { setSelected(id); setCompareId(''); }
                  return 'Retrieved the selected reference.';
                }, true)}>{link.title.length > 120 ? link.title.slice(0, 117) + '…' : link.title}</Button>)}
            </details>}
            <Button variant="outlined" disabled={!!busy || !observation.page.text.trim()} onClick={() => void perform('Saving source', async () => {
              const saved = await run.save(observation.id, projectId);
              return `Saved in project Sources · ${saved.title}`;
            })}>Save to Sources</Button>
          </>}
          {!!observation.page?.text && others.length > 0 && <TextField select size="small" label="Compare with" value={compareId}
            onChange={event => setCompareId(event.target.value)}>
            <MenuItem value="">Choose a retrieved page</MenuItem>
            {others.map(source => <MenuItem key={source.id} value={source.id}>{source.title || source.url}</MenuItem>)}
          </TextField>}
        </>}
      </section>
    </div>}
    {comparison && <section className="spica-panel" aria-label="Evidence comparison">
      <Typography fontWeight={700}>Compare retrieved passages</Typography>
      <Typography fontSize={13} color="text.secondary">
        {[comparison.sameExcerpt && 'Identical excerpt hash', comparison.sameHost && 'Same host', comparison.linked && 'Shared reference lineage'].filter(Boolean).join(' · ') || 'Two passages available for comparison'}
        {' · Assess source independence and whether each passage supports the claim.'}
      </Typography>
      <div className="spica-layout"><Evidence page={comparison.a} /><Evidence page={comparison.b} /></div>
    </section>}
  </section>;
}

function Evidence({ page }: { page: ResearchPage }) {
  return <div className="spica-evidence">
    <strong>{page.title || page.url}</strong>
    <code>{page.url}</code>
    <Typography fontSize={12} color="text.secondary">{page.locator} · Retrieved {page.retrievedAt}</Typography>
    <Typography fontSize={12} color="text.secondary">Excerpt SHA-256 · {page.contentHash.slice(0, 16)}</Typography>
    {page.text ? <pre>{page.text}</pre> : <Typography color="text.secondary">No matching passage returned.</Typography>}
  </div>;
}
