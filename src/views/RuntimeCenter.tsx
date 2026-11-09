import { QualityChecks } from '../components/QualityChecks';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { SectionTitle } from '../components/SectionTitle';
import { useInstallJobs, installProgress } from '../engine/install-jobs';
import { getRuntimeLocation, readEngineLog } from '../engine/desktop';
export function RuntimeCenter() {
  const { jobs, error, start, cancel, refresh } = useInstallJobs();
  const [path, setPath] = useState('./runtime');
  const [cuda, setCuda] = useState(true);
  const [log, setLog] = useState('');
  const [logError, setLogError] = useState('');
  async function inspectLog(engine: 'llama.cpp' | 'vllm') {
    try { setLog(`${engine} diagnostics\n\n${await readEngineLog(engine)}`); setLogError(''); }
    catch (error) { setLogError(String(error)); }
  }
  useEffect(() => { void getRuntimeLocation().then(setPath).catch(() => {}); }, []);
  const active = jobs.filter((job) => ['running','cancelling'].includes(job.status));
  return <Box className="view-scroll page-padding runtime-center">
    <SectionTitle eyebrow="SOLARIUM RUNTIME CENTER" title="Installations & Engines" description="Installers run in Rust. Switching pages never resets their progress; completed and interrupted jobs survive a restart." action={<Button variant="outlined" onClick={() => void refresh()}>Refresh jobs</Button>}/>
    <Box className="glass panel runtime-path"><Typography fontSize={12} fontWeight={800}>Local installation folder</Typography><Typography fontFamily="monospace" fontSize={11} sx={{ overflowWrap:'anywhere' }}>{path}</Typography><Typography fontSize={11} color="text.secondary">Engine binaries live in runtime/llama-cpp; the private WSL2 disk and vLLM files live in runtime/vllm. Windows WSL components and NVIDIA drivers remain system-managed.</Typography></Box>
    {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}
    <div className="runtime-cards">
      <Box className="glass panel"><Typography fontWeight={800}>llama.cpp · Windows x64</Typography><Typography fontSize={12} color="text.secondary" my={1}>Official CUDA/CPU releases, SHA-256 validation, automatic migration of older numbered installs. Target: ./runtime/llama-cpp/</Typography><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Button variant={cuda ? 'contained' : 'outlined'} onClick={() => setCuda(true)}>CUDA 12</Button><Button variant={!cuda ? 'contained' : 'outlined'} onClick={() => setCuda(false)}>CPU</Button><Button disabled={active.some((job) => job.engine === 'llama.cpp')} variant="contained" onClick={() => void start('llama.cpp', { cuda })}>Install / update</Button><Button variant="outlined" onClick={() => void inspectLog('llama.cpp')}>Engine logs</Button></Stack></Box>
      <Box className="glass panel"><Typography fontWeight={800}>vLLM · WSL2</Typography><Typography fontSize={12} color="text.secondary" my={1}>Downloads a verified Ubuntu 24.04 LTS WSL image; no existing Ubuntu distribution is required. Creates a private Linux disk in ./runtime/vllm/linux/ and installs vLLM inside it. WSL2, NVIDIA GPU passthrough and several GB of drive space are still required.</Typography><Stack direction="row" gap={1} alignItems="center" flexWrap="wrap"><Button disabled={active.some((job) => job.engine === 'vllm')} variant="contained" onClick={() => { if (window.confirm('Install a dedicated Ubuntu WSL2 filesystem and vLLM under ./runtime/vllm? This downloads several gigabytes of software.')) void start('vllm'); }}>Install / update</Button><Button variant="outlined" onClick={() => void inspectLog('vllm')}>Engine logs</Button></Stack></Box>
    </div>
    {logError && <Alert severity="warning" sx={{ mb: 2 }}>{logError}</Alert>}
    {log && <Box className="glass panel" sx={{ mb: 2, maxWidth: 980 }}><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontWeight={800}>Runtime diagnostics</Typography><Button onClick={() => setLog('')}>Close logs</Button></Stack><Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 280, overflowY: 'auto', fontSize: 11 }}>{log}</Box></Box>}
    <Box className="glass panel" sx={{mb:2}}><Typography fontWeight={800}>Private coding tools</Typography><Typography fontSize={12} color="text.secondary" my={1}>Install verified portable Node.js LTS, Python and TypeScript/Python language services under Solarium runtime. Existing global toolchains stay available. The download requires an internet connection; coding can use these tools offline afterward.</Typography><Button variant="contained" disabled={active.some(j=>j.engine==='coding-tools')} onClick={()=>void start('coding-tools')}>Install / update coding tools</Button></Box>
    <QualityChecks/>
    <Typography variant="h6" mb={1.5}>Installation history</Typography>
    {jobs.length === 0 && <Box className="glass panel"><Typography color="text.secondary" fontSize={12}>No installation jobs yet. Start with llama.cpp CUDA 12 for your RTX 3060.</Typography></Box>}
    <Stack gap={1}>{[...jobs].reverse().map((job) => { const percent = job.status === 'completed' ? 100 : installProgress(job); return <Box key={job.id} className="glass panel runtime-job"><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography fontWeight={700}>{job.engine} <Typography component="span" fontSize={11} color="text.secondary"> · {new Date(job.updatedAt * 1000).toLocaleString()}</Typography></Typography><Chip size="small" label={job.status} color={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : job.status === 'running' ? 'primary' : job.status === 'cancelled' ? 'default' : 'warning'} /></Stack><Typography fontSize={12} my={1}>{job.phase}</Typography><LinearProgress variant={percent === null && (job.status === 'running' || job.status === 'cancelling') ? 'indeterminate' : 'determinate'} value={percent ?? 0} sx={{ mb: 1 }} />{percent !== null && <Typography fontSize={11}>{Math.round(percent)}% {job.total > 0 && `· ${(job.downloaded / 1048576).toFixed(1)} / ${(job.total / 1048576).toFixed(1)} MiB`}</Typography>}{job.error && <Alert severity="error" sx={{ mt: 1 }}>{job.error}</Alert>}{job.result && <Typography color="success.main" fontSize={11} sx={{ mt: 1, overflowWrap: 'anywhere' }}>{job.result}</Typography>}{job.status === 'running' && <Button size="small" color="warning" onClick={() => void cancel(job.id)}>Request cancel</Button>}{job.engine!=='gguf'&&['failed','interrupted','cancelled'].includes(job.status) && <Button size="small" sx={{ mt: 1 }} onClick={() => void start(job.engine, job.engine === 'llama.cpp' ? { cuda } : {})}>Retry installation</Button>}</Box>; })}</Stack>
  </Box>;
}
