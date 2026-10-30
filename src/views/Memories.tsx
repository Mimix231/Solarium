import { useShallow } from 'zustand/react/shallow';
import { useState } from 'react';
import { Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from '@mui/material';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import { SectionTitle } from '../components/SectionTitle';
import { useSolarium } from '../state/useSolarium';
import { now, uid } from '../domain/types';
export function Memories() {
  const { workspace, addMemory, updateMemory, removeMemory } = useSolarium(useShallow((state) => ({ workspace: state.workspace, addMemory: state.addMemory, updateMemory: state.updateMemory, removeMemory: state.removeMemory })));
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState('global');
  const add = () => {
    if (!draft.trim()) return;
    addMemory({ id: uid(), text: draft.trim(), scope: scope === 'global' ? 'global' : 'spark', sparkId: scope === 'global' ? null : scope, enabled: true, createdAt: now() });
    setDraft('');
  };
  return <Box className="view-scroll page-padding">
    <SectionTitle eyebrow="USER-APPROVED CONTEXT" title="Memory Library" description="You control exactly what your Sparks remember. Stored locally and never added without your consent." />
    <Box className="glass panel" sx={{ maxWidth: 800, mb: 2 }}><Typography fontWeight={700} mb={1.5}>Add a memory</Typography><TextField fullWidth multiline minRows={2} placeholder="A fact or preference you want your Spark to remember..." value={draft} onChange={(e) => setDraft(e.target.value)} />
      <Stack direction="row" alignItems="center" gap={1} mt={1.5} flexWrap="wrap"><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Visible to</InputLabel><Select value={scope} label="Visible to" onChange={(e) => setScope(e.target.value)}><MenuItem value="global">All Sparks</MenuItem>{workspace.sparks.map((s) => <MenuItem key={s.id} value={s.id}>{s.name} only</MenuItem>)}</Select></FormControl><Button variant="contained" startIcon={<AddRounded />} onClick={add}>Remember this</Button></Stack>
    </Box>
    <Stack gap={1.1} sx={{ maxWidth: 800 }}>{workspace.memories.map((m) => <Box key={m.id} className="glass memory-row"><Switch size="small" checked={m.enabled} onChange={(e) => updateMemory(m.id, { enabled: e.target.checked })} inputProps={{ 'aria-label': 'Enable memory' }} /><Box flex={1} minWidth={0}><TextField variant="standard" fullWidth multiline value={m.text} onChange={(e) => updateMemory(m.id, { text: e.target.value })} /><Typography color="text.secondary" fontSize={10} mt={.4}>{new Date(m.createdAt).toLocaleDateString()}</Typography></Box><Chip size="small" label={m.scope === 'global' ? 'All Sparks' : workspace.sparks.find((s) => s.id === m.sparkId)?.name ?? 'Unknown'} /><IconButton aria-label="Delete memory" onClick={() => removeMemory(m.id)}><DeleteOutlineRounded fontSize="small" /></IconButton></Box>)}
      {!workspace.memories.length && <Box className="glass panel"><Typography color="text.secondary" fontSize={12}>No memories saved yet. Your Sparks won't invent a memory of you.</Typography></Box>}
    </Stack>
  </Box>;
}
