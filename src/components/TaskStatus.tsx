import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { foundationStore } from '../foundation/store';
import type { AccessContext, StoredRecord } from '../foundation/types';
import { accessibleScopes } from '../foundation/types';
import type { TaskData } from '../engine/intelligence/task';
interface WritingTaskStatus {sessionId:string;state:string;characters:number;words:number;documentId:string;target:{minimum:number;unit:string}|null;originalGoal:string;stopReason?:string}
/** Recovery belongs to its conversation; this is not a permanent Activity panel. */
export function TaskStatus({access,busy,onResume,onDocument}:{access:AccessContext;busy:boolean;onResume:(request:string)=>void;onDocument:(id:string)=>void}){
  const [coding,setCoding]=useState<StoredRecord<TaskData>|null>(null),[writing,setWriting]=useState<StoredRecord<WritingTaskStatus>|null>(null);
  const {sessionId,projectId}=access;const scopes=useMemo(()=>accessibleScopes({sessionId,projectId}),[sessionId,projectId]);
  useEffect(()=>{let disposed=false;setCoding(null);setWriting(null);const refresh=async()=>{
    const [tasks,chapters]=await Promise.all([foundationStore.list<TaskData>({collection:'task_execution',scopes}),foundationStore.list<WritingTaskStatus>({collection:'writing_task',scopes})]);if(disposed)return;
    const latest=tasks.filter(t=>t.data.sessionId===sessionId&&Boolean(t.data.appPlan||t.data.verification?.writes||t.data.verification?.required.length)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];setCoding(latest??null);
    setWriting(chapters.filter(t=>t.data.sessionId===sessionId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]??null);
  };void refresh().catch(()=>{});const timer=setInterval(()=>void refresh().catch(()=>{}),2000);return()=>{disposed=true;clearInterval(timer);};},[scopes,sessionId,busy]);
  return <Stack gap={.5}>
    {coding&&coding.data.state!=='completed'&&<Alert severity={coding.data.state==='blocked'?'warning':'info'} action={<Button disabled={busy} onClick={()=>onResume('Resume the coding task. Keep its original outcome, inspect the saved diagnostics, repair unresolved checks and verify completion.')}>Resume task</Button>}><Typography fontSize={11}>Coding task {busy?'in progress':coding.data.state==='working'?'interrupted':coding.data.state} · {coding.data.verification?.writes??0} confirmed writes · {Object.values(coding.data.verification?.checks??{}).filter(c=>c.status==='failed').length} unresolved failed checks. Commands and diagnostics remain saved.</Typography></Alert>}
    {coding?.data.appPlan&&<details className="glass" style={{padding:'8px 12px'}}><summary>Application · {coding.data.appPlan.steps.filter(s=>s.state==='verified').length}/{coding.data.appPlan.steps.length} feature operations verified{coding.data.appPlan.audit?` · ${coding.data.appPlan.audit.characters.toLocaleString()} source characters`:''}</summary><Typography fontSize={11} color="text.secondary">{coding.data.appPlan.architecture}</Typography>{coding.data.appPlan.steps.map(step=><Typography key={step.id} fontSize={11}>{step.state==='verified'?'✓':'○'} {step.title} · {step.files.join(', ')}</Typography>)}</details>}
    {writing&&<Alert severity={writing.data.state==='completed'?'success':'info'} action={<Stack direction="row"><Button onClick={()=>onDocument(writing.data.documentId)}>Open chapter</Button>{writing.data.state!=='completed'&&<Button disabled={busy} onClick={()=>onResume('Resume chapter. Keep the saved plan, accepted prose, continuity and original length target.')}>Resume chapter</Button>}</Stack>}><Typography fontSize={11}>{writing.data.characters.toLocaleString()} characters · {writing.data.words.toLocaleString()} words · {writing.data.target?`target ${writing.data.target.minimum.toLocaleString()} ${writing.data.target.unit}`:'approved chapter outline'} · {writing.data.state==='completed'?'Planned chapter saved in chat':writing.data.state}{!busy&&writing.data.stopReason?' · '+writing.data.stopReason.slice(0,140):''}</Typography></Alert>}
  </Stack>;
}
