import { useShallow } from 'zustand/react/shallow';
import { useRef, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography, TextField, Chip } from '@mui/material';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import UploadRounded from '@mui/icons-material/UploadRounded';
import { SectionTitle } from '../components/SectionTitle';
import { useSolarium } from '../state/useSolarium';
import { exportWorkspace } from '../data/repository';
import { validateWorkspace } from '../domain/validation';
import { themes } from '../themes/registry';
import { availableToolNames } from '../engine/tools';
import { chooseDirectory, scanGGUFDirectory } from '../engine/desktop';
import { catalogToModels } from '../engine/catalog';
import type { Density, ThemeId } from '../domain/types';
import { importFoundation } from '../foundation/backup';
export function Settings() {
  const { workspace, updatePreferences, restore, syncCatalog } = useSolarium(useShallow((state) => ({ workspace: state.workspace, updatePreferences: state.updatePreferences, restore: state.restore, syncCatalog: state.syncCatalog })));
  const { preferences } = workspace;
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [catalogMessage, setCatalogMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  async function syncFolder(folder: string) {
    setScanning(true); setCatalogMessage('');
    try {
      const files = await scanGGUFDirectory(folder);
      syncCatalog(catalogToModels(files, preferences.serverPort), folder);
      setCatalogMessage(`Found ${files.length} GGUF files in the selected folder.`);
    } catch (error) { setError(`GGUF scan failed: ${String(error)}`); }
    finally { setScanning(false); }
  }
  async function restoreFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 100_000_000) throw new Error('Backup exceeds 100 MB.');
      const raw=JSON.parse(await file.text()) as {foundation?:unknown};
      const candidate = validateWorkspace(raw);
      if (confirm('Replace your current local Solarium workspace with this backup, including Sources and Writing?')) {await importFoundation(raw.foundation,candidate);restore(candidate);}
    } catch (e) { setError(`Import failed: ${String(e)}`); }
  }
  return <Box className="view-scroll page-padding">
    <SectionTitle eyebrow="MAKE IT YOURS" title="Preferences" description="Tune Solarium’s appearance, performance, and local privacy behavior." />
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ maxWidth: 800, mb: 2 }}>{error}</Alert>}
    <Box className="glass panel" sx={{ maxWidth: 800, mb: 2 }}>
      <Typography fontWeight={750} mb={2}>Appearance</Typography>
      <div className="settings-form">
        <FormControl size="small" fullWidth><InputLabel>Theme</InputLabel><Select label="Theme" value={preferences.theme} onChange={(e) => updatePreferences({ theme: e.target.value as ThemeId })}>{themes.map((t) => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" fullWidth><InputLabel>Startup screen</InputLabel><Select label="Startup screen" value={preferences.startupView ?? 'home'} onChange={(e) => updatePreferences({ startupView: e.target.value as 'home' | 'chat' })}><MenuItem value="home">Solarium Home · Console</MenuItem><MenuItem value="chat">Conversations</MenuItem></Select></FormControl>
        <FormControl size="small" fullWidth><InputLabel>Density</InputLabel><Select label="Density" value={preferences.density} onChange={(e) => updatePreferences({ density: e.target.value as Density })}><MenuItem value="ultra">Ultra compact</MenuItem><MenuItem value="compact">Compact</MenuItem><MenuItem value="comfortable">Comfortable</MenuItem></Select></FormControl>
      </div>
      <FormControlLabel sx={{ mt: 1.5 }} control={<Switch checked={preferences.reducedMotion} onChange={(e) => updatePreferences({ reducedMotion: e.target.checked })} />} label="Reduce interface animation" />
      <Typography color="text.secondary" fontSize={11}>System reduced-motion preferences are respected automatically.</Typography>
    </Box>
    <Box className="glass panel" sx={{ maxWidth: 800, mb: 2 }}>
      <Typography fontWeight={750} mb={1}>Web research provider</Typography><Typography fontSize={12} color="text.secondary" mb={2}>Search runs only when Web Search is ON. Bing uses DuckDuckGo when its results do not match the research topic. SearXNG needs a public HTTPS instance with JSON output enabled.</Typography><Stack direction="row" gap={1}><TextField select label="Provider" value={preferences.searchProvider?.kind??'bing'} onChange={e=>updatePreferences({searchProvider:{...preferences.searchProvider,kind:e.target.value as 'bing'|'searxng'|'duckduckgo'}})} sx={{minWidth:180}}><MenuItem value="bing">Bing RSS + fallback</MenuItem><MenuItem value="duckduckgo">DuckDuckGo HTML</MenuItem><MenuItem value="searxng">SearXNG</MenuItem></TextField>{preferences.searchProvider?.kind==='searxng'&&<TextField label="SearXNG HTTPS instance URL" value={preferences.searchProvider.endpoint??''} onChange={e=>updatePreferences({searchProvider:{kind:'searxng',endpoint:e.target.value}})} sx={{flex:1}}/>}</Stack>
    </Box>
    <Box className="glass panel" sx={{ maxWidth: 800, mb: 2 }}>
      <Typography fontWeight={750} mb={1}>Local GGUF model library</Typography>
      <Typography fontSize={12} color="text.secondary" mb={2}>Choose your GGUF folder once. Solarium discovers .gguf files up to four subfolders deep, and the chat composer lists them by filename. Selecting one loads that exact GGUF with llama.cpp.</Typography>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        <TextField label="GGUF model directory" value={preferences.ggufDirectory} onChange={(e) => updatePreferences({ ggufDirectory: e.target.value })} sx={{ flex: 1, minWidth: 240 }} inputProps={{ 'aria-label': 'GGUF model directory' }}/>
        <Button variant="outlined" onClick={() => void (async () => { try { const folder = await chooseDirectory(); if (folder) { updatePreferences({ ggufDirectory: folder }); await syncFolder(folder); } } catch (e) { setError(String(e)); } })()}>Choose folder</Button>
        <Button disabled={scanning || !preferences.ggufDirectory.trim()} variant="contained" onClick={() => void syncFolder(preferences.ggufDirectory)}>Scan GGUFs</Button>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1} mt={1.3}><Chip size="small" label={`${workspace.models.filter((m) => m.ggufPath).length} local GGUFs`}/><Typography fontSize={11} color="text.secondary">{catalogMessage || 'Only local file names and paths are indexed. No files are uploaded.'}</Typography></Stack>
    </Box>
    <Box className="glass panel" sx={{ maxWidth: 800, mb: 2 }}>
      <Typography fontWeight={750} mb={1}>Tool permissions</Typography><Typography fontSize={12} color="text.secondary" mb={2}>Only registered tools are exposed. Choose Ask, Auto, or YOLO in the chat composer to control confirmations. Here you can disable individual tools in every mode. YOLO can modify project files and execute project scripts without asking.</Typography>
      <Stack gap={1}>{availableToolNames.map((tool) => <Stack key={tool} direction="row" alignItems="center" justifyContent="space-between" gap={1}><Typography fontSize={12}>{tool.replaceAll('_', ' ')}</Typography><FormControl size="small" sx={{ minWidth: 145 }}><Select aria-label={`${tool} permission`} value={preferences.toolPermissions[tool] === 'deny' ? 'deny' : 'ask'} onChange={(e) => updatePreferences({ toolPermissions: { ...preferences.toolPermissions, [tool]: e.target.value as 'allow' | 'ask' | 'deny' } })}><MenuItem value="ask">Available · follow chat mode</MenuItem><MenuItem value="deny">Blocked in all modes</MenuItem></Select></FormControl></Stack>)}</Stack>
    </Box>
    <Box className="glass panel" sx={{ maxWidth: 800 }}><Typography fontWeight={750} mb={1}>Your data</Typography><Typography fontSize={12} color="text.secondary" mb={2}>Your Sparks, chats, and explicit memories are stored locally. Export a backup before switching devices. A desktop installation uses SQLite; browser development uses localStorage.</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap"><Button variant="contained" startIcon={<DownloadRounded />} onClick={() => void exportWorkspace(workspace).catch(e=>setError(String(e)))}>Export backup</Button><Button variant="outlined" startIcon={<UploadRounded />} onClick={() => fileRef.current?.click()}>Import backup</Button><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={(e) => void restoreFile(e)} /></Stack>
    </Box>
  </Box>;
}
