import { useEffect, useState } from 'react';
import { Box, Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { formatThinkingDuration } from '../engine/duration';
import { MarkdownBody } from './MarkdownBody';

export interface ThinkingSnapshot { text: string; elapsedMs: number; active: boolean; activeStartedAt?: number }


/** One compact panel for the whole message; no artificial cycle or stage labels. */
export function ThinkingPanel({ snapshot, busy = false, busyStartedAt, status = 'generating' }: { snapshot?: ThinkingSnapshot; busy?: boolean; busyStartedAt?: number | null; status?: 'searching' | 'loading' | 'generating' }) {
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!busy && !snapshot?.active) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 250);
    return () => window.clearInterval(timer);
  }, [busy, snapshot?.active]);
  // tick triggers a rerender while the phase is active, but isn't shown as a fake percent.
  void tick;
  if (!busy && !snapshot?.text) return null;
  const hasReasoning = Boolean(snapshot?.text);
  const duration = (snapshot?.elapsedMs ?? 0) + (snapshot?.active && snapshot.activeStartedAt !== undefined ? Math.max(0, performance.now() - snapshot.activeStartedAt) : 0);
  const title = hasReasoning || snapshot?.active
    ? `${busy && snapshot?.active ? 'Thinking' : 'Thought'} for ${formatThinkingDuration(duration)}`
    : `${status === 'searching' ? 'Searching web' : status === 'loading' ? 'Loading model' : 'Generating'} for ${formatThinkingDuration(busyStartedAt === null || busyStartedAt === undefined ? 0 : performance.now() - busyStartedAt)}`;
  return <section className={`thinking-panel ${busy ? 'is-active' : ''}`} aria-label="Model reasoning">
    <button className="thinking-header" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      <span className="thinking-star" aria-hidden="true">✧</span>
      <span className="thinking-label">{title}</span>
      {hasReasoning && <span className="thinking-caption">Model reasoning</span>}
      <Tooltip title={expanded ? 'Collapse reasoning' : 'Expand available reasoning'}><span><IconButton component="span" size="small" tabIndex={-1}><ExpandMoreRounded className={expanded ? 'thinking-chevron open' : 'thinking-chevron'} sx={{ fontSize: 15 }} /></IconButton></span></Tooltip>
    </button>
    {busy && <div className="thinking-glow" aria-hidden="true"><i /></div>}
    <Collapse in={expanded}>
      <Box className="thinking-detail">{hasReasoning ? <div className="thinking-markdown"><MarkdownBody text={snapshot?.text ?? ''}/></div>
        : <Typography color="text.secondary" fontSize={11}>This model has not exposed a reasoning channel. No thoughts are simulated.</Typography>}</Box>
    </Collapse>
  </section>;
}
