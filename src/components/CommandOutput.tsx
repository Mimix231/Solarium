import {useState} from 'react';
import {Alert,Button,Dialog,DialogContent,DialogTitle,Stack} from '@mui/material';
import type {TerminalRun} from '../domain/types';
import {readCommandOutput} from '../engine/intelligence/commands';
export function CommandOutput({run,root}:{run:TerminalRun;root?:string}){
  const [open,setOpen]=useState(false),[stream,setStream]=useState<'stdout'|'stderr'>('stdout'),[text,setText]=useState(''),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function read(nextStream:'stdout'|'stderr',reset:boolean){if(!root||!run.runId)return;setBusy(true);setError('');try{const page=await readCommandOutput(root,run.runId,nextStream,reset?0:offset);setText(old=>reset?page.text:old+page.text);setOffset(page.nextOffset);setMore(page.hasMore);setStream(nextStream);}catch(e){setError(String(e));}finally{setBusy(false);}}
  return <details className="verified-output"><summary>◉ Ran {run.command} · {run.cancelled?'Cancelled':run.timedOut?'Timed out':`Exit ${run.exitCode??'unknown'}`} · recorded</summary><pre>{run.stdout}{run.stderr&&`\n[stderr]\n${run.stderr}`}</pre>{run.runId&&root&&<Button size="small" onClick={()=>{setOpen(true);void read('stdout',true);}}>Read full command log{run.outputComplete===false?' · excerpt above':''}</Button>}
    <Dialog open={open} onClose={()=>setOpen(false)} fullWidth maxWidth="lg"><DialogTitle>{run.command}</DialogTitle><DialogContent><Stack direction="row" gap={1}><Button disabled={busy} onClick={()=>void read('stdout',true)}>stdout</Button><Button disabled={busy} onClick={()=>void read('stderr',true)}>stderr</Button><Button disabled={!more||busy} onClick={()=>void read(stream,false)}>Read next page</Button><Button onClick={()=>setOpen(false)}>Close</Button></Stack>{error&&<Alert severity="error">{error}</Alert>}<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{text||(!busy?'No output on this stream.':'Reading actual log…')}</pre></DialogContent></Dialog>
  </details>;
}
