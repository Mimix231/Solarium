import { useState } from 'react';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { changeGraph, type Collection, type Graph, type GraphEdit } from '../spica/graph';
import { allCollections, blockRegistry, programFor, workflowId, type Flow, type Screen, type Step } from '../spica/program';

const actions = blockRegistry.filter(block => ['validate', 'set', 'save', 'navigate', 'status'].includes(block.id));

export function SpicaWorkflows({ graph, busy, onEdit }: {
  graph: Graph; busy: boolean; onEdit(edits: readonly GraphEdit[]): Promise<void>;
}) {
  const [id, setId] = useState('');
  const program = graph.program ?? programFor(graph);
  const selected = program.flows.find(flow => flow.id === id);
  const collections = allCollections(graph);
  return <section className="spica-panel" aria-label="Workflow editor">
    <Typography variant="h6">Workflows</Typography>
    {!collections.length ? <Typography color="text.secondary">Add a collection or install a record recipe to build submit flows.</Typography> : <>
      <TextField select size="small" label="Workflow" value={selected?.id ?? ''} onChange={event => setId(event.target.value)}>
        <MenuItem value="">New workflow</MenuItem>
        {program.flows.map(flow => <MenuItem key={flow.id} value={flow.id}>{flow.id}</MenuItem>)}
      </TextField>
      <FlowEditor key={selected ? JSON.stringify(selected) : 'new'} initial={selected} graph={graph} collections={collections} screens={program.screens} busy={busy}
        onSave={async (flow, screen) => {
          await onEdit([{ op: 'put_flow', flow }, ...(screen ? [{ op: 'put_screen', screen } as const] : [])]);
          setId(flow.id);
        }} />
    </>}
  </section>;
}

