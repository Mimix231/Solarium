import {useCallback,useEffect,useRef,useState} from 'react';
import {Alert,Button,Dialog,DialogActions,DialogContent,DialogTitle} from '@mui/material';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {useSolarium} from '../state/useSolarium';
import {saveWorkspace} from '../data/repository';
import {CloseCoordinator} from '../engine/close-coordinator';
import {workLifecycle} from '../engine/work-lifecycle';

export function ApplicationClose(){
  const [prompt,setPrompt]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const coordinator=useRef<CloseCoordinator|null>(null);
  const close=useCallback(async(save:boolean)=>{setBusy(true);setError('');try{await coordinator.current?.close(save);}catch(error){setError(String(error));}finally{setBusy(false);}},[]);
  useEffect(()=>{
    if(!('__TAURI_INTERNALS__' in window))return;
    let disposed=false,unlisten:(()=>void)|undefined;
    const handle=getCurrentWindow();
    coordinator.current=new CloseCoordinator({stopWork:()=>workLifecycle.stopAll(),saveFiles:async()=>{const {useDocumentStore}=await import('../coding/stores/documentStore');await useDocumentStore.getState().saveAll();},saveRecovery:async()=>{const {workspaceSession}=await import('../coding/services/workspaceSession');await workspaceSession.persist();},saveWorkspace:()=>saveWorkspace(useSolarium.getState().workspace),destroy:()=>handle.destroy()});
    void handle.onCloseRequested(async event=>{
      event.preventDefault();if(disposed)return;
      try{const {useDocumentStore}=await import('../coding/stores/documentStore');if(useDocumentStore.getState().documents.some(d=>d.content!==d.savedContent)){setPrompt(true);return;}await close(false);}catch(error){setError(String(error));setPrompt(true);}
    }).then(stop=>{if(disposed)stop();else unlisten=stop;}).catch(error=>setError(String(error)));
    return()=>{disposed=true;unlisten?.();};
  },[close]);
  return <>{error&&!prompt&&<Alert severity="error" role="alert" sx={{position:'fixed',bottom:12,left:60,zIndex:5000}} onClose={()=>setError('')}>Closing failed: {error}<Button onClick={()=>setPrompt(true)}>Review</Button></Alert>}<Dialog open={prompt} onClose={busy?undefined:()=>setPrompt(false)}><DialogTitle>Keep your source safe</DialogTitle><DialogContent>{error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}Save edited project files, or keep their recovery buffers before closing. Generated source edits are saved locally. Active tasks will stop and retain their confirmed progress.</DialogContent><DialogActions><Button disabled={busy} onClick={()=>setPrompt(false)}>Cancel</Button><Button disabled={busy} onClick={()=>void close(false)}>Keep recovery and close</Button><Button disabled={busy} variant="contained" onClick={()=>void close(true)}>Save and close</Button></DialogActions></Dialog></>;
}
