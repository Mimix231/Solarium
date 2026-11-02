import { useEffect,useState,useSyncExternalStore } from 'react';
import { Code2,ArrowUpRight,MessageSquare,RefreshCw } from 'lucide-react';
import type { AccessContext } from '../../foundation/types';
import { CodeRepository,type CodeArtifact } from '../artifacts/repository';
import { codeArtifactEvents } from '../artifacts/events';
import { useDocumentStore } from '../stores/documentStore';
import { useSolarium } from '../../state/useSolarium';

export default function GeneratedSourcesPanel({access}:{access:AccessContext}){
  const change=useSyncExternalStore(codeArtifactEvents.subscribe,codeArtifactEvents.snapshot,codeArtifactEvents.snapshot);
  const [recovered,setRecovered]=useState(false);
  const [items,setItems]=useState<CodeArtifact[]>([]),[error,setError]=useState(''),[query,setQuery]=useState('');
  const sessionId=access.sessionId,projectId=access.projectId,personal=recovered||!sessionId&&!projectId;
  useEffect(()=>{let disposed=false;void new CodeRepository({sessionId,projectId,personal}).list().then(rows=>{if(!disposed)setItems(personal?rows.filter(r=>r.scope.kind==='library'):rows);}).catch(error=>{if(!disposed)setError(String(error));});return()=>{disposed=true;};},[sessionId,projectId,personal,change]);
  async function open(item:CodeArtifact){try{const context={...access,personal};if(item.data.state==='streaming')await new CodeRepository(context).recoverInterrupted(item.id,item.version);await useDocumentStore.getState().openGenerated(item.id,context);setError('');}catch(error){setError(String(error));}}
  const visible=items.filter(item=>(item.title+' '+item.data.language+' '+(item.data.pathHint??'')).toLowerCase().includes(query.toLowerCase()));
  return <div className="studio-generated-list">
    <div className="studio-panel-heading"><span>Generated source</span><button className="studio-icon-button" aria-label="Refresh generated source" onClick={()=>codeArtifactEvents.changed()}><RefreshCw size={14}/></button></div>
    <div className="studio-recovery-switch"><button className={!personal?'is-selected':''} onClick={()=>setRecovered(false)}>Current scope</button><button className={personal?'is-selected':''} onClick={()=>setRecovered(true)}>Recovered</button></div>
    <div className="studio-filter"><input aria-label="Filter generated source" placeholder="Find a generated file…" value={query} onChange={event=>setQuery(event.target.value)}/></div>
    {error&&<p className="studio-inline-error" role="alert">{error}</p>}
    <div className="studio-generated-rows">{visible.map(item=><button key={item.id} className="studio-generated-row" onClick={()=>void open(item)} title={item.data.pathHint??item.title}><span className="studio-file-glyph"><Code2 size={17}/></span><span className="studio-generated-caption"><strong>{item.data.pathHint??item.title}</strong><small>{item.data.language} · {item.data.characters.toLocaleString()} characters</small><small>{item.data.state==='streaming'?(codeArtifactEvents.isStreaming(item.data.origin.sessionId,item.data.origin.messageId)?'Generating source':'Recover interrupted draft'):item.data.state==='incomplete'?'Incomplete draft':item.data.applied?'Applied to project':item.data.userEdited?'Edited locally':'Generated artifact'}</small></span><ArrowUpRight size={14}/></button>)}</div>
    {!visible.length&&<div className="studio-side-empty"><Code2 size={24}/><strong>Your next idea starts in chat.</strong><p>Generated code blocks appear here, with their source and edits preserved.</p><button className="studio-button" onClick={()=>useSolarium.getState().setView('chat')}><MessageSquare size={14}/>Open chat</button></div>}
  </div>;
}
