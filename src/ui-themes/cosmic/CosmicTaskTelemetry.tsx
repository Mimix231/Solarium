import type {SpicaTaskPlan} from '../../engine/intelligence/spica-task-orchestrator';
import type {AgentCycleBudget} from '../../engine/intelligence/agent-budget';
import {Box, LinearProgress, Stack, Typography} from '@mui/material';
import DataObjectRounded from '@mui/icons-material/DataObjectRounded';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import HistoryRounded from '@mui/icons-material/HistoryRounded';

/** Cosmetic-only readout of committed SPICA evidence, never fabricated build status. */
export function CosmicTaskTelemetry({plan,budget}:{plan:SpicaTaskPlan;budget:AgentCycleBudget}) {
  const steps=plan.steps;
  const completed=steps.filter(step=>step.state==='completed').length;
  const cycle=plan.cycles.at(-1);
  const target=cycle?.budget??(budget==='auto'?null:budget);
  const latest=plan.batches?.at(-1);
  const lastThought=plan.thoughts?.at(-1);
  const checkpoint=[...(plan.batches??[])].reverse().find(batch=>batch.status==='checkpointed');
  return <aside className="cosmic-telemetry" aria-label="Cosmic build telemetry">
    <section className="cosmic-telemetry-panel">
      <header><AutoAwesomeRounded/><strong>Task State</strong></header>
      <Typography fontSize={11} color="text.secondary">{plan.goal}</Typography>
      <dl><div><dt>State</dt><dd>{plan.status}</dd></div><div><dt>Graph revision</dt><dd>{plan.graphRevision??'none'}</dd></div>
        <div><dt>Verified changes</dt><dd>{plan.verifiedChanges}</dd></div><div><dt>Build progress</dt><dd>{completed}/{steps.length} stages</dd></div></dl>
      <LinearProgress value={steps.length?completed/steps.length*100:0} variant="determinate"/>
    </section>
    <section className="cosmic-telemetry-panel">
      <header><DataObjectRounded/><strong>Working Context</strong></header>
      <Typography fontSize={11} color="text.secondary">Per-inference working target: {target?.toLocaleString()??'model capacity'} tokens</Typography>
      <LinearProgress value={target&&cycle?.promptTokens!=null?Math.min(100,cycle.promptTokens/target*100):0} variant="determinate"/>
      <Typography fontSize={10} color="text.secondary">{cycle?.promptTokens!=null?cycle.promptTokens.toLocaleString():'Unmeasured'} input tokens · last natural tool turn</Typography>
      <Typography fontSize={10} color="text.secondary">Action batch {latest?.index??'—'} · {latest?.thoughtIndices.length??0} turns · {latest?.toolCalls??0} calls</Typography>
    </section>
    <section className="cosmic-telemetry-panel">
      <header><ShieldOutlined/><strong>Verification</strong></header>
      {steps.map(step=><div className="cosmic-telemetry-step" key={step.id}><span className={`cosmic-led ${step.state}`}/><span>{step.title}</span><small>{step.state}</small></div>)}
      {plan.lastError&&<Typography fontSize={10} color="warning.main">{plan.lastError}</Typography>}
    </section>
    <section className="cosmic-telemetry-panel">
      <header><HistoryRounded/><strong>Checkpoint & Activity</strong></header>
      <Stack gap={.7}>
        {checkpoint?<Box className="cosmic-checkpoint"><strong>Saved revision {checkpoint.toRevision??'—'}</strong>
          <Typography fontSize={10} color="text.secondary">{checkpoint.toolCalls} real tool calls · {checkpoint.failures} failed</Typography>
          <Typography fontSize={10} color="text.secondary">Onion-skin summary saved for the next action batch</Typography></Box>
          :<Typography fontSize={10} color="text.secondary">No verified action-batch checkpoint yet.</Typography>}
        {lastThought?.toolResults.slice(-4).map(result=><Typography key={result.id} fontSize={10} color={result.status==='completed'?'success.main':'warning.main'}>
          {result.status==='completed'?'✓':'!'} {result.name}</Typography>)}
      </Stack>
    </section>
  </aside>;
}
