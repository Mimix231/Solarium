import { useEffect,useMemo,useState,useSyncExternalStore } from 'react';
import { Dialog,DialogContent,List,ListItemButton,ListItemText,TextField,Typography } from '@mui/material';
import { Code2,FileCode2 } from 'lucide-react';
import { useWorkbenchStore } from '../../stores/workbenchStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useDocumentStore } from '../../stores/documentStore';
import { useSolarium } from '../../../state/useSolarium';
import { CodeRepository,type CodeArtifact } from '../../artifacts/repository';
import { codeArtifactEvents } from '../../artifacts/events';
import type { FileNode } from '../../lib/types';
function flatten(nodes:FileNode[],out:FileNode[]=[]){for(const node of nodes){if(!node.isDirectory)out.push(node);if(node.children)flatten(node.children,out);}return out;}
export default function QuickOpen(){
 const opened=useWorkbenchStore(s=>s.quickOpen),setOpen=useWorkbenchStore(s=>s.setQuickOpen),tree=useWorkspaceStore(s=>s.tree),[query,setQuery]=useState(''),[generated,setGenerated]=useState<CodeArtifact[]>([]),[error,setError]=useState('');
 const sessionId=useSolarium(s=>s.workspace.activeSessionId),projectId=useSolarium(s=>s.workspace.activeProjectId??null),change=useSyncExternalStore(codeArtifactEvents.subscribe,codeArtifactEvents.snapshot,codeArtifactEvents.snapshot);
 useEffect(()=>{if(!opened)return;let disposed=false;void new CodeRepository({sessionId,projectId}).list().then(rows=>{if(!disposed)setGenerated(rows);}).catch(error=>{if(!disposed)setError(String(error));});return()=>{disposed=true;};},[opened,sessionId,projectId,change]);
 const files=useMemo(()=>[...flatten(tree).map(f=>({id:f.path,title:f.name,detail:f.path,artifact:false})),...generated.map(a=>({id:a.id,title:a.data.pathHint??a.title,detail:'Generated source · '+a.data.language,artifact:true}))],[tree,generated]);
 const shown=useMemo(()=>{const terms=query.toLowerCase().split(/\s+/).filter(Boolean);return files.map(file=>({file,score:terms.reduce((score,term)=>score+(file.title.toLowerCase().includes(term)?5:0)+(file.detail.toLowerCase().includes(term)?1:0),0)})).filter(item=>!terms.length||item.score>0).sort((a,b)=>b.score-a.score).slice(0,80).map(item=>item.file);},[files,query]);
 async function open(file:typeof files[number]){try{if(file.artifact)await useDocumentStore.getState().openGenerated(file.id,{sessionId,projectId});else await useDocumentStore.getState().open(file.id,file.title);setOpen(false);setError('');setQuery('');}catch(error){setError(String(error));}}
 return <Dialog className="studio-dialog" open={opened} onClose={()=>setOpen(false)} fullWidth maxWidth="sm"><DialogContent sx={{p:2}}><TextField autoFocus fullWidth size="small" placeholder="Find source files & generated code…" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape')setOpen(false);if(event.key==='Enter'&&shown[0])void open(shown[0]);}}/>{error&&<Typography color="warning.main" fontSize={12} sx={{p:1}}>{error}</Typography>}<List dense sx={{maxHeight:420,overflow:'auto',pt:1}}>{shown.map(file=><ListItemButton key={file.id} onClick={()=>void open(file)} sx={{gap:1.4,borderRadius:2,mb:.5}}>{file.artifact?<Code2 size={17}/>:<FileCode2 size={17}/>}<ListItemText primary={file.title} secondary={file.detail} slotProps={{primary:{sx:{fontSize:12}},secondary:{sx:{fontSize:10.5},noWrap:true}}}/></ListItemButton>)}</List>{!shown.length&&<Typography color="text.secondary" fontSize={12} sx={{p:2}}>No matching source in this conversation or project.</Typography>}</DialogContent></Dialog>;
}
