import { useMemo, useState } from "react";
import { Box, IconButton, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { Tree, type NodeRendererProps } from "react-arborist";
import { ChevronDown, ChevronRight, File, FileCode2, FileJson, Folder, FolderOpen, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useDocumentStore } from "../../stores/documentStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useElementSize } from "../../hooks/useElementSize";
import type { FileNode } from "../../lib/types";
import { api } from "../../integration/api";

function icon(node: FileNode, opened = false) {
  if (node.isDirectory) return opened ? <FolderOpen size={15} /> : <Folder size={15} />;
  if (/\.(ts|tsx|js|jsx|py|rs|cpp|c|h)$/i.test(node.name)) return <FileCode2 size={14} />;
  if (/\.json$/i.test(node.name)) return <FileJson size={14} />;
  return <File size={14} />;
}
function findNode(nodes: FileNode[], id: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = node.children && findNode(node.children, id);
    if (child) return child;
  }
}
function relativePath(root: string, path: string) {
  const clean = (value: string) => value.replace(/\\/g, "/").replace(/\/$/, "");
  const base = clean(root), full = clean(path);
  return full.startsWith(`${base}/`) ? full.slice(base.length + 1) : path;
}

export default function ExplorerView() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const root = useWorkspaceStore(s => s.root), tree = useWorkspaceStore(s => s.tree), choose = useWorkspaceStore(s => s.choose), refresh = useWorkspaceStore(s => s.refresh);
  const openDoc = useDocumentStore(s => s.open), remapDocPath = useDocumentStore(s => s.remapPath), closeUnder = useDocumentStore(s => s.closeUnder);
  const confirmDeletes = useSettingsStore(s => s.settings.confirmDeletes);
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; node?: FileNode } | null>(null);
  const rows = useMemo(() => tree, [tree]);

  const fail=(error:unknown)=>useWorkspaceStore.setState({error:String(error)});
  function Row({ node, style, dragHandle }: NodeRendererProps<FileNode>) {
    return <div ref={dragHandle} style={style} className={`arborist-row ${node.isSelected ? "selected" : ""}`}
      onContextMenu={event => { event.preventDefault(); event.stopPropagation(); node.select(); setMenu({ x: event.clientX, y: event.clientY, node: node.data }); }}
      onDoubleClick={() => node.data.isDirectory ? node.toggle() : void openDoc(node.data.path, node.data.name).catch(fail)}
      onClick={() => { node.select(); if (!node.data.isDirectory) void openDoc(node.data.path, node.data.name).catch(fail); }}>
      {node.data.isDirectory ? (node.isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <span style={{ width: 13 }} />}
      <span style={{ color: node.data.isDirectory ? "#d9ba78" : "#8f9cad", display: "flex" }}>{icon(node.data, node.isOpen)}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{node.data.name}</span>
    </div>;
  }

  const act = async (kind: string) => {
    if (!menu) return;
    const node = menu.node;
    const base = node ? (node.isDirectory ? node.path : node.path.replace(/[\\/][^\\/]+$/, "")) : root;
    try {
      if (kind === "new-file" || kind === "new-folder") {
        const name = window.prompt(kind === "new-file" ? "File name" : "Folder name");
        if (name) {
          const sep = base.includes("\\") ? "\\" : "/";
          const path = `${base}${sep}${name}`;
          if (kind === "new-file") await api.createFile(path); else await api.createDirectory(path);
          await refresh();
        }
      }
      if (kind === "rename" && node) {
        const name = window.prompt("New name", node.name);
        if (name) {
          const newPath = await api.renamePath(node.path, name);
          remapDocPath(node.path, newPath);
          await refresh();
        }
      }
      if (kind === "delete" && node && (!confirmDeletes || window.confirm(`Delete ${node.name}?`))) {
        const clean=(path:string)=>path.replaceAll('\\','/').toLowerCase();const prefix=clean(node.path);
        if(useDocumentStore.getState().documents.some(d=>(clean(d.path)===prefix||clean(d.path).startsWith(prefix+'/'))&&d.content!==d.savedContent))throw Error('Save or explicitly close the edited buffers before moving their files to recovery trash.');
        await api.deletePath(node.path);
        closeUnder(node.path);
        await refresh();
      }
      if (kind === "copy-path" && node) await navigator.clipboard.writeText(node.path);
      if (kind === "copy-relative" && node) await navigator.clipboard.writeText(relativePath(root, node.path));
      if (kind === "reveal" && node) await api.revealPath(node.path);
    } catch(error) { fail(error); } finally {
      setMenu(null);
    }
  };

  return <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
    <Stack direction="row" sx={[{ height: 36, px: 1.25, borderBottom: "1px solid", borderColor: "divider" }, {alignItems: "center"}]}>
      <Typography variant="overline" sx={{ fontSize: 10.5, letterSpacing: 1 }}>Explorer</Typography><Box sx={{ flex: 1 }} />
      <Tooltip title="New"><IconButton disabled={!root} onClick={e => setMenu({ x: e.clientX, y: e.clientY })}><Plus size={15} /></IconButton></Tooltip>
      <Tooltip title="Refresh"><IconButton disabled={!root} onClick={() => refresh()}><RefreshCw size={14} /></IconButton></Tooltip>
    </Stack>
    {!root ? <Box sx={{ p: 1.5 }}><Typography sx={{color: "text.secondary", fontSize: 12}}>Open a folder to begin.</Typography><Typography onClick={() => choose()} sx={{ mt: 1, color: "primary.main", fontSize: 12, cursor: "pointer" }}>Open Folder</Typography></Box> : <>
      <Typography title={root} sx={{ px: 1.25, py: .8, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{root.split(/[\\/]/).pop()?.toUpperCase()}</Typography>
      <Box sx={{ px: .8, pb: .7 }}><TextField size="small" fullWidth placeholder="Filter files" value={filter} onChange={e => setFilter(e.target.value)} sx={{ "& input": { py: .6, fontSize: 11.5 } }} /></Box>
      <Box ref={ref} sx={{ flex: 1, minHeight: 0 }} onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }); }}>
        {size.width > 0 && <Tree<FileNode> data={rows} width={size.width} height={size.height} rowHeight={24} indent={14} openByDefault={false} idAccessor="id" childrenAccessor="children" searchTerm={filter}
          searchMatch={(node, term) => node.data.name.toLowerCase().includes(term.toLowerCase())}
          onRename={async ({ id, name }) => { try{const node = findNode(tree, String(id)); if (node) { const newPath = await api.renamePath(node.path, name); remapDocPath(node.path, newPath); await refresh(); }}catch(error){fail(error);} }}
          onMove={async ({ dragIds, parentId }) => { try{const parent = parentId ? findNode(tree, String(parentId))?.path : root; if (!parent) return; for (const id of dragIds) { const node = findNode(tree, String(id)); if (node && node.path !== parent) { const newPath = await api.movePath(node.path, parent); remapDocPath(node.path, newPath); } } await refresh(); }catch(error){fail(error);} }}>
          {Row}
        </Tree>}
      </Box>
    </>}
    <Menu open={!!menu} onClose={() => setMenu(null)} anchorReference="anchorPosition" anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}>
      <MenuItem onClick={() => act("new-file")}>New File</MenuItem><MenuItem onClick={() => act("new-folder")}>New Folder</MenuItem>
      {menu?.node && <MenuItem onClick={() => act("rename")}>Rename</MenuItem>}
      {menu?.node && <MenuItem onClick={() => act("copy-path")}>Copy Path</MenuItem>}
      {menu?.node && <MenuItem onClick={() => act("copy-relative")}>Copy Relative Path</MenuItem>}
      {menu?.node && <MenuItem onClick={() => act("reveal")}>Reveal in File Explorer</MenuItem>}
      {menu?.node && <MenuItem sx={{ color: "error.main" }} onClick={() => act("delete")}><Trash2 size={14} style={{ marginRight: 8 }} />Delete</MenuItem>}
    </Menu>
  </Box>;
}
