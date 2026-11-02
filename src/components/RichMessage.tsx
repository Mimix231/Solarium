import { useMemo, useRef, useState } from 'react';
import { Box, Button, Chip, Dialog, DialogContent, Stack, Typography } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import type { ChatAttachment, ChatSource, TerminalRun } from '../domain/types';
import type { ContentBlock } from '../blocks/protocol';
import { BlockStreamAssembler, groupCodeFiles, INLINE_FORMAT_KINDS } from '../blocks/protocol';
import { GeneratedCodeCard } from '../coding/components/GeneratedCodeCard';
import type { CodeBlockContext } from '../coding/artifacts/context';
import { CodeCollection } from '../blocks/CodeCollection';
import { BlockCard, ContentBlockBody } from '../blocks/BlockCard';
import { parseDataTable } from '../blocks/data';
import { MarkdownBody } from './MarkdownBody';
import { CommandOutput } from './CommandOutput';
import { InlineWritingBlock, type WritingBlockContext } from './InlineWritingBlock';

/** Stable streaming blocks render from the entire accumulated answer; stream boundaries never close fences. */
export function RichMessage({ text, attachments = [], sources = [], assets = {}, terminalRuns = [], projectFolder,onOpenBlock, onSaveAsset, writingContext,codeContext, streaming = false }:
  { text: string; attachments?: ChatAttachment[]; sources?: ChatSource[]; assets?: Record<string, string>; terminalRuns?: TerminalRun[];
    projectFolder?:string;codeContext?:CodeBlockContext;writingContext?:WritingBlockContext;onOpenBlock?: (block: ContentBlock) => void; onSaveAsset?: (block: ContentBlock) => void; streaming?: boolean }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const assembler = useRef(new BlockStreamAssembler());
  const parts = useMemo(() => {
    if (!text.startsWith(assembler.current.text)) assembler.current.reset();
    assembler.current.push(text.slice(assembler.current.text.length));
    const snapshot = assembler.current.snapshot();
    return groupCodeFiles(streaming ? snapshot : snapshot.map((part) => part.type === 'block' && part.block.status === 'streaming' ? { ...part, block: { ...part.block, status: 'incomplete' as const } } : part));
  }, [text, streaming]);
  function formattedPart(block: ContentBlock) {
    if (block.kind === 'table') {
      const table = parseDataTable(block.content);
      if (table) {
        const esc = (v: unknown) => String(v ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
        const rows = [table.columns.map(esc).join(' | '), table.columns.map(() => '---').join(' | '), ...table.rows.map((r) => r.map(esc).join(' | '))];
        return <MarkdownBody text={rows.map((r) => `| ${r} |`).join('\n')} />;
      }
    }
    if (block.kind === 'equation') return <MarkdownBody text={`$$\n${block.content}\n$$`} />;
    return <div className={`rich-inline-${block.kind}`}><ContentBlockBody block={block}/></div>;
  }
  return <div className="rich-message">
    {parts.map((part, i) => part.type === 'markdown'
      ? <MarkdownBody key={`md-${i}`} text={part.text}/>
      : part.type === 'collection' ? <CodeCollection key={part.id} blocks={part.blocks} codeContext={codeContext} assets={assets} onOpen={onOpenBlock} onSaveAsset={onSaveAsset}/>
      : INLINE_FORMAT_KINDS.has(part.block.kind)
        ? <div key={part.block.id} className="rich-inline-format">{formattedPart(part.block)}</div>
        : part.block.kind === 'terminal' || part.block.kind === 'file'
          ? <details key={part.block.id} className="verified-output"><summary>{part.block.kind === 'terminal' ? '▸ Proposed terminal text · not executed' : '▸ Proposed file · not saved'}</summary><pre>{part.block.content}</pre></details>
          : part.block.kind === 'writing' && writingContext ? <InlineWritingBlock key={part.block.id} block={part.block} context={writingContext} onAdvanced={() => onOpenBlock?.(part.block)}/>
          : codeContext&&['code','preview'].includes(part.block.kind)?<GeneratedCodeCard key={part.block.id} block={part.block} legacyContent={assets[part.block.id]} context={codeContext}/>
          : <BlockCard key={part.block.id} block={assets[part.block.id] !== undefined ? { ...part.block, content: assets[part.block.id]! } : part.block} onOpen={onOpenBlock} onSaveAsset={onSaveAsset}/>)}
    {terminalRuns.map((run,index)=><CommandOutput key={`terminal-${index}`} run={run} root={projectFolder}/>)}
    {attachments.length > 0 && <div className="message-attachments">{attachments.map((attachment) => <div className="attachment-card" key={attachment.id}>
      {attachment.kind === 'image' && attachment.dataUrl ? <button className="attachment-image" onClick={() => setLightbox(attachment.dataUrl!)}><img src={attachment.dataUrl} alt={attachment.name} loading="lazy" /></button> : <span className="attachment-file-icon">▤</span>}
      <Stack minWidth={0}><Typography fontSize={11} fontWeight={700} noWrap>{attachment.name}</Typography><Typography fontSize={9} color="text.secondary">{attachment.kind} · {(attachment.size / 1024).toFixed(0)} KB</Typography></Stack>
    </div>)}</div>}
    {sources.length > 0 && <Box className="message-sources"><Typography fontSize={10.5} color="text.secondary" fontWeight={750} mb={.8}>Sources read or searched</Typography><Stack direction="row" gap={.6} flexWrap="wrap">{sources.map((s, i) => <Chip key={s.url + i} clickable component="a" href={s.url} target="_blank" rel="noopener noreferrer" size="small" variant="outlined" label={`${i + 1}. ${s.title || s.url}`} title={s.excerpt}/>)}</Stack></Box>}
    <Dialog open={Boolean(lightbox)} onClose={() => setLightbox(null)} maxWidth="xl"><DialogContent sx={{ position: 'relative', p: 1, bgcolor: '#111827' }}><Button onClick={() => setLightbox(null)} sx={{ position: 'absolute', right: 8, top: 8 }}><CloseRounded/></Button>{lightbox && <img src={lightbox} alt="Expanded attachment" className="image-lightbox"/>}</DialogContent></Dialog>
  </div>;
}
