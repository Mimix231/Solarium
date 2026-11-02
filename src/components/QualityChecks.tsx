import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useSolarium } from '../state/useSolarium';
import { foundationStore } from '../foundation/store';
import type { StoredRecord } from '../foundation/types';
import { qualityCases } from '../quality/cases';
import { runQualityCase, saveQualityReview, qualityEngineFingerprint, type QualityRun } from '../quality/runner';
import { downloadBytes } from '../blocks/exports';

export function QualityChecks() {
  const workspace = useSolarium(s => s.workspace);
  const [modelId, setModelId] = useState(workspace.models[0]?.id ?? '');
  const [selected, setSelected] = useState(['mimir-profile', 'approved-outline', 'basket-discount']);
  const [trials, setTrials] = useState(1), [web, setWeb] = useState(false),[holdout,setHoldout]=useState(false);
  const [runs, setRuns] = useState<StoredRecord<QualityRun>[]>([]), [current, setCurrent] = useState<QualityRun | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false),[engineFingerprint,setEngineFingerprint]=useState('');
  const [approval, setApproval] = useState<{name:string;args:Record<string,unknown>}|null>(null);
  const approvalResolve = useRef<((decision:'allow'|'deny')=>void)|null>(null);
  const controller = useRef<AbortController | null>(null);
  async function refresh() {
    const w = useSolarium.getState().workspace;
    const owners = [...w.sessions.map(s => ({kind:'chat' as const,id:s.id})), ...(w.projects??[]).map(p=>({kind:'project' as const,id:p.id}))];
    const records = (await Promise.all(owners.map(scope => foundationStore.list<QualityRun>({collection:'quality_run',scopes:[scope]})))).flat();
    setRuns(records.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));
  }
  useEffect(()=>{void refresh().catch(e=>setError(String(e)));void qualityEngineFingerprint().then(setEngineFingerprint).catch(e=>setError(String(e)));},[]);
  useEffect(()=>()=>{controller.current?.abort();approvalResolve.current?.('deny');},[]);
  function resolve(decision:'allow'|'deny'){approvalResolve.current?.(decision);approvalResolve.current=null;setApproval(null);}
  async function start() {
    if(controller.current)return;
    const model=workspace.models.find(m=>m.id===modelId),spark=workspace.sparks.find(s=>s.id===workspace.selectedSparkId);
    if(!model||!spark){setError('Choose a model and Spark first.');return;}
    const abort=new AbortController();controller.current=abort;setBusy(true);setError('');
    try {
      for(let trial=0;trial<trials&&!abort.signal.aborted;trial++)for(const test of qualityCases.filter(c=>selected.includes(c.id))){
        if(abort.signal.aborted)break;
        await runQualityCase(test,{model,spark,signal:abort.signal,webEnabled:web,onProgress:run=>setCurrent({...run}),onApproval:(name,args)=>new Promise(resolveApproval=>{setApproval({name,args});approvalResolve.current=resolveApproval;abort.signal.addEventListener('abort',()=>resolveApproval('deny'),{once:true});})});
        await refresh();
      }
    }catch(error){setError(String(error));}finally{controller.current=null;setBusy(false);setCurrent(null);resolve('deny');await refresh();}
  }
  const complete=runs.filter(r=>r.data.fingerprints?.engine===engineFingerprint&&!['running','cancelled','blocked'].includes(r.data.state));
  const passed=complete.filter(r=>r.data.state==='passed').length;
  function openChat(run:QualityRun){useSolarium.setState(s=>({view:'chat',workspace:{...s.workspace,activeSessionId:run.sessionId,activeProjectId:run.projectId,selectedSparkId:workspace.selectedSparkId}}));}
  return <details className="glass panel quality-checks"><summary>Quality checks · real tasks in this Solarium instance</summary>
    <Typography fontSize={12} my={1}>Uses this app’s engine, selected Spark, permission mode and normal storage. Coding checks create new temporary repositories. Results and generated writing remain available as chats. Load the model in Models before running.</Typography>
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center"><TextField select size="small" label="Model" value={modelId} disabled={busy} onChange={e=>setModelId(e.target.value)} sx={{minWidth:240}}>{workspace.models.map(m=><MenuItem key={m.id} value={m.id}>{m.name} · {m.contextSize.toLocaleString()} context</MenuItem>)}</TextField><TextField select size="small" label="Trials" value={trials} disabled={busy} onChange={e=>setTrials(Number(e.target.value))}>{[1,3].map(n=><MenuItem key={n} value={n}>{n}</MenuItem>)}</TextField><FormControlLabel control={<Checkbox checked={web} disabled={busy} onChange={e=>setWeb(e.target.checked)}/>} label="Allow web for these checks"/><Button disabled={busy||!selected.length} onClick={()=>void start()}>Run selected</Button><Button disabled={!busy} color="warning" onClick={()=>{controller.current?.abort();resolve('deny');}}>Stop</Button><Button disabled={busy} onClick={()=>void refresh().catch(e=>setError(String(e)))}>Refresh results</Button></Stack>
    {error&&<Alert severity="error">{error}</Alert>}{current&&<Typography role="status" fontSize={12} my={1}>{current.caseTitle} · {current.operations.length} confirmed tool results · {current.reasoningCharacters.toLocaleString()} reasoning characters</Typography>}
    <FormControlLabel control={<Checkbox checked={holdout} disabled={busy} onChange={e=>{setHoldout(e.target.checked);if(!e.target.checked)setSelected(ids=>ids.filter(id=>qualityCases.find(c=>c.id===id)?.caseSet!=='holdout'));}}/>} label="Include held-out release checks"/>
    <Box className="quality-case-list">{qualityCases.filter(test=>holdout||test.caseSet!=='holdout').map(test=><FormControlLabel key={test.id} control={<Checkbox size="small" checked={selected.includes(test.id)} disabled={busy||Boolean(test.requiresWeb&&!web)} onChange={e=>setSelected(v=>e.target.checked?[...v,test.id]:v.filter(id=>id!==test.id))}/>} label={<Typography fontSize={12}>{test.category} · {test.title}{test.requiresWeb?' · web required':''}</Typography>}/>)}</Box>
    <Typography fontSize={12} my={1}>{passed}/{complete.length} current-build runs passed · {complete.filter(r=>r.data.state==='needs_review').length} await reading. Repeated trials remain separate; one success cannot hide failed attempts.</Typography>
    <Button size="small" onClick={()=>downloadBytes(JSON.stringify(runs,null,2),'application/json','solarium-quality-results.json')}>Export results</Button>
    {runs.slice(0,40).map(run=><QualityResult key={`${run.id}:${run.version}`} record={run} onOpen={()=>openChat(run.data)} onSaved={refresh}/>)}
    <Dialog open={Boolean(approval)} onClose={()=>resolve('deny')} maxWidth="md" fullWidth><DialogTitle>Approve {approval?.name}</DialogTitle><DialogContent><Box component="pre" sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12}}>{JSON.stringify(approval?.args,null,2)}</Box></DialogContent><DialogActions><Button onClick={()=>resolve('deny')}>Deny</Button><Button onClick={()=>resolve('allow')}>Allow</Button></DialogActions></Dialog>
  </details>;
}
function QualityResult({record,onOpen,onSaved}:{record:StoredRecord<QualityRun>;onOpen:()=>void;onSaved:()=>Promise<void>}){
  const [ratings,setRatings]=useState(record.data.ratings??{}),[notes,setNotes]=useState(record.data.notes??''),[error,setError]=useState('');
  const data=record.data;
  return <details className="quality-result"><summary>{data.caseTitle} · {data.model.name} · {data.state}</summary><Typography fontSize={11}>{data.instance.app} ({data.instance.identifier}) · {data.caseSet??'regression'} · {data.capabilities?.contextSize??data.model.contextSize} context · tools {data.capabilities?.tools??'unknown'} · {new Date(data.startedAt).toLocaleString()}</Typography><Button size="small" onClick={onOpen}>Open actual chat & writing</Button>{data.checks.map((check,i)=><Typography fontSize={12} key={i} color={check.passed?'success.main':'error.main'}>{check.passed?'✓':'!'} {check.name} · {check.detail}</Typography>)}{data.warnings.map((warning,i)=><Alert key={i} severity="warning">{warning}</Alert>)}{data.review.map(item=><TextField key={item} select size="small" fullWidth label={item} value={ratings[item]??''} onChange={e=>setRatings(v=>({...v,[item]:Number(e.target.value)}))} sx={{my:1}}>{[1,2,3,4,5].map(n=><MenuItem key={n} value={n}>{n} · {n>=4?'meets the requirement':n===3?'mixed':'needs improvement'}</MenuItem>)}</TextField>)}{data.review.length>0&&<><TextField multiline fullWidth size="small" label="Reading notes" value={notes} onChange={e=>setNotes(e.target.value)}/><Button size="small" onClick={()=>void saveQualityReview(record,ratings,notes).then(onSaved).catch(e=>setError(String(e)))}>Save reading assessment</Button></>}{error&&<Alert severity="error">{error}</Alert>}</details>;
}
