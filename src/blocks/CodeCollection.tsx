import { useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { ContentBlock } from './protocol';
import { ContentBlockBody } from './BlockCard';
import { exportBlock } from './exports';
import { composeWebPreview } from './preview-source';
import { LivePreview } from './LivePreview';
export function CodeCollection({ blocks, onOpen, onSaveAsset, assets = {} }: { blocks: ContentBlock[]; onOpen?: (block: ContentBlock) => void; onSaveAsset?: (block: ContentBlock) => void; assets?: Record<string, string> }) {
  const [active, setActive] = useState(blocks[0]!.id);
  const selected = blocks.find((block) => block.id === active) ?? blocks[0]!;
  const content = assets[selected.id] ?? selected.content;
  const block = { ...selected, content };
  const [preview, setPreview] = useState(false);
  const webSource = composeWebPreview(blocks.map((item) => ({ language: item.language, content: assets[item.id] ?? item.content })));
  return <section className="solarium-block block-file-collection" aria-label={`Generated source files (${blocks.length})`}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" className="block-titlebar" px={1.2} py={.6}><Typography fontWeight={750} fontSize={11}>▤ Generated files</Typography><Chip size="small" label={`${blocks.length} files`} /></Stack>
    <div className="block-file-tabs">{blocks.map((item) => <button key={item.id} className={block.id === item.id ? 'selected' : ''} onClick={() => setActive(item.id)}>{item.title}</button>)}</div>
    <div className="block-body">{preview && webSource ? <LivePreview content={webSource} finished={blocks.every((item) => item.status === 'complete')}/> : <ContentBlockBody block={block}/>}</div>
    <Stack direction="row" gap={.7} justifyContent="flex-end" px={1} py={.6} className="block-footer"><Typography fontSize={10} color="text.secondary" sx={{ mr: 'auto' }}>{block.language} · {block.status}</Typography>{webSource && <Button size="small" onClick={() => setPreview((value) => !value)}>{preview ? 'Source' : 'Preview'}</Button>}<Button size="small" onClick={() => exportBlock(block)}>Export</Button>{onSaveAsset && <Button size="small" onClick={() => onSaveAsset(block)} disabled={block.status === 'streaming'}>Save asset</Button>}{onOpen && <Button size="small" onClick={() => onOpen(block)}>Open editor</Button>}</Stack>
    <Box px={1} pb={.5} fontSize={10} color="text.secondary">Each file can be edited and reviewed independently before saving to a project.</Box>
  </section>;
}
