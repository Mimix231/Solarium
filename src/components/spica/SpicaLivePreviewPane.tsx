import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { AppsOutlined, VisibilityOutlined, AutoAwesomeOutlined } from '@mui/icons-material';
import { SpicaPreview } from '../SpicaPreview';
import { SpicaBlockPreview } from './SpicaBlockPreview';
import { useState } from 'react';
import type { SpicaRecord } from '../../spica/repository';
import type { GraphEdit } from '../../spica/graph';
import type { StyleEdit } from '../../spica/appearance';
import type { ProgramEdit } from '../../spica/program';
import { auditSpicaDesign } from '../../spica/professionalism';
import { getRuntimeBlock } from '../../spica/runtime/registry';

/** This is the real interactive graph renderer, not a claim of a running native executable. */
export function SpicaLivePreviewPane({ record, verified, locked, open, onClose, onEdit, onProgramEdit }: {
  record: SpicaRecord; verified: boolean; locked: boolean; open: boolean; onClose(): void;
  onEdit(edit: readonly GraphEdit[]): Promise<void>;
  onProgramEdit(edit: ProgramEdit): Promise<boolean>;
}) {
  const quality = auditSpicaDesign(record.data.graph);
  const hasV2Preview=Boolean(record.data.graphV2?.nodes.some(node=>
    getRuntimeBlock(node.block.id,node.block.version)?.kind === 'renderer'));
  const [view,setView]=useState<'blocks'|'legacy'>('blocks');
  return <Box className="spica-live-preview-pane">
    <Stack className="spica-live-preview-caption" direction="row" gap={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
      <Stack direction="row" alignItems="center" gap={.8}>
        <AppsOutlined fontSize="small" color="primary" />
        <Typography fontWeight={700} fontSize={13}>Application preview</Typography>
      </Stack>
      <Stack direction="row" gap={.7} alignItems="center" flexWrap="wrap">
        {hasV2Preview && <Button size="small" variant="outlined" onClick={()=>setView(previous=>previous==='blocks'?'legacy':'blocks')}>
          {view==='blocks'?'Show standalone app':'Show block composition'}</Button>}
        {quality.findings.length > 0 && <Chip size="small" color={quality.errors ? 'error' : 'warning'}
          variant="outlined" label={`${quality.errors} errors · ${quality.warnings} design warnings`} />}
        <Chip size="small" variant="outlined" icon={<VisibilityOutlined />}
          color={verified ? 'success' : 'default'} label={verified ? 'Native build verified · graph preview' : 'Interactive graph preview'} />
      </Stack>
    </Stack>
    <Box className="spica-live-preview-body">
      <Stack className="spica-live-preview-window" direction="row" alignItems="center" gap={.8}>
        <span className="spica-window-dot spica-window-close" /><span className="spica-window-dot spica-window-min" />
        <span className="spica-window-dot spica-window-max" />
        <Typography fontSize={11} sx={{ flex: 1, textAlign: 'center' }}>{record.data.graph.name}</Typography>
        <AutoAwesomeOutlined fontSize="inherit" color="secondary" />
      </Stack>
      {hasV2Preview && view==='blocks' && record.data.graphV2 ? <SpicaBlockPreview graph={record.data.graphV2}/> :
        <SpicaPreview record={record} embedded mode={open ? 'dock' : 'closed'} onMode={onClose}
          onEdit={(style: StyleEdit) => onEdit([style])} onProgramEdit={onProgramEdit} saving={locked}
          verification={verified ? `Native verification passed · r${record.data.revision} · sample graph data` : 'Sample graph data · not a native build'} />}
    </Box>
  </Box>;
}
