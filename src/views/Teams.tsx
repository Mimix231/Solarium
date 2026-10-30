import { useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { SectionTitle } from '../components/SectionTitle';
import { useSolarium } from '../state/useSolarium';
import { now, uid, type TeamRun } from '../domain/types';
import { composeSparkInstructions } from '../domain/persona';
import { adapterFor } from '../engine/backends';
/** Sequential real inference: one GPU model can serve multiple Spark roles. */
export function Teams() {
  const { workspace, mutate } = useSolarium();
  const [task, setTask] = useState('');
  const [modelId, setModelId] = useState(workspace.models[0]?.id ?? '');
  const [sparkIds, setSparkIds] = useState<string[]>(workspace.sparks.map((s) => s.id).slice(0, 3));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  async function start() {
    const model = workspace.models.find((m) => m.id === modelId);
    if (!model || !sparkIds.length || !task.trim()) { setError('Select a loaded model, Sparks and a task.'); return; }
    const run: TeamRun = { id: uid(), title: task.slice(0, 70), task, modelId, sparkIds, createdAt: now(), steps: [] };
    mutate((w) => { (w.teamRuns ??= []).push(run); });
    const controller = new AbortController(); abort.current = controller; setBusy(true); setError('');
    try {
      const adapter = adapterFor(model);
      const metadata = await adapter.inspect(model, controller.signal);
      let prior = '';
      for (const sparkId of sparkIds) {
        if (controller.signal.aborted) break;
        const spark = workspace.sparks.find((s) => s.id === sparkId); if (!spark) continue;
        const prompt = `Team objective:\n${task}\n\nPrevious Spark outputs (review and build on these, do not pretend to have executed tools):\n${prior.slice(-8000)}\n\nProvide your own concrete contribution to the task.`;
        try {
          const result = await adapter.generate(model, [
            { role: 'system', content: composeSparkInstructions(spark, 'work', workspace.memories, workspace.worlds ?? [], task) },
            { role: 'user', content: prompt },
          ], metadata.capabilities, { answer: () => undefined, reasoning: () => undefined }, controller.signal);
          prior += `\n${spark.name}: ${result.answer.slice(0, 6000)}`;
          mutate((w) => { (w.teamRuns ?? []).find((r) => r.id === run.id)?.steps.push({ sparkId, content: result.answer }); });
        } catch (err) {
          if (controller.signal.aborted) break;
          mutate((w) => { (w.teamRuns ?? []).find((r) => r.id === run.id)?.steps.push({ sparkId, content: '', error: String(err) }); });
          throw err;
        }
      }
    } catch (err) { if (!controller.signal.aborted) setError(String(err)); }
    finally { abort.current = null; setBusy(false); }
  }
  return <Box className="view-scroll page-padding"><SectionTitle eyebrow="MULTI-SPARK WORKSPACE" title="Spark Teams" description="Different identities collaborate in sequence through one running local model. Each contribution comes from actual inference—not fabricated agent activity." />
    <Box className="glass panel" sx={{ maxWidth: 920, mb: 2 }}><Stack gap={1.2}><TextField fullWidth multiline minRows={3} label="Team objective" value={task} onChange={(e) => setTask(e.target.value)}/><FormControl size="small" sx={{ maxWidth: 300 }}><InputLabel>Running local model</InputLabel><Select value={modelId} label="Running local model" onChange={(e) => setModelId(e.target.value)}>{workspace.models.map((m) => <MenuItem value={m.id} key={m.id}>{m.name}</MenuItem>)}</Select></FormControl><Typography fontWeight={750} fontSize={12}>Run order (up to 4 Sparks)</Typography><Stack direction="row" gap={1} flexWrap="wrap">{workspace.sparks.map((spark) => <Button key={spark.id} variant={sparkIds.includes(spark.id) ? 'contained' : 'outlined'} startIcon={<Checkbox size="small" checked={sparkIds.includes(spark.id)} />} onClick={() => setSparkIds((ids) => ids.includes(spark.id) ? ids.filter((id) => id !== spark.id) : ids.length < 4 ? [...ids, spark.id] : ids)}>{spark.name}</Button>)}</Stack><Typography fontSize={11} color="text.secondary">The model must already be running. Reusing one engine is safer for a 12 GB GPU than loading multiple models.</Typography><Stack direction="row" gap={1}><Button variant="contained" disabled={busy || !task.trim() || !sparkIds.length || !modelId} onClick={() => void start()}>Run team</Button>{busy && <Button onClick={() => abort.current?.abort()}>Stop</Button>}</Stack></Stack></Box>
    {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
    {[...(workspace.teamRuns ?? [])].reverse().map((run) => <Box key={run.id} className="glass panel" sx={{ maxWidth: 920, mb: 2 }}><Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={800}>{run.title}</Typography><Chip size="small" label={`${run.steps.length}/${run.sparkIds.length} contributions`}/></Stack><Typography color="text.secondary" fontSize={11} my={1}>{run.task}</Typography>{run.steps.map((step, index) => <Box key={`${step.sparkId}-${index}`} className="lab-response" sx={{ mt: 1 }}><Typography fontWeight={700} fontSize={12} mb={1}>{index + 1}. {workspace.sparks.find((s) => s.id === step.sparkId)?.name ?? 'Spark'}</Typography><Typography fontSize={12} whiteSpace="pre-wrap">{step.error || step.content}</Typography></Box>)}<Button size="small" color="error" onClick={() => mutate((w) => { w.teamRuns = (w.teamRuns ?? []).filter((r) => r.id !== run.id); })}>Remove report</Button></Box>)}
  </Box>;
}
