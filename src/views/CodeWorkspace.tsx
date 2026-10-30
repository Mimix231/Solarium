import { useEffect, useState } from 'react';
import { Alert, Box, Button, Card, Chip, Stack, TextField, Typography } from '@mui/material';
import { useSolarium } from '../state/useSolarium';
import { listProjectFiles, readProjectFile, writeProjectFile } from '../engine/creator';
import { SectionTitle } from '../components/SectionTitle';

export function CodeWorkspace() {
  const { workspace, setView } = useSolarium();
  const project = (workspace.projects ?? []).find((p) => p.id === workspace.activeProjectId);
  const [files, setFiles] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [original, setOriginal] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { let mounted = true; setFiles([]); setCurrent(''); setContent(''); setOriginal(''); if (project?.folder) void listProjectFiles(project.folder).then((list) => { if (mounted) setFiles(list); }).catch((e: unknown) => { if (mounted) setError(String(e)); }); return () => { mounted = false; }; }, [project?.folder]);
  async function openFile(path: string) { if (!project) return; try { const text = await readProjectFile(project.folder, path); setContent(text); setOriginal(text); setCurrent(path); setStatus(''); setError(''); } catch (e) { setError(String(e)); } }
  async function save() { if (!project || !current || content === original) return; if (!window.confirm(`Apply your changes to ${current}? A .solarium.bak backup will be saved first.`)) return; try { await writeProjectFile(project.folder, current, content, original); setOriginal(content); setStatus('File saved. Backup created beside the original file.'); setError(''); } catch (e) { setError(String(e)); } }
  return <div className="view-scroll creator-view"><SectionTitle eyebrow="LOCAL SOURCE EXPLORER" title="Code Workspace" description="Browse, inspect, and explicitly save project files. Solarium never edits files automatically from chat."/>
    <Stack direction="row" gap={1} mb={2}><Button onClick={() => setView('projects')}>← Project settings</Button><Chip size="small" label={project?.name ?? 'No project'}/><Button onClick={() => project?.folder && listProjectFiles(project.folder).then(setFiles).catch((e: unknown) => setError(String(e)))}>Refresh</Button></Stack>
    {error && <Alert severity="warning" onClose={() => setError('')}>{error}</Alert>}{status && <Alert severity="success" onClose={() => setStatus('')}>{status}</Alert>}
    <div className="creator-code-layout"><Card className="creator-file-tree">{files.length ? files.map((file) => <button key={file} onClick={() => void openFile(file)} className={current === file ? 'selected' : ''}>{file}</button>) : <Typography fontSize={12} color="text.secondary">Choose a project source folder. Supported text and code files are shown here.</Typography>}</Card><Card className="creator-editor"><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography fontSize={12} fontWeight={700}>{current || 'Select a file'} {content !== original ? '• Unsaved' : ''}</Typography><Button variant="contained" disabled={!current || content === original} onClick={() => void save()}>Review & Save</Button></Stack>
      <TextField fullWidth multiline minRows={18} maxRows={40} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Open a file to inspect or edit it" slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 } } }} /><Box fontSize={11} color="text.secondary">Changes are written only after you confirm. Files changed externally will not be overwritten.</Box></Card></div>
  </div>;
}
