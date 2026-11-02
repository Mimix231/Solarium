import {ProjectServicesPanel} from '../../components/ProjectServicesPanel';
import {useSolarium} from '../../../state/useSolarium';
import { useEffect,useRef,useState } from 'react';
import { Alert,Box,Button,Stack,Typography } from '@mui/material';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { runProjectCommand } from '../../../engine/intelligence/commands';
import { CommandOutput } from '../../../components/CommandOutput';
import type { TerminalRun } from '../../../domain/types';
export default function RunView(){
 const web=useSolarium(s=>s.webEnabled);
 const root=useWorkspaceStore(s=>s.root),tasks=useWorkspaceStore(s=>s.tasks),refresh=useWorkspaceStore(s=>s.refreshProjectMeta);
 const [runs,setRuns]=useState<TerminalRun[]>([]),[running,setRunning]=useState(''),[error,setError]=useState('');const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[root]);
 async function run(id:string){const stop=new AbortController();controller.current=stop;setRunning(id);setError('');try{const result=await runProjectCommand(root,id,web,stop.signal);setRuns(previous=>[...previous,{command:result.command,exitCode:result.exit_code,stdout:result.stdout,stderr:result.stderr,timedOut:result.timed_out,runId:result.run_id,cancelled:result.cancelled,outputComplete:result.output_complete}]);}catch(error){setError(String(error));}finally{setRunning('');}}
 return <Box sx={{p:1,height:'100%',overflow:'auto'}}><Stack direction="row" justifyContent="space-between"><Typography fontSize={12} fontWeight={750}>Project commands</Typography><Button size="small" onClick={()=>void refresh()}>Refresh</Button></Stack>{error&&<Alert severity="error">{error}</Alert>}{running&&<Button color="warning" onClick={()=>controller.current?.abort()}>Stop {running}</Button>}{!tasks.length&&<Typography fontSize={12}>No runnable commands are declared in this project.</Typography>}{tasks.filter(task=>!task.service&&(web||task.id!=='install:network'&&!task.network)).map(task=><Box key={task.id} sx={{py:1,borderBottom:'1px solid',borderColor:'divider'}}><Typography fontSize={11}>{task.command}</Typography><Button size="small" disabled={Boolean(running)} onClick={()=>void run(task.id)}>Run {task.id}</Button></Box>)}<ProjectServicesPanel/>{runs.map((run,index)=><CommandOutput key={index} run={run} root={root}/>)}</Box>;
}
