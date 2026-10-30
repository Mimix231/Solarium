import { useState } from 'react';
import { Button, Card, Chip, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import CodeRounded from '@mui/icons-material/CodeRounded';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import { useSolarium } from '../state/useSolarium';
import { chooseDirectory } from '../engine/desktop';
import { SectionTitle } from '../components/SectionTitle';
import { exportBlock } from '../blocks/exports';

export function Projects() {
  const { workspace, addProject, updateProject, deleteProject, selectProject, createSession, setView } = useSolarium();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const selected = (workspace.projects ?? []).find((p) => p.id === workspace.activeProjectId);
  return <div className="view-scroll creator-view"><SectionTitle eyebrow="CREATOR WORKSPACE" title="Projects" description="Keep conversations, source code, and project instructions together. Files stay on your computer." />
    <Stack direction="row" gap={1} mb={2}><TextField size="small" placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { addProject(name); setName(''); } }} /><Button variant="contained" disabled={!name.trim()} startIcon={<AddRounded />} onClick={() => { addProject(name); setName(''); }}>Create project</Button></Stack>
    {error && <Typography color="error" fontSize={12}>{error}</Typography>}
    <div className="creator-columns"><div className="creator-project-list"><Button onClick={() => selectProject(null)}>← All conversations</Button>{(workspace.projects ?? []).map((p) => <button key={p.id} className={`creator-project-item ${selected?.id === p.id ? 'selected' : ''}`} onClick={() => selectProject(p.id)}><FolderOpenRounded fontSize="small"/><span>{p.name}</span><Chip size="small" label={workspace.sessions.filter((s) => s.projectId === p.id).length}/></button>)}{!(workspace.projects ?? []).length && <Typography color="text.secondary" fontSize={12}>Create a project to begin.</Typography>}</div>
    <div className="creator-project-details">{selected ? <Card className="creator-card"><Stack direction="row" alignItems="center" justifyContent="space-between"><Typography fontWeight={800} fontSize={16}>{selected.name}</Typography><IconButton aria-label="Delete project" onClick={() => { if (window.confirm(`Delete ${selected.name} and its conversations? Project files will not be deleted.`)) deleteProject(selected.id); }}><DeleteOutlineRounded/></IconButton></Stack>
      <TextField label="Project name" size="small" fullWidth value={selected.name} onChange={(e) => updateProject(selected.id, { name: e.target.value })}/>
      <TextField label="Project objective / description" size="small" fullWidth multiline minRows={2} value={selected.description} onChange={(e) => updateProject(selected.id, { description: e.target.value })} helperText="Dona receives this objective in every project conversation, even when older messages no longer fit the context window."/>
      <TextField label="Project instructions" size="small" fullWidth multiline minRows={3} value={selected.instructions} onChange={(e) => updateProject(selected.id, { instructions: e.target.value })} helperText="Included only in chats belonging to this project. Your Spark personality stays intact."/>
      <TextField select size="small" label="Preferred Spark" value={selected.sparkId ?? ''} onChange={(e) => updateProject(selected.id, { sparkId: e.target.value || null })}><MenuItem value="">Active Spark</MenuItem>{workspace.sparks.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField>
      <TextField select size="small" label="Preferred model" value={selected.modelId ?? ''} onChange={(e) => updateProject(selected.id, { modelId: e.target.value || null })}><MenuItem value="">Conversation default</MenuItem>{workspace.models.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}</TextField>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Chip size="small" color={selected.folder ? 'success' : 'warning'} label={selected.folder ? 'Source folder attached' : 'No source folder attached'}/>
        <Button startIcon={<FolderOpenRounded/>} onClick={() => void chooseDirectory().then((folder) => { if (folder) updateProject(selected.id, { folder }); }).catch((e: unknown) => setError(String(e)))}>{selected.folder ? 'Change source folder' : 'Attach source folder'}</Button>
        {selected.folder && <Button size="small" color="warning" onClick={() => updateProject(selected.id, { folder: '' })}>Unlink</Button>}
        <Typography fontSize={11} color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{selected.folder || 'Dona can discuss this project, but local file operations are unavailable until a folder is attached.'}</Typography>
      </Stack>
      <Stack direction="row" gap={1}><Button variant="contained" startIcon={<ChatBubbleOutlineRounded/>} onClick={() => createSession(undefined, selected.id)}>New project chat</Button><Button disabled={!selected.folder} startIcon={<CodeRounded/>} onClick={() => setView('code')}>Browse project code</Button></Stack>
      <Typography fontWeight={700} mt={2} fontSize={12}>Saved project assets</Typography>
      {(workspace.assets ?? []).filter((asset) => asset.projectId === selected.id).map((asset) => <Stack direction="row" alignItems="center" key={asset.id} gap={1}><Typography fontSize={11} sx={{ flex: 1 }} noWrap>{asset.title} · {asset.kind}</Typography><Button size="small" onClick={() => exportBlock({ id: asset.blockId, kind: asset.kind, title: asset.title, language: asset.language, content: asset.content, status: 'complete', provenance: 'model' })}>Export</Button><Button color="error" size="small" onClick={() => { if (window.confirm(`Remove saved asset ${asset.title}?`)) useSolarium.getState().removeAsset(asset.id); }}>Remove</Button></Stack>)}
      {!(workspace.assets ?? []).some((asset) => asset.projectId === selected.id) && <Typography color="text.secondary" fontSize={11}>Saved writing and code blocks from project chats appear here.</Typography>}
      <Typography fontWeight={700} mt={2} fontSize={12}>Project conversations</Typography>{workspace.sessions.filter((s) => s.projectId === selected.id).map((s) => <Button key={s.id} sx={{ justifyContent: 'start' }} onClick={() => useSolarium.getState().openSession(s.id)}>{s.title}</Button>)}
    </Card> : <Typography color="text.secondary">Select a project to configure it.</Typography>}</div></div>
  </div>;
}
