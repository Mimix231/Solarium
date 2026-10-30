import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import { ContentBlockBody } from './BlockCard';
import type { ContentBlock } from './protocol';
import { exportBlock, exportDocx, exportHtmlDocument, printDocument, suggestedFileName } from './exports';
import { inspectGeneratedFile, saveGeneratedFile } from '../engine/creator';
import { MarkdownBody } from '../components/MarkdownBody';
import { documentHeadings, documentWordCount } from './document';

export function BlockWorkbench({ block, onClose, onSave, onRewrite, projectFolder, history = [] }: { block: ContentBlock; onClose: () => void; onSave: (block: ContentBlock) => void; onRewrite?: (excerpt: string, document: ContentBlock) => void; projectFolder?: string; history?: { content: string; updatedAt: string }[] }) {
  const [draft, setDraft] = useState(block.content);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [filePath, setFilePath] = useState(suggestedFileName(block));
  const [review, setReview] = useState<{ exists: boolean; current: string } | null>(null);
  const [savingFile, setSavingFile] = useState(false);
  const [search, setSearch] = useState('');
  const [replacement, setReplacement] = useState('');
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => { if (!editing) setDraft(block.content); }, [block.content, block.id]);
  useEffect(() => { setEditing(false); setNotice(''); setDraft(block.content); setFilePath(suggestedFileName(block)); setReview(null); }, [block.id]);
  const current = { ...block, content: draft };
  const save = () => { if (block.status === 'streaming') { setNotice('Wait until generation finishes to save this block.'); return; } onSave(current); setEditing(false); setNotice('Saved to the local Solarium asset library.'); };
  async function reviewFile() {
    if (!projectFolder) return;
    setSavingFile(true); setNotice('');
    try { setReview(await inspectGeneratedFile(projectFolder, filePath.trim())); }
    catch (error) { setNotice(`Cannot review project file: ${String(error)}`); }
    finally { setSavingFile(false); }
  }
  async function applyFile() {
    if (!projectFolder || !review) return;
    setSavingFile(true);
    try {
      await saveGeneratedFile(projectFolder, filePath.trim(), draft, review.exists ? review.current : null);
      setReview(null); setNotice('Saved to the selected project folder. Existing files receive a .solarium.bak backup.');
    } catch (error) { setNotice(`File was not saved: ${String(error)}`); }
    finally { setSavingFile(false); }
  }
  return <aside className="block-workbench" aria-label="Content block workspace">
    <header className="block-workbench-header"><Stack minWidth={0}><Typography fontSize={12} fontWeight={750} noWrap>{block.title}</Typography><Typography fontSize={10} color="text.secondary">{block.kind} · {block.status === 'streaming' ? 'Streaming' : 'Editable asset'}</Typography></Stack><Box flex={1}/><Tooltip title="Close block workspace"><IconButton size="small" aria-label="Close block workspace" onClick={onClose}><CloseRounded fontSize="small"/></IconButton></Tooltip></header>
    <Stack direction="row" gap={.5} px={1} py={.6} flexWrap="wrap">
      <Button size="small" variant={editing ? 'contained' : 'text'} onClick={() => setEditing((v) => !v)} disabled={block.status === 'streaming'}>{editing ? 'Preview' : 'Edit'}</Button>
      <Button size="small" onClick={() => setAdvanced((v) => !v)}>Find / history</Button>
      {block.kind === 'writing' && <Typography fontSize={10} color="text.secondary">{documentWordCount(draft)} words · {draft.length} characters</Typography>}
      {block.kind === 'writing' && onRewrite && <Button size="small" onClick={() => { const field = editorRef.current; if (!field) { setEditing(true); return; } const excerpt = field.value.slice(field.selectionStart, field.selectionEnd).trim(); if (!excerpt) { setNotice('Select the passage you want the Spark to rewrite, then press Ask Spark.'); return; } onRewrite(excerpt, current); }}>Ask Spark to rewrite selection</Button>}
      <Button size="small" startIcon={<SaveOutlined fontSize="small"/>} onClick={save} disabled={block.status === 'streaming'}>Save asset</Button>
      <Button size="small" startIcon={<DownloadRounded fontSize="small"/>} onClick={() => exportBlock(current)}>Export</Button>
      {projectFolder && ['code', 'writing', 'table', 'preview'].includes(block.kind) && <Button size="small" disabled={block.status === 'streaming'} onClick={() => void reviewFile()}>Review to project</Button>}
      {block.kind === 'writing' && <><Button size="small" onClick={() => exportDocx(draft, block.title + '.docx')}>DOCX</Button><Button size="small" onClick={() => exportHtmlDocument(draft, block.title)}>HTML</Button><Button size="small" onClick={() => printDocument(draft, block.title)}>Print / PDF</Button></>}
    </Stack>
    {advanced && <Box px={1} py={.6} className="block-advanced-controls"><Stack direction="row" gap={.7} alignItems="center"><TextField size="small" label="Find" value={search} onChange={(e) => setSearch(e.target.value)}/><TextField size="small" label="Replace" value={replacement} onChange={(e) => setReplacement(e.target.value)}/><Button size="small" disabled={!search || block.status === 'streaming'} onClick={() => { setDraft((text) => text.split(search).join(replacement)); setEditing(true); }}>Replace all</Button></Stack>
      {history.length > 0 && <Box mt={1}><Typography fontSize={10} fontWeight={700}>Previous saved versions</Typography><Stack gap={.4}>{history.slice().reverse().map((item, i) => <Button key={i} size="small" sx={{ justifyContent: 'start' }} onClick={() => { setDraft(item.content); setEditing(true); }}>{new Date(item.updatedAt).toLocaleString()} · Restore in editor</Button>)}</Stack></Box>}
    </Box>}
    {projectFolder && ['code', 'writing', 'table', 'preview'].includes(block.kind) && <TextField size="small" label="Project-relative filename" value={filePath} onChange={(e) => setFilePath(e.target.value)} sx={{ mx: 1, my: .5 }} />}
    {notice && <Alert sx={{ m: 1 }} severity="info" onClose={() => setNotice('')}>{notice}</Alert>}
    <div className="block-workbench-content">{editing && block.kind === 'writing' ? <div className="writing-editor-layout">
      <section className="writing-document-outline"><Typography fontWeight={700} fontSize={11}>Outline</Typography>{documentHeadings(draft).map((heading) => <button key={`${heading.line}-${heading.label}`} style={{ paddingLeft: 7 + heading.level * 9 }} onClick={() => { const field = editorRef.current; if (!field) return; const pos = field.value.split('\n').slice(0, heading.line - 1).reduce((total, line) => total + line.length + 1, 0); field.focus(); field.setSelectionRange(pos, pos); }}>{heading.label}</button>)}</section>
      <textarea ref={editorRef} autoFocus className="writing-markdown-source" aria-label="Editable document markdown" spellCheck value={draft} onChange={(event) => setDraft(event.target.value)} />
      <div className="writing-live-render"><MarkdownBody text={draft}/></div>
    </div> : editing ? <textarea className="block-source-editor" autoFocus spellCheck={false} aria-label="Editable source code" value={draft} onChange={(event) => setDraft(event.target.value)} /> : <ContentBlockBody block={current} />}</div>
    <Typography fontSize={10} color="text.secondary" px={1.5} py={1}>Edits are stored as an independent asset; the original assistant message is never overwritten.</Typography>
    <Dialog open={Boolean(review)} onClose={() => setReview(null)} fullWidth maxWidth="lg"><DialogTitle>Review file changes — {filePath}</DialogTitle><DialogContent>
      <Typography fontSize={11} color="text.secondary" mb={1}>{review?.exists ? 'Compare the existing file against the proposed replacement. An automatic backup is created before overwriting.' : 'This is a new file. Solarium will create it only after you approve.'}</Typography>
      <div className="block-file-diff"><div><Typography fontSize={11} mb={1} fontWeight={700}>Current file</Typography><pre>{review?.exists ? review.current : '(new file)'}</pre></div><div><Typography fontSize={11} mb={1} fontWeight={700}>Proposed file</Typography><pre>{draft}</pre></div></div>
    </DialogContent><DialogActions><Button onClick={() => setReview(null)}>Cancel</Button><Button variant="contained" disabled={savingFile} onClick={() => void applyFile()}>Apply reviewed change</Button></DialogActions></Dialog>
  </aside>;
}
