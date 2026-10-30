import { useShallow } from 'zustand/react/shallow';
import { useRef, useState, type ChangeEvent } from 'react';
import { validateSpark } from '../domain/validation';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import UploadRounded from '@mui/icons-material/UploadRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { AvatarView } from '../components/AvatarView';
import { SparkDnaEditor } from '../components/SparkDnaEditor';
import { AvatarStudio } from '../components/AvatarStudio';
import { SectionTitle } from '../components/SectionTitle';
import { useSolarium } from '../state/useSolarium';
import { now, uid, type Spark } from '../domain/types';

export function SparkStudio() {
  const { workspace, addSpark, selectSpark, setView, deleteSpark, editingSparkId, setEditingSparkId, updateSpark } = useSolarium(useShallow((state) => ({ workspace: state.workspace, addSpark: state.addSpark, selectSpark: state.selectSpark, setView: state.setView, deleteSpark: state.deleteSpark, editingSparkId: state.editingSparkId, setEditingSparkId: state.setEditingSparkId, updateSpark: state.updateSpark })));
  const selected = workspace.sparks.find((s) => s.id === editingSparkId);
  const [tab, setTab] = useState(0);
  const [warning, setWarning] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const setField = <K extends keyof Spark>(key: K, value: Spark[K]) => { if (selected) updateSpark(selected.id, { [key]: value }); };
  function exportSpark(spark: Spark) {
    const blob = new Blob([JSON.stringify({ format: 'solarium-spark-v1', spark }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${spark.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'spark'}.spark.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importSpark(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Spark file is too large.');
      const data: unknown = JSON.parse(await file.text());
      if (!data || typeof data !== 'object') throw new Error('Invalid Spark data.');
      const payload = data as { format?: string; spark?: unknown };
      if (payload.format !== 'solarium-spark-v1' || !payload.spark || typeof payload.spark !== 'object') throw new Error('Unsupported Spark format.');
      const candidate = validateSpark(payload.spark);
      const imported: Spark = {
        ...candidate, id: uid(), preferredModelId: null,
        createdAt: now(), updatedAt: now(),
      };
      useSolarium.getState().mutate((w) => { w.sparks.push(imported); w.selectedSparkId = imported.id; });
      setEditingSparkId(imported.id);
    } catch (error) { setWarning(`Could not import Spark: ${String(error)}`); }
  }
  return <Box className="view-scroll page-padding">
    <SectionTitle eyebrow="YOUR PERSONALITY COLLECTION" title="Spark Studio" description="Build distinct AI personalities. Give each Spark a voice, an identity, and an appearance." action={<Stack direction="row" gap={1}><input hidden ref={importRef} type="file" accept=".json" onChange={(e) => void importSpark(e)} /><Button variant="outlined" startIcon={<UploadRounded />} onClick={() => importRef.current?.click()}>Import</Button><Button variant="contained" startIcon={<AddRounded />} onClick={() => { setTab(0); addSpark(); }}>Create Spark</Button></Stack>} />
    <Box className="spark-grid">
      {workspace.sparks.map((spark) => <div key={spark.id} className="glass spark-card">
        <div className="spark-card-glow" style={{ background: spark.avatar.color }} />
        <Stack direction="row" alignItems="start" justifyContent="space-between"><AvatarView avatar={spark.avatar} size={73} /><Chip label={workspace.selectedSparkId === spark.id ? 'ACTIVE' : 'SPARK'} color={workspace.selectedSparkId === spark.id ? 'primary' : 'default'} size="small" variant="outlined" /></Stack>
        <Typography variant="h6" mt={2}>{spark.name}</Typography>
        <Typography color="text.secondary" fontSize={12} className="spark-description">{spark.description}</Typography>
        <Stack direction="row" gap={1} mt="auto" pt={2}>
          <Button fullWidth variant={workspace.selectedSparkId === spark.id ? 'outlined' : 'contained'} onClick={() => { selectSpark(spark.id); setView('chat'); }}>{workspace.selectedSparkId === spark.id ? 'Chat now' : 'Activate'}</Button>
          <IconButton aria-label={`Export ${spark.name}`} className="icon-surface" onClick={() => exportSpark(spark)}><DownloadRounded fontSize="small" /></IconButton>
          <IconButton aria-label={`Edit ${spark.name}`} className="icon-surface" onClick={() => { setTab(0); setEditingSparkId(spark.id); }}><EditRounded fontSize="small" /></IconButton>
        </Stack>
      </div>)}
      <button className="spark-create glass" onClick={addSpark}><AddRounded sx={{ fontSize: 29 }} /><strong>Make another Spark</strong><span>Start with a blank personality</span></button>
    </Box>
    <Dialog open={Boolean(selected)} onClose={() => setEditingSparkId(null)} maxWidth="xl" fullWidth slotProps={{ paper: { className: `editor-dialog ${tab === 2 ? 'appearance-dialog' : ''}` } }}>
      {selected && <>
        <DialogTitle sx={{ display: 'flex', gap: 1.4, alignItems: 'center' }}><AvatarView avatar={selected.avatar} size={42} /><Box><Typography fontWeight={750}>Edit {selected.name}</Typography><Typography color="text.secondary" fontSize={11}>Changes save automatically</Typography></Box></DialogTitle>
        <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 2 }}><Tab label="Identity" /><Tab label="Personality" /><Tab label="Appearance" /><Tab label="Behavior" /></Tabs>
        <DialogContent dividers sx={{ minHeight: 340 }}>
          {warning && <Alert severity="warning" onClose={() => setWarning('')} sx={{ mb: 2 }}>{warning}</Alert>}
          {tab === 0 && <Stack gap={2}>
            <TextField label="Spark name" value={selected.name} inputProps={{ maxLength: 60 }} onChange={(e) => setField('name', e.target.value)} fullWidth />
            <TextField label="Short description" value={selected.description} onChange={(e) => setField('description', e.target.value)} fullWidth multiline minRows={2} />
            <TextField label="First greeting" value={selected.greeting} onChange={(e) => setField('greeting', e.target.value)} fullWidth multiline minRows={2} />
            <Typography color="text.secondary" fontSize={11}>The greeting appears when starting a fresh conversation.</Typography>
          </Stack>}
          {tab === 1 && <SparkDnaEditor key={selected.id} spark={selected} models={workspace.models} update={(patch) => updateSpark(selected.id, patch)} />}
          {tab === 2 && <AvatarStudio key={selected.id} name={selected.name} avatar={selected.avatar} onChange={(avatar) => updateSpark(selected.id, { avatar })} />}
          {tab === 3 && <Stack gap={2}>
            <Typography fontSize={12} color="text.secondary">Assign a preferred local model. Conversation mode can still override it.</Typography>
            <FormControl fullWidth size="small"><InputLabel>Preferred model</InputLabel><Select label="Preferred model" value={selected.preferredModelId ?? ''} onChange={(e) => setField('preferredModelId', e.target.value || null)}><MenuItem value="">Use current/default model</MenuItem>{workspace.models.map((m) => <MenuItem value={m.id} key={m.id}>{m.name}</MenuItem>)}</Select></FormControl>
            <Divider />
            <Typography fontWeight={650} fontSize={12}>Privacy and memory</Typography>
            <Typography fontSize={12} color="text.secondary">Each Spark can access global memories and memories explicitly assigned to it. Memories are never extracted automatically.</Typography>
            <Button sx={{ alignSelf: 'start' }} onClick={() => { setEditingSparkId(null); setView('memories'); }}>Manage memories</Button>
          </Stack>}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.3 }}><Typography color="text.secondary" fontSize={10} sx={{ mr: 'auto' }}>Edited {new Date(selected.updatedAt || now()).toLocaleDateString()}</Typography><Button color="error" startIcon={<DeleteOutlineRounded />} disabled={workspace.sparks.length <= 1} onClick={() => { if (confirm(`Delete ${selected.name} and all its chats?`)) { deleteSpark(selected.id); setEditingSparkId(null); } }}>Delete</Button><Button variant="contained" onClick={() => setEditingSparkId(null)}>Done</Button></DialogActions>
      </>}
    </Dialog>
  </Box>;
}
