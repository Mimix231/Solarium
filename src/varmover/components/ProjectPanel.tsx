import { useMemo, useState } from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Grid3X3,
  Layers3,
  Lock,
  MoreVertical,
  Plus,
  Search,
  Settings2,
  Trash2,
  Unlock,
  Users,
} from "lucide-react";
import { getActiveScene } from "../editor/project";
import { useEditorStore } from "../editor/store";
import type { GameObjectDocument, SceneLayerDocument } from "../editor/types";

function ObjectRow({
  object,
  objects,
  layers,
  visibleIds,
  depth,
  onOpenObjectTools,
}: {
  object: GameObjectDocument;
  objects: GameObjectDocument[];
  layers: SceneLayerDocument[];
  visibleIds: Set<string>;
  depth: number;
  onOpenObjectTools: (objectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const selectedObjectIds = useEditorStore((state) => state.selectedObjectIds);
  const selectObject = useEditorStore((state) => state.selectObject);
  const reparentSelectedObject = useEditorStore((state) => state.reparentSelectedObject);
  const toggleSelectedEditorVisible = useEditorStore((state) => state.toggleSelectedEditorVisible);
  const children = objects.filter((candidate) => candidate.parentId === object.id && visibleIds.has(candidate.id));
  const layer = layers.find((candidate) => candidate.id === object.layerId);

  return (
    <>
      <div
        className={`tree-row ${selectedObjectIds.includes(object.id) ? "tree-row-selected" : ""} ${object.editorVisible === false ? "tree-row-hidden" : ""}`}
        style={{ paddingLeft: 8 + depth * 15 }}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("application/x-shadowium-object-id", object.id);
          event.dataTransfer.effectAllowed = "move";
          if (!selectedObjectIds.includes(object.id)) selectObject(object.id);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const draggedId = event.dataTransfer.getData("application/x-shadowium-object-id");
          if (draggedId && draggedId !== object.id) {
            selectObject(draggedId);
            window.setTimeout(() => reparentSelectedObject(object.id), 0);
          }
        }}
        onClick={(event) => selectObject(object.id, event.shiftKey || event.ctrlKey || event.metaKey)}
      >
        <button
          className="tree-expander"
          type="button"
          disabled={children.length === 0}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          {children.length > 0 ? expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
        </button>
        <span className="object-layer-dot" style={{ background: layer?.editorColor ?? "#78909c" }} />
        {object.components.some((element) => element.type === "tilemap-renderer") ? <Grid3X3 size={14} /> : <Box size={14} />}
        <span className="tree-label">{object.name}</span>
        {object.prefabId && <span className="linked-prefab-badge" title="Linked Prefab instance">P</span>}
        <span className="tree-state">{object.locked ? <Lock size={12} /> : <Unlock size={12} />}</span>
        <button className="tree-state tree-visibility-toggle" type="button" title={object.editorVisible === false ? "Show in editor" : "Hide in editor"} onClick={(event) => { event.stopPropagation(); selectObject(object.id); window.setTimeout(toggleSelectedEditorVisible, 0); }}>{object.editorVisible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
        <button
          className="tree-row-more"
          type="button"
          title={`Open tools for ${object.name}`}
          onClick={(event) => {
            event.stopPropagation();
            selectObject(object.id);
            onOpenObjectTools(object.id);
          }}
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {expanded && children.map((child) => (
        <ObjectRow key={child.id} object={child} objects={objects} layers={layers} visibleIds={visibleIds} depth={depth + 1} onOpenObjectTools={onOpenObjectTools} />
      ))}
    </>
  );
}

export function ProjectPanel({
  onOpenScene,
  onOpenOverlay,
}: {
  onOpenScene?: () => void;
  onOpenOverlay?: (kind: "add-object" | "add-component" | "object-tools" | "hierarchy-tools" | "events" | "animations" | "audio") => void;
}) {
  const [search, setSearch] = useState("");
  const project = useEditorStore((state) => state.project);
  const selectedObjectIds = useEditorStore((state) => state.selectedObjectIds);
  const addScene = useEditorStore((state) => state.addScene);
  const addTilemapObject = useEditorStore((state) => state.addTilemapObject);
  const groupSelectedObjects = useEditorStore((state) => state.groupSelectedObjects);
  const selectScene = useEditorStore((state) => state.selectScene);
  const selectObject = useEditorStore((state) => state.selectObject);
  const reparentSelectedObject = useEditorStore((state) => state.reparentSelectedObject);
  const deleteScene = useEditorStore((state) => state.deleteScene);
  const scene = getActiveScene(project);

  const visibleIds = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return new Set(scene.objects.map((object) => object.id));
    const ids = new Set(scene.objects.filter((object) => object.name.toLowerCase().includes(query) || object.tags.some((tag) => tag.toLowerCase().includes(query))).map((object) => object.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const object of scene.objects) {
        if (ids.has(object.id) && object.parentId && !ids.has(object.parentId)) {
          ids.add(object.parentId);
          changed = true;
        }
      }
    }
    return ids;
  }, [scene.objects, search]);

  const roots = scene.objects.filter((object) => object.parentId === null && visibleIds.has(object.id));

  return (
    <aside className="dock-panel project-dock">
      <header className="dock-header">
        <div className="dock-title"><Layers3 size={15} /><span>Project</span></div>
        <div className="dock-header-actions">
          <button className="icon-button" type="button" title="Add tilemap" onClick={addTilemapObject}><Grid3X3 size={15} /></button>
          <button className="icon-button primary" type="button" title="Open Game Object Library" onClick={() => onOpenOverlay?.("add-object")}><Plus size={16} /></button>
        </div>
      </header>

      <div className="project-section-header">
        <span>Scenes</span>
        <button className="icon-button compact" type="button" title="Add scene" onClick={addScene}><Plus size={14} /></button>
      </div>

      <div className="scene-chip-list">
        {project.scenes.map((item) => (
          <div key={item.id} className={`scene-chip ${item.id === project.activeSceneId ? "scene-chip-active" : ""}`}>
            <button type="button" onClick={() => { selectScene(item.id); onOpenScene?.(); }}>
              <Layers3 size={13} />
              <span>{item.name}</span>
              <small>{item.objects.length}</small>
            </button>
            {project.scenes.length > 1 && (
              <button className="scene-delete" type="button" title="Delete scene" onClick={() => deleteScene(item.id)}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="project-section-header object-section-header hierarchy-section-title">
        <span>Hierarchy</span>
        <div>
          <small>{selectedObjectIds.length > 1 ? `${selectedObjectIds.length} selected` : `${scene.objects.length} objects`}</small>
          <button className="icon-button compact" type="button" title="Open Game Object Library" onClick={() => onOpenOverlay?.("add-object")}><Plus size={14} /></button>
          <button className="icon-button compact" type="button" title="Hierarchy tools" onClick={() => onOpenOverlay?.("hierarchy-tools")}><MoreVertical size={15} /></button>
        </div>
      </div>

      <div className="hierarchy-search">
        <Search size={13} />
        <input value={search} placeholder="Search objects or tags" onChange={(event) => setSearch(event.target.value)} />
        {selectedObjectIds.length > 1 && <button className="icon-button compact" type="button" title="Group selected" onClick={groupSelectedObjects}><Users size={13} /></button>}
      </div>

      <div
        className="object-tree"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          if (event.target !== event.currentTarget) return;
          const draggedId = event.dataTransfer.getData("application/x-shadowium-object-id");
          if (draggedId) {
            selectObject(draggedId);
            window.setTimeout(() => reparentSelectedObject(null), 0);
          }
        }}
      >
        {roots.length > 0 ? (
          roots.map((object) => <ObjectRow key={object.id} object={object} objects={scene.objects} layers={scene.layers} visibleIds={visibleIds} depth={0} onOpenObjectTools={(objectId) => { selectObject(objectId); onOpenOverlay?.("object-tools"); }} />)
        ) : (
          <div className="empty-panel-message">
            <Box size={30} />
            <strong>{search ? "No matching objects" : "Empty scene"}</strong>
            <span>{search ? "Try another hierarchy search." : "Add an object, tilemap, or drag a Game Object into the viewport."}</span>
            {!search && <button className="material-button tonal" type="button" onClick={() => onOpenOverlay?.("add-object")}><Plus size={15} /> Browse Game Objects</button>}
          </div>
        )}
      </div>

      <footer className="project-footer">
        <Settings2 size={13} />
        <span>{project.settings.gameWidth} × {project.settings.gameHeight}</span>
        <span>{scene.layers.length} layers</span>
      </footer>
    </aside>
  );
}
