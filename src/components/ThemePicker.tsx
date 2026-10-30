import { Box, IconButton, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import { useState, type MouseEvent } from 'react';
import { useSolarium } from '../state/useSolarium';
import { themes } from '../themes/registry';
export function ThemePicker() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const theme = useSolarium((s) => s.workspace.preferences.theme);
  const update = useSolarium((s) => s.updatePreferences);
  return <>
    <Tooltip title="Appearance"><IconButton onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)} aria-label="Choose theme"><PaletteRounded fontSize="small" /></IconButton></Tooltip>
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { className: 'theme-menu' } }}>
      <Typography variant="overline" sx={{ px: 2, fontWeight: 800 }}>Appearance</Typography>
      {themes.map((item) => <MenuItem key={item.id} onClick={() => { update({ theme: item.id }); setAnchor(null); }} sx={{ py: .8, gap: 1.4, minWidth: 255 }}>
        <Box className="theme-preview" sx={{ background: item.sample }} />
        <Stack sx={{ flex: 1 }}><Typography fontWeight={650} fontSize={12.5}>{item.title}</Typography><Typography color="text.secondary" fontSize={10.5}>{item.description}</Typography></Stack>
        {theme === item.id && <CheckRounded fontSize="small" color="primary" />}
      </MenuItem>)}
    </Menu>
  </>;
}
