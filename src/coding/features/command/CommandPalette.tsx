import { useState } from "react";
import { Box, Dialog, DialogContent, InputAdornment, List, ListItemButton, ListItemText, TextField, Typography } from "@mui/material";
import { Command } from "lucide-react";
import { commandRegistry } from "../../commands/registry";
import { useWorkbenchStore } from "../../stores/workbenchStore";

export default function CommandPalette() {
  const open = useWorkbenchStore((s) => s.commandPaletteOpen);
  const setOpen = useWorkbenchStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const commands = commandRegistry.search(query).slice(0, 100);
  const execute = async (id: string) => { setOpen(false); setQuery(""); await commandRegistry.execute(id, { source: "palette" }); };

  return <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { alignSelf: "flex-start", mt: "10vh" } } }}>
    <DialogContent sx={{ p: 1 }}>
      <TextField autoFocus fullWidth size="small" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a workspace command"
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><Command size={15}/></InputAdornment> } }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter" && commands[0]) void execute(commands[0].id); }} />
      <List dense sx={{ maxHeight: 440, overflow: "auto" }}>
        {commands.map((command) => <ListItemButton key={command.id} onClick={() => void execute(command.id)} sx={{ borderRadius: 1 }}>
          <ListItemText primary={command.title} secondary={`${command.category} · ${command.id}`}
            slotProps={{ primary: { sx: { fontSize: 12 } }, secondary: { sx: { fontSize: 10.5 } } }} />
          {command.keybinding && <Typography sx={{ ml: 2, fontSize: 10.5, color: "text.secondary", fontFamily: "monospace" }}>{command.keybinding}</Typography>}
        </ListItemButton>)}
      </List>
      {!commands.length && <Box sx={{ p: 2, textAlign: "center", color: "text.secondary", fontSize: 12 }}>No matching commands.</Box>}
    </DialogContent>
  </Dialog>;
}
