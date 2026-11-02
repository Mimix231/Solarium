import { CodeRepository } from '../coding/artifacts/repository';
import { codeArtifactEvents } from '../coding/artifacts/events';
import { GeneratedCodeCard } from '../coding/components/GeneratedCodeCard';
import type { CodeBlockContext } from '../coding/artifacts/context';
import { useEffect,useState,useSyncExternalStore } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { ContentBlock } from './protocol';
import { ContentBlockBody } from './BlockCard';
import { exportBlock } from './exports';
import { composeWebPreview } from './preview-source';
import { LivePreview } from './LivePreview';
export function CodeCollection({ blocks, onOpen, onSaveAsset, assets = {},codeContext }: { blocks: ContentBlock[];codeContext?:CodeBlockContext; onOpen?: (block: ContentBlock) => void; onSaveAsset?: (block: ContentBlock) => void; assets?: Record<string, string> }) {
  const change=useSyncExternalStore(codeArtifactEvents.subscribe,codeArtifactEvents.snapshot,codeArtifactEvents.snapshot);
  const [sourceError,setSourceError]=useState('');
  const [stored,setStored]=useState<Record<string,string>>({});
  const sessionId=codeContext?.access.sessionId,projectId=codeContext?.access.projectId,messageId=codeContext?.messageId,streaming=codeContext?.streaming;
  useEffect(()=>{if(!sessionId||!messageId||streaming)return;let disposed=false;const repo=new CodeRepository({sessionId,projectId:projectId??null});void(async()=>{const items=await repo.list(),next:Record<string,string>={};for(const block of blocks){const artifact=items.find(r=>r.data.origin.sessionId===sessionId&&r.data.origin.messageId===messageId&&r.data.origin.blockId===block.id);if(artifact)next[block.id]=(await repo.get(artifact.id)).content;}if(!disposed){setStored(next);setSourceError('');}})().catch(error=>{if(!disposed)setSourceError(String(error));});return()=>{disposed=true;};},[sessionId,projectId,messageId,streaming,blocks,change]);
  const [active, setActive] = useState(blocks[0]!.id);
  const selected = blocks.find((block) => block.id === active) ?? blocks[0]!;
  const content = (!streaming?stored[selected.id]:undefined)??assets[selected.id]??selected.content;
  const block = { ...selected, content };
  const [preview, setPreview] = useState(false);
  const webSource = composeWebPreview(blocks.map((item) => ({ language: item.language, content: (!streaming?stored[item.id]:undefined)??assets[item.id]??item.content })));
  return <section className="solarium-block block-file-collection" aria-label={`Generated source files (${blocks.length})`}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" className="block-titlebar" px={1.2} py={.6}><Typography fontWeight={750} fontSize={11}>▤ Generated files</Typography><Chip size="small" label={`${blocks.length} files`} /></Stack>
    {sourceError&&<Alert severity="warning">{sourceError}</Alert>}
    <div className="block-file-tabs">{blocks.map((item) => <button key={item.id} className={block.id === item.id ? 'selected' : ''} onClick={() => setActive(item.id)}>{item.title}</button>)}</div>
    <div className="block-body">{preview && webSource ? <LivePreview content={webSource} finished={blocks.every((item) => item.status === 'complete')}/> : codeContext?<GeneratedCodeCard block={selected} legacyContent={assets[selected.id]} context={codeContext}/>:<ContentBlockBody block={block}/>}</div>
    <Stack direction="row" gap={.7} justifyContent="flex-end" px={1} py={.6} className="block-footer"><Typography fontSize={10} color="text.secondary" sx={{ mr: 'auto' }}>{block.language} · {block.status}</Typography>{webSource && <Button size="small" onClick={() => setPreview((value) => !value)}>{preview ? 'Source' : 'Preview'}</Button>}{!codeContext&&<Button size="small" onClick={() => exportBlock(block)}>Export</Button>}{!codeContext&&onSaveAsset && <Button size="small" onClick={() => onSaveAsset(block)} disabled={block.status === 'streaming'}>Save asset</Button>}{!codeContext&&onOpen && <Button size="small" onClick={() => onOpen(block)}>Open editor</Button>}</Stack>
    <Box px={1} pb={.5} fontSize={10} color="text.secondary">Each file can be edited and reviewed independently before saving to a project.</Box>
  </section>;
}
