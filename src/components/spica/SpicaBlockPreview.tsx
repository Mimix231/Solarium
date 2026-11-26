import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, FormControlLabel, Grid,
  LinearProgress, CircularProgress, Dialog, DialogContent, DialogTitle, DialogActions, List, ListItem, ListItemText, Menu, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography, Breadcrumbs, Tooltip, Slider } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SpicaGraphV2 } from '../../spica/graph-v2/types';
import { getRuntimeBlock } from '../../spica/runtime/registry';
import { executeSpicaGraphV2 } from '../../spica/runtime/executor';
import type { SpicaRuntimeStore, SpicaRuntimePermission } from '../../spica/runtime/adapter';
import type { SpicaRuntimeGrantBroker } from '../../spica/runtime/permissions';

/** Explicit allowlist. Untrusted block content never becomes HTML, JavaScript, URLs or CSS. */
type View = Record<string, unknown> & { renderer: string };
const isView = (value:unknown):value is View =>
  !!value && typeof value==='object' && !Array.isArray(value) && typeof (value as View).renderer==='string';
const asText=(value:unknown):string=>typeof value==='string'?value.slice(0,32000):String(value??'').slice(0,400);
const list=(value:unknown):unknown[]=>Array.isArray(value)?value.slice(0,500):[];
const spacing=(value:unknown):number=>typeof value==='number'&&Number.isFinite(value)?Math.min(8,Math.max(0,value)):2;
function MarkdownText({value}:{value:unknown}){
  return <Box sx={{overflowWrap:'anywhere','& a':{color:'primary.main'}}}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>{asText(value)}</ReactMarkdown>
  </Box>;
}
function MarkdownEditor({view,onEvent}:{view:View;onEvent:(id:string,value:string)=>void}){
  const [body,setBody]=useState(asText(view.text));
  useEffect(()=>setBody(asText(view.text)),[view.text]);
  return <Stack gap={2}><TextField fullWidth multiline minRows={5} maxRows={15}
    label={asText(view.label)||'Markdown'} value={body} onChange={event=>{setBody(event.target.value);if(typeof view.eventId==='string')onEvent(view.eventId,event.target.value);}} />
    <Paper variant="outlined" sx={{p:2}} aria-label="Markdown live preview"><MarkdownText value={body}/></Paper>
  </Stack>;
}
function DataForm({view,onEvent}:{view:View;onEvent:(id:string,value:string)=>void}){
  const [values,setValues]=useState<Record<string,string>>({});
  const fields=list(view.fields).filter((name):name is string=>typeof name==='string'&&/^[a-z][a-z0-9_]{0,63}$/.test(name)).slice(0,16);
  const eventId=typeof view.eventId==='string'?view.eventId:'';
  return <Stack component="form" gap={2} onSubmit={event=>{event.preventDefault();if(eventId)onEvent(eventId,JSON.stringify(values));}}>
    <Typography variant="h6">{asText(view.title)}</Typography>
    {fields.map(field=><TextField key={field} size="small" fullWidth label={field}
      value={values[field]??''} onChange={event=>setValues(old=>({...old,[field]:event.target.value}))}/>)}
    <Button type="submit" variant="contained">{asText(view.submitLabel)||'Save'}</Button>
  </Stack>;
}
function TypedForm({view,onEvent}:{view:View;onEvent:(id:string,value:string)=>void}){
  const initial=JSON.stringify(view.values??{});
  const [values,setValues]=useState<Record<string,unknown>>(()=>JSON.parse(initial));
  const [error,setError]=useState('');
  useEffect(()=>{setValues(JSON.parse(initial));setError('');},[initial]);
  const fields=list(view.fields) as Array<Record<string,unknown>>;
  const change=(key:string,value:unknown)=>setValues(previous=>({...previous,[key]:value}));
  return <Stack component="form" gap={2} onSubmit={event=>{
    event.preventDefault();
    if(!event.currentTarget.reportValidity())return;
    const record:Record<string,unknown>={};
    for(const field of fields){
      const key=String(field.key),value=values[key];
      if(field.type==='boolean')record[key]=value===true;
      else if(field.type==='number'&&value!==undefined&&value!==''){
        const number=Number(value);
        if(!Number.isFinite(number)){setError(String(field.label)+' must be a finite number.');return;}
        record[key]=number;
      }else record[key]=value??'';
    }
    const payload=JSON.stringify(record);
    if(payload.length>32000){setError('This form exceeds the saved event size. Shorten the text before submitting.');return;}
    setError('');onEvent(String(view.eventId),payload);
  }}>
    <Typography variant="h6">{asText(view.title)}</Typography>
    {fields.map(field=>{
      const key=String(field.key),label=String(field.label);
      if(field.type==='boolean')return <FormControlLabel key={key} label={label}
        control={<Checkbox required={field.required===true} checked={values[key]===true} onChange={event=>change(key,event.target.checked)}/>}/>;
      return <TextField key={key} fullWidth size="small" label={label} select={field.type==='choice'}
        type={field.type==='number'?'number':field.type==='date'?'date':'text'}
        required={field.required===true} multiline={field.type==='multiline'} minRows={field.type==='multiline'?3:undefined}
        value={values[key]??''} onChange={event=>change(key,event.target.value)}
        slotProps={{inputLabel:field.type==='date'?{shrink:true}:undefined,
          htmlInput:{min:field.min,max:field.max,step:field.type==='number'?'any':undefined,maxLength:field.maxLength??16000}}}>
        {field.type==='choice'?[<MenuItem key="" value=""><em>Choose…</em></MenuItem>,
          ...list(field.choices).map(choice=><MenuItem key={String(choice)} value={String(choice)}>{String(choice)}</MenuItem>)]:undefined}
      </TextField>;
    })}
    {error&&<Alert severity="error">{error}</Alert>}
    <Button type="submit" variant="contained">{asText(view.submitLabel)||'Save'}</Button>
  </Stack>;
}
function RuntimeTabs({view,onEvent}:{view:View;onEvent:(id:string,value:string)=>void}){
  const [selected,setSelected]=useState(0);
  return <Tabs value={Math.min(selected,Math.max(0,list(view.tabs).length-1))} onChange={(_,value:number)=>{
    setSelected(value);if(typeof view.eventId==='string')onEvent(view.eventId,String(value));
  }}>{list(view.tabs).map((tab,i)=><Tab key={i} label={asText(tab)}/>)}</Tabs>;
}
/** New SPICA interactions are actual React controls; they deliver only bounded,
 * user-generated events to the same permissioned graph interaction bridge. */
