import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import { chooseDirectory } from '../engine/desktop';
import { createProjectDirectory } from '../engine/creator';
import { useSolarium } from '../state/useSolarium';

/** Created from Conversations. A project is an explicit conversation scope, not a global chat label. */
export function CreateProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { workspace, addProject, updateProject } = useSolarium();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'unlinked' | 'existing' | 'new'>('unlinked');
  const [folder, setFolder] = useState('');
  const [sparkId, setSparkId] = useState('');
  const [modelId, setModelId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      if (mode !== 'unlinked' && !folder.trim()) throw new Error(mode === 'new' ? 'Choose the parent folder for your new project.' : 'Choose the existing project folder.');
      const target = mode === 'new' ? await createProjectDirectory(folder, name.trim()) : mode === 'existing' ? folder : '';
      const projectId = addProject(name, target, sparkId || null, modelId || null);
      if (description.trim()) updateProject(projectId, { description: description.trim() });
      setDescription(''); setName(''); setFolder(''); setMode('unlinked'); setSparkId(''); setModelId(''); onClose();
    } catch (err) { setError(String(err)); } finally { setBusy(false); }
  }
  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
    <DialogTitle sx={{ fontWeight: 800 }}>✦ Create Project</DialogTitle>
    <DialogContent><Stack gap={1.7} sx={{ pt: 1 }}>
      <Typography variant="caption" color="text.secondary">Project chats are private to this project and do not appear in All Conversations.</Typography>
      <TextField label="Project name" size="small" value={name} onChange={(e) => setName(e.target.value)} autoFocus inputProps={{ maxLength: 120 }}/>
      <TextField label="Project objective (optional)" size="small" multiline minRows={2} value={description} onChange={(e) => setDescription(e.target.value)} helperText="Shared with the Spark in every conversation inside this project. You can edit it later."/>
      <TextField select size="small" label="Folder setup" value={mode} onChange={(e) => { setMode(e.target.value as typeof mode); setFolder(''); }}>
        <MenuItem value="unlinked">Conversations only — no project file access</MenuItem>
        <MenuItem value="existing">Use existing project directory</MenuItem>
        <MenuItem value="new">Create new directory in selected parent</MenuItem>
      </TextField>
      {mode !== 'unlinked' && <Stack direction="row" gap={1} alignItems="center">
        <Button startIcon={<FolderOpenRounded />} variant="outlined" onClick={() => void chooseDirectory().then((path) => { if (path) setFolder(path); }).catch((err: unknown) => setError(String(err)))}>Browse</Button>
        <Typography fontSize={11} sx={{ overflowWrap: 'anywhere' }}>{folder || (mode === 'new' ? 'Choose parent directory' : 'Choose source directory')}</Typography>
      </Stack>}
      <TextField select size="small" label="Assigned Spark" value={sparkId} onChange={(e) => setSparkId(e.target.value)}>
        <MenuItem value="">Use active Spark</MenuItem>{workspace.sparks.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Preferred model" value={modelId} onChange={(e) => setModelId(e.target.value)}>
        <MenuItem value="">Conversation default</MenuItem>{workspace.models.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
      </TextField>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="contained" onClick={() => void create()} disabled={busy || !name.trim()}>Create project</Button></DialogActions>
  </Dialog>;
}
