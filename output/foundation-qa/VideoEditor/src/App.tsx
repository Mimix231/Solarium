import { useEffect, useRef, useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Button, Typography, Slider } from '@mui/material';
type Clip={id:string;name:string;url:string};
const theme=createTheme({palette:{mode:'dark',primary:{main:'#a5b4fc'},background:{default:'#101323',paper:'#1c2234'}},shape:{borderRadius:14},typography:{fontFamily:'Segoe UI, sans-serif'}});
export function App(){
 const [clips,setClips]=useState<Clip[]>([]),[active,setActive]=useState(''),[time,setTime]=useState(0),[duration,setDuration]=useState(0);
 const video=useRef<HTMLVideoElement>(null),urls=useRef<string[]>([]);const selected=clips.find(c=>c.id===active);
 useEffect(()=>()=>{urls.current.forEach(url=>URL.revokeObjectURL(url));},[]);
 return <ThemeProvider theme={theme}><CssBaseline/><div className="editor-shell"><header><Typography variant="h6">Video Editor <small>0.1 · Phase 1</small></Typography><Button component="label" variant="contained">Import media<input hidden type="file" multiple accept="video/*" onChange={e=>{const next=Array.from(e.target.files??[]).map(f=>{const url=URL.createObjectURL(f);urls.current.push(url);return{id:crypto.randomUUID(),name:f.name,url};});setClips(old=>[...old,...next]);if(next[0])setActive(next[0].id);e.target.value='';}}/></Button></header>
 <aside className="media panel"><h2>Media library</h2>{!clips.length&&<p>Import a local video to begin.</p>}{clips.map(c=><Button key={c.id} fullWidth variant={active===c.id?'contained':'text'} onClick={()=>{setActive(c.id);setTime(0);}}>{c.name}</Button>)}</aside>
 <main className="preview panel"><h2>Preview</h2>{selected?<video key={selected.id} ref={video} src={selected.url} controls onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)}/>:<p>Your selected video appears here.</p>}</main>
 <section className="timeline panel"><h2>Timeline · {time.toFixed(1)} / {duration.toFixed(1)} s</h2><Slider aria-label="Playhead" min={0} max={duration||1} step={0.01} value={Math.min(time,duration||1)} onChange={(_,v)=>{if(video.current){video.current.currentTime=v as number;setTime(v as number);}}}/><div className="track">{clips.map(c=><button key={c.id} onClick={()=>setActive(c.id)}>{c.name}</button>)}</div><p>Local import, playback and scrubbing. Multi-track editing and FFmpeg export are planned.</p></section></div></ThemeProvider>;
}