function ContextMenuControl({view,onEvent,child}:{view:View;onEvent:(id:string,value:string)=>void;child:ReactNode}){
  const [point,setPoint]=useState<{x:number;y:number}|null>(null);
  return <Box onContextMenu={event=>{event.preventDefault();setPoint({x:event.clientX,y:event.clientY});}}>
    {child}<Menu open={point!==null} onClose={()=>setPoint(null)} anchorReference="anchorPosition"
      anchorPosition={point?{top:point.y,left:point.x}:undefined}>
      {list(view.options).map((option,i)=><MenuItem key={i} onClick={()=>{setPoint(null);if(typeof view.eventId==='string')onEvent(view.eventId,asText(option));}}>{asText(option)}</MenuItem>)}
    </Menu>
  </Box>;
}
function TreeControl({view,onEvent}:{view:View;onEvent:(id:string,value:string)=>void}){
  const [expanded,setExpanded]=useState<ReadonlySet<string>>(()=>new Set());
  const labelField=asText(view.labelField),childrenField=asText(view.childrenField),eventId=asText(view.eventId);
  const branch=(items:unknown[],depth:number,path:string):ReactNode=>depth>6?null:items.slice(0,100).map((entry,i)=>{
    const record=entry&&typeof entry==='object'&&!Array.isArray(entry)?entry as Record<string,unknown>:{};
    const id=`${path}.${i}`;
    const children=list(record[childrenField]);
    const isOpen=expanded.has(id);
    return <Box key={id} sx={{pl:depth*1.5}}>
      <Stack direction="row" alignItems="center" gap={.5}>
        {children.length>0&&<Button aria-label={isOpen?'Collapse group':'Expand group'} size="small" onClick={()=>setExpanded(old=>{
          const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;
        })}>{isOpen?'▾':'▸'}</Button>}
        <Button size="small" onClick={()=>{if(eventId)onEvent(eventId,asText(record[labelField]??id));}}>{asText(record[labelField]??`Item ${i+1}`)}</Button>
      </Stack>
      {isOpen&&branch(children,depth+1,id)}
    </Box>;
  });
  return <Box role="tree" aria-label="Record tree">{branch(list(view.items),0,'root')}</Box>;
}
function ShortcutControl({view,onEvent,child}:{view:View;onEvent:(id:string,value:string)=>void;child:ReactNode}){
  const key=asText(view.key),modifier=asText(view.modifier),eventId=asText(view.eventId);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(event.key.toLowerCase()!==key || !(modifier==='ctrl'?event.ctrlKey:modifier==='meta'?event.metaKey:event.altKey))return;
      if(event.repeat||event.isComposing)return;
      event.preventDefault();if(eventId)onEvent(eventId,'true');
    };
    window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[key,modifier,eventId,onEvent]);
  return <Box>{child}</Box>;
}
function Descriptor({view,depth=0,onEvent}:{view:View;depth?:number;onEvent:(id:string,value:string)=>void}):ReactNode{
  if(depth>14)return <Alert severity="warning">Preview depth limit reached.</Alert>;
  const nested=(value:unknown)=>isView(value)?<Descriptor view={value} depth={depth+1} onEvent={onEvent}/>:null;
  const children=()=>list(view.children).filter(isView).map((child,index)=><Box key={index}>{nested(child)}</Box>);
  switch(view.renderer){
    case 'spica.ui.ui_heading':return <Typography variant={(['h1','h2','h3','h4','h5','h6'][Number(view.level)-1]??'h3') as 'h3'}>{asText(view.text)}</Typography>;
    case 'spica.ui.ui_text':return <Typography>{asText(view.text)}</Typography>;
    case 'spica.ui.ui_markdown':return <MarkdownText value={view.text}/>;
    case 'spica.ui.ui_markdown_editor':return <MarkdownEditor view={view} onEvent={onEvent}/>;
    case 'spica.ui.ui_button':case 'spica.ui.material_button':return <Button onClick={()=>{if(typeof view.eventId==='string')onEvent(view.eventId,'true');}} variant={view.variant==='outlined'?'outlined':view.variant==='text'?'text':'contained'}>{asText(view.label)}</Button>;
    case 'spica.ui.ui_input':return <TextField size="small" fullWidth label={asText(view.label)} defaultValue={asText(view.value)} multiline={view.multiline===true} onChange={event=>{if(typeof view.eventId==='string')onEvent(view.eventId,event.target.value);}}/>;
    case 'spica.ui.ui_number_input':case 'spica.ui.ui_date_input':return <TextField fullWidth size="small"
      label={asText(view.label)} type={view.renderer.endsWith('date_input')?'date':'number'} defaultValue={view.value??''}
      slotProps={{inputLabel:{shrink:true},htmlInput:{min:view.min,max:view.max,step:view.step??'any'}}}
      onChange={event=>{if(typeof view.eventId==='string')onEvent(view.eventId,event.target.value);}}/>;
    case 'spica.ui.ui_checkbox':return <FormControlLabel control={<Checkbox defaultChecked={view.checked===true} onChange={event=>{if(typeof view.eventId==='string')onEvent(view.eventId,String(event.target.checked));}}/>} label={asText(view.label)}/>;
    case 'spica.ui.ui_select':return <TextField select size="small" fullWidth label={asText(view.label)} defaultValue={asText(view.value)} onChange={event=>{if(typeof view.eventId==='string')onEvent(view.eventId,event.target.value);}}>{list(view.options).map((option,i)=><MenuItem key={i} value={asText(option)}>{asText(option)}</MenuItem>)}</TextField>;
    case 'spica.ui.ui_alert':return <Alert severity={(['info','success','warning','error'].includes(String(view.severity))?view.severity:'info') as 'info'}>{asText(view.text)}</Alert>;
    case 'spica.ui.ui_badge':return <Chip label={asText(view.text)}/>;
    case 'spica.ui.ui_card':return <Card variant="outlined"><CardContent><Stack gap={1}>{view.title ? <Typography fontWeight={700}>{asText(view.title)}</Typography> : null}{nested(view.child)}</Stack></CardContent></Card>;
    case 'spica.ui.ui_stack':return <Stack direction={view.direction==='row'?'row':'column'} spacing={spacing(view.spacing)} flexWrap="wrap">{children()}</Stack>;
    case 'spica.ui.ui_grid':return <Grid container spacing={2}>{children().map((child,i)=><Grid key={i} size={{xs:12,md:12/Math.max(1,Math.min(12,Number(view.columns)||2))}}>{child}</Grid>)}</Grid>;
    case 'spica.ui.ui_selectable_list':return <List dense aria-label="Selectable records">{list(view.items).map((value,i)=>{
      const row=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
      const key=asText(row[asText(view.keyField)]??i);
      const label=asText(row[asText(view.labelField)]??value);
      return <ListItem key={key} disablePadding><Button fullWidth variant={view.selected===key?'contained':'text'}
        sx={{justifyContent:'flex-start'}} onClick={()=>{if(typeof view.eventId==='string')onEvent(view.eventId,key);}}>{label}</Button></ListItem>;
    })}</List>;
    case 'spica.ui.ui_search_field':return <TextField size="small" fullWidth label={asText(view.label)||'Search'}
      value={asText(view.value)} onChange={event=>{if(typeof view.eventId==='string')onEvent(view.eventId,event.target.value);}}/>;
    case 'spica.ui.ui_screen_router':return <Stack gap={2}><Tabs value={asText(view.selected)} onChange={(_,value:string)=>{
      if(typeof view.eventId==='string')onEvent(view.eventId,value);
    }} variant="scrollable" scrollButtons="auto">{list(view.screens).map((item,i)=>{
      const screen=item&&typeof item==='object'?item as Record<string,unknown>:{};
      return <Tab key={i} value={asText(screen.id)} label={asText(screen.label)}/>;
    })}</Tabs>{nested(view.content)}</Stack>;
    case 'spica.ui.ui_dialog':return <Dialog open={view.open===true} onClose={()=>{if(typeof view.eventId==='string')onEvent(view.eventId,'close');}}
      aria-labelledby="spica-runtime-dialog-title"><DialogTitle id="spica-runtime-dialog-title">{asText(view.title)}</DialogTitle>
      <DialogContent>{nested(view.content)}</DialogContent><DialogActions><Button onClick={()=>{if(typeof view.eventId==='string')onEvent(view.eventId,'close');}}>Close</Button></DialogActions></Dialog>;
    case 'spica.ui.ui_form':return <DataForm view={view} onEvent={onEvent}/>;
    case 'spica.ui.ui_loading_state':return <Stack alignItems="center" gap={1}><CircularProgress aria-label={asText(view.label)||'Loading'}/><Typography>{asText(view.label)}</Typography></Stack>;
    case 'spica.layout.scroll':return <Box sx={{overflowY:'auto',maxHeight:Math.max(100,Math.min(2500,Number(view.maxHeight)||480))}}>{nested(view.child)}</Box>;
    case 'spica.ui.ui_notification':return <Alert severity={(['info','success','warning','error'].includes(String(view.severity))?view.severity:'info') as 'info'}>{asText(view.text)}</Alert>;
    case 'spica.ui.ui_list':return <List dense>{list(view.items).map((value,i)=>{const label=typeof value==='object'&&value!==null?(value as Record<string,unknown>)[asText(view.labelField)]??JSON.stringify(value):value;return <ListItem key={i}><ListItemText primary={asText(label)}/></ListItem>;})}</List>;
    case 'spica.ui.ui_data_table':return <Box sx={{overflowX:'auto'}}><Box component="table" sx={{width:'100%',borderCollapse:'collapse','& th,& td':{textAlign:'left',padding:1,borderBottom:'1px solid',borderColor:'divider'}}}><thead><tr>{list(view.columns).map((key,i)=><th key={i}>{asText(key)}</th>)}</tr></thead><tbody>{list(view.items).map((item,i)=><tr key={i}>{list(view.columns).map((key,j)=><td key={j}>{asText(item&&typeof item==='object'?(item as Record<string,unknown>)[String(key)]:null)}</td>)}</tr>)}</tbody></Box></Box>;
    case 'spica.ui.ui_tooltip':return <Tooltip arrow title={asText(view.text)} placement={(['top','bottom','left','right'].includes(asText(view.placement))?view.placement:'top') as 'top'}><Box component="span" sx={{display:'inline-flex',maxWidth:'100%'}}>{nested(view.child)}</Box></Tooltip>;
    case 'spica.ui.ui_context_menu':return <ContextMenuControl view={view} onEvent={onEvent} child={nested(view.child)}/>;
    case 'spica.ui.ui_breadcrumbs':return <Breadcrumbs aria-label="Application navigation">{list(view.items).map((item,i)=><Button key={i} size="small" onClick={()=>{if(typeof view.eventId==='string')onEvent(view.eventId,asText(item));}}>{asText(item)}</Button>)}</Breadcrumbs>;
    case 'spica.ui.ui_tree_view':return <TreeControl view={view} onEvent={onEvent}/>;
    case 'spica.ui.ui_range_slider':return <Stack gap={1}><Typography>{asText(view.label)}</Typography><Slider aria-label={asText(view.label)} min={Number(view.min)} max={Number(view.max)} step={Number(view.step)} defaultValue={Number(view.value)} valueLabelDisplay="auto" onChangeCommitted={(_,value)=>{if(typeof view.eventId==='string')onEvent(view.eventId,String(value));}}/></Stack>;
    case 'spica.ui.ui_file_picker':return <Button component="label" variant="outlined">{asText(view.label)}<input hidden type="file" accept={asText(view.accept)} onChange={event=>{const file=event.target.files?.[0];if(file&&typeof view.eventId==='string')onEvent(view.eventId,file.name.slice(0,200));}}/></Button>;
    case 'spica.ui.ui_resizable_panel':return <Box sx={{resize:'horizontal',overflow:'auto',width:'100%',minWidth:Number(view.minWidth),maxWidth:Number(view.maxWidth)}}>{nested(view.child)}</Box>;
    case 'spica.ui.ui_keyboard_shortcut':return <ShortcutControl view={view} onEvent={onEvent} child={nested(view.child)}/>;
    case 'spica.ui.ui_empty_state':return <Typography color="text.secondary" sx={{py:3,textAlign:'center'}}>{asText(view.text)}</Typography>;
    case 'spica.ui.ui_toolbar':return <Stack direction="row" gap={1} role="toolbar" flexWrap="wrap">{children()}</Stack>;
    case 'spica.ui.ui_typed_form':return <TypedForm view={view} onEvent={onEvent}/>;
    case 'spica.ui.ui_tabs':return <RuntimeTabs view={view} onEvent={onEvent}/>;
    case 'spica.appearance.styled_surface':return <Paper elevation={Number(view.elevation??0)} sx={{
      backgroundColor:asText(view.background)||undefined,color:asText(view.color)||undefined,
      borderRadius:String(view.radius??12)+'px',padding:String(view.padding??16)+'px',
      fontFamily:view.font==='mono'?'ui-monospace, Consolas, monospace':view.font==='serif'?'Georgia, serif':'inherit',
      '& button:focus-visible, & input:focus-visible':{outline:'2px solid '+(asText(view.accent)||'currentColor'),outlineOffset:2},
    }}>{nested(view.child)}</Paper>;
    case 'spica.appearance.interactive_surface':return <Box sx={{
      transition:'transform '+Number(view.duration??160)+'ms ease, box-shadow '+Number(view.duration??160)+'ms ease',
      '&:hover':{transform:'translateY(-'+Number(view.lift??2)+'px)',boxShadow:2},
      '&:active':{transform:'translateY(0)'},
      '@media (prefers-reduced-motion: reduce)':{transition:'none','&:hover':{transform:'none'}},
    }}>{nested(view.child)}</Box>;
    case 'spica.appearance.glass_surface':return <Paper sx={{p:2,backdropFilter:'blur(12px)',backgroundColor:'background.paper',opacity:view.strength==='subtle'?.9:1}}>{nested(view.content)}</Paper>;
    case 'spica.ui.ui_divider':return <Divider/>;
    case 'spica.ui.ui_surface':return <Paper sx={{p:2}}><Typography fontWeight={700} gutterBottom>{asText(view.title)}</Typography>{nested(view.child)}</Paper>;
    case 'spica.ui.ui_progress':return <LinearProgress variant="determinate" value={typeof view.value==='number'?view.value:0}/>;
    case 'spica.layout.responsive_split':return <Grid container spacing={2}><Grid size={{xs:12,md:6}}>{nested(view.left)}</Grid><Grid size={{xs:12,md:6}}>{nested(view.right)}</Grid></Grid>;
    case 'spica.note_card':return <Card variant="outlined"><CardContent><Typography fontWeight={700}>{asText(view.title)}</Typography><Typography>{asText(view.body)}</Typography></CardContent></Card>;
    default:return <Alert severity="warning">Unsupported visual descriptor: {asText(view.renderer)}</Alert>;
  }
}
/** The preview only accepts UI-session state updates. External writes remain forbidden
 * unless the normal permissioned runtime is explicitly called elsewhere. */
