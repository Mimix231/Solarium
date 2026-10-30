import { IconButton, Stack, Tooltip } from '@mui/material';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import CropSquareRounded from '@mui/icons-material/CropSquareRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Borderless desktop window controls; not displayed during web preview. */
export function WindowButtons() {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return null;
  const windowHandle = getCurrentWindow();
  return <Stack direction="row" className="window-controls" alignItems="center" gap={.2}>
    <Tooltip title="Minimize"><IconButton aria-label="Minimize" className="window-control" onClick={() => void windowHandle.minimize()}><RemoveRounded sx={{ fontSize: 15 }} /></IconButton></Tooltip>
    <Tooltip title="Maximize or restore"><IconButton aria-label="Maximize or restore" className="window-control" onClick={() => void windowHandle.toggleMaximize()}><CropSquareRounded sx={{ fontSize: 12 }} /></IconButton></Tooltip>
    <Tooltip title="Close Solarium"><IconButton aria-label="Close Solarium" className="window-control window-close" onClick={() => void windowHandle.close()}><CloseRounded sx={{ fontSize: 16 }} /></IconButton></Tooltip>
  </Stack>;
}
