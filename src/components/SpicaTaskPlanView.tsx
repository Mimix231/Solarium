import {Box, Button, Chip, Collapse, FormControl, LinearProgress, MenuItem, Select, Stack, Tooltip, Typography} from '@mui/material';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import PauseCircleOutlineRounded from '@mui/icons-material/PauseCircleOutlineRounded';
import PlayCircleOutlineRounded from '@mui/icons-material/PlayCircleOutlineRounded';
import CancelOutlined from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import RadioButtonCheckedRounded from '@mui/icons-material/RadioButtonCheckedRounded';
import RadioButtonUncheckedRounded from '@mui/icons-material/RadioButtonUncheckedRounded';
import type {AgentCycleBudget} from '../engine/intelligence/agent-budget';
import type {SpicaTaskPlan} from '../engine/intelligence/spica-task-orchestrator';

/** Plan status is sourced only from recorded tool results and committed graph revisions. */
export function SpicaTaskPlanView({plan,expanded,onToggle,busy,budget,onBudgetChange,onPause,onResume,onCancel,proposed=false}:
  {plan:SpicaTaskPlan|null;expanded:boolean;onToggle:()=>void;busy:boolean;
    budget:AgentCycleBudget;onBudgetChange:(value:AgentCycleBudget)=>void;
    onPause:()=>void;onResume:()=>void;onCancel:()=>void;proposed?:boolean}) {
  if(!plan&&!proposed)return null;
  const steps=plan?.steps??[];
  const completed=steps.filter(s=>s.state==='completed').length;
  const cycle=plan?.cycles.at(-1);
  const used=cycle?.promptTokens??null;
  const limit=cycle?.budget??(budget==='auto'?null:budget);
  const proportion=used!==null&&limit!==null?Math.min(100,Math.round(used/limit*100)):0;
  return <Box sx={{mb:1,p:1.25,border:'1px solid rgba(83,204,213,.32)',borderRadius:2.5,
    bgcolor:'rgba(12,29,46,.68)',backdropFilter:'blur(16px)',boxShadow:'inset 0 1px 0 rgba(214,251,255,.08)'}} aria-label="SPICA build plan">
    <Stack direction="row" alignItems="center" gap={1} justifyContent="space-between">
      <Button size="small" color="info" startIcon={<VisibilityOutlined fontSize="small"/>} onClick={onToggle}
        aria-expanded={expanded} aria-controls="spica-build-plan-details" sx={{textTransform:'none',fontWeight:750}}>
        Plan {plan?`· ${completed}/${steps.length}`: '· Ready to create'}
      </Button>
      {plan&&<Stack direction="row" alignItems="center" gap={.6}>
        <Chip size="small" variant="outlined" color={plan.status==='completed'?'success':plan.status==='blocked'?'error':plan.status==='paused'?'warning':'info'} label={plan.status}/>
        <Typography fontSize={10} color="text.secondary">Revision {plan.graphRevision??'—'}</Typography>
      </Stack>}
    </Stack>
    <Collapse in={expanded} id="spica-build-plan-details">
      <Stack gap={1.2} sx={{pt:1}}>
        <Typography fontSize={11} fontWeight={650}>{plan?.goal??'A project build plan will be created when the request is sent.'}</Typography>
        {plan&&<LinearProgress variant="determinate" value={steps.length?completed/steps.length*100:0} sx={{height:5,borderRadius:5}}/>}
        {steps.map(step=><Stack direction="row" key={step.id} gap={1} alignItems="flex-start">
          {step.state==='completed'?<CheckCircleOutlineRounded color="success" sx={{fontSize:17}}/>:
            step.state==='active'?<RadioButtonCheckedRounded color="info" sx={{fontSize:17}}/>:
              <RadioButtonUncheckedRounded color="disabled" sx={{fontSize:17}}/>}
          <Box flex={1} minWidth={0}>
            <Typography fontSize={11} fontWeight={step.state==='active'?700:500}>{step.title}</Typography>
            {step.evidence.length>0&&<Typography color="text.secondary" fontSize={10} sx={{overflowWrap:'anywhere'}}>{step.evidence.at(-1)}</Typography>}
          </Box>
        </Stack>)}
        {plan?.lastError&&<Typography color="warning.main" fontSize={10} sx={{overflowWrap:'anywhere'}}>
          Last diagnostic: {plan.lastError}
        </Typography>}
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Typography color="text.secondary" fontSize={10}>Cycle budget</Typography>
          <FormControl size="small">
            <Select size="small" aria-label="SPICA context budget" value={String(budget)} disabled={busy}
              onChange={e=>onBudgetChange(e.target.value==='auto'?'auto':Number(e.target.value) as 2048|4096|8192)}
              sx={{fontSize:10,height:25}}>
              {[2048,4096,8192].map(size=><MenuItem key={size} value={String(size)}>{size.toLocaleString()} tokens</MenuItem>)}
              <MenuItem value="auto">Model capacity</MenuItem>
            </Select>
          </FormControl>
          {cycle&&<Typography color="text.secondary" fontSize={10}>Cycle {cycle.index} · {cycle.tokenSource==='server'?'server count + estimated tools':cycle.tokenSource==='estimate'?'estimated':'unmeasured'}</Typography>}
        </Stack>
        {limit!==null&&<Tooltip title="Prompt and offered tools count against this budget. Generation is not interrupted at this number.">
          <Box><LinearProgress value={proportion} variant="determinate" color="info" sx={{height:4,borderRadius:5}}/>
            <Typography mt={.5} color="text.secondary" fontSize={10}>{used===null?'Awaiting token measurement':`${used.toLocaleString()} / ${limit.toLocaleString()} prompt tokens`}</Typography></Box>
        </Tooltip>}
        <Stack direction="row" gap={.6} flexWrap="wrap">
          {busy&&<Button size="small" startIcon={<PauseCircleOutlineRounded/>} onClick={onPause}>Pause</Button>}
          {!busy&&plan&&plan.status!=='completed'&&plan.status!=='cancelled'&&<Button size="small" startIcon={<PlayCircleOutlineRounded/>} onClick={onResume}>Resume</Button>}
          {plan&&plan.status!=='completed'&&plan.status!=='cancelled'&&<Button size="small" color="inherit" startIcon={<CancelOutlined/>} onClick={onCancel}>Cancel task</Button>}
        </Stack>
      </Stack>
    </Collapse>
  </Box>;
}
