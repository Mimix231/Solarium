import { useShallow } from 'zustand/react/shallow';
import { StrictMode, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, CircularProgress, Box, Alert } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { createSolariumTheme } from './themes/registry';
import { ApplicationClose } from './components/ApplicationClose';
import { Shell } from './components/Shell';
import { SourcesLibrary } from './components/sources/SourcesLibrary';
import { WritingLibrary } from './components/WritingLibrary';
import { StoryBible } from './components/StoryBible';
import './themes/foundation.css';
import { RenderErrorBoundary } from './components/RenderErrorBoundary';
import { ConsoleHome } from './views/ConsoleHome';
import './themes/console.css';
import './themes/live-workspace.css';
import { Chat } from './views/Chat';
import { Projects } from './views/Projects';
import { CodeWorkspace } from './views/CodeWorkspace';
import { SpicaStudio } from './views/SpicaStudio';
import { SparkStudio } from './views/SparkStudio';
import { Models } from './views/Models';
import { Memories } from './views/Memories';
import { Settings } from './views/Settings';
import { RuntimeCenter } from './views/RuntimeCenter';
import { Worlds } from './views/Worlds';
import { Laboratory } from './views/Laboratory';
import { Teams } from './views/Teams';
import { startInstallerTracking } from './engine/install-jobs';
import { useSolarium } from './state/useSolarium';
import './themes/base.css';
import './themes/blocks.css';
import './themes/obsidian/obsidian.css';
import './themes/crystal/crystal.css';
import './themes/aurora/aurora.css';
import './themes/material/material.css';
import './themes/slate/slate.css';
import './themes/solar/solar.css';
import './themes/peach/peach.css';
import './themes/cherry/cherry.css';
import './themes/lime/lime.css';
import './themes/blueberry/blueberry.css';
import './themes/tangerine/tangerine.css';
import './themes/kiwi/kiwi.css';
import './themes/strawberry/strawberry.css';

function App() {
  const { ready, hydrate, view, workspace, error, setView, updatePreferences } = useSolarium(useShallow((state) => ({ ready: state.ready, hydrate: state.hydrate, view: state.view, workspace: state.workspace, error: state.error, setView: state.setView, updatePreferences: state.updatePreferences })));
  const { theme, density, reducedMotion } = workspace.preferences;
  const mui = useMemo(() => createSolariumTheme(theme, density), [theme, density]);
  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => startInstallerTracking(), []);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.dataset.density = density; document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'normal'; document.documentElement.dataset.workspace = workspace.preferences.workspaceMode ?? 'companion'; }, [theme, density, reducedMotion, workspace.preferences.workspaceMode]);
  return <ThemeProvider theme={mui}><CssBaseline />{!ready ? <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : <>
    {error && <Alert severity="warning" sx={{ position: 'fixed', bottom: 5, left: 64, zIndex: 2000, maxWidth: 600 }}>{error}</Alert>}
    <RenderErrorBoundary key={view} onRecover={() => updatePreferences({ showActivity: false })} onHome={() => setView('home')}>
    <ApplicationClose/><Shell>{view === 'sources' ? <SourcesLibrary/> : view === 'writing' ? <WritingLibrary/> : view === 'stories' ? <StoryBible/> : view === 'home' ? <ConsoleHome /> : view === 'chat' ? <Chat /> : view === 'projects' ? <Projects /> : view === 'code' ? <CodeWorkspace /> : view === 'spica' ? <SpicaStudio /> : view === 'sparks' ? <SparkStudio /> : view === 'models' ? <Models /> : view === 'runtime' ? <RuntimeCenter /> : view === 'worlds' ? <Worlds /> : view === 'laboratory' ? <Laboratory /> : view === 'teams' ? <Teams /> : view === 'memories' ? <Memories /> : <Settings />}</Shell>
    </RenderErrorBoundary>
  </>}</ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