function FlowEditor({ initial, graph, collections, screens, busy, onSave }: {
  initial?: Flow; graph: Graph; collections: Collection[]; screens: Screen[]; busy: boolean;
  onSave(flow: Flow, screen?: Screen): Promise<void>;
}) {
  const [id, setId] = useState(initial?.id ?? '');
  const [collectionId, setCollection] = useState(initial?.collection ?? collections[0]?.id ?? '');
  const [steps, setSteps] = useState<Step[]>(initial?.steps ?? []);
  const [action, setAction] = useState('validate');
  const [formLabel, setFormLabel] = useState('');
  const [error, setError] = useState('');
  const collection = collections.find(item => item.id === collectionId);
  const bound = screens.filter(screen => screen.view === 'form' && screen.submit === id);
  const screen = formLabel.trim() && !bound.length && collection
    ? { id: `${id.slice(0, 35)}_form`, view: 'form' as const, label: formLabel.trim(), collection: collection.id,
        fields: collection.fields.map(field => field.key), submit: id }
    : undefined;
  const changed = !initial || JSON.stringify(initial.steps) !== JSON.stringify(steps) || Boolean(screen);

  function addStep() {
    if (!collection || steps.length >= 32) return;
    let n = 1;
    while (steps.some(step => step.id === `step_${n}`)) n++;
    const stepId = `step_${n}`;
    const first = collection.fields[0];
    const destination = screens[0]?.id ?? screen?.id;
    let next: Step;
    switch (action) {
      case 'save': next = { id: stepId, action }; break;
      case 'navigate':
        if (!destination) { setError('Add a destination screen before adding navigation.'); return; }
        next = { id: stepId, action, screen: destination };
        break;
      case 'status': next = { id: stepId, action, text: 'Done' }; break;
      case 'set':
        if (!first) { setError('Add a field before adding a field assignment.'); return; }
        next = { id: stepId, action, field: first.key, value: first.initial };
        break;
      default: next = { id: stepId, action: 'validate' };
    }
    setError('');
    setSteps(current => [...current, next]);
  }

  function move(index: number, direction: number) {
    setSteps(current => {
      const next = current.slice();
      const [step] = next.splice(index, 1);
      if (step) next.splice(index + direction, 0, step);
      return next;
    });
  }

  return <Stack component="form" gap={2} onSubmit={event => {
    event.preventDefault();
    if (!collection || !changed) return;
    const flow: Flow = { id, collection: collection.id, steps };
    try {
      if (!initial && graph.program?.flows.some(item => item.id === id)) throw Error('Choose an unused workflow ID.');
      if (screen && screens.some(item => item.id === screen.id)) throw Error('A screen already uses the generated form ID.');
      changeGraph(graph, [{ op: 'put_flow', flow }, ...(screen ? [{ op: 'put_screen', screen } as const] : [])]);
      setError('');
      void onSave(flow, screen);
    } catch (reason) { setError(String(reason)); }
  }}>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <TextField size="small" label="Workflow ID" value={id} disabled={!!initial || busy} onChange={event => setId(event.target.value)}
        slotProps={{ htmlInput: { maxLength: 40 } }} helperText="Lowercase letters, numbers, and underscores" />
      <TextField select size="small" label="Collection" value={collectionId} disabled={!!initial || busy} onChange={event => {
        setCollection(event.target.value);
        setSteps([]);
      }}>
        {collections.map(item => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
      </TextField>
      {bound.length ? <Typography alignSelf="center" fontSize={13}>Submit from {bound.map(item => item.label).join(', ')}</Typography> :
        <TextField size="small" label="New form label (optional)" value={formLabel} disabled={busy} onChange={event => setFormLabel(event.target.value)}
          helperText="Connect a form to this workflow" slotProps={{ htmlInput: { maxLength: 100 } }} />}
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {steps.some(step => step.action === 'save') && graph.program && !graph.program.grants.includes('records.write') &&
      <Alert severity="warning">Saving requires the records.write grant.</Alert>}
    {!steps.length && <Typography color="text.secondary">Add an action to begin the workflow.</Typography>}
    {collection && steps.length > 0 && <ol className="spica-flow-steps">
      {steps.map((step, index) => <li key={step.id}>
        <div className="spica-heading">
          <strong>{index + 1}. {actions.find(item => item.id === step.action)?.label}</strong>
          <Stack direction="row">
            <Button type="button" size="small" aria-label={`Move action ${index + 1} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</Button>
            <Button type="button" size="small" aria-label={`Move action ${index + 1} down`} disabled={busy || index === steps.length - 1} onClick={() => move(index, 1)}>↓</Button>
            <Button type="button" size="small" color="warning" disabled={busy} aria-label={`Remove action ${index + 1}`} onClick={() =>
              setSteps(current => current.filter(item => item.id !== step.id))}>Remove</Button>
          </Stack>
        </div>
        <StepFields step={step} collection={collection} screens={screen ? [...screens, screen] : screens} busy={busy}
          onChange={next => setSteps(current => current.map(item => item.id === step.id ? next : item))} />
      </li>)}
    </ol>}
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
      <TextField select size="small" label="Action" value={action} disabled={busy} onChange={event => setAction(event.target.value)}>
        {actions.map(item => <MenuItem key={item.id} value={item.id}>{item.label}</MenuItem>)}
      </TextField>
      <Button type="button" disabled={busy || steps.length >= 32} onClick={addStep}>Add action</Button>
      <Button type="submit" variant="contained" disabled={busy || !changed || !workflowId(id) || !steps.length}>Save workflow</Button>
    </Stack>
  </Stack>;
}

function StepFields({ step, collection, screens, busy, onChange }: {
  step: Step; collection: Collection; screens: Screen[]; busy: boolean; onChange(step: Step): void;
}) {
  if (step.action === 'status') return <TextField size="small" label="Status message" value={step.text} disabled={busy}
    slotProps={{ htmlInput: { maxLength: 100 } }} onChange={event => onChange({ ...step, text: event.target.value })} />;
  if (step.action === 'navigate') return <TextField select size="small" label="Destination screen" value={step.screen} disabled={busy}
    onChange={event => onChange({ ...step, screen: event.target.value })}>
    {screens.map(screen => <MenuItem key={screen.id} value={screen.id}>{screen.label}</MenuItem>)}
  </TextField>;
  if (step.action !== 'set') return null;
  const field = collection.fields.find(item => item.key === step.field);
  return <Stack direction="row" gap={1} flexWrap="wrap">
    <TextField select size="small" label="Field" value={step.field} disabled={busy} onChange={event => {
      const next = collection.fields.find(item => item.key === event.target.value);
      if (next) onChange({ ...step, field: next.key, value: next.initial });
    }}>
      {collection.fields.map(item => <MenuItem key={item.key} value={item.key}>{item.label}</MenuItem>)}
    </TextField>
    {field?.type === 'boolean' ? <TextField select size="small" label="Value" value={String(step.value)} disabled={busy}
      onChange={event => onChange({ ...step, value: event.target.value === 'true' })}>
      <MenuItem value="true">True</MenuItem><MenuItem value="false">False</MenuItem>
    </TextField> : <TextField size="small" label={field?.type === 'reference' ? 'Record ID (optional)' : 'Value'}
      value={step.value ?? ''} disabled={busy} type={field?.type === 'reference' ? 'number' : 'text'}
      onChange={event => onChange({ ...step, value: field?.type === 'reference' ? (event.target.value ? Number(event.target.value) : null) : event.target.value })} />}
  </Stack>;
}
