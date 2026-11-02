import './monaco';
import './workspace.css';
import '@xterm/xterm/css/xterm.css';
import { useEffect,useRef,useState,type CSSProperties,type PointerEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DiffEditor } from '@monaco-editor/react';
import type { IDisposable } from 'monaco-editor';
import { Alert,Button,Checkbox,Dialog,DialogActions,DialogContent,DialogTitle,FormControlLabel,MenuItem,Stack,TextField } from '@mui/material';
import { Files,Search,GitBranch,Play,Code2,Settings2,PanelLeftClose,PanelLeftOpen,ChevronDown,ChevronUp,Terminal,Activity,Check,Save,Maximize2,Minimize2,ArrowUpRight,FolderOpen,Command,Sparkles } from 'lucide-react';
import { useSolarium } from '../../state/useSolarium';
import EditorArea from '../workbench/EditorArea';
import ExplorerView from '../features/explorer/ExplorerView';
import SearchView from '../features/search/SearchView';
import SourceControlView from '../features/sourceControl/SourceControlView';
import RunView from '../features/run/RunView';
import ProblemsPanel from '../features/editor/ProblemsPanel';
import LanguageServicesPanel from '../features/editor/LanguageServicesPanel';
import TerminalPanel from '../features/terminal/TerminalPanel';
import GeneratedSourcesPanel from '../components/GeneratedSourcesPanel';
import GeneratedApplyDialog from '../components/GeneratedApplyDialog';
import QuickOpen from '../features/search/QuickOpen';
import CommandPalette from '../features/command/CommandPalette';
import { commandRegistry } from '../commands/registry';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useDocumentStore } from '../stores/documentStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useWorkbenchStore } from '../stores/workbenchStore';
import { workspaceSession } from '../services/workspaceSession';
import { autoSaveService } from '../services/autoSaveService';
import { api,onWorkspaceFsEvent } from './api';
import { normalizedRoot } from './session';
import type { SidebarView } from '../lib/types';
import { LivePreview } from '../../blocks/LivePreview';
import { composeWebPreview } from '../../blocks/preview-source';
import { exportBlock } from '../../blocks/exports';
import type { ContentBlock } from '../../blocks/protocol';
import type { CodeAccessContext } from '../artifacts/repository';

const fail=(reason:unknown)=>useWorkspaceStore.setState({error:String(reason)});
function registerCommands(){
  const add=commandRegistry.upsert.bind(commandRegistry);
  add({id:'code.open',category:'Workspace',title:'Open source folder',run:()=>useWorkspaceStore.getState().choose()});
  add({id:'code.refresh',category:'Workspace',title:'Refresh source files',run:()=>useWorkspaceStore.getState().refresh()});
  add({id:'code.save',category:'File',title:'Save active source',keybinding:'Ctrl+S',run:()=>useDocumentStore.getState().save()});
  add({id:'code.saveAll',category:'File',title:'Save all edited files',keybinding:'Ctrl+Shift+S',run:()=>useDocumentStore.getState().saveAll()});
  add({id:'code.quick',category:'File',title:'Quick Open',keybinding:'Ctrl+P',run:()=>useWorkbenchStore.getState().setQuickOpen(true)});
  add({id:'code.generated',category:'Workspace',title:'Generated source from chat',run:()=>useWorkbenchStore.getState().setSidebarView('generated')});
  add({id:'code.terminal',category:'Workspace',title:'Open terminal',run:()=>useWorkbenchStore.getState().setBottomView('terminal')});
  add({id:'code.settings',category:'Preferences',title:'Editor appearance',run:()=>useWorkbenchStore.getState().setSettingsOpen(true)});
}
const navigation=[{id:'explorer',title:'Project files',icon:Files},{id:'generated',title:'Generated source',icon:Sparkles},{id:'search',title:'Find in project',icon:Search},{id:'source-control',title:'Source control',icon:GitBranch},{id:'run',title:'Project commands',icon:Play}] as const;

