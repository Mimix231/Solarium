import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { Check, Close, Remove } from '@mui/icons-material';
import { stageStatus, stageForCommand, type SpicaBuildEvent, type SpicaBuildStage, type SpicaBuildStatus } from '../../spica/build-events';
import type { BuildEvidence } from '../../spica/export';

const desktopPhases: { stage: SpicaBuildStage; label: string }[] = [
  { stage: 'generate', label: 'Export' },
  { stage: 'prepare', label: 'Dependencies' },
  { stage: 'compile', label: 'Compile' },
  { stage: 'native-test', label: 'Native tests' },
  { stage: 'desktop-build', label: 'Desktop build' },
  { stage: 'scenario-test', label: 'Scenarios' },
  { stage: 'preview', label: 'Preview' },
];

const webPhases: {stage:SpicaBuildStage;label:string}[] = [
  {stage:'generate',label:'Export'}, {stage:'prepare',label:'Dependencies'},
  {stage:'compile',label:'Web build'}, {stage:'web-assets',label:'Static assets'}, {stage:'preview',label:'Graph preview'},
];

/** Recover only persisted command outcomes; do not invent export or preview events. */
export function evidenceStageStatus(evidence: BuildEvidence | null | undefined, stage: SpicaBuildStage): SpicaBuildStatus {
  if (!evidence) return 'queued';
  const checks = evidence.checks.filter(check => stageForCommand(check.command_id) === stage);
  const check = checks.at(-1);
  if (!check) return 'queued';
  if (check.cancelled) return 'cancelled';
  return check.timed_out || check.exit_code !== 0 ||
    (check.source_before && check.source_after && check.source_before !== check.source_after) ? 'failed' : 'passed';
}
export function SpicaBuildTimeline({ events, evidence, target = 'desktop' }: { events: readonly SpicaBuildEvent[]; evidence?: BuildEvidence | null; target?: 'desktop'|'web' }) {
  return <Stack className="spica-build-timeline" direction="row" gap={.4} aria-label="Actual build stage statuses">
    {(target === 'web' ? webPhases : desktopPhases).map(({ stage, label }) => {
      const status = events.length ? stageStatus(events, stage) : evidenceStageStatus(evidence, stage);
      return <Tooltip key={stage} title={`${label}: ${status}`}>
        <Box className="spica-timeline-step" data-status={status}>
          <Box className="spica-timeline-dot" aria-hidden="true">
            {status === 'passed' ? <Check sx={{ fontSize: 12 }} /> : status === 'failed' || status === 'cancelled' ?
              <Close sx={{ fontSize: 12 }} /> : status === 'running' ? <span className="spica-timeline-spinner" /> : <Remove sx={{ fontSize: 12 }} />}
          </Box>
          <Typography fontSize={10} fontWeight={status === 'running' ? 700 : 500}>{label}</Typography>
          <Box component="span" className="spica-sr-only">{status}</Box>
        </Box>
      </Tooltip>;
    })}
  </Stack>;
}
