import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Alert, Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography, Tooltip, IconButton } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import {LocalCodingModels} from '../components/LocalCodingModels';
import { SectionTitle } from '../components/SectionTitle';
import { useSolarium } from '../state/useSolarium';
import { adapterFor, generationMetrics } from '../engine/backends';
import { optimizationPresets, type OptimizationPreset } from '../engine/optimization';
import { chooseFile, gpuStatus, getRuntimeLocation, readEngineLog, startLlamaServer, stopLlamaServer, startVllmServer, stopVllmServer } from '../engine/desktop';
import { now, uid, type Capabilities, type InferenceBackend, type LocalModel, type GenerationMetrics } from '../domain/types';

type Check = { ids: string[]; capabilities: Capabilities };
type CompareResult = { name: string; response: string; metrics?: GenerationMetrics; error?: string };
export function Models() {
  const { workspace, upsertModel, removeModel, updatePreferences } = useSolarium(useShallow((state) => ({
    workspace: state.workspace, upsertModel: state.upsertModel, removeModel: state.removeModel, updatePreferences: state.updatePreferences,
  })));
  const [backend, setBackend] = useState<InferenceBackend>('llama.cpp');
  const [name, setName] = useState('Local model');
  const [endpoint, setEndpoint] = useState('http://127.0.0.1:8080');
  const [modelId, setModelId] = useState('');
  const [ggufPath, setGgufPath] = useState('');
  const [contextSize, setContextSize] = useState(4096);
  const [gpuLayers, setGpuLayers] = useState(20);
  const [preset, setPreset] = useState<OptimizationPreset>('balanced');
  const [vllmModel, setVllmModel] = useState('Qwen/Qwen2.5-1.5B-Instruct');
  const [vllmPort, setVllmPort] = useState(8000);
  const [gpuFraction, setGpuFraction] = useState(0.35);
  const [gpu, setGpu] = useState('GPU memory has not been inspected.');
  const [engineLog, setEngineLog] = useState('');
  const [runtimeLocation, setRuntimeLocation] = useState('Loading runtime location…');
  useEffect(() => {
    let active = true;
    void getRuntimeLocation().then((path) => { if (active) setRuntimeLocation(path); })
      .catch((error: unknown) => { if (active) setRuntimeLocation(String(error)); });
    return () => { active = false; };
  }, []);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [comparisonPrompt, setComparisonPrompt] = useState('Explain how to write a reliable unit test in two sentences.');
  const [comparisons, setComparisons] = useState<CompareResult[]>([]);
  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    try { setMessage(await action()); setFailure(false); }
    catch (error) { setFailure(true); setMessage(String(error)); }
    finally { setBusy(false); }
  };
  async function check(model: LocalModel) {
    await run(async () => {
      const result = await adapterFor(model).inspect(model);
      setChecks((prev) => ({ ...prev, [model.id]: result }));
      return `Connected to ${model.name} (${model.backend ?? 'llama.cpp'}): ${result.ids.length} loaded model(s).`;
    });
  }
  async function discover() {
    const test: LocalModel = { id: '_preview', name, backend, endpoint, modelId, contextSize, temperature: .7, maxTokens: 2048, createdAt: now() };
    await run(async () => {
      const info = await adapterFor(test).inspect(test);
      if (info.ids[0]) setModelId(info.ids[0]);
      return `Discovered: ${info.ids.join(', ') || '(no loaded models)'}`;
    });
  }
  async function compareEngines() {
    const selected = (['llama.cpp', 'vllm'] as const).map((kind) => workspace.models.find((m) => (m.backend ?? 'llama.cpp') === kind)).filter((m): m is LocalModel => !!m);
    if (selected.length !== 2) { setFailure(true); setMessage('Register one llama.cpp model and one vLLM model to compare both running engines.'); return; }
    setBusy(true); setComparisons([]);
    const finished = await Promise.all(selected.map(async (model): Promise<CompareResult> => {
      const engine = adapterFor(model);
      const signal = new AbortController().signal;
      const started = performance.now(); let firstToken: number | null = null;
      try {
        const inspected = await engine.inspect(model, signal);
        const generated = await engine.generate(model, [{ role: 'user', content: comparisonPrompt }], inspected.capabilities, {
          answer: () => { if (firstToken === null) firstToken = performance.now(); }, reasoning: () => undefined,
        }, signal);
        return { name: model.name, response: generated.answer,
          metrics: generationMetrics(engine.kind, model.modelId, started, firstToken, performance.now(), generated.answer, generated.usage?.completionTokens) };
      } catch (error) { return { name: model.name, response: '', error: String(error) }; }
    }));
    setComparisons(finished); setBusy(false);
  }
  return <Box className="view-scroll page-padding">
    <LocalCodingModels/><SectionTitle eyebrow="LOCAL COMPUTE" title="Inference Engines" description="Run llama.cpp and vLLM concurrently on different ports. Assign either engine to a Spark or chat." />
    <Box className="glass panel" sx={{ maxWidth: 940, mb: 2, py: 1.3 }}><Stack direction="row" alignItems="center" justifyContent="space-between"><Box><Typography fontWeight={750}>Persistent Runtime Center</Typography><Typography fontSize={11} color="text.secondary">Install and update engines while navigating anywhere in Solarium.</Typography></Box><Button variant="contained" startIcon={<DownloadRounded />} onClick={() => useSolarium.getState().setView('runtime')}>Open installer</Button></Stack></Box>
    {message && <Alert severity={failure ? 'warning' : 'success'} onClose={() => setMessage('')} sx={{ mb: 2, maxWidth: 940 }}>{message}</Alert>}
    <Box className="glass panel" sx={{ maxWidth: 940, mb: 2 }}>
      <Typography fontSize={13} fontWeight={800}>Local runtime folder · ./runtime</Typography>
      <Typography color="text.secondary" mt={.4} fontSize={11}>
        llama.cpp runs from ./runtime/llama-cpp. vLLM uses a private WSL2 virtual disk under ./runtime/vllm/linux. No existing Ubuntu distribution is copied.
      </Typography>
      <Typography fontFamily="monospace" fontSize={11} mt={1} sx={{ userSelect: 'text', overflowWrap: 'anywhere' }}>{runtimeLocation}</Typography>
    </Box>
    <Alert severity="info" sx={{ mb: 2, maxWidth: 940 }}>RTX 3060 · 12 GB VRAM · 64 GB RAM preset. Both engines can remain running, but they share the same 12 GB GPU. Use small/quantized models and low vLLM memory utilization; concurrent models may still trigger CUDA out-of-memory errors. vLLM on Windows requires WSL2.</Alert>
    <Box className="glass panel" sx={{ maxWidth: 940, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Typography fontSize={14} fontWeight={800}>Runtime status</Typography>
        <Button size="small" disabled={busy} startIcon={<RefreshRounded />} onClick={() => void run(async () => { const result = await gpuStatus(); setGpu(result); return 'GPU statistics refreshed.'; })}>Refresh GPU</Button>
      </Stack>
      <Typography sx={{ mt: 1, fontFamily: 'monospace' }} fontSize={12}>{gpu}</Typography>
      <Typography mt={1} color="text.secondary" fontSize={11}>NVIDIA reports memory values in MiB. vLLM's memory fraction is a scheduling budget, not a guaranteed limit on all GPU allocations.</Typography>
    </Box>
    <Box className="glass panel" sx={{ maxWidth: 940, mb: 2 }}>
      <Stack direction="row" gap={1.5} flexWrap="wrap" alignItems="center">
        <FormControl size="small" sx={{ minWidth: 215 }}><InputLabel>RTX 3060 optimization</InputLabel><Select label="RTX 3060 optimization" value={preset} onChange={(e) => {
          const chosen = e.target.value as OptimizationPreset;
          setPreset(chosen); setGpuLayers(optimizationPresets[chosen].gpuLayers);
          setGpuFraction(optimizationPresets[chosen].vllmFraction); setContextSize(optimizationPresets[chosen].context);
        }}><MenuItem value="balanced">Dual-engine balanced</MenuItem><MenuItem value="llama-performance">llama.cpp performance</MenuItem><MenuItem value="memory-saver">Memory saver</MenuItem></Select></FormControl>
        <Typography color="text.secondary" fontSize={11} flex={1}>{optimizationPresets[preset].description}</Typography>
      </Stack>
    </Box>
    <Box className="glass panel" sx={{ maxWidth: 940, mb: 2 }}>
      <Typography fontWeight={800} fontSize={14}>llama.cpp · Windows native</Typography>
      <Typography fontSize={12} color="text.secondary" mt={.6} mb={1.5}>Install verified official release binaries. The CUDA 12 build is recommended for an RTX 3060 with compatible NVIDIA drivers.</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
        <Button variant="contained" startIcon={<DownloadRounded />} onClick={() => useSolarium.getState().setView('runtime')}>Manage installations</Button>
      </Stack>
      <Stack direction="row" gap={1} mt={1.5} alignItems="center">
        <TextField fullWidth label="llama-server executable" value={workspace.preferences.llamaExecutable} onChange={(e) => updatePreferences({ llamaExecutable: e.target.value })} />
        <Button startIcon={<FolderOpenRounded />} disabled={busy} onClick={() => void run(async () => {
          const path = await chooseFile(); if (path) updatePreferences({ llamaExecutable: path }); return path ? 'Executable selected.' : 'Selection cancelled.';
        })}>Browse</Button>
      </Stack>
      <Stack direction="row" gap={1} mt={1} alignItems="center">
        <TextField fullWidth label="GGUF model path" value={ggufPath} onChange={(e) => setGgufPath(e.target.value)} />
        <Button startIcon={<FolderOpenRounded />} disabled={busy} onClick={() => void run(async () => {
          const path = await chooseFile([{ name: 'GGUF models', extensions: ['gguf'] }]); if (path) setGgufPath(path); return path ? 'GGUF selected.' : 'Selection cancelled.';
        })}>Browse</Button>
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={1} mt={1.5}>
        <TextField type="number" label="Port" value={workspace.preferences.serverPort} onChange={(e) => updatePreferences({ serverPort: Number(e.target.value) })} sx={{ width: 102 }} />
        <TextField type="number" label="GPU layers (-1 = all)" value={gpuLayers} onChange={(e) => setGpuLayers(Number(e.target.value))} sx={{ width: 170 }} />
        <TextField type="number" label="Context" value={contextSize} onChange={(e) => setContextSize(Number(e.target.value))} sx={{ width: 120 }} />
        <Button variant="contained" disabled={busy || !ggufPath || !workspace.preferences.llamaExecutable} startIcon={<PlayArrowRounded />} onClick={() => void run(() => startLlamaServer(workspace.preferences.llamaExecutable, ggufPath, workspace.preferences.serverPort, contextSize, gpuLayers))}>Start llama.cpp</Button>
        <Button variant="outlined" disabled={busy} startIcon={<StopRounded />} onClick={() => void run(stopLlamaServer)}>Stop</Button>
        <Button variant="text" disabled={busy} onClick={() => void run(async () => { setEngineLog(await readEngineLog('llama.cpp')); return 'Loaded latest llama.cpp log.'; })}>View logs</Button>
      </Stack>
    </Box>
    <Box className="glass panel" sx={{ maxWidth: 940, mb: 2 }}>
      <Typography fontWeight={800} fontSize={14}>vLLM · WSL2 CUDA</Typography>
      <Typography fontSize={12} mt={.6} mb={1.5} color="text.secondary">Solarium downloads an official Ubuntu 24.04 LTS WSL image and creates a dedicated distribution in ./runtime/vllm/linux. You do not need Ubuntu preinstalled, but WSL2 and compatible NVIDIA drivers are required. GGUF support in vLLM remains experimental; prefer supported Hugging Face models.</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <TextField label="WSL distribution" value="Solarium-vLLM" disabled sx={{ width: 170 }} />
        <TextField label="vLLM model ID / Linux path" value={vllmModel} onChange={(e) => setVllmModel(e.target.value)} sx={{ flex: 1, minWidth: 260 }} />
        <TextField type="number" label="Port" value={vllmPort} onChange={(e) => setVllmPort(Number(e.target.value))} sx={{ width: 105 }} />
        <TextField type="number" label="GPU memory fraction" value={gpuFraction} onChange={(e) => setGpuFraction(Number(e.target.value))} inputProps={{ min: 0.2, max: 0.7, step: 0.05 }} sx={{ width: 180 }} />
      </Stack>
      <Stack direction="row" gap={1} mt={1.5} flexWrap="wrap">
        <Button variant="outlined" startIcon={<DownloadRounded />} onClick={() => useSolarium.getState().setView('runtime')}>Install vLLM in Runtime Center</Button>
        <Button variant="contained" disabled={busy} startIcon={<PlayArrowRounded />} onClick={() => void run(() => startVllmServer(vllmModel, vllmPort, contextSize, gpuFraction))}>Start vLLM</Button>
        <Button variant="outlined" disabled={busy} startIcon={<StopRounded />} onClick={() => void run(stopVllmServer)}>Stop vLLM</Button>
        <Button variant="text" disabled={busy} onClick={() => void run(async () => { setEngineLog(await readEngineLog('vllm')); return 'Loaded latest vLLM log.'; })}>View logs</Button>
      </Stack>
      <Typography fontFamily="monospace" sx={{ overflowWrap: 'anywhere', mt: 1.5 }} fontSize={11} color="text.secondary">vLLM Linux disk: ./runtime/vllm/linux/ext4.vhdx. Python environment inside WSL: /opt/solarium/vllm/venv. Installer logs: ./runtime/vllm/install.log. Windows WSL components are not relocated.</Typography>
    </Box>
    {engineLog && <Box className="glass panel" sx={{ maxWidth: 940, mb: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontSize={13} fontWeight={750}>Engine diagnostics</Typography><Button size="small" onClick={() => setEngineLog('')}>Close</Button></Stack><Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 240, overflow: 'auto', fontSize: 11, mt: 1 }}>{engineLog}</Box></Box>}
    <Box className="glass panel" sx={{ maxWidth: 940, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontSize={14} fontWeight={800}>Registered models</Typography><Chip size="small" label={`${workspace.models.length} endpoints`} /></Stack>
      <Stack gap={1.2} mt={1.5}>{workspace.models.map((model) => <Box key={model.id} className="model-row">
        <Box flex={1} minWidth={0}><Typography fontSize={13} fontWeight={750}>{model.name} <Chip size="small" label={model.backend ?? 'llama.cpp'} /></Typography>
          <Typography color="text.secondary" fontSize={11} sx={{ overflowWrap: 'anywhere' }}>{model.modelId} · {model.endpoint}</Typography>
          <Stack direction="row" gap={1} mt={1} flexWrap="wrap">
            <TextField label="Temperature" type="number" size="small" value={model.temperature} onChange={(e) => { const value = Number(e.target.value); if (value >= 0 && value <= 2) upsertModel({ ...model, temperature: value }); }} sx={{ width: 105 }} inputProps={{ step: .05, min: 0, max: 2 }} />
            <Typography fontSize={10.5} color="text.secondary">Continuous generation · model stays loaded</Typography>
            <Stack direction="row" gap={.4} alignItems="center"><Typography fontSize={10}>Enable tool calling</Typography><Switch size="small" checked={model.toolCalling === true} onChange={(e) => upsertModel({ ...model, toolCalling: e.target.checked })}/></Stack>
            <Stack direction="row" gap={.4} alignItems="center"><Typography fontSize={10}>Try vision messages</Typography><Switch size="small" checked={model.visionEnabled === true} onChange={(e) => upsertModel({ ...model, visionEnabled: e.target.checked })}/></Stack>
            {checks[model.id] && <><Chip size="small" label={`tools: ${checks[model.id]?.capabilities.tools}`} /><Chip size="small" label={`vision: ${checks[model.id]?.capabilities.vision}`} /></>}
          </Stack></Box>
        <Tooltip title="Inspect loaded models"><span><IconButton disabled={busy} onClick={() => void check(model)} aria-label={`Inspect ${model.name}`}><RefreshRounded fontSize="small" /></IconButton></span></Tooltip>
        <IconButton onClick={() => removeModel(model.id)} aria-label={`Remove ${model.name}`}><DeleteOutlineRounded fontSize="small" /></IconButton>
      </Box>)}{!workspace.models.length && <Typography fontSize={12} color="text.secondary">No model endpoints registered yet.</Typography>}</Stack>
      <Typography fontSize={10} color="text.secondary" mt={1}>“Enable tool calling” sends real tool definitions to OpenAI-compatible servers when automatic tool capability detection is inconclusive. Enable only for a model whose chat template supports tool calls; unsupported models may return an inference error. This never skips per-tool permissions.</Typography>
      <Typography fontSize={10} color="text.secondary" mt={1.5}>“Try vision messages” manually enables image sending when the server cannot report its vision capability. The model must actually support image input or the request will fail.</Typography>
      <Divider sx={{ my: 2 }} />
      <Typography fontWeight={750} fontSize={13} mb={1}>Register a running model</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 135 }}><InputLabel>Engine</InputLabel><Select label="Engine" value={backend} onChange={(e) => { const next = e.target.value as InferenceBackend; setBackend(next); setEndpoint(next === 'vllm' ? `http://127.0.0.1:${vllmPort}` : next === 'ollama' ? 'http://127.0.0.1:11434' : `http://127.0.0.1:${workspace.preferences.serverPort}`); }}><MenuItem value="llama.cpp">llama.cpp</MenuItem><MenuItem value="vllm">vLLM</MenuItem><MenuItem value="ollama">Ollama</MenuItem></Select></FormControl>
        <TextField label="Display name" value={name} onChange={(e) => setName(e.target.value)} sx={{ minWidth: 150 }} />
        <TextField label="Model ID" value={modelId} onChange={(e) => setModelId(e.target.value)} sx={{ flex: 1, minWidth: 200 }} />
        <TextField label="Loopback endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} sx={{ minWidth: 200 }} />
      </Stack>
      <Stack direction="row" gap={1} mt={1.5}>
        <Button variant="contained" disabled={!name.trim() || !modelId.trim()} startIcon={<AddRounded />} onClick={() => {
          try {
            const u = new URL(endpoint);
            if (u.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(u.hostname) || u.username || u.password || u.search || u.hash || !['/',''].includes(u.pathname)) throw new Error('Use an http://127.0.0.1:PORT endpoint.');
            upsertModel({ id: uid(), name: name.trim(), backend, endpoint: u.origin, modelId: modelId.trim(), contextSize, temperature: .7, maxTokens: 2048, createdAt: now() });
            setMessage('Model registered; use Inspect to confirm it is loaded.'); setFailure(false);
          } catch (error) { setMessage(String(error)); setFailure(true); }
        }}>Register</Button>
        <Button variant="outlined" disabled={busy} onClick={() => void discover()}>Discover ID</Button>
      </Stack>
    </Box>
    <Box className="glass panel" sx={{ maxWidth: 940 }}>
      <Typography fontSize={14} fontWeight={800}>Dual-engine comparison</Typography>
      <Typography fontSize={12} color="text.secondary" my={1}>Send the same prompt to both registered engines at the same time, without mixing their outputs. This tests true simultaneous inference; both models must fit available GPU/CPU memory.</Typography>
      <Stack direction="row" gap={1}><TextField fullWidth multiline minRows={2} label="Compare prompt" value={comparisonPrompt} onChange={(e) => setComparisonPrompt(e.target.value)} /><Button variant="contained" disabled={busy || !comparisonPrompt.trim()} onClick={() => void compareEngines()}>Run both</Button></Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 1.5, mt: 2 }}>
        {comparisons.map((item) => <Box key={item.name} className="glass panel" sx={{ minWidth: 0 }}><Typography fontWeight={750} fontSize={12}>{item.name}</Typography>
          {item.metrics && <Typography fontSize={11} color="text.secondary">First token: {item.metrics.firstTokenMs?.toFixed(0) ?? '—'} ms · {item.metrics.tokensPerSecond ?? '—'} tok/s {item.metrics.completionTokens === null ? '(estimated)' : ''}</Typography>}
          <Typography fontSize={12} color={item.error ? 'error' : 'text.primary'} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', mt: 1 }}>{item.error ?? item.response}</Typography></Box>)}
      </Box>
    </Box>
  </Box>;
}