export default function Workspace(){
  const project=useSolarium(useShallow(s=>s.workspace.projects?.find(p=>p.id===s.workspace.activeProjectId)));
  const sessionId=useSolarium(s=>s.workspace.activeSessionId),reducedMotion=useSolarium(s=>s.workspace.preferences.reducedMotion);
  const projects=useSolarium(s=>s.workspace.projects),modelName=useSolarium(s=>(s.workspace.models.find(m=>m.id===project?.modelId)??s.workspace.models[0])?.name);
  const {error,loading,index}=useWorkspaceStore(useShallow(s=>({error:s.error,loading:s.loading,index:s.index})));
  const documents=useDocumentStore(s=>s.documents),activePath=useDocumentStore(s=>s.activePath);
  const settings=useSettingsStore(s=>s.settings),layout=useWorkbenchStore();
  const [reviewPath,setReviewPath]=useState<string|null>(null),[reviewDisk,setReviewDisk]=useState<string|null>(''),[applying,setApplying]=useState<{id:string;access:CodeAccessContext}|null>(null);
  const [preview,setPreview]=useState(false),[zen,setZen]=useState(false),[hidden,setHidden]=useState(document.hidden),[resizing,setResizing]=useState(false);
  const reviewListener=useRef<IDisposable|undefined>(undefined),drag=useRef<{kind:'sidebar'|'bottom';x:number;y:number;width:number;height:number}|null>(null);
  const active=documents.find(d=>d.path===activePath),reviewed=documents.find(d=>d.path===reviewPath),dirty=documents.some(d=>d.content!==d.savedContent);
  const access={sessionId,projectId:project?.id??null};
  const diagnosticCount=Object.values(useDocumentStore(s=>s.diagnostics)).flat().filter(d=>d.severity>=4).length;
  const previewSource=active?composeWebPreview((active.generated?documents.filter(d=>d.generated?.artifactId!==undefined&&d.generated.access.sessionId===active.generated?.access.sessionId&&d.generated.messageId===active.generated?.messageId):[active]).map(d=>({language:d.language,content:d.content}))):null;
  const ownerSession=project?null:sessionId;

  async function review(){if(!active||active.generated)return;try{setReviewDisk(await api.readTextFile(active.path));setReviewPath(active.path);}catch(error){if(/os error [23]\b|no such file/i.test(String(error))){setReviewDisk(null);setReviewPath(active.path);}else fail(error);}}
  async function applyReviewed(){if(!reviewed)return;const content=reviewed.content;try{await api.applyReviewedSource(reviewed.path,content,reviewDisk);useDocumentStore.getState().markSaved(reviewed.path,content);setReviewPath(null);}catch(error){fail(error);}}
  async function applyGenerated(){if(!active?.generated)return;try{await useDocumentStore.getState().save(active.path);setApplying({id:active.generated.artifactId,access:active.generated.access});}catch(error){fail(error);}}
  function beginResize(kind:'sidebar'|'bottom',event:PointerEvent<HTMLDivElement>){event.preventDefault();drag.current={kind,x:event.clientX,y:event.clientY,width:layout.explorerWidth,height:layout.bottomHeight};setResizing(true);}
  useEffect(()=>{const move=(event:globalThis.PointerEvent)=>{const value=drag.current;if(!value)return;const state=useWorkbenchStore.getState();if(value.kind==='sidebar')state.setExplorerWidth(value.width+event.clientX-value.x);else state.setBottomHeight(value.height+value.y-event.clientY);};const end=()=>{drag.current=null;setResizing(false);};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);};},[]);
  useEffect(()=>{const change=()=>setHidden(document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
  useEffect(()=>()=>reviewListener.current?.dispose(),[]);
  useEffect(()=>{registerCommands();void useSettingsStore.getState().load();},[]);
  useEffect(()=>{
    setReviewPath(null);setApplying(null);setPreview(false);let cancelled=false,unlisten:(()=>void)|undefined,refreshTimer:number|undefined;
    const open=async()=>{
      workspaceSession.stop();autoSaveService.stop();await workspaceSession.persist();if(cancelled)return;
      useDocumentStore.getState().reset(true,{sessionId:ownerSession,projectId:project?.id??null});
      if(project?.folder){await useWorkspaceStore.getState().openRoot(project.folder);if(cancelled)return;await workspaceSession.restore(project.id,project.folder);if(cancelled)return;
        const listener=await onWorkspaceFsEvent(event=>{if(cancelled||event.root&&normalizedRoot(event.root)!==normalizedRoot(project.folder))return;if(event.kind==='error'){fail(event.error);return;}window.clearTimeout(refreshTimer);refreshTimer=window.setTimeout(()=>void useWorkspaceStore.getState().refresh(),250);for(const path of event.paths){const doc=useDocumentStore.getState().documents.find(d=>d.path===path);if(doc&&!doc.generated&&doc.content===doc.savedContent)void api.readTextFile(path).then(text=>{if(!cancelled)useDocumentStore.getState().applyExternal(path,text);}).catch(fail);}});
        if(cancelled){listener();return;}unlisten=listener;if(useSettingsStore.getState().settings.autoWatchWorkspace)await api.startWorkspaceWatch(project.folder);
      }else useWorkspaceStore.setState({root:'',tree:[],index:undefined,error:'',tasks:[],git:undefined,loading:false});
      if(!cancelled){workspaceSession.start();autoSaveService.start();}
    };void open().catch(fail);
    return()=>{cancelled=true;window.clearTimeout(refreshTimer);unlisten?.();void workspaceSession.persist();workspaceSession.stop();autoSaveService.stop();void api.stopWorkspaceWatch().catch(fail);};
  },[project?.id,project?.folder,ownerSession]);
  useEffect(()=>{setPreview(false);},[activePath]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(!(event.ctrlKey||event.metaKey))return;const key=event.key.toLowerCase();let action:Promise<void>|void=undefined;
    if(key==='s'){event.preventDefault();action=event.shiftKey?useDocumentStore.getState().saveAll():useDocumentStore.getState().save();}
    else if(key==='p'){event.preventDefault();if(event.shiftKey)useWorkbenchStore.getState().setCommandPaletteOpen(true);else useWorkbenchStore.getState().setQuickOpen(true);}
    else if(key==='f'&&event.shiftKey){event.preventDefault();useWorkbenchStore.getState().setSidebarView('search');}
    if(action)void action.catch(fail);
  };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const style={'--studio-sidebar':`${layout.sidebarOpen&&!zen?layout.explorerWidth:0}px`,'--studio-bottom':`${layout.bottomOpen&&!zen?layout.bottomHeight:0}px`} as CSSProperties;
  const title=navigation.find(n=>n.id===layout.sidebarView)?.title??'Project files';
  return <section className={`solarium-code-studio ${resizing?'is-resizing':''} ${zen?'is-zen':''}`} style={style} data-motion={!reducedMotion&&settings.ambientMotion?'on':'off'} data-paused={hidden} aria-label="Solarium Code Studio">
    <div className="studio-ambient" aria-hidden="true"><i/><i/><i/></div>
    {error&&<Alert className="studio-error" severity="warning" onClose={()=>useWorkspaceStore.setState({error:''})}>{error}</Alert>}
    <div className="studio-stage">
      <nav className="studio-navigation" aria-label="Code workspace tools"><div className="studio-nav-primary">{navigation.map(item=><button key={item.id} className={`studio-nav-button ${layout.sidebarView===item.id&&layout.sidebarOpen?'is-selected':''}`} title={item.title} aria-label={item.title} aria-pressed={layout.sidebarView===item.id&&layout.sidebarOpen} onClick={()=>layout.sidebarView===item.id&&layout.sidebarOpen?layout.setSidebarOpen(false):layout.setSidebarView(item.id as SidebarView)}><item.icon size={20}/></button>)}</div><div className="studio-nav-secondary"><button className="studio-nav-button" title="Quick Open (Ctrl P)" aria-label="Quick Open" onClick={()=>layout.setQuickOpen(true)}><Search size={19}/></button><button className="studio-nav-button" title="Editor appearance" aria-label="Editor appearance" onClick={()=>layout.setSettingsOpen(true)}><Settings2 size={19}/></button><button className="studio-nav-button" title="Command palette" aria-label="Command palette" onClick={()=>layout.setCommandPaletteOpen(true)}><Command size={19}/></button><button className="studio-nav-button" title="Open source folder" aria-label="Open source folder" onClick={()=>void useWorkspaceStore.getState().choose().catch(fail)}><FolderOpen size={19}/></button></div></nav>
      <aside className={`studio-sidepane ${!layout.sidebarOpen||zen?'is-hidden':''}`} aria-label={title}><div className="studio-side-heading"><span>{title}</span><button className="studio-icon-button" aria-label="Collapse source panel" onClick={()=>layout.setSidebarOpen(false)}><PanelLeftClose size={15}/></button></div>
        <div className="studio-project-picker"><span className="studio-project-orbit"/><select aria-label="Source project" value={project?.id??''} onChange={event=>useSolarium.getState().mutate(w=>{const id=event.target.value||null;w.activeProjectId=id;w.activeSessionId=w.sessions.find(s=>s.id===w.activeSessionId&&(s.projectId??null)===id)?.id??w.sessions.find(s=>(s.projectId??null)===id)?.id??null;})}><option value="">Chat artifacts</option>{projects?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="studio-side-content">{layout.sidebarView==='generated'?<GeneratedSourcesPanel access={access}/>:!project?.folder?<div className="studio-side-empty"><FolderOpen size={25}/><strong>Bring your project.</strong><p>Link its source folder to inspect, edit and run real code.</p><button className="studio-button" onClick={()=>void useWorkspaceStore.getState().choose().catch(fail)}>Open source folder<ArrowUpRight size={14}/></button><button className="studio-text-button" onClick={()=>layout.setSidebarView('generated')}>Browse generated source</button></div>:layout.sidebarView==='explorer'?<ExplorerView/>:layout.sidebarView==='search'?<SearchView/>:layout.sidebarView==='source-control'?<SourceControlView/>:<RunView key={project.id}/>}</div>
        <div className="studio-sidebar-resize" role="separator" aria-label="Resize source panel" aria-orientation="vertical" onPointerDown={event=>beginResize('sidebar',event)}/>
      </aside>
      <div className={`studio-split `}>
        <main className="studio-center"><section className="studio-editor-surface"><div className="studio-editor-toolbar"><div className="studio-breadcrumb"><button className="studio-icon-button" title="Toggle source panel" aria-label="Toggle source panel" onClick={()=>layout.setSidebarOpen(!layout.sidebarOpen)}>{layout.sidebarOpen?<PanelLeftClose size={15}/>:<PanelLeftOpen size={15}/>}</button><span>{project?.name??'Generated source'}</span><span className="studio-breadcrumb-divider">/</span><strong>{active?.name??'Workspace'}</strong>{active?.generated&&<span className="studio-source-badge">FROM CHAT</span>}</div><div className="studio-editor-actions">{active&&<><button className="studio-icon-button" title={active.generated?'Export generated source':'Export current source'} aria-label="Export current source" onClick={()=>exportBlock({kind:'code',title:active.name,language:active.language,content:active.content,status:'complete',provenance:'model',id:active.path} as ContentBlock)}><ArrowUpRight size={15}/></button>{previewSource&&<button className={`studio-text-button ${preview?'is-active':''}`} onClick={()=>setPreview(!preview)}>{preview?'Source':'Preview'}</button>}{active.generated?<button className="studio-button studio-button-small studio-primary" onClick={()=>void applyGenerated()}><ArrowUpRight size={13}/>Apply to project</button>:<button className="studio-text-button" disabled={active.content===active.savedContent} onClick={()=>void review()}>Review changes</button>}</>}<button className="studio-icon-button" title={zen?'Exit focus mode':'Focus mode'} aria-label={zen?'Exit focus mode':'Focus mode'} onClick={()=>setZen(!zen)}>{zen?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button></div></div>
          <div className="studio-editor-content">{preview&&previewSource?<div className="studio-web-preview"><LivePreview content={previewSource} finished/></div>:<EditorArea/>}</div>
        </section>
        {!zen&&<section className={`studio-bottom-surface ${!layout.bottomOpen?'is-collapsed':''}`}><div className="studio-bottom-resize" role="separator" aria-label="Resize output panel" aria-orientation="horizontal" onPointerDown={event=>beginResize('bottom',event)}/><div className="studio-bottom-tabs"><div role="tablist" aria-label="Development output">{([{id:'problems',title:'Diagnostics',icon:Activity},{id:'terminal',title:'Terminal',icon:Terminal},{id:'language',title:'Language services',icon:Code2}] as const).map(tab=><button key={tab.id} role="tab" aria-selected={layout.bottomView===tab.id&&layout.bottomOpen} className={layout.bottomView===tab.id&&layout.bottomOpen?'is-selected':''} onClick={()=>layout.setBottomView(tab.id)}><tab.icon size={14}/>{tab.title}{tab.id==='problems'&&diagnosticCount>0&&<small>{diagnosticCount}</small>}</button>)}</div><button className="studio-icon-button" aria-label={layout.bottomOpen?'Collapse output panel':'Expand output panel'} onClick={()=>layout.setBottomOpen(!layout.bottomOpen)}>{layout.bottomOpen?<ChevronDown size={15}/>:<ChevronUp size={15}/>}</button></div><div className="studio-bottom-content">{layout.bottomOpen&&(layout.bottomView==='terminal'?(project?.folder?<TerminalPanel/>:<div className="studio-bottom-placeholder">Link a project folder to open its terminal.</div>):layout.bottomView==='language'?(project?.folder?<LanguageServicesPanel key={project.id}/>:<div className="studio-bottom-placeholder">Project language services start when a source file is opened.</div>):<ProblemsPanel/>)}</div></section>}
        </main>

      </div>
    </div>
    <footer className="studio-statusbar"><div><span className={`studio-status-dot ${loading?'is-loading':''}`}/><span>{loading?'Indexing source…':project?.folder?'Local workspace':'Local code artifacts'}</span>{index&&<span className="studio-status-muted">{index.files} files indexed</span>}</div><div><span>{active?.language??'Ready to build'}</span>{active&&<span className="studio-status-muted">{active.content.split('\n').length} lines · UTF-8</span>}<button className="studio-status-save" disabled={!dirty} onClick={()=>void useDocumentStore.getState().saveAll().catch(fail)}>{dirty?<Save size={12}/>:<Check size={12}/>}<span>{dirty?'Save changes':'All edits saved'}</span></button><span className="studio-model-name" title={modelName}>{modelName??'Select a model'}</span></div></footer>
    <QuickOpen/><CommandPalette/>
    {applying&&<GeneratedApplyDialog artifactId={applying.id} access={applying.access} onClose={()=>setApplying(null)}/>}
    <Dialog className="studio-dialog" open={Boolean(reviewPath&&reviewed)} onClose={()=>setReviewPath(null)} fullWidth maxWidth="lg"><DialogTitle>Review {reviewed?.name}<small className="studio-dialog-subtitle">Current disk version / edited buffer</small></DialogTitle><DialogContent sx={{height:'65vh',p:0}}>{reviewed&&<DiffEditor key={reviewPath} original={reviewDisk??''} modified={reviewed.content} language={reviewed.language} theme="solarium-studio" options={{originalEditable:false,renderSideBySide:true,automaticLayout:true}} onMount={editor=>{reviewListener.current?.dispose();reviewListener.current=editor.getModifiedEditor().onDidChangeModelContent(()=>useDocumentStore.getState().update(reviewed.path,editor.getModifiedEditor().getValue()));}}/>}</DialogContent><DialogActions><Button onClick={()=>setReviewPath(null)}>Cancel</Button><Button variant="contained" onClick={()=>void applyReviewed()}>Apply reviewed buffer</Button></DialogActions></Dialog>
    <Dialog className="studio-dialog" open={layout.settingsOpen} onClose={()=>layout.setSettingsOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Make it your space<small className="studio-dialog-subtitle">Code Studio appearance & editing</small></DialogTitle><DialogContent><Stack gap={2} sx={{pt:1}}><TextField label="Editor font" select value={settings.editorFontFamily} onChange={event=>void useSettingsStore.getState().save({...settings,editorFontFamily:event.target.value}).catch(fail)}>{['"Cascadia Code", Consolas, monospace','"Cascadia Mono", Consolas, monospace','Consolas, "Liberation Mono", monospace',...(!['"Cascadia Code", Consolas, monospace','"Cascadia Mono", Consolas, monospace','Consolas, "Liberation Mono", monospace'].includes(settings.editorFontFamily)?[settings.editorFontFamily]:[])].map(font=><MenuItem key={font} value={font}>{font.split(',')[0]!.replaceAll('"','')}</MenuItem>)}</TextField><TextField label="Font size" type="number" value={settings.editorFontSize} onChange={event=>void useSettingsStore.getState().save({...settings,editorFontSize:Math.max(10,Math.min(32,Number(event.target.value)))}).catch(fail)}/>{([{key:'editorWordWrap',label:'Wrap long lines',value:settings.editorWordWrap==='on'},{key:'editorMinimap',label:'Source minimap',value:settings.editorMinimap},{key:'lspEnabled',label:'External language services',value:settings.lspEnabled},{key:'editorAutoSave',label:'Automatically save project files',value:settings.editorAutoSave==='afterDelay'},{key:'ambientMotion',label:'Ambient background animation',value:settings.ambientMotion}] as const).map(item=><FormControlLabel key={item.key} label={item.label} control={<Checkbox checked={item.value} onChange={(_,value)=>void useSettingsStore.getState().save({...settings,[item.key]:item.key==='editorWordWrap'?(value?'on':'off'):item.key==='editorAutoSave'?(value?'afterDelay':'off'):value}).catch(fail)}/>}/>)}</Stack></DialogContent><DialogActions><Button onClick={()=>layout.setSettingsOpen(false)}>Done</Button></DialogActions></Dialog>

  </section>;
}
