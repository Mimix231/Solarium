import { useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { CheckCircleOutline, CancelOutlined, ErrorOutline, HourglassTop, TerminalOutlined } from '@mui/icons-material';
import type { SpicaBuildEvent, SpicaBuildStatus } from '../../spica/build-events';
import type { BuildEvidence } from '../../spica/export';

function Marker({ status }: { status: SpicaBuildStatus }) {
  if (status === 'passed') return <CheckCircleOutline fontSize="small" color="success" />;
  if (status === 'failed') return <ErrorOutline fontSize="small" color="error" />;
  if (status === 'cancelled') return <CancelOutlined fontSize="small" color="warning" />;
  return <HourglassTop fontSize="small" color={status === 'running' ? 'primary' : 'disabled'} />;
}

/** Live terminal-like output: stage rows are authoritative export/command notices,
 * and the text region contains only actual native stdout/stderr. */
export function SpicaBuildStream({ events, output, active, evidence, onOpenLogs }: {
  events: readonly SpicaBuildEvent[]; output: string; active: boolean; evidence?: BuildEvidence | null; onOpenLogs(): void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState(false);
  const terminal = useRef<HTMLPreElement>(null);
  const follow = useRef(true);
  useEffect(() => {
    const node = terminal.current;
    if (node && follow.current) node.scrollTop = node.scrollHeight;
  }, [output]);
  const visible = allEvents ? events : events.slice(-48);
  const recorded = !events.length ? evidence?.checks ?? [] : [];
  return <Stack className="spica-build-stream" gap={1.2}>
    <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
      <Stack direction="row" gap={1} alignItems="center">
        <TerminalOutlined fontSize="small" color="primary" />
        <Typography fontWeight={700} fontSize={13}>Build activity</Typography>
        <Chip size="small" label={active ? 'Running' : events.length ? 'Recorded events' : recorded.length ? 'Saved build evidence' : 'Not started'}
          color={active ? 'info' : 'default'} variant="outlined" />
      </Stack>
      <Stack direction="row" gap={.5}>
        {events.length > 48 && <Button size="small" onClick={() => setAllEvents(value => !value)}>
          {allEvents ? 'Latest 48' : `All ${events.length}`}</Button>}
        <Button size="small" onClick={onOpenLogs} disabled={!output && !recorded.length}>Full logs</Button>
      </Stack>
    </Stack>
    <Box className="spica-build-events" component="ol" aria-label="Executed build stages">
      {!events.length && !recorded.length && <Box component="li" className="spica-build-event-empty">
        <Typography color="text.secondary" fontSize={12}>Start Test &amp; Preview to see real export and verification stages.</Typography>
      </Box>}
      {recorded.map(result => <Box component="li" key={result.run_id} className="spica-build-event"
        data-status={result.cancelled ? 'cancelled' : result.timed_out || result.exit_code !== 0 ? 'failed' : 'passed'}>
        <Box className="spica-build-event-icon"><Marker status={result.cancelled ? 'cancelled' : result.timed_out || result.exit_code !== 0 ? 'failed' : 'passed'} /></Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={600} fontSize={12}>{result.command_id}</Typography>
          <Typography fontFamily="monospace" fontSize={10} color="text.secondary">Recorded command · exit {result.exit_code ?? 'unknown'} · {Math.round(result.duration_ms)} ms · run {result.run_id.slice(0, 12)}</Typography>
        </Box>
      </Box>)}
      {visible.map(event => <Box component="li" key={event.eventId} className="spica-build-event" data-status={event.status}>
        <Tooltip title={event.status}><Box className="spica-build-event-icon"><Marker status={event.status} /></Box></Tooltip>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="baseline" gap={.7} flexWrap="wrap">
            <Typography component="span" fontFamily="monospace" fontSize={11} color="text.secondary">
              {new Date(event.timestamp).toLocaleTimeString()}</Typography>
            <Typography component="span" fontWeight={600} fontSize={12} sx={{ overflowWrap: 'anywhere' }}>{event.message}</Typography>
          </Stack>
          <Typography color="text.secondary" fontSize={10}>{event.stage} · {event.status}</Typography>
          {event.commandRunId && <Button size="small" sx={{ p: 0, minWidth: 0, fontSize: 10, textTransform: 'none' }}
            aria-expanded={expanded === event.eventId} onClick={() => setExpanded(value => value === event.eventId ? null : event.eventId)}>
            {expanded === event.eventId ? 'Hide command ID' : 'Inspect command ID'}</Button>}
          {expanded === event.eventId && event.commandRunId && <Typography fontFamily="monospace" fontSize={11}
            sx={{ overflowWrap: 'anywhere' }}>{event.commandRunId}</Typography>}
        </Box>
      </Box>)}
    </Box>
    <Box className="spica-terminal-shell">
      <Stack className="spica-terminal-title" direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <Typography fontFamily="monospace" fontSize={11}>native output / stdout + stderr</Typography>
        <Typography fontSize={10} color="text.secondary">Last 96 KB · source: command runner</Typography>
      </Stack>
      <Box component="pre" ref={terminal} className="spica-terminal-output" role="log" aria-label="Live native build output"
        onScroll={event => { const node = event.currentTarget; follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64; }}>
        {output || (active ? 'Waiting for command output…' : recorded.length ? 'Previous command output is stored in Build Logs. Open its stdout/stderr there.' : 'No native output captured for this run.')}
      </Box>
    </Box>
  </Stack>;
}
