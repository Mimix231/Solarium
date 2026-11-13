import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import { CreateProjectDialog } from './CreateProjectDialog';
import CodeRounded from '@mui/icons-material/CodeRounded';
import DownloadForOfflineRounded from '@mui/icons-material/DownloadForOfflineRounded';
import MenuBookRounded from '@mui/icons-material/MenuBookRounded';
import ScienceRounded from '@mui/icons-material/ScienceRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import AutoModeRounded from '@mui/icons-material/AutoModeRounded';
import { useInstallJobs, installProgress } from '../engine/install-jobs';
import { useShallow } from 'zustand/react/shallow';
import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Stack, Tooltip, Typography, TextField } from '@mui/material';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import SmartToyOutlined from '@mui/icons-material/SmartToyOutlined';
import PsychologyOutlined from '@mui/icons-material/PsychologyOutlined';
import MemoryRounded from '@mui/icons-material/MemoryRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import AddRounded from '@mui/icons-material/AddRounded';
import MenuOpenRounded from '@mui/icons-material/MenuOpenRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import { ThemePicker } from './ThemePicker';
import { WindowButtons } from './WindowButtons';
import { AvatarView } from './AvatarView';
import { useSolarium } from '../state/useSolarium';
import type { ReactNode } from 'react';
const rail = [
  { id: 'home', title: 'Solarium Home', icon: <HomeRounded /> },
  { id: 'chat', title: 'Conversations', icon: <ChatBubbleOutlineRounded /> },
  { id: 'projects', title: 'Creator Projects', icon: <FolderOpenRounded /> },
  { id: 'code', title: 'Code Workspace', icon: <CodeRounded /> },
  { id: 'sparks', title: 'Spark Studio', icon: <AutoAwesomeRounded /> },
  { id: 'models', title: 'Local Models', icon: <SmartToyOutlined /> },
  { id: 'runtime', title: 'Runtime Center', icon: <DownloadForOfflineRounded /> },
  { id: 'worlds', title: 'Spark Worlds', icon: <MenuBookRounded /> },
  { id: 'laboratory', title: 'Spark Laboratory', icon: <ScienceRounded /> },
  { id: 'teams', title: 'Spark Teams', icon: <GroupsRounded /> },
  { id: 'memories', title: 'Memories', icon: <PsychologyOutlined /> },
  { id: 'settings', title: 'Settings', icon: <SettingsOutlined /> },
] as const;
export function Shell({ children }: { children: ReactNode }) {
  const { workspace, view, setView, createSession, openSession, deleteSession, updatePreferences } = useSolarium(useShallow((state) => ({ workspace: state.workspace, view: state.view, setView: state.setView, createSession: state.createSession, openSession: state.openSession, deleteSession: state.deleteSession, updatePreferences: state.updatePreferences })));
  const [search, setSearch] = useState('');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  useEffect(() => setSearch(''), [workspace.activeProjectId]);
  const jobs = useInstallJobs((state) => state.jobs);
  const currentInstall = [...jobs].reverse().find((job) => (job.status === 'running' || job.status === 'cancelling'));
  const selected = workspace.sparks.find((s) => s.id === workspace.selectedSparkId) ?? workspace.sparks[0]!;
  const sidebar = view === 'chat' && workspace.preferences.sidebarOpen;
  const currentProject = (workspace.projects ?? []).find((p) => p.id === workspace.activeProjectId);
  const scopeCount = workspace.sessions.filter((s) => (s.projectId ?? null) === (currentProject?.id ?? null)).length;
  return <Box className="app-shell">
    <header className="title-bar" data-tauri-drag-region>
      <Stack direction="row" alignItems="center" gap={1.2}>
        <span className="brand-symbol">☼</span><Typography fontWeight={800} fontSize={13.5} letterSpacing="-.25px">Solarium</Typography>
        <span className="build-badge">0.1</span>
      </Stack>
      <Box className="title-grip" data-tauri-drag-region />
      <Stack direction="row" alignItems="center" gap={.4}>
        <Typography color="text.secondary" fontSize={10.5} sx={{ display: { xs: 'none', sm: 'block' } }}>Your local AI universe</Typography>
        {currentInstall && <Tooltip title={`${currentInstall.engine}: ${currentInstall.phase}`}><Button size="small" variant="outlined" className="runtime-title-progress" onClick={() => setView('runtime')}><DownloadForOfflineRounded sx={{ fontSize: 14, mr: .5 }}/>{currentInstall.engine} {installProgress(currentInstall) === null ? '…' : `${Math.round(installProgress(currentInstall)!)}%`}</Button></Tooltip>}
        <Tooltip title="Switch between Companion and Workspace layouts"><Button size="small" variant="text" onClick={() => updatePreferences({ workspaceMode: workspace.preferences.workspaceMode === 'workspace' ? 'companion' : 'workspace' })}><AutoModeRounded sx={{ fontSize: 15, mr: .6 }}/>{workspace.preferences.workspaceMode === 'workspace' ? 'Workspace' : 'Companion'}</Button></Tooltip>
        <ThemePicker />
        {view==='chat'&&<Tooltip title={sidebar ? 'Hide sidebar' : 'Show sidebar'}><IconButton aria-label="Toggle sidebar" onClick={() => updatePreferences({ sidebarOpen: !sidebar })}><MenuOpenRounded fontSize="small" /></IconButton></Tooltip>}
        <WindowButtons />
      </Stack>
    </header>
    <Box className="layout-body">
      <nav className="nav-rail" aria-label="Main navigation">
        <Stack alignItems="center" gap={.65} flex={1} pt={1.2}>
          {rail.map((item) => <Tooltip key={item.id} title={item.title} placement="right"><IconButton aria-label={item.title} className={`rail-button ${view === item.id ? 'rail-active' : ''}`} onClick={() => setView(item.id)}>{item.icon}</IconButton></Tooltip>)}
        </Stack>
        <Tooltip title="Settings"><IconButton aria-label="Settings" className="rail-button" onClick={() => setView('settings')}><MemoryRounded fontSize="small" /></IconButton></Tooltip>
      </nav>
      {sidebar && <aside className="conversation-sidebar">
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.8, pt: 2, pb: 1 }}>
          <Typography fontWeight={750} fontSize={12}>Conversations</Typography>
          <Tooltip title="New conversation"><IconButton aria-label="New conversation" onClick={() => createSession()}><AddRounded fontSize="small" /></IconButton></Tooltip>
        </Stack>
        <Button startIcon={<AddRounded />} variant="contained" className="new-chat" onClick={() => createSession()}>New {currentProject ? 'project conversation' : 'conversation'}</Button>
        <Button startIcon={<FolderOpenRounded />} variant="outlined" className="new-chat" sx={{ mt: .65 }} onClick={() => setProjectDialogOpen(true)}>Create project</Button>
        <Box sx={{ px: 1.5, py: 1.2 }}><TextField fullWidth placeholder="Search chats" value={search} onChange={(e) => setSearch(e.target.value)} slotProps={{ input: { startAdornment: <SearchRounded sx={{ fontSize: 15, opacity: .6, mr: .8 }} /> } }} /></Box>
        {workspace.preferences.workspaceMode === 'workspace' && <Box className="workspace-shortcuts">
          <Typography className="sidebar-label">WORKSPACE TOOLS</Typography>
          <Stack gap={.4} sx={{ px: 1.2, pb: 1 }}>
            <Button onClick={() => setView('worlds')} size="small" startIcon={<MenuBookRounded />}>Knowledge worlds</Button>
            <Button onClick={() => setView('laboratory')} size="small" startIcon={<ScienceRounded />}>Persona tests</Button>
            <Button onClick={() => setView('teams')} size="small" startIcon={<GroupsRounded />}>Spark teams</Button>
          </Stack>
        </Box>}
        <Box className="project-tree">
          <Typography className="sidebar-label" sx={{ px: 1, pt: 1 }}>PROJECTS</Typography>
          <Button size="small" className="sidebar-project-button" variant={!currentProject ? 'contained' : 'text'} onClick={() => useSolarium.getState().selectProject(null)}>◫ All conversations</Button>
          {(workspace.projects ?? []).map((p) => <Stack key={p.id} direction="row" alignItems="center" gap={.2}>
            <Button size="small" startIcon={<FolderOpenRounded sx={{ fontSize: 15 }}/>} className="sidebar-project-button" variant={p.id === currentProject?.id ? 'contained' : 'text'} onClick={() => useSolarium.getState().selectProject(p.id)}>{p.name}</Button>
            {p.id === currentProject?.id && <Tooltip title="Project settings"><IconButton size="small" aria-label={`Settings for ${p.name}`} onClick={() => setView('projects')}><SettingsOutlined sx={{ fontSize: 15 }}/></IconButton></Tooltip>}
          </Stack>)}
        </Box>
        <Box sx={{px:1.3,py:.8}}><Stack gap={.3}>
          <Button size="small" onClick={()=>setView('sources')}>{currentProject?`${currentProject.name} Sources`:'Chat Sources'}</Button>
          {currentProject&&workspace.activeSessionId&&<Button size="small" onClick={()=>setView('sources')}>Chat Sources · current conversation</Button>}
          <Button size="small" onClick={()=>setView('writing')}>Writing Library</Button>
          <Button size="small" onClick={()=>setView('stories')}>Story Bible</Button>
        </Stack></Box>
        <Box className="project-scope-title"><Typography fontWeight={750} fontSize={11} noWrap>{currentProject ? `${currentProject.name} · Conversations` : 'RECENT CHATS'} ({scopeCount})</Typography>
          {currentProject && <Typography fontSize={10} color="text.secondary">Only conversations belonging to this project appear here.</Typography>}
        </Box>
        <Box className="chat-list" role="list">
          {workspace.sessions.filter((s) => (s.projectId ?? null) === (workspace.activeProjectId ?? null) && s.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((s) => <Box key={s.id} className={`chat-row ${workspace.activeSessionId === s.id ? 'selected' : ''}`} role="listitem">
            <button className="chat-row-main" onClick={() => openSession(s.id)} title={s.title}>{s.parentSessionId ? "↳ " : ""}{s.title}</button>
            <IconButton aria-label={`Delete ${s.title}`} className="row-delete" onClick={() => { if (confirm(`Delete "${s.title}"?`)) deleteSession(s.id); }}><DeleteOutlineRounded sx={{ fontSize: 15 }} /></IconButton>
          </Box>)}
          {!scopeCount && <Typography color="text.secondary" fontSize={11} sx={{ px: 2, mt: 1 }}>Your conversations will appear here.</Typography>}
        </Box>
        <Box className="sidebar-bottom" onClick={() => setView('sparks')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setView('sparks'); }}>
          <AvatarView avatar={selected.avatar} size={33} />
          <Stack minWidth={0}><Typography fontSize={12} fontWeight={650} noWrap>{selected.name}</Typography><Typography fontSize={10} color="text.secondary">Active Spark · Customize</Typography></Stack>
          <AutoAwesomeRounded sx={{ ml: 'auto', opacity: .5, fontSize: 17 }} />
        </Box>
      </aside>}
      <main className="main-content">{children}</main>
      <CreateProjectDialog open={projectDialogOpen} onClose={() => setProjectDialogOpen(false)}/>
    </Box>
  </Box>;
}
