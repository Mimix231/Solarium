import { useEffect } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { RefreshCw, Server } from "lucide-react";
import { useLspStore } from "../../stores/lspStore";
import type { LspRunningServer } from "../../lib/types";

export default function LanguageServicesPanel(){
  const status=useLspStore(s=>s.status),loading=useLspStore(s=>s.loading),error=useLspStore(s=>s.error),refresh=useLspStore(s=>s.refresh);
  useEffect(()=>{void refresh();},[refresh]);
  const running=Object.entries(status?.running??{}) as Array<[string,LspRunningServer]>;
  return <Box sx={{height:"100%",overflow:"auto",p:1.25}}>
    <Stack direction="row" spacing={1} sx={{alignItems:"center",mb:1}}><Server size={15}/><Typography sx={{fontSize:12,fontWeight:700}}>Language Services</Typography><Box sx={{flex:1}}/><Button size="small" startIcon={<RefreshCw size={13}/>} disabled={loading} onClick={()=>void refresh()}>Refresh</Button></Stack>
    {error&&<Typography sx={{fontSize:11,color:"error.main",mb:1}}>{error}</Typography>}
    <Typography sx={{fontSize:10.5,color:"text.secondary",mb:.7}}>Discovered for {status?.root??"no workspace"}</Typography>
    <Stack direction="row" spacing={.7} sx={{flexWrap:"wrap",gap:.7,mb:1.2}}>{(status?.available??[]).map(server=><Chip key={server.family} size="small" label={`${server.family} · ${server.languages.join(", ")}`} variant="outlined"/>)}</Stack>
    {!status?.available?.length&&<Typography sx={{fontSize:11.5,color:"text.secondary"}}>No external language servers were found. Monaco remains usable; install a project/global language server to enable Glitch LSP completion, hover, definitions and diagnostics.</Typography>}
    {running.map(([family,server])=><Box key={family} sx={{border:"1px solid",borderColor:"divider",borderRadius:1,p:1,mb:1}}><Stack direction="row" spacing={1} sx={{alignItems:"center"}}><Typography sx={{fontSize:11.5,fontWeight:700}}>{family}</Typography><Chip size="small" color={server.alive?"success":"error"} label={server.alive?`PID ${server.pid}`:"stopped"}/><Typography sx={{fontSize:10.5,color:"text.secondary"}}>{server.languages.join(", ")}</Typography></Stack>{server.logTail.length>0&&<Box component="pre" sx={{m:0,mt:.8,fontSize:10,color:"text.secondary",whiteSpace:"pre-wrap"}}>{server.logTail.join("\n")}</Box>}</Box>)}
  </Box>;
}
