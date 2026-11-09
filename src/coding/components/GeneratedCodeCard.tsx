import './generated-code.css';
import { useEffect,useState,useSyncExternalStore } from 'react';
import { Alert,Button,Chip,Stack } from '@mui/material';
import CodeRounded from '@mui/icons-material/CodeRounded';
import type { ContentBlock } from '../../blocks/protocol';
import { BlockCard } from '../../blocks/BlockCard';
import { CodeRepository,type CodeArtifact } from '../artifacts/repository';
import { codeArtifactEvents } from '../artifacts/events';
import type { CodeBlockContext } from '../artifacts/context';
import { useSolarium } from '../../state/useSolarium';
import { openGeneratedCode } from '../artifacts/open';

export function GeneratedCodeCard({block,context,legacyContent}:{block:ContentBlock;context:CodeBlockContext;legacyContent?:string}){
  const reducedMotion=useSolarium(s=>s.workspace.preferences.reducedMotion);
  const change=useSyncExternalStore(codeArtifactEvents.subscribe,codeArtifactEvents.snapshot,codeArtifactEvents.snapshot);
  const [saved,setSaved]=useState<{artifact:CodeArtifact;content:string}|null>(null),[error,setError]=useState(''),[opening,setOpening]=useState(false);
  const sessionId=context.access.sessionId,projectId=context.access.projectId,messageId=context.messageId,streaming=context.streaming,naturalEnd=context.naturalEnd;
  useEffect(()=>{
    if(!sessionId)return;let disposed=false;
    const repo=new CodeRepository({sessionId,projectId});
    const load=async()=>{const id=`code:${sessionId}:${messageId}:${block.id}`;const existing=(await repo.list()).find(r=>r.id===id);if(!existing&&!streaming)await repo.capture(block,{sessionId,messageId,blockId:block.id,sparkId:context.sparkId},naturalEnd===true,false,true);if(existing||!streaming){let value=await repo.get(id);if(!streaming&&legacyContent!==undefined&&!value.artifact.data.userEdited&&value.artifact.data.state!=='streaming'&&value.content!==legacyContent){await repo.edit(id,legacyContent,value.artifact.version);value=await repo.get(id);}if(!disposed)setSaved(value);}};
    void load().catch(reason=>{if(!disposed)setError(String(reason));});return()=>{disposed=true;};
  },[sessionId,projectId,messageId,block,streaming,naturalEnd,context.sparkId,change,legacyContent]);
  const displayed=!streaming&&saved?{...block,content:saved.content}:legacyContent!==undefined?{...block,content:legacyContent}:block;
  async function open(){setOpening(true);setError('');try{await openGeneratedCode(displayed,context);}catch(error){setError(String(error));}finally{setOpening(false);}}
  return <div className="generated-code-artifact" data-motion={reducedMotion?'off':'on'}>
    <BlockCard block={displayed} onOpen={()=>void open()} toolbar={<Button className="code-studio-action" size="small" startIcon={<CodeRounded sx={{fontSize:14}}/>} disabled={opening||streaming} onClick={()=>void open()}>Code Studio</Button>}/>
    <Stack className="generated-code-meta" direction="row" gap={.7} alignItems="center"><Chip size="small" label={streaming?'Generating source':saved?.artifact.data.userEdited?'Edited in Code Studio':'Generated code'}/><span>{saved?.artifact.data.applied?`Applied to ${saved.artifact.data.applied.path}`:saved?(saved.artifact.data.state==='ready'?'Saved locally · ready to edit, preview or apply':'Incomplete source saved locally · open to recover'):'Saving source artifact…'}</span></Stack>
    {error&&<Alert severity="warning" onClose={()=>setError('')}>{error}</Alert>}
    {saved?.artifact.data.diagnostics?.length? <details><summary>Source quality · {saved.artifact.data.diagnostics.length} repetition findings</summary>{saved.artifact.data.diagnostics.map((diagnostic,i)=><Alert severity="warning" key={i}>{diagnostic}</Alert>)}</details>:null}
  </div>;
}
