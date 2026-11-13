import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { ensureCatalog, inspectCatalog, searchCatalog, listCatalogCategories, registerCatalogCategory, type CatalogCategory, type CatalogCounts, type CatalogEntry, type CatalogPage } from '../spica/catalog/client';
import { warehouseCapacity, warehouseCategories } from '../spica/catalog/categories';
import type { Graph, GraphEdit } from '../spica/graph';
import type { Target } from '../spica/program';
import { browseSpicaWarehouse, inspectSpicaComponent, registeredWarehouseCounts, type WarehouseCandidate } from '../spica/warehouse';

const pageSize = 8;
const number = new Intl.NumberFormat();
type Mode = 'registered' | 'descriptors' | 'profiles';
type Candidate = CatalogEntry | WarehouseCandidate;
type Selected = Pick<Candidate, 'id' | 'version'>;

function candidateStatus(candidate: Candidate) {
  if (candidate.maturity === 'draft') return 'Draft';
  if ('executableNow' in candidate && candidate.executableNow) return 'Runnable for target';
  if ('installableNow' in candidate && candidate.installableNow) return 'Available recipe';
  return 'Needs setup';
}

export function SpicaWarehouse({ graph, busy, onEdit }: {
  graph: Graph; busy: boolean; onEdit(edits: readonly GraphEdit[]): Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>('registered');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<number | null>(null);
  const [target, setTarget] = useState<Target>('desktop');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [draft, setDraft] = useState<CatalogEntry | null>(null);
  const [draftPage, setDraftPage] = useState<CatalogPage | null>(null);
  const [counts, setCounts] = useState<CatalogCounts | null>(null);
  const [retry, setRetry] = useState(0);
  const [catalogError, setCatalogError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [inspectError, setInspectError] = useState('');
  const [installReview, setInstallReview] = useState(false);
  const [categoryList, setCategoryList] = useState<CatalogCategory[]>([]);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [registeringCategory, setRegisteringCategory] = useState(false);
  const categories = useMemo(() => new Map([...warehouseCategories.map(item => [item.id, item.title] as const),
    ...categoryList.map(item => [item.id, item.title] as const)]), [categoryList]);
  const categoriesForPicker = categoryList.length ? categoryList : warehouseCategories;
  const displayedCapacity = categoryList.length ? categoryList.reduce((sum, category) => sum + category.capacity, 0) : warehouseCapacity;
  const registered = mode === 'registered';

  useEffect(() => {
    let active = true;
    setCatalogError('');
    void ensureCatalog().then(async value => {
      if (active) setCounts(value);
      try { const savedCategories = await listCatalogCategories(); if (active) setCategoryList(savedCategories); }
      catch { /* Native index unavailable; show the read-only bundled categories. */ }
    })
      .catch(error => { if (active) setCatalogError(String(error)); });
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    if (registered || !counts) return;
    let active = true;
    setDraftPage(null);
    setSearchError('');
    void searchCatalog(query, category, offset, pageSize, mode === 'profiles' ? 'profile' : 'primitive')
      .then(value => { if (active) setDraftPage(value); })
      .catch(error => { if (active) setSearchError(String(error)); });
    return () => { active = false; };
  }, [category, counts, mode, offset, query, registered, retry]);

  useEffect(() => {
    if (!selected || registered) return;
    let active = true;
    void inspectCatalog(selected.id, selected.version).then(value => { if (active) setDraft(value); })
      .catch(error => { if (active) setInspectError(String(error)); });
    return () => { active = false; };
  }, [registered, selected]);

  const local = useMemo(() => registered
    ? browseSpicaWarehouse(graph, { query, target, category: category ?? undefined, offset, limit: pageSize })
    : null, [category, graph, offset, query, registered, target]);
  const entries = registered ? local?.candidates ?? [] : draftPage?.candidates ?? [];
  const total = registered ? local?.totalMatches ?? 0 : draftPage?.total ?? 0;
  const component = registered && selected ? inspectSpicaComponent(graph, selected.id, selected.version, target) : null;
  const loading = !registered && (!counts || !draftPage) && !catalogError && !searchError;

  function select(entry: Selected | null) {
    setSelected(entry);
    setDraft(null);
    setInspectError('');
    setInstallReview(false);
  }
  function resetPage() {
    setOffset(0);
    select(null);
  }

  return <section className="spica-panel spica-warehouse" aria-label="Component warehouse">
    <div className="spica-heading">
      <div>
        <Typography variant="h6">Component warehouse</Typography>
        <Typography color="text.secondary" fontSize={13}>
          {registeredWarehouseCounts.adapters} registered adapters · {registeredWarehouseCounts.recipes} recipes
          {counts && ` · ${number.format(counts.entries)} indexed drafts, including ${number.format(counts.profiles)} research profiles`}
        </Typography>
      </div>
      <Stack direction="row" gap={1} alignItems="center">
        <Chip size="small" label={`${categoriesForPicker.length} categories · ${number.format(displayedCapacity)} planned capacity`} />
        <Button size="small" variant="outlined" disabled={!counts} onClick={() => setCategoryDialog(true)}>New category</Button>
      </Stack>
    </div>
    {catalogError && <Alert severity="warning" action={<Button onClick={() => setRetry(value => value + 1)}>Retry</Button>}>{catalogError}</Alert>}
    <Stack direction="row" flexWrap="wrap" gap={1} role="group" aria-label="Warehouse collection">
      {([['registered', 'Registered'], ['descriptors', 'Draft blocks'], ['profiles', 'Research profiles']] as const).map(([id, label]) =>
        <Button key={id} aria-pressed={mode === id} variant={mode === id ? 'contained' : 'outlined'} onClick={() => {
          if (mode === id) return;
          setMode(id);
          setCategory(null);
          resetPage();
        }}>{label}</Button>)}
    </Stack>
    <div className="spica-warehouse-filters">
      <Stack component="form" direction="row" gap={1} onSubmit={event => {
        event.preventDefault();
        setQuery(input.trim());
        resetPage();
      }}>
        <TextField fullWidth size="small" label="Search components" value={input} onChange={event => setInput(event.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
        <Button type="submit" variant="outlined">Search</Button>
      </Stack>
      {mode !== 'profiles' && <TextField select size="small" label="Category" value={category ?? ''} onChange={event => {
        setCategory(Number(event.target.value) || null);
        resetPage();
      }}>
        <MenuItem value="">All categories</MenuItem>
        {categoriesForPicker.map(item => <MenuItem key={item.id} value={item.id}>{item.id}. {item.title}</MenuItem>)}
      </TextField>}
      {registered && <TextField select size="small" label="Target" value={target} onChange={event => {
        setTarget(event.target.value === 'web' ? 'web' : 'desktop');
        resetPage();
      }}><MenuItem value="desktop">Desktop</MenuItem><MenuItem value="web">Web</MenuItem></TextField>}
    </div>
    {searchError && <Alert severity="error">{searchError}</Alert>}
    <div className="spica-layout">
      <div className="spica-warehouse-results">
        <Typography fontSize={12} color="text.secondary" role="status">{loading ? 'Reading local index…' :
          searchError || (!registered && !counts) ? 'Search unavailable' :
          total ? `${offset + 1}–${offset + entries.length} of ${number.format(total)} matches` : 'No matches'}</Typography>
        <ul className="spica-warehouse-list">
          {entries.map(entry => <li key={entry.id}>
            <button type="button" aria-pressed={selected?.id === entry.id} onClick={() => select({ id: entry.id, version: entry.version })}>
              <strong>{entry.title}</strong><span>{candidateStatus(entry)}</span>
            </button>
          </li>)}
        </ul>
        <Stack direction="row" gap={1}>
          <Button size="small" disabled={!offset || loading} onClick={() => { setOffset(offset - pageSize); select(null); }}>Previous</Button>
          <Button size="small" disabled={loading || offset + pageSize >= total} onClick={() => { setOffset(offset + pageSize); select(null); }}>Next</Button>
        </Stack>
      </div>
      <section className="spica-panel spica-warehouse-detail" aria-label="Component details">
        {inspectError ? <Alert severity="error">{inspectError}</Alert> : component ? <>
          <Typography fontWeight={700}>{component.title}</Typography>
          <code>{component.id}@{component.version}</code>
          <Typography fontSize={13}>{component.summary}</Typography>
          <Typography fontSize={12} color="text.secondary">{categories.get(component.primaryCategoryId)} · {component.maturity} · {component.targets.join(', ')}</Typography>
          <Typography fontSize={13}>Input · {component.inputs.join(', ')}<br />Output · {component.outputs.join(', ')}</Typography>
          {component.dependencies.length > 0 && <details><summary>Versioned dependencies</summary><ul>
            {component.dependencies.map(dep => <li key={dep.id}><code>{dep.id}@{dep.version}</code></li>)}
          </ul></details>}
          {component.blockedReasons.length > 0 && <ul>{component.blockedReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
          <Typography fontSize={13}>Graph capabilities · {component.permissions.join(', ') || 'None required'}</Typography>
          {component.installableNow && component.recipeId && (installReview ? <>
            <Alert severity="info">Install {component.title} with the graph changes in its recipe. Required capabilities appear above.</Alert>
            <Stack direction="row" gap={1}>
              <Button variant="contained" disabled={busy} onClick={() => {
                const recipe = component.recipeId;
                if (recipe) void onEdit([{ op: 'install_recipe', recipe }]);
                setInstallReview(false);
              }}>Confirm install</Button>
              <Button onClick={() => setInstallReview(false)}>Cancel</Button>
            </Stack>
          </> : <Button variant="outlined" disabled={busy} onClick={() => setInstallReview(true)}>Review recipe install</Button>)}
        </> : draft ? <>
          <Typography fontWeight={700}>{draft.title}</Typography>
          <code>{draft.id}@{draft.version}</code>
          <Typography fontSize={13}>{draft.summary}</Typography>
          <Typography fontSize={12} color="text.secondary">{categories.get(draft.category)} · {draft.reference}</Typography>
          <Alert severity="info">Draft metadata. Execution requires a registered adapter and the applicable graph grants.</Alert>
        </> : <Typography color="text.secondary">{selected ? 'Reading descriptor…' : 'Select a component to inspect its contract.'}</Typography>}
      </section>
    </div>
    <Dialog open={categoryDialog} onClose={() => !registeringCategory && setCategoryDialog(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Create metadata category</DialogTitle>
      <DialogContent>
        <Typography fontSize={13} color="text.secondary" sx={{ mb: 1.5 }}>
          This creates a searchable catalog namespace with space for 10,000 entries. It does not create executable blocks.
        </Typography>
        <TextField fullWidth autoFocus label="Category name" size="small" value={categoryName}
          onChange={event => { setCategoryName(event.target.value); setCategoryError(''); }}
          slotProps={{ htmlInput: { maxLength: 100 } }} />
        {categoryError && <Alert severity="error" sx={{ mt: 1 }}>{categoryError}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={registeringCategory} onClick={() => setCategoryDialog(false)}>Cancel</Button>
        <Button variant="contained" disabled={registeringCategory || categoryName.trim().length < 2} onClick={() => {
          const title = categoryName.trim();
          const slug = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          if (slug.length < 2 || slug.length > 60) { setCategoryError('Use a category name with 2–60 URL-safe characters.'); return; }
          setRegisteringCategory(true);
          void registerCatalogCategory({ slug, title }).then(async () => {
            setCategoryList(await listCatalogCategories()); setCategoryDialog(false); setCategoryName('');
            setRetry(value => value + 1);
          }).catch(error => setCategoryError(String(error))).finally(() => setRegisteringCategory(false));
        }}>Create</Button>
      </DialogActions>
    </Dialog>
  </section>;
}
