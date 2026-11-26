import { memo, useMemo, useRef, useState } from 'react';
import { Button, Dialog, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { formatSpeakerDialogue, sceneBreak, type SceneSpacerStyle } from '../writing/prose';
import { MarkdownBody } from './MarkdownBody';

const ProseSection = memo(function ProseSection({ text, speakerLayout }: { text: string; speakerLayout: boolean }) {
  return <MarkdownBody prose text={formatSpeakerDialogue(text, [], true, speakerLayout)} />;
});

export const ChapterProse = memo(function ChapterProse({ text, speakerLayout }: { text: string; speakerLayout: boolean }) {
  const sections = useMemo(() => text.split(sceneBreak), [text]);
  return <article className="chapter-prose" aria-label="Chapter text">
    {sections.map((section, index) => <section className="chapter-scene" key={index} data-chapter-scene={index + 1}>
      {index > 0 && <hr aria-label="Scene break" />}
      <ProseSection text={section} speakerLayout={speakerLayout} />
    </section>)}
  </article>;
});

export function ChapterReader({ title, text, speakerLayout, spacer, onClose }: {
  title: string; text: string; speakerLayout: boolean; spacer: SceneSpacerStyle; onClose: () => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState(1);
  const sceneCount = useMemo(() => text.split(sceneBreak).length, [text]);
  function goToScene(value: number) {
    setScene(value);
    scroll.current?.querySelector(`[data-chapter-scene="${value}"]`)?.scrollIntoView({ block: 'start' });
  }
  return <Dialog open onClose={onClose} maxWidth={false} aria-labelledby="chapter-reader-title" className="chapter-reader">
    <header className="chapter-reader-toolbar">
      <Typography id="chapter-reader-title" component="h2" className="chapter-reader-title">{title}</Typography>
      {sceneCount > 1 && <TextField size="small" select label="Jump to scene" value={scene}
        onChange={event => goToScene(Number(event.target.value))} sx={{ minWidth: 130 }}>
        {Array.from({ length: sceneCount }, (_, i) => <MenuItem key={i} value={i + 1}>Scene {i + 1}</MenuItem>)}
      </TextField>}
      <Button size="small" onClick={() => scroll.current?.scrollTo({ top: scroll.current.scrollHeight })}>End</Button>
      <IconButton aria-label="Close chapter reader" onClick={onClose}><CloseRounded /></IconButton>
    </header>
    <div ref={scroll} className="chapter-reader-body" data-scene-spacer={spacer} tabIndex={0} aria-label="Read chapter">
      <ChapterProse text={text} speakerLayout={speakerLayout} />
    </div>
  </Dialog>;
}
