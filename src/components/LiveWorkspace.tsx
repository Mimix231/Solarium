import { useMemo, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import CodeRounded from '@mui/icons-material/CodeRounded';
import LanguageRounded from '@mui/icons-material/LanguageRounded';
import TerminalRounded from '@mui/icons-material/TerminalRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import hljs from 'highlight.js/lib/common';
import { MarkdownBody } from './MarkdownBody';
import type { LiveWorkspaceUpdate } from '../engine/live-workspace';

const extToLanguage: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', rs: 'rust',
  py: 'python', css: 'css', html: 'xml', json: 'json', sh: 'bash', yml: 'yaml', yaml: 'yaml',
  cpp: 'cpp', c: 'c', java: 'java', sql: 'sql', md: 'markdown', xml: 'xml', toml: 'ini',
};
export function LiveWorkspace({ update, onReturn }: { update: LiveWorkspaceUpdate; onReturn: () => void }) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const current = update.files?.find((f) => f.path === selectedPath) ?? update.files?.find((f) => f.path === update.activeFile) ?? update.files?.at(-1);
  const lang = current?.path.split('.').at(-1)?.toLowerCase() ?? '';
  const source = current?.content ?? '';
  const lines = source.split('\n').length;
  const syntax = useMemo(() => {
    const language = extToLanguage[lang];
    if (!language || !hljs.getLanguage(language)) return null;
    // highlight.js escapes HTML; this string contains syntax highlighting only,
    // not arbitrary unescaped HTML from the model.
    try { return hljs.highlight(source, { language, ignoreIllegals: true }).value; }
    catch { return null; }
  }, [lang, source]);
  const isCode = update.kind === 'generate' || update.kind === 'edit' || update.kind === 'save';
  return <section className="live-workspace" aria-label="Live work workspace">
    <div className="live-workspace-heading">
      <Stack direction="row" gap={1} alignItems="center" minWidth={0}>
        {isCode ? <CodeRounded fontSize="small" /> : update.kind === 'search' ? <LanguageRounded fontSize="small" /> : <TerminalRounded fontSize="small" />}
        <Box minWidth={0}><Typography fontWeight={750} fontSize={13} noWrap>{update.title}</Typography>
          <Typography color="text.secondary" fontSize={10} noWrap>{update.detail ?? (update.status === 'running' ? 'Receiving real work events…' : update.status)}</Typography></Box>
      </Stack>
      <Stack direction="row" gap={.6} alignItems="center">
        <Chip variant="outlined" size="small" label={update.status === 'running' ? 'Live' : update.status} />
        <Button size="small" onClick={onReturn} startIcon={<CloseRounded fontSize="small" />}>Chat</Button>
      </Stack>
    </div>
    {Boolean(update.files?.length) && <div className="live-workspace-tabs" role="tablist" aria-label="Generated source files">
      {update.files!.map((file) => <button type="button" role="tab" aria-selected={current?.path === file.path} key={file.path}
        className={current?.path === file.path ? 'active' : ''} onClick={() => setSelectedPath(file.path)}>{file.path.split('/').at(-1)}{file.complete ? '' : ' ·'}</button>)}
    </div>}
    {update.kind === 'writing' ? <div className="live-workspace-document"><MarkdownBody text={update.output ?? ''} /></div> : update.kind === 'search' && update.sources?.length ? <div className="visual-source-grid live-source-grid">{update.sources.filter(source => /^https:\/\//i.test(source.url)).map(source => <a key={source.url} className="visual-source-tile" href={source.url} target="_blank" rel="noopener noreferrer"><span className="visual-source-favicon">◈</span><span className="visual-source-title">{source.title || source.url}</span><small>{new URL(source.url).hostname}</small><span className="visual-source-state">{source.status === 'read' ? '✓ Read' : source.status === 'reading' ? 'Reading…' : source.status === 'failed' ? 'Failed' : 'Found'}</span></a>)}</div> : current ? <div className="live-workspace-code" aria-label={`Streaming source: ${current.path}`}>
      <div className="live-workspace-file"><span>{current.path}</span><span>{lines} lines · {current.complete ? 'Buffered for review' : 'Streaming source…'}</span></div>
      <div className="live-workspace-source"><div className="live-workspace-gutter" aria-hidden="true">{Array.from({ length: lines }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
        {syntax ? <pre><code className="hljs" dangerouslySetInnerHTML={{ __html: syntax }} /></pre> : <pre><code>{source}</code></pre>}
      </div>
    </div> : update.url ? <div className="live-workspace-summary">
      <Typography fontWeight={700} fontSize={12} overflow="hidden" textOverflow="ellipsis">{update.url}</Typography>
      <Typography color="text.secondary" fontSize={12} sx={{ whiteSpace: 'pre-wrap' }}>{update.detail}</Typography>
      {update.output && <pre className="live-workspace-page">{update.output.slice(0, 12_000)}</pre>}
    </div> : <div className="live-workspace-summary"><Typography fontSize={12} color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{update.output || update.detail || 'Waiting for the operation to return data…'}</Typography></div>}
    <div className="live-workspace-footer">{update.status === 'running' ? 'Work in progress — source remains temporary until the native tool confirms the write.' : 'Operation returned a result. The conversation contains the final outcome.'}</div>
  </section>;
}
