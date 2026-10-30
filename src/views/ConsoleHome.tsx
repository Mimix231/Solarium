import { useState, type ReactNode } from 'react';
import { Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography, IconButton, Tooltip } from '@mui/material';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import TerminalRounded from '@mui/icons-material/TerminalRounded';
import TravelExploreRounded from '@mui/icons-material/TravelExploreRounded';
import MenuBookRounded from '@mui/icons-material/MenuBookRounded';
import DownloadForOfflineRounded from '@mui/icons-material/DownloadForOfflineRounded';
import SmartToyRounded from '@mui/icons-material/SmartToyRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { useSolarium, type View } from '../state/useSolarium';
import { AvatarView } from '../components/AvatarView';
import { CreateProjectDialog } from '../components/CreateProjectDialog';

const features: { title: string; description: string; view: View; icon: ReactNode }[] = [
  { title: 'Conversations', description: 'Talk and create with Sparks', view: 'chat', icon: <ChatBubbleOutlineRounded/> },
  { title: 'Projects', description: 'Your work and its conversations', view: 'projects', icon: <FolderRounded/> },
  { title: 'Spark Studio', description: 'Personalities and avatars', view: 'sparks', icon: <AutoAwesomeRounded/> },
  { title: 'Code Workspace', description: 'Inspect and edit source', view: 'code', icon: <TerminalRounded/> },
  { title: 'Research', description: 'Search from your conversations', view: 'chat', icon: <TravelExploreRounded/> },
  { title: 'Worlds', description: 'Project knowledge', view: 'worlds', icon: <MenuBookRounded/> },
  { title: 'Models', description: 'Choose local LLMs', view: 'models', icon: <SmartToyRounded/> },
  { title: 'Runtime Center', description: 'Inference engines', view: 'runtime', icon: <DownloadForOfflineRounded/> },
];
/** Console-inspired launcher; responsive tiles, keyboard buttons, theme-aware glossy surfaces. */
export function ConsoleHome() {
  const { workspace, setView, openChannel, addChannel, removeChannel, selectProject, createSession } = useSolarium();
  const [createOpen, setCreateOpen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sparkId, setSparkId] = useState('');
  const currentSpark = workspace.sparks.find((s) => s.id === workspace.selectedSparkId) ?? workspace.sparks[0]!;
  return <div className="view-scroll console-home"><Box className="console-welcome">
    <Stack direction="row" gap={2} alignItems="center"><AvatarView avatar={currentSpark.avatar} size={65}/><Box>
      <Typography className="eyebrow">YOUR LOCAL AI UNIVERSE</Typography><Typography variant="h4" fontWeight={850}>Welcome to Solarium</Typography>
      <Typography color="text.secondary" fontSize={12}>Choose a channel, continue a conversation, or build something new.</Typography>
    </Box></Stack>
    <Stack direction="row" gap={1}><Button variant="contained" size="small" onClick={() => createSession(undefined, null)}>New conversation</Button><Button variant="outlined" size="small" onClick={() => setCreateOpen(true)}>Create project</Button></Stack>
  </Box>
  <Typography fontWeight={800} fontSize={14} mt={3} mb={1.5}>Solarium channels</Typography>
  <div className="console-tiles">{features.map((tile) => <button type="button" key={tile.title} className="console-tile" onClick={() => setView(tile.view)}>
    <span className="console-tile-icon">{tile.icon}</span><strong>{tile.title}</strong><small>{tile.description}</small>
  </button>)}
    <button type="button" className="console-tile console-add" onClick={() => setChannelOpen(true)}><span className="console-tile-icon"><AddRounded/></span><strong>Create Channel</strong><small>A personalized shortcut</small></button>
  </div>
  {(workspace.projects ?? []).length > 0 && <><Typography fontWeight={800} fontSize={14} mt={3} mb={1.5}>Your projects</Typography>
    <div className="console-tiles">{(workspace.projects ?? []).map((p) => <button type="button" className="console-tile project-tile" key={p.id} onClick={() => selectProject(p.id)}><span className="console-tile-icon"><FolderRounded/></span><strong>{p.name}</strong><small>{workspace.sessions.filter((s) => s.projectId === p.id).length} conversations</small></button>)}</div>
  </>}
  {!!workspace.preferences.consoleChannels?.length && <><Typography fontWeight={800} fontSize={14} mt={3} mb={1.5}>Custom channels</Typography>
    <div className="console-tiles">{workspace.preferences.consoleChannels.map((channel) => <Card key={channel.id} className="console-channel"><button className="console-tile" onClick={() => openChannel(channel.id)}><span className="console-tile-icon">✦</span><strong>{channel.title}</strong><small>{(workspace.projects ?? []).find((p) => p.id === channel.projectId)?.name ?? 'Conversations'}</small></button><Tooltip title="Remove channel"><IconButton size="small" className="channel-remove" onClick={() => removeChannel(channel.id)}><DeleteOutlineRounded fontSize="small"/></IconButton></Tooltip></Card>)}</div>
  </>}
  <Dialog open={channelOpen} onClose={() => setChannelOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Create a channel</DialogTitle><DialogContent><Stack gap={1.4} pt={1}><TextField label="Channel title" value={title} onChange={(e) => setTitle(e.target.value)} size="small"/><TextField label="Open project" select value={projectId} size="small" onChange={(e) => setProjectId(e.target.value)}><MenuItem value="">All conversations</MenuItem>{(workspace.projects ?? []).map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField><TextField select size="small" label="Spark" value={sparkId} onChange={(e) => setSparkId(e.target.value)}><MenuItem value="">Current Spark</MenuItem>{workspace.sparks.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}</TextField></Stack></DialogContent><DialogActions><Button onClick={() => setChannelOpen(false)}>Cancel</Button><Button variant="contained" disabled={!title.trim()} onClick={() => { addChannel(title, projectId || null, sparkId || null); setTitle(''); setChannelOpen(false); }}>Create</Button></DialogActions></Dialog>
  <CreateProjectDialog open={createOpen} onClose={() => setCreateOpen(false)}/>
  </div>;
}
