import { Box,Chip,Stack,Typography } from "@mui/material";
import { AlertCircle,AlertTriangle,Info } from "lucide-react";
import { useDocumentStore } from "../../stores/documentStore";
import type { EditorDiagnostic } from "../../lib/types";

function severityIcon(severity:number){if(severity>=8)return <AlertCircle size={14}/>;if(severity>=4)return <AlertTriangle size={14}/>;return <Info size={14}/>;}
function severityLabel(severity:number){if(severity>=8)return "error";if(severity>=4)return "warning";return "info";}
export default function ProblemsPanel(){
  const diagnostics=useDocumentStore(s=>s.diagnostics);const open=useDocumentStore(s=>s.open);
  const entries=(Object.entries(diagnostics) as Array<[string,EditorDiagnostic[]]>).flatMap(([path,items])=>items.map(item=>({path,item})));
  const errors=entries.filter(x=>x.item.severity>=8).length,warnings=entries.filter(x=>x.item.severity>=4&&x.item.severity<8).length;
  return <Box sx={{height:"100%",overflow:"auto"}}>
    <Stack direction="row" spacing={.7} sx={[{px:1.2,py:.7,borderBottom:"1px solid",borderColor:"divider"}, {alignItems: "center"}]}>
      <Typography sx={{fontSize: 11.5, fontWeight: 700}}>Monaco diagnostics</Typography><Chip size="small" label={`${errors} errors`} color={errors?"error":"default"}/><Chip size="small" label={`${warnings} warnings`} color={warnings?"warning":"default"}/>
    </Stack>
    {!entries.length?<Typography sx={[{p:1.5}, {fontSize: 12, color: "text.secondary"}]}>No problems reported by the active Monaco language models.</Typography>:entries.map(({path,item},i)=><Stack key={`${path}:${item.startLineNumber}:${item.startColumn}:${i}`} direction="row" spacing={1} onClick={()=>open(path,undefined,item.startLineNumber,item.startColumn)} sx={{px:1.2,py:.65,borderBottom:"1px solid",borderColor:"divider",cursor:"pointer","&:hover":{bgcolor:"action.hover"}}}>
      <Box sx={{color:item.severity>=8?"error.main":item.severity>=4?"warning.main":"info.main",pt:.15}}>{severityIcon(item.severity)}</Box>
      <Box sx={{minWidth:0,flex:1}}><Typography sx={{fontSize: 11.5}}>{item.message}</Typography><Typography noWrap sx={{fontSize: 10.5, color: "text.secondary"}}>{path} · {item.startLineNumber}:{item.startColumn}{item.source?` · ${item.source}`:""}</Typography></Box>
      <Typography sx={{fontSize: 10, color: "text.secondary"}}>{severityLabel(item.severity)}</Typography>
    </Stack>)}
  </Box>;
}
