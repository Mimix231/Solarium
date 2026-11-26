import { useShallow } from 'zustand/react/shallow';
import { useRef, useState, type ChangeEvent } from 'react';
import { Alert, Box, Button, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Tabs, Tab, Typography, TextField, Chip } from '@mui/material';
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
import type { Density, Preferences, ThemeId } from '../domain/types';
import { importFoundation } from '../foundation/backup';
import { FictionSettings } from '../components/FictionSettings';
import { nativeSearchProvider, type SearchProviderConfig } from '../research/research';
import { SpicaResearchRun } from '../spica/research-run';
import './settings.css';

const sections = [['appearance', 'Appearance'], ['models', 'Models & Runtime'], ['web', 'Web Research'],
  ['permissions', 'Tool Permissions'], ['data', 'Backups']] as const;
export function Settings() {
  const { workspace, updatePreferences, restore, syncCatalog } = useSolarium(useShallow((state) => ({ workspace: state.workspace, updatePreferences: state.updatePreferences, restore: state.restore, syncCatalog: state.syncCatalog })));
  const { preferences } = workspace;
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [catalogMessage, setCatalogMessage] = useState('');
  const [scanning, setScanning] = useState(false);
  const [tab, setTab] = useState<'general' | 'fiction'>('general');
  const [section, setSection] = useState<typeof sections[number][0]>('appearance');
  const [connectionQuery, setConnectionQuery] = useState('');
  const [connection, setConnection] = useState('');
  const [testing, setTesting] = useState(false);
  const online = useSolarium(state => state.webEnabled);
  async function testProvider() {
    if (!online || !connectionQuery.trim() || testing || preferences.searchProvider?.kind !== 'searxng') return;
    const provider = preferences.searchProvider;
    setTesting(true); setConnection(''); setError('');
    try {
      const run = new SpicaResearchRun(() => nativeSearchProvider(provider, useSolarium.getState().webEnabled),
        () => useSolarium.getState().webEnabled);
      const result = await run.search(connectionQuery, new AbortController().signal);
      setConnection(`SearXNG returned valid JSON · ${result.returned} public results.`);
    } catch (reason) { setError(String(reason)); }
    finally { setTesting(false); }
  }
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
  return <Box className="view-scroll page-padding settings-shell">
    <SectionTitle eyebrow="SOLARIUM" title="Settings" description="Manage your workspace and the stories you write in it." />
    <Tabs value={tab} onChange={(_, value: 'general' | 'fiction') => setTab(value)} aria-label="Settings tabs" className="settings-tabs">
      <Tab value="general" label="General" id="settings-general-tab" aria-controls="settings-general" />
      <Tab value="fiction" label="Fiction" id="settings-fiction-tab" aria-controls="settings-fiction" />
    </Tabs>
    {tab === 'fiction' ? <section id="settings-fiction" role="tabpanel" aria-labelledby="settings-fiction-tab">
      <Stack className="glass panel" direction="row" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap" mb={2}>
        <Box><Typography fontWeight={750}>Chapter presentation</Typography>
          <Typography variant="body2" color="text.secondary">Choose the spacer between scenes in your writing blocks.</Typography></Box>
        <TextField select size="small" label="Scene spacer" value={preferences.sceneSpacer ?? 'rule'} sx={{ minWidth: 175 }}
          onChange={event => updatePreferences({ sceneSpacer: event.target.value as Preferences['sceneSpacer'] })}>
          <MenuItem value="rule">Thin rule</MenuItem><MenuItem value="dots">Three dots</MenuItem><MenuItem value="space">Open space</MenuItem>
        </TextField>
      </Stack>
      <FictionSettings />
    </section> :
      <section id="settings-general" role="tabpanel" aria-labelledby="settings-general-tab" className="settings-general">
    <nav className="glass panel settings-section-nav" aria-label="General settings sections">
      {sections.map(([id, label]) => <Button key={id} variant={section === id ? 'contained' : 'text'} aria-current={section === id ? 'true' : undefined}
        onClick={() => setSection(id)}>{label}</Button>)}
    </nav>
    <div className="settings-section-content">
    {error && <Alert severity="error" onClose={() => setError('')} sx={{ maxWidth: 800, mb: 2 }}>{error}</Alert>}
    <Box className="glass panel" hidden={section !== 'appearance'}>
      <Typography fontWeight={750} mb={2}>Appearance</Typography>
      <div className="settings-form">
        <FormControl size="small" fullWidth><InputLabel>Theme</InputLabel><Select label="Theme" value={preferences.theme} onChange={(e) => updatePreferences({ theme: e.target.value as ThemeId })}>{themes.map((t) => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" fullWidth><InputLabel>Startup screen</InputLabel><Select label="Startup screen" value={preferences.startupView ?? 'home'} onChange={(e) => updatePreferences({ startupView: e.target.value as 'home' | 'chat' })}><MenuItem value="home">Solarium Home · Console</MenuItem><MenuItem value="chat">Conversations</MenuItem></Select></FormControl>
        <FormControl size="small" fullWidth><InputLabel>Density</InputLabel><Select label="Density" value={preferences.density} onChange={(e) => updatePreferences({ density: e.target.value as Density })}><MenuItem value="ultra">Ultra compact</MenuItem><MenuItem value="compact">Compact</MenuItem><MenuItem value="comfortable">Comfortable</MenuItem></Select></FormControl>
      </div>
      <FormControlLabel sx={{ mt: 1.5 }} control={<Switch checked={preferences.reducedMotion} onChange={(e) => updatePreferences({ reducedMotion: e.target.checked })} />} label="Reduce interface animation" />
      <Typography color="text.secondary" fontSize={11}>System reduced-motion preferences are respected automatically.</Typography>
    </Box>
    <Box className="glass panel" hidden={section !== 'web'}>
      <Typography fontWeight={750} mb={1}>Web research provider</Typography>
      <Typography fontSize={12} color="text.secondary" mb={2}>Search runs when Web Search is on. With Bing selected, a Spark can try Mwmbl when Bing has weak results. SearXNG needs a public HTTPS instance with JSON output enabled.</Typography>
      <Stack direction="row" gap={1}>
        <TextField select label="Provider" value={preferences.searchProvider?.kind??'bing'} onChange={event=>{
          setConnection('');
          updatePreferences({searchProvider:{...preferences.searchProvider,kind:event.target.value as SearchProviderConfig['kind']}});
        }} sx={{minWidth:180}}>
          <MenuItem value="bing">Bing RSS + fallback</MenuItem>
          <MenuItem value="mwmbl">Mwmbl</MenuItem>
          <MenuItem value="duckduckgo">DuckDuckGo HTML</MenuItem>
          <MenuItem value="searxng">SearXNG</MenuItem>
        </TextField>
        {preferences.searchProvider?.kind==='searxng'&&<TextField label="SearXNG HTTPS instance URL" value={preferences.searchProvider.endpoint??''}
          onChange={event=>updatePreferences({searchProvider:{kind:'searxng',endpoint:event.target.value}})} sx={{flex:1}}/>}
      </Stack>
      {preferences.searchProvider?.kind === 'searxng' && <Stack gap={1.5} mt={2}>
        <TextField label="Connection test query" value={connectionQuery} onChange={event => setConnectionQuery(event.target.value)}
          helperText={online ? 'This public query checks the selected instance’s JSON search endpoint.' : 'Enable Web Search in chat to run a connection test.'} />
        <Button variant="outlined" sx={{ alignSelf: 'start' }} disabled={!online || testing || !connectionQuery.trim()}
          onClick={() => void testProvider()}>{testing ? 'Testing…' : 'Test connection'}</Button>
        {connection && <Alert severity="success">{connection}</Alert>}
      </Stack>}
    </Box>
    <Box className="glass panel" hidden={section !== 'models'}>
      <Typography fontWeight={750} mb={1}>Local GGUF model library</Typography>
      <Typography fontSize={12} color="text.secondary" mb={2}>Choose your GGUF folder once. Solarium discovers .gguf files up to four subfolders deep, and the chat composer lists them by filename. Selecting one loads that exact GGUF with llama.cpp.</Typography>
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        <TextField label="GGUF model directory" value={preferences.ggufDirectory} onChange={(e) => updatePreferences({ ggufDirectory: e.target.value })} sx={{ flex: 1, minWidth: 240 }} inputProps={{ 'aria-label': 'GGUF model directory' }}/>
        <Button variant="outlined" onClick={() => void (async () => { try { const folder = await chooseDirectory(); if (folder) { updatePreferences({ ggufDirectory: folder }); await syncFolder(folder); } } catch (e) { setError(String(e)); } })()}>Choose folder</Button>
        <Button disabled={scanning || !preferences.ggufDirectory.trim()} variant="contained" onClick={() => void syncFolder(preferences.ggufDirectory)}>Scan GGUFs</Button>
      </Stack>
      <Stack direction="row" alignItems="center" gap={1} mt={1.3}><Chip size="small" label={`${workspace.models.filter((m) => m.ggufPath).length} local GGUFs`}/><Typography fontSize={11} color="text.secondary">{catalogMessage || 'Only local file names and paths are indexed. No files are uploaded.'}</Typography></Stack>
    </Box>
    <Box className="glass panel" hidden={section !== 'permissions'}>
      <Typography fontWeight={750} mb={1}>Tool permissions</Typography><Typography fontSize={12} color="text.secondary" mb={2}>Only registered tools are exposed. Choose Ask, Auto, or YOLO in the chat composer to control confirmations. Here you can disable individual tools in every mode. YOLO can modify project files and execute project scripts without asking.</Typography>
      <Stack gap={1}>{availableToolNames.map((tool) => <Stack key={tool} direction="row" alignItems="center" justifyContent="space-between" gap={1}><Typography fontSize={12}>{tool.replaceAll('_', ' ')}</Typography><FormControl size="small" sx={{ minWidth: 145 }}><Select aria-label={`${tool} permission`} value={preferences.toolPermissions[tool] === 'deny' ? 'deny' : 'ask'} onChange={(e) => updatePreferences({ toolPermissions: { ...preferences.toolPermissions, [tool]: e.target.value as 'allow' | 'ask' | 'deny' } })}><MenuItem value="ask">Available · follow chat mode</MenuItem><MenuItem value="deny">Blocked in all modes</MenuItem></Select></FormControl></Stack>)}</Stack>
    </Box>
    <Box className="glass panel" hidden={section !== 'data'}><Typography fontWeight={750} mb={1}>Your data</Typography><Typography fontSize={12} color="text.secondary" mb={2}>Your Sparks, chats, and explicit memories are stored locally. Export a backup before switching devices. A desktop installation uses SQLite; browser development uses localStorage.</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap"><Button variant="contained" startIcon={<DownloadRounded />} onClick={() => void exportWorkspace(workspace).catch(e=>setError(String(e)))}>Export backup</Button><Button variant="outlined" startIcon={<UploadRounded />} onClick={() => fileRef.current?.click()}>Import backup</Button><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={(e) => void restoreFile(e)} /></Stack>
    </Box>
    </div></section>}
  </Box>;
}
