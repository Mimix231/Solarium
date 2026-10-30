import { useRef, useState } from 'react';
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { SectionTitle } from '../components/SectionTitle';
import { useSolarium } from '../state/useSolarium';
import { uid, type LabCase } from '../domain/types';
import { composeSparkInstructions } from '../domain/persona';
import { adapterFor } from '../engine/backends';
export function Laboratory() {
  const { workspace, mutate } = useSolarium();
  const [sparkId, setSparkId] = useState(workspace.selectedSparkId);
  const [modelId, setModelId] = useState(workspace.models[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  function addCase() { mutate((w) => { (w.labCases ??= []).push({ id: uid(), sparkId, title: 'Personality test', prompt: 'Introduce yourself in character.', expectedPhrases: [] }); }); }
  function patch(id: string, change: (item: LabCase) => void) { mutate((w) => { const item = (w.labCases ?? []).find((c) => c.id === id); if (item) change(item); }); }
  async function run(id: string) {
    const selected = workspace.labCases?.find((c) => c.id === id);
    const spark = workspace.sparks.find((s) => s.id === sparkId);
    const model = workspace.models.find((m) => m.id === modelId);
    if (!selected || !spark || !model) { setError('Choose a Spark and a running model before testing.'); return; }
    const controller = new AbortController(); abort.current = controller; setBusy(true); setError('');
    try {
      const adapter = adapterFor(model);
      const metadata = await adapter.inspect(model, controller.signal);
      const generated = await adapter.generate(model, [
        { role: 'system', content: composeSparkInstructions(spark, 'conversation', workspace.memories, workspace.worlds ?? [], selected.prompt) },
        { role: 'user', content: selected.prompt },
      ], metadata.capabilities, { answer: () => undefined, reasoning: () => undefined }, controller.signal);
      patch(id, (item) => { item.lastResponse = generated.answer; });
    } catch (err) { if (!controller.signal.aborted) setError(String(err)); }
    finally { abort.current = null; setBusy(false); }
  }
  const tests = (workspace.labCases ?? []).filter((c) => c.sparkId === sparkId);
  return <Box className="view-scroll page-padding"><SectionTitle eyebrow="PERSONALITY QUALITY" title="Spark Laboratory" description="Save repeatable persona tests, run them against a real local model, inspect the answers, and rate them yourself. No invented personality accuracy scores." action={<Button variant="contained" onClick={addCase}>New test case</Button>}/>
    {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack direction="row" gap={1} mb={2} flexWrap="wrap"><FormControl size="small" sx={{ minWidth: 170 }}><InputLabel>Spark</InputLabel><Select label="Spark" value={sparkId} onChange={(e) => setSparkId(e.target.value)}>{workspace.sparks.map((s) => <MenuItem value={s.id} key={s.id}>{s.name}</MenuItem>)}</Select></FormControl><FormControl size="small" sx={{ minWidth: 210 }}><InputLabel>Local model</InputLabel><Select label="Local model" value={modelId} onChange={(e) => setModelId(e.target.value)}>{workspace.models.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}</Select></FormControl>{busy && <Button onClick={() => abort.current?.abort()}>Stop test</Button>}</Stack>
    {tests.map((item) => <Box className="glass panel" key={item.id} sx={{ maxWidth: 880, mb: 2 }}><Stack gap={1}><TextField label="Test title" value={item.title} onChange={(e) => patch(item.id, (c) => { c.title = e.target.value; })}/><TextField fullWidth multiline minRows={2} label="Prompt" value={item.prompt} onChange={(e) => patch(item.id, (c) => { c.prompt = e.target.value; })}/><TextField label="Expected phrases (comma separated, optional)" value={item.expectedPhrases.join(', ')} onChange={(e) => patch(item.id, (c) => { c.expectedPhrases = e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20); })}/><Stack direction="row" gap={1} alignItems="center"><Button variant="contained" disabled={busy} onClick={() => void run(item.id)}>Run test</Button><Button color="error" onClick={() => mutate((w) => { w.labCases = (w.labCases ?? []).filter((c) => c.id !== item.id); })}>Delete</Button></Stack>{item.lastResponse !== undefined && <Box className="lab-response"><Typography fontSize={11} fontWeight={800} mb={1}>Actual model response</Typography><Typography fontSize={12} whiteSpace="pre-wrap">{item.lastResponse}</Typography><Stack mt={1} direction="row" flexWrap="wrap" gap={.5}>{item.expectedPhrases.map((phrase) => <Chip key={phrase} size="small" color={item.lastResponse?.toLowerCase().includes(phrase.toLowerCase()) ? 'success' : 'warning'} label={`${item.lastResponse?.toLowerCase().includes(phrase.toLowerCase()) ? '✓' : '×'} ${phrase}`}/>)}</Stack><Typography mt={1.5} fontSize={11}>Your rating</Typography><Stack direction="row" gap={.5}>{[1,2,3,4,5].map((rating) => <Button size="small" variant={item.rating === rating ? 'contained' : 'outlined'} key={rating} onClick={() => patch(item.id, (c) => { c.rating = rating; })}>{rating}</Button>)}</Stack></Box>}</Stack></Box>)}
    {!tests.length && <Typography color="text.secondary">Create a test to compare how consistently this Spark follows its personality.</Typography>}
  </Box>;
}
