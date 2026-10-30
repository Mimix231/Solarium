import { useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Menu, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { SourceRepository, DuplicateSourceError, type SourceKind, type SourceOrigin } from '../../sources/repository';
import type { AccessContext, SourceScope } from '../../foundation/types';
export function SaveToSources({text,title,origin,kind='chat_message',access,projectName}:{text:string;title?:string;origin:SourceOrigin;kind?:SourceKind;access:AccessContext;projectName?:string}){
  const [anchor,setAnchor]=useState<HTMLElement|null>(null),[scope,setScope]=useState<SourceScope|null>(null),[name,setName]=useState(''),[tags,setTags]=useState(''),[body,setBody]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[duplicate,setDuplicate]=useState(false);
  const selectedText=useRef('');
  function begin(destination:SourceScope){setScope(destination);setAnchor(null);setName(title??text.replace(/^#+\s*/, '').split('\n').find(l=>l.trim())?.slice(0,100)??'Saved reference');setBody(selectedText.current||text);setDuplicate(false);setNotice('');}
  async function save(keepBoth=false){if(!scope)return;setBusy(true);try{await new SourceRepository(access).create({scope,title:name,content:body,origin,kind,tags:tags.split(',').map(t=>t.trim()).filter(Boolean),keepBoth});setScope(null);setNotice(`Saved to ${scope.kind==='project'?`${projectName??'Project'} Sources`:'Chat Sources'}.`);}catch(error){setDuplicate(error instanceof DuplicateSourceError);setNotice(String(error instanceof Error?error.message:error));}finally{setBusy(false);}}
  return <><Button size="small" onMouseDown={e=>{const selection=window.getSelection();const row=e.currentTarget.closest('.message-row');selectedText.current=selection?.anchorNode&&row?.contains(selection.anchorNode)&&selection.focusNode&&row.contains(selection.focusNode)?selection.toString():'';}} onClick={e=>{setAnchor(e.currentTarget);setNotice('');}} disabled={!text.trim()} aria-label="Save to Sources">Save to Sources ▾</Button>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={()=>setAnchor(null)}>
      <MenuItem disabled={!access.sessionId} onClick={()=>access.sessionId&&begin({kind:'chat',id:access.sessionId})}>Save to Chat Sources</MenuItem>
      <MenuItem disabled={!access.projectId} onClick={()=>access.projectId&&begin({kind:'project',id:access.projectId})}>Save to {projectName??'Project'} Sources</MenuItem>
    </Menu>
    {!scope&&notice&&<Typography component="span" role="status" fontSize={10} color="text.secondary">{notice}</Typography>}
    <Dialog open={Boolean(scope)} onClose={()=>!busy&&setScope(null)} fullWidth maxWidth="sm"><DialogTitle>Save to {scope?.kind==='project'?`${projectName??'Project'} Sources`:'Chat Sources'}</DialogTitle><DialogContent><Stack gap={1.5} pt={1}>
      {notice&&<Alert severity={duplicate?'info':'error'}>{notice}</Alert>}<TextField autoFocus label="Source title" value={name} onChange={e=>setName(e.target.value)}/><TextField label="Tags, separated by commas" value={tags} onChange={e=>setTags(e.target.value)}/><TextField label="Snapshot / selection" multiline minRows={5} maxRows={14} value={body} onChange={e=>setBody(e.target.value)}/><Typography fontSize={11} color="text.secondary">This stores a separate snapshot with its origin. Edit the snapshot to keep only the passage you need.</Typography>
    </Stack></DialogContent><DialogActions><Button onClick={()=>setScope(null)} disabled={busy}>Cancel</Button>{duplicate&&<Button disabled={busy} onClick={()=>void save(true)}>Keep both</Button>}<Button variant="contained" disabled={busy||!name.trim()||!body.trim()||duplicate} onClick={()=>void save()}>Save snapshot</Button></DialogActions></Dialog>
  </>;
}
