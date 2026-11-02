import { useEffect,useRef } from "react";
import { Box,Button,IconButton,Stack,Tab,Tabs,Tooltip } from "@mui/material";
import { Plus,X } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { api,onTerminalEvent } from "../../integration/api";
import { normalizedRoot } from "../../integration/session";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTerminalStore } from "../../stores/terminalStore";
import type { TerminalDescriptor } from "../../lib/types";
const fail=(error:unknown)=>useWorkspaceStore.setState({error:'Terminal: '+String(error)});
function TerminalView({desc,active}:{desc:TerminalDescriptor;active:boolean}){
  const host=useRef<HTMLDivElement>(null),term=useRef<Terminal|null>(null),fit=useRef<FitAddon|null>(null);
  const family=useSettingsStore(s=>s.settings.terminalFontFamily),fontSize=useSettingsStore(s=>s.settings.terminalFontSize);
  useEffect(()=>{
    if(!host.current)return;
    const terminal=new Terminal({fontFamily:family,fontSize,theme:{background:'#0d0f12',foreground:'#e7eaf0',cursor:'#8a7dff'},cursorBlink:true,scrollback:10000});
    const sizing=new FitAddon();terminal.loadAddon(sizing);terminal.loadAddon(new WebLinksAddon());terminal.loadAddon(new SearchAddon());terminal.open(host.current);term.current=terminal;fit.current=sizing;
    let disposed=false,busy=false,pending=false,offset=0,exitShown=false,unlisten:(()=>void)|undefined;
    const drain=async()=>{if(disposed)return;if(busy){pending=true;return;}busy=true;
      try{do{pending=false;const page=await api.readTerminal(desc.id,offset,desc.root);if(disposed)return;offset=page.nextOffset;if(page.data)await new Promise<void>(resolve=>terminal.write(page.data,resolve));if(page.finished&&!exitShown){exitShown=true;terminal.writeln('\r\n[process exited '+(page.code??'unknown')+']');}pending=pending||page.more;}while(pending&&!disposed);}catch(error){if(!disposed)fail(error);}finally{busy=false;}};
    const resize=()=>{if(!host.current?.clientWidth||!host.current.clientHeight)return;try{sizing.fit();void api.resizeTerminal(desc.id,terminal.cols,terminal.rows,desc.root).catch(fail);}catch(error){fail(error);}};
    const input=terminal.onData(data=>void api.writeTerminal(desc.id,data,desc.root).catch(fail));
    const observer=new ResizeObserver(resize);observer.observe(host.current);
    void onTerminalEvent(event=>{if(event.terminalId!==desc.id||disposed)return;if(event.kind==='error')fail(event.error);void drain();}).then(stop=>{if(disposed)stop();else{unlisten=stop;void drain();}}).catch(fail);
    resize();return()=>{disposed=true;unlisten?.();observer.disconnect();input.dispose();terminal.dispose();term.current=null;fit.current=null;};
  },[desc.id,desc.root,family,fontSize]);
  useEffect(()=>{if(!active)return;const timer=window.setTimeout(()=>{fit.current?.fit();term.current?.focus();},0);return()=>window.clearTimeout(timer);},[active]);
  return <Box ref={host} sx={{position:'absolute',inset:0,display:active?'block':'none'}}/>;
}
export default function TerminalPanel(){
  const root=useWorkspaceStore(s=>s.root),terms=useTerminalStore(s=>s.terminals),active=useTerminalStore(s=>s.activeId),create=useTerminalStore(s=>s.create),close=useTerminalStore(s=>s.close),setActive=useTerminalStore(s=>s.setActive);
  const attempted=useRef('');const owned=terms.filter(t=>t.root&&normalizedRoot(t.root)===normalizedRoot(root));const current=owned.find(t=>t.id===active)??owned.at(-1);
  useEffect(()=>{if(!root||owned.length||attempted.current===root)return;attempted.current=root;void create(root).catch(fail);},[root,owned.length,create]);
  return <Box sx={{height:'100%',display:'flex',flexDirection:'column'}}><Stack direction="row" alignItems="center" sx={{height:30,borderBottom:'1px solid',borderColor:'divider'}}><Tabs value={current?.id??false} onChange={(_,value)=>setActive(String(value))} variant="scrollable" sx={{minHeight:30,flex:1,'& .MuiTab-root':{minHeight:30,py:0,fontSize:11,textTransform:'none'}}}>{owned.map(t=><Tab key={t.id} value={t.id} label={t.title}/>)}</Tabs><Tooltip title="New terminal"><IconButton disabled={!root} onClick={()=>void create(root).catch(fail)}><Plus size={14}/></IconButton></Tooltip>{current&&<Tooltip title="Kill terminal"><IconButton onClick={()=>void close(current.id).catch(fail)}><X size={14}/></IconButton></Tooltip>}</Stack><Box sx={{flex:1,minHeight:0,position:'relative',bgcolor:'#0d0f12'}}>{owned.map(t=><TerminalView key={t.id} desc={t} active={t.id===current?.id}/>)}{!current&&<Button onClick={()=>void create(root).catch(fail)}>Open terminal</Button>}</Box></Box>;
}
