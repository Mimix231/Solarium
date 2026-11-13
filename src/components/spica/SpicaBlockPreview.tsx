import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Divider, FormControlLabel, Grid,
  LinearProgress, List, ListItem, ListItemText, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SpicaGraphV2 } from '../../spica/graph-v2/types';
import { getRuntimeBlock } from '../../spica/runtime/registry';
import { executeSpicaGraphV2 } from '../../spica/runtime/executor';

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
function MarkdownEditor({view}:{view:View}){
  const [body,setBody]=useState(asText(view.text));
  useEffect(()=>setBody(asText(view.text)),[view.text]);
  return <Stack gap={2}><TextField fullWidth multiline minRows={5} maxRows={15}
    label={asText(view.label)||'Markdown'} value={body} onChange={event=>setBody(event.target.value)} />
    <Paper variant="outlined" sx={{p:2}} aria-label="Markdown live preview"><MarkdownText value={body}/></Paper>
  </Stack>;
}
function Descriptor({view,depth=0}:{view:View;depth?:number}):ReactNode{
  if(depth>14)return <Alert severity="warning">Preview depth limit reached.</Alert>;
  const nested=(value:unknown)=>isView(value)?<Descriptor view={value} depth={depth+1}/>:null;
  const children=()=>list(view.children).filter(isView).map((child,index)=><Box key={index}>{nested(child)}</Box>);
  switch(view.renderer){
    case 'spica.ui.ui_heading':return <Typography variant={(['h1','h2','h3','h4','h5','h6'][Number(view.level)-1]??'h3') as 'h3'}>{asText(view.text)}</Typography>;
    case 'spica.ui.ui_text':return <Typography>{asText(view.text)}</Typography>;
    case 'spica.ui.ui_markdown':return <MarkdownText value={view.text}/>;
    case 'spica.ui.ui_markdown_editor':return <MarkdownEditor view={view}/>;
    case 'spica.ui.ui_button':case 'spica.ui.material_button':return <Button variant={view.variant==='outlined'?'outlined':view.variant==='text'?'text':'contained'}>{asText(view.label)}</Button>;
    case 'spica.ui.ui_input':return <TextField size="small" fullWidth label={asText(view.label)} defaultValue={asText(view.value)} multiline={view.multiline===true}/>;
    case 'spica.ui.ui_checkbox':return <FormControlLabel control={<Checkbox defaultChecked={view.checked===true}/>} label={asText(view.label)}/>;
    case 'spica.ui.ui_select':return <TextField select size="small" fullWidth label={asText(view.label)} defaultValue={asText(view.value)}>{list(view.options).map((option,i)=><MenuItem key={i} value={asText(option)}>{asText(option)}</MenuItem>)}</TextField>;
    case 'spica.ui.ui_alert':return <Alert severity={(['info','success','warning','error'].includes(String(view.severity))?view.severity:'info') as 'info'}>{asText(view.text)}</Alert>;
    case 'spica.ui.ui_badge':return <Chip label={asText(view.text)}/>;
    case 'spica.ui.ui_card':return <Card variant="outlined"><CardContent><Stack gap={1}>{view.title ? <Typography fontWeight={700}>{asText(view.title)}</Typography> : null}{nested(view.child)}</Stack></CardContent></Card>;
    case 'spica.ui.ui_stack':return <Stack direction={view.direction==='row'?'row':'column'} spacing={spacing(view.spacing)} flexWrap="wrap">{children()}</Stack>;
    case 'spica.ui.ui_grid':return <Grid container spacing={2}>{children().map((child,i)=><Grid key={i} size={{xs:12,md:12/Math.max(1,Math.min(12,Number(view.columns)||2))}}>{child}</Grid>)}</Grid>;
    case 'spica.ui.ui_list':return <List dense>{list(view.items).map((value,i)=>{const label=typeof value==='object'&&value!==null?(value as Record<string,unknown>)[asText(view.labelField)]??JSON.stringify(value):value;return <ListItem key={i}><ListItemText primary={asText(label)}/></ListItem>;})}</List>;
    case 'spica.ui.ui_data_table':return <Box sx={{overflowX:'auto'}}><Box component="table" sx={{width:'100%',borderCollapse:'collapse','& th,& td':{textAlign:'left',padding:1,borderBottom:'1px solid',borderColor:'divider'}}}><thead><tr>{list(view.columns).map((key,i)=><th key={i}>{asText(key)}</th>)}</tr></thead><tbody>{list(view.items).map((item,i)=><tr key={i}>{list(view.columns).map((key,j)=><td key={j}>{asText(item&&typeof item==='object'?(item as Record<string,unknown>)[String(key)]:null)}</td>)}</tr>)}</tbody></Box></Box>;
    case 'spica.ui.ui_empty_state':return <Typography color="text.secondary" sx={{py:3,textAlign:'center'}}>{asText(view.text)}</Typography>;
    case 'spica.ui.ui_toolbar':return <Stack direction="row" gap={1} role="toolbar" flexWrap="wrap">{children()}</Stack>;
    case 'spica.ui.ui_tabs':return <Tabs value={0}>{list(view.tabs).map((tab,i)=><Tab key={i} label={asText(tab)}/>)}</Tabs>;
    case 'spica.ui.ui_divider':return <Divider/>;
    case 'spica.ui.ui_surface':return <Paper sx={{p:2}}><Typography fontWeight={700} gutterBottom>{asText(view.title)}</Typography>{nested(view.child)}</Paper>;
    case 'spica.ui.ui_progress':return <LinearProgress variant="determinate" value={typeof view.value==='number'?view.value:0}/>;
    case 'spica.layout.responsive_split':return <Grid container spacing={2}><Grid size={{xs:12,md:6}}>{nested(view.left)}</Grid><Grid size={{xs:12,md:6}}>{nested(view.right)}</Grid></Grid>;
    case 'spica.note_card':return <Card variant="outlined"><CardContent><Typography fontWeight={700}>{asText(view.title)}</Typography><Typography>{asText(view.body)}</Typography></CardContent></Card>;
    default:return <Alert severity="warning">Unsupported visual descriptor: {asText(view.renderer)}</Alert>;
  }
}
/** Preview only runs pure, no-permission graph nodes. State-changing blocks are NEVER auto-executed. */
export function SpicaBlockPreview({graph}:{graph:SpicaGraphV2}){
  const [state,setState]=useState<{error:string;views:View[]}>({error:'',views:[]});
  useEffect(()=>{
    let active=true;
    const runnable=graph.nodes.filter(node=>node.block.availability==='registered');
    if(!runnable.length){setState({error:'No executable composition nodes.',views:[]});return;}
    if(runnable.some(node=>{const adapter=getRuntimeBlock(node.block.id,node.block.version);return !adapter||adapter.permissions.length>0||adapter.kind==='effect';})){
      setState({error:'This graph contains effectful blocks. Run it explicitly through the permission-gated Spark tool; automatic preview is disabled.',views:[]});return;
    }
    void executeSpicaGraphV2(graph,{target:'desktop',grants:new Set(),excludeIsolatedLegacy:true,maxOperations:200}).then(result=>{
      if(!active)return;
      if(result.state!=='passed'){setState({error:result.error??'Composition cannot run.',views:[]});return;}
      const consumed=new Set(graph.edges.filter(e=>e.from.port==='view').map(e=>e.from.node));
      const views=Object.entries(result.outputs).filter(([id])=>!consumed.has(id))
        .flatMap(([,outputs])=>Object.values(outputs).filter(isView)).slice(-8);
      setState({views,error:views.length?'':'Graph executed, but no root UI descriptors were produced.'});
    }).catch(error=>{if(active)setState({error:String(error),views:[]});});
    return()=>{active=false};
  },[graph]);
  return <Stack gap={1} sx={{p:2,height:'100%',overflow:'auto'}} data-spica-v2-preview>
    <Chip size="small" variant="outlined" color="info" label="V2 block composition · isolated preview (not native export)"/>
    {state.error?<Alert severity="info">{state.error}</Alert>:state.views.map((view,i)=><Descriptor key={i} view={view}/>)}
  </Stack>;
}
