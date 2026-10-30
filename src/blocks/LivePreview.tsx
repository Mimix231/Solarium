import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { createPreviewDocument, describePreviewSource } from './preview-source';

export function LivePreview({ content, finished = true }: { content: string; finished?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const nonce = useRef(`preview-${Math.random().toString(36).slice(2)}`);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [runtime, setRuntime] = useState<{ kind: 'loading' | 'ready' | 'empty' | 'error'; text: string }>({ kind: 'loading', text: 'Preparing preview…' });
  const [showSource, setShowSource] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [stableContent, setStableContent] = useState(content);
  useEffect(() => {
    if (finished) { setStableContent(content); return; }
    const timer = window.setTimeout(() => setStableContent(content), 350);
    return () => window.clearTimeout(timer);
  }, [content, finished]);
  const source = useMemo(() => describePreviewSource(stableContent, finished), [stableContent, finished]);
  const srcDoc = useMemo(() => source.html ? createPreviewDocument(source, nonce.current) : '', [source, refresh]);
  useEffect(() => {
    setRuntime({ kind: 'loading', text: source.description });
  }, [srcDoc, source.kind, source.description]);
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null') return;
      const data: unknown = event.data;
      if (!data || typeof data !== 'object') return;
      const record = data as { solariumPreview?: boolean; id?: string; type?: string; message?: string };
      if (!record.solariumPreview || record.id !== nonce.current) return;
      if (record.type === 'error') setRuntime({ kind: 'error', text: (record.message || 'Preview runtime error').slice(0, 600) });
      if (record.type === 'empty') setRuntime((state) => state.kind === 'error' ? state : { kind: 'empty', text: record.message || 'The preview is empty.' });
      if (record.type === 'ready') setRuntime((state) => state.kind === 'error' ? state : { kind: 'ready', text: 'Preview loaded' });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const viewWidth = viewport === 'mobile' ? 390 : viewport === 'tablet' ? 740 : undefined;
  return <div className="live-preview">
    <Stack direction="row" alignItems="center" gap={.5} className="preview-toolbar" flexWrap="wrap">
      <Typography fontSize={10} sx={{ mr: 'auto' }}>{source.description}</Typography>
      {(['desktop', 'tablet', 'mobile'] as const).map((size) => <Button key={size} size="small" onClick={() => setViewport(size)} variant={viewport === size ? 'contained' : 'text'}>{size}</Button>)}
      <Button size="small" onClick={() => setRefresh((v) => v + 1)} disabled={!srcDoc}>Refresh</Button>
      <Button size="small" onClick={() => setShowSource((v) => !v)}>{showSource ? 'Hide source' : 'Source'}</Button>
    </Stack>
    {source.kind === 'unsupported' || source.kind === 'incomplete' ? <Alert severity={source.kind === 'unsupported' ? 'warning' : 'info'} sx={{ m: 1 }}>{source.description}</Alert> : <>
      {runtime.kind === 'error' || runtime.kind === 'empty' ? <Alert severity={runtime.kind === 'error' ? 'error' : 'warning'} sx={{ m: 1 }}>{runtime.text}</Alert> : <Typography sx={{ px: 1, py: .45 }} color="text.secondary" fontSize={10}>{runtime.kind === 'ready' ? '● Preview ready · offline sandbox' : 'Preparing isolated preview…'}</Typography>}
      <Box className="preview-viewport"><iframe key={`${refresh}-${source.kind}`} ref={frame} onLoad={() => setRuntime((state) => state.kind === 'error' || state.kind === 'empty' ? state : { kind: 'ready', text: 'Preview loaded' })} title="Isolated live code preview" className="block-preview-frame" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={srcDoc} style={{ maxWidth: viewWidth, width: '100%' }} /></Box>
    </>}
    {showSource && <pre className="preview-source">{content}</pre>}
  </div>;
}
