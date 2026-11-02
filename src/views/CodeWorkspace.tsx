import { lazy,Suspense } from 'react';
import { Box,CircularProgress,Typography } from '@mui/material';
const Workspace=lazy(()=>import('../coding/integration/Workspace'));
export function CodeWorkspace(){return <Suspense fallback={<Box sx={{p:3,display:'flex',gap:1,alignItems:'center'}}><CircularProgress size={18}/><Typography>Loading code workspace…</Typography></Box>}><Workspace/></Suspense>;}
