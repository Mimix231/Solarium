import { useEffect, useRef, useState } from 'react';
import { Box, Button, Collapse, Stack, Tooltip, Typography } from '@mui/material';
import LanguageRounded from '@mui/icons-material/LanguageRounded';
import CodeRounded from '@mui/icons-material/CodeRounded';
import AutoStoriesRounded from '@mui/icons-material/AutoStoriesRounded';
import FolderOutlined from '@mui/icons-material/FolderOutlined';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import OpenInFullRounded from '@mui/icons-material/OpenInFullRounded';
import { LiveWorkspace } from './LiveWorkspace';
import type { VisualAction } from '../engine/visual-actions';
import { SaveToSources } from './sources/SaveToSources';
import { useSolarium } from '../state/useSolarium';

const descriptions = { search: 'Research', inspect: 'Project inspection', generate: 'Source generation', edit: 'Code changes', writing: 'Document draft', execute: 'Execution', check: 'Project checks', save: 'File changes' };
const label = (action: VisualAction) => action.status === 'running' ? 'In progress' : action.status === 'completed' ? 'Done' : action.status === 'denied' ? 'Not authorized' : 'Failed';
export function VisualActionCard({ action, onExpandWorkspace }: { action: VisualAction; onExpandWorkspace?: (action: VisualAction) => void }) {
  const session=useSolarium(s=>s.workspace.sessions.find(c=>c.id===action.sessionId));
  const project=useSolarium(s=>(s.workspace.projects??[]).find(p=>p.id===session?.projectId));
  const [expanded, setExpanded] = useState(action.status === 'failed' || action.status === 'running');
  const previousStatus = useRef(action.status);
  useEffect(() => {
    const wasRunning = previousStatus.current === 'running';
    previousStatus.current = action.status;
    if (action.status === 'failed') setExpanded(true);
    if (wasRunning && action.status === 'completed') {
      const timer = setTimeout(() => setExpanded(false), 1100);
      return () => clearTimeout(timer);
    }
  }, [action.status]);
  const isCode = action.kind === 'generate' || action.kind === 'edit' || action.kind === 'save';
  const Icon = action.kind === 'search' ? LanguageRounded : action.kind === 'writing' ? AutoStoriesRounded : isCode ? CodeRounded : action.kind === 'inspect' ? FolderOutlined : FactCheckRounded;
  return <section className={`visual-action visual-action-${action.status}`} aria-label={`${descriptions[action.kind]}: ${action.title}`}>
    <button type="button" className="visual-action-heading" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
      <Icon sx={{ fontSize: 16 }} />
      <span className="visual-action-title">{action.title}</span>
      <span className="visual-action-status">{action.status === 'running' && <span className="visual-action-spinner" />}{label(action)}</span>
      <ExpandMoreRounded className={expanded ? 'visual-chevron expanded' : 'visual-chevron'} sx={{ fontSize: 17 }}/>
    </button>
    <Collapse in={expanded} timeout={180} unmountOnExit><div className="visual-action-details">
      <Typography fontSize={11} color="text.secondary" sx={{ whiteSpace:'pre-wrap', overflowWrap:'anywhere' }}>{action.detail}</Typography>
      {action.query && <Typography fontSize={11} mt={.6} fontWeight={700}>Query: {action.query}</Typography>}
      {Boolean(action.sources?.length) && <div className="visual-source-grid" aria-label="Actual research results">
        {action.sources!.map(source => <div key={source.url}><a className="visual-source-tile" href={source.url} target="_blank" rel="noopener noreferrer">
          <span className="visual-source-favicon" aria-hidden="true">◈</span>
          <span className="visual-source-title">{source.title || new URL(source.url).hostname}</span>
          <small>{new URL(source.url).hostname}</small>
          <span className="visual-source-state">{source.status === 'read' ? '✓ Page read' : source.status === 'reading' ? 'Reading…' : source.status === 'failed' ? 'Failed' : 'Found · not yet read'}</span>
        </a>{session&&source.excerpt&&<SaveToSources text={source.excerpt} title={source.title} kind="webpage" origin={{kind:'web',url:source.url,accessedAt:action.updatedAt,readState:source.status==='read'?'read':'found'}} access={{sessionId:session.id,projectId:project?.id??null}} projectName={project?.name}/>}</div>)}
      </div>}
      {Boolean(action.files?.length) && <div className="visual-file-grid">{action.files!.map(file => <div className="visual-file-entry" key={file.path}><CodeRounded sx={{fontSize:14}}/><Typography fontSize={11} noWrap title={file.path}>{file.path}</Typography><span>{action.status === 'completed' ? '✓' : '…'}</span></div>)}</div>}
      {Boolean(action.output) && !action.files?.length && !action.sources?.length && <pre className="visual-action-output">{action.output!.slice(0, 8000)}</pre>}
      <Stack direction="row" alignItems="center" gap={1} mt={1}>
        <Tooltip title="Open the full real operation result"><Button size="small" startIcon={<OpenInFullRounded sx={{fontSize:14}}/>} onClick={() => onExpandWorkspace?.(action)} sx={{fontSize:10}}>Open workspace</Button></Tooltip>
        <Box flex={1}/><Typography fontSize={9} color="text.secondary">{new Date(action.updatedAt).toLocaleTimeString()}</Typography>
      </Stack>
    </div></Collapse>
  </section>;
}
/** Same renderer also serves as a focused, full-size workspace when opened from an action. */
export function VisualActionWorkspace({ action, onReturn }: { action: VisualAction; onReturn: () => void }) {
  return <LiveWorkspace update={action} onReturn={onReturn}/>;
}
