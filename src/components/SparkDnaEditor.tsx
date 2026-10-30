import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Select, Slider, Stack, TextField, Typography } from '@mui/material';
import UploadRounded from '@mui/icons-material/UploadRounded';
import ScienceRounded from '@mui/icons-material/ScienceRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import { composeSparkInstructions } from '../domain/persona';
import { traitNames, uid, type Spark, type SparkDNA, type SparkMode, type LocalModel } from '../domain/types';
import { adapterFor } from '../engine/backends';

const blank: SparkDNA = { mode: 'simple', raw: '', identity: '', speech: '', behavior: '', relationships: '', workStyle: '', boundaries: '' };
const advanced: { key: keyof Omit<SparkDNA, 'mode' | 'raw'>; label: string; hint: string }[] = [
  { key: 'identity', label: 'Identity and background', hint: 'Origins, context, signature beliefs.' },
  { key: 'speech', label: 'Voice and vocabulary', hint: 'Tone, grammar, favorite phrases, pacing.' },
  { key: 'behavior', label: 'Behavior and habits', hint: 'How the Spark reacts and what it consistently does.' },
  { key: 'relationships', label: 'Relationship style', hint: 'Familiarity, boundaries, approach to the user.' },
  { key: 'workStyle', label: 'Approach to work', hint: 'Research, coding, problem solving, rigor.' },
  { key: 'boundaries', label: 'Character boundaries', hint: 'Personality behaviors the Spark should avoid.' },
];
interface Props {
  spark: Spark;
  models: LocalModel[];
  update: (patch: Partial<Spark>) => void;
}
export function SparkDnaEditor({ spark, models, update }: Props) {
  const dna = spark.dna ?? blank;
  const testingModel = models.find((m) => m.id === spark.preferredModelId) ?? models[0];
  const personaTokenEstimate = Math.ceil(composeSparkInstructions(spark, 'conversation', []).length / 4);
  const [mode, setMode] = useState<SparkMode>('conversation');
  const [showPreview, setShowPreview] = useState(false);
  const [probe, setProbe] = useState('Hello! Tell me what fascinates you most.');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const updateDna = (patch: Partial<SparkDNA>) => update({ dna: { ...blank, ...dna, ...patch } });
  async function importRaw(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 64_000) throw new Error('Personality text must be smaller than 64 KB.');
      if (!/\.(txt|md)$/i.test(file.name)) throw new Error('Please choose a .txt or .md file.');
      updateDna({ mode: 'raw', raw: await file.text() }); setError('');
    } catch (e) { setError(String(e)); }
  }
  async function testSpark() {
    const model = models.find((m) => m.id === spark.preferredModelId) ?? models[0];
    if (!model) { setError('Register a local inference model first to test this Spark.'); return; }
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError(''); setResult('');
    try {
      const adapter = adapterFor(model);
      const info = await adapter.inspect(model, abort.signal);
      if (info.ids.length && !info.ids.includes(model.modelId)) throw new Error(`The loaded model is not ${model.modelId}.`);
      await adapter.generate(model, [
        { role: 'system', content: composeSparkInstructions(spark, mode, []) },
        { role: 'user', content: probe },
      ], { ...info.capabilities, tools: 'unknown' }, {
        answer: (delta) => setResult((s) => s + delta), reasoning: () => undefined,
      }, abort.signal);
    } catch (e) { if (!abort.signal.aborted) setError(String(e)); }
    finally { if (controller.current === abort) { controller.current = null; setBusy(false); } }
  }
  return <Stack gap={1.6}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
      <Box><Typography fontSize={14} fontWeight={800}>Spark DNA</Typography><Typography color="text.secondary" fontSize={11}>Your written personality stays intact. Sliders never overwrite raw personality text.</Typography></Box>
      <FormControl size="small" sx={{ width: 190 }}><InputLabel>Editor mode</InputLabel><Select label="Editor mode" value={dna.mode} onChange={(e) => updateDna({ mode: e.target.value as SparkDNA['mode'] })}>
        <MenuItem value="simple">Simple traits</MenuItem><MenuItem value="advanced">Advanced categories</MenuItem><MenuItem value="raw">Raw personality</MenuItem>
      </Select></FormControl>
    </Stack>
    {dna.mode === 'simple' && <><Box className="trait-grid">{traitNames.map((trait) => <Box key={trait} px={1}><Stack direction="row" justifyContent="space-between"><Typography fontSize={12} textTransform="capitalize">{trait}</Typography><Typography color="text.secondary" fontSize={11}>{spark.traits[trait]}</Typography></Stack><Slider value={spark.traits[trait]} size="small" onChange={(_, value) => update({ traits: { ...spark.traits, [trait]: value as number } })} aria-label={trait} /></Box>)}</Box>
      <TextField label="Additional character instructions" multiline minRows={4} fullWidth value={spark.instructions} onChange={(e) => update({ instructions: e.target.value })} /></>}
    {dna.mode === 'advanced' && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 1.2 }}>
      {advanced.map(({ key, label, hint }) => <TextField key={key} label={label} helperText={hint} multiline minRows={3} fullWidth value={dna[key]} onChange={(e) => updateDna({ [key]: e.target.value })} />)}
    </Box>}
    {dna.mode === 'raw' && <>
      <Typography color="text.secondary" fontSize={11}>Paste up to 64,000 characters. This is the primary personality source; you can use headings, Markdown, behavioral rules, and long-form character descriptions.</Typography>
      <TextField label="Full personality instructions" placeholder="# Personality\nDescribe exactly how this Spark should behave…" multiline minRows={12} maxRows={24} fullWidth value={dna.raw} onChange={(e) => updateDna({ raw: e.target.value.slice(0, 64_000) })}
        sx={{ '& textarea': { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', fontSize: 12, lineHeight: 1.7 } }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography fontSize={11} color="text.secondary">{dna.raw.length.toLocaleString()} / 64,000 characters</Typography>
        <input type="file" accept=".txt,.md,text/plain,text/markdown" hidden ref={upload} onChange={(e) => void importRaw(e)} />
        <Button size="small" startIcon={<UploadRounded />} onClick={() => upload.current?.click()}>Import .txt / .md</Button></Stack>
    </>}
    {testingModel && personaTokenEstimate > testingModel.contextSize * .65 && <Alert severity="warning">Personality prompt is approximately {personaTokenEstimate.toLocaleString()} tokens for a configured {testingModel.contextSize.toLocaleString()}-token context. This estimate is not a tokenizer measurement. Shorten the persona or increase context to leave room for conversation.</Alert>}
    <Divider />
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography fontSize={13} fontWeight={750}>Example conversations <Chip label={spark.examples.length} size="small" /></Typography>
      <Button size="small" startIcon={<AddRounded />} disabled={spark.examples.length >= 20} onClick={() => update({ examples: [...spark.examples, { id: uid(), user: '', assistant: '' }] })}>Add example</Button>
    </Stack>
    {spark.examples.map((example) => <Box key={example.id} className="example-card"><Stack gap={1}>
      <TextField label="User example" fullWidth value={example.user} onChange={(e) => update({ examples: spark.examples.map((x) => x.id === example.id ? { ...x, user: e.target.value } : x) })} />
      <TextField label="Expected Spark response" multiline minRows={2} fullWidth value={example.assistant} onChange={(e) => update({ examples: spark.examples.map((x) => x.id === example.id ? { ...x, assistant: e.target.value } : x) })} />
      <Button size="small" color="error" sx={{ alignSelf: 'end' }} onClick={() => update({ examples: spark.examples.filter((x) => x.id !== example.id) })}>Remove</Button>
    </Stack></Box>)}
    <Divider />
    <Stack direction="row" alignItems="center" justifyContent="space-between"><Typography fontSize={13} fontWeight={750}>Personality inspection and test</Typography><Button onClick={() => setShowPreview((x) => !x)} size="small">{showPreview ? 'Hide compiled prompt' : 'Preview compiled prompt'}</Button></Stack>
    {showPreview && <Box component="pre" sx={{ p: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 11, maxHeight: 250, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>{composeSparkInstructions(spark, mode, [])}</Box>}
    <Stack direction="row" gap={1}><FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Test mode</InputLabel><Select label="Test mode" value={mode} onChange={(e) => setMode(e.target.value as SparkMode)}>{(['conversation','work','research','creative'] as const).map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select></FormControl>
      <TextField fullWidth label="Test message" multiline maxRows={3} value={probe} onChange={(e) => setProbe(e.target.value)} /></Stack>
    <Stack direction="row" gap={1}><Button variant="contained" startIcon={<ScienceRounded />} disabled={busy || !probe.trim()} onClick={() => void testSpark()}>Test personality</Button>{busy && <Button startIcon={<StopRounded />} onClick={() => controller.current?.abort()}>Stop test</Button>}</Stack>
    {error && <Alert severity="warning" onClose={() => setError('')}>{error}</Alert>}
    {(result || busy) && <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{result || 'Waiting for the model…'}</Box>}
  </Stack>;
}