export interface SpicaPreviewAuthorization {
  /** Only supplied by a trusted, already-authorized host. Default preview has no grants. */
  store:SpicaRuntimeStore;
  grants:ReadonlySet<SpicaRuntimePermission>;
  broker?:SpicaRuntimeGrantBroker;
}
export function SpicaBlockPreview({graph,runtime}:{graph:SpicaGraphV2;runtime?:SpicaPreviewAuthorization}){
  const [state,setState]=useState<{error:string;views:View[]}>({error:'',views:[]});
  const interactionState=useRef(new Map<string,string>());
  const sequence=useRef(0);
  const queue=useRef(Promise.resolve());
  const run=useCallback(async(events?:Readonly<Record<string,string>>)=>{
    const runnable=graph.nodes.filter(node=>node.block.availability==='registered');
    if(!runnable.length){setState({error:'No executable composition nodes.',views:[]});return;}
    if(runnable.some(node=>{const adapter=getRuntimeBlock(node.block.id,node.block.version);
      if(!adapter)return true;
      if(adapter.permissions.some(permission=>!runtime?.grants.has(permission)))return true;
      // Only explicitly user-event-gated record writes are safe to host in
      // a preview. Unconditional write/delete blocks must never run on render.
      if(adapter.permissions.some(permission=>permission!=='records.read') &&
        !['spica.runtime.record_write_on_event','spica.runtime.record_patch_on_event','spica.runtime.record_delete_on_event','spica.runtime.settings_store'].includes(adapter.id))return true;
      return false;
    })){
      setState({error:'This graph needs approved runtime permissions or contains automatic write effects. The safe preview will not execute it.',views:[]});return;
    }
    const token=++sequence.current;
    const session=interactionState.current;
    const execute=(eventPayload?:Readonly<Record<string,string>>)=>executeSpicaGraphV2(graph,{target:'desktop',
      interactionState:session,events:eventPayload,store:runtime?.store,grants:runtime?.grants??new Set(),broker:runtime?.broker,
      excludeIsolatedLegacy:true,maxOperations:200});
    try {
      if(events){const eventResult=await execute(events);
        if(eventResult.state!=='passed'){if(token===sequence.current)setState({error:eventResult.error??'Interaction failed.',views:[]});return;}}
      const result=await execute();
      if(token!==sequence.current)return;
      if(result.state!=='passed'){setState({error:result.error??'Composition cannot run.',views:[]});return;}
      const consumed=new Set(graph.edges.filter(e=>e.from.port==='view').map(e=>e.from.node));
      const views=Object.entries(result.outputs).filter(([id])=>!consumed.has(id))
        .flatMap(([,outputs])=>Object.values(outputs).filter(isView)).slice(-8);
      setState({views,error:views.length?'':'Graph executed, but no root UI descriptors were produced.'});
    }catch(error){if(token===sequence.current)setState({error:String(error),views:[]});}
  },[graph,runtime]);
  useEffect(()=>{interactionState.current=new Map();queue.current=Promise.resolve();void run();return()=>{sequence.current++;};},[run]);
  const onEvent=useCallback((id:string,value:string)=>{
    if(!/^[a-z][a-z0-9_]{0,63}$/.test(id)||['constructor','prototype','__proto__'].includes(id)||value.length>32000)return;
    queue.current=queue.current.catch(()=>undefined).then(()=>run({[id]:value}));
  },[run]);
  return <Stack gap={1} sx={{p:2,height:'100%',overflow:'auto'}} data-spica-v2-preview>
    <Chip size="small" variant="outlined" color="info" label="V2 block composition · isolated interactive preview (not native export)"/>
    {state.error?<Alert severity="info">{state.error}</Alert>:state.views.map((view,i)=><Descriptor key={i} view={view} onEvent={onEvent}/>)}
  </Stack>;
}
