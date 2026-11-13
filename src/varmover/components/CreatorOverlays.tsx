import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Aperture,
  AudioLines,
  Box,
  Boxes,
  Gamepad2,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Film,
  FolderPlus,
  Layers3,
  LayoutGrid,
  Link2,
  Lock,
  MoreVertical,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Unlock,
  X,
  Zap,
} from "lucide-react";
import { COMPONENT_CATALOG } from "../editor/catalog";
import { GAME_OBJECT_TYPE_PROFILES, profileForObject } from "../editor/phase10Architecture";
import { getActiveScene } from "../editor/project";
import { useEditorStore } from "../editor/store";
import type { ComponentCategory, ComponentDefinition, ComponentType } from "../editor/types";
import { AnimationEditor } from "./AnimationEditor";
import { AudioPanel } from "./AudioPanel";
import { EventEditor } from "./EventEditor";

export type CreatorOverlayKind =
  | "add-object"
  | "add-component"
  | "object-tools"
  | "events"
  | "animations"
  | "audio"
  | "hierarchy-tools"
  | null;

interface CreatorOverlaysProps {
  kind: CreatorOverlayKind;
  onClose: () => void;
  onOpenMode: (mode: "world" | "logic" | "interface" | "play", logicView?: "events" | "animations" | "audio") => void;
  onOpenComponentLibrary?: () => void;
}

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  rendering: "Rendering",
  world: "World",
  movement: "Movement",
  animation: "Animation",
  physics: "Physics",
  gameplay: "Gameplay",
  interaction: "Interaction",
  combat: "Combat",
  ai: "AI",
  abilities: "Abilities",
  stats: "Stats",
  progression: "Progression",
  scripting: "Scripting",
  camera: "Camera",
  audio: "Audio",
  interface: "Interface",
  materials: "Materials",
  effects: "Effects",
  persistence: "Persistence",
  debugging: "Debugging",
  behaviour: "Behaviour",
};

function useStoredList(key: string, legacyKey?: string): [string[], (next: string[]) => void] {
  const [items, setItems] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem(key) ?? (legacyKey ? window.localStorage.getItem(legacyKey) : null) ?? "[]";
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
      return [];
    }
  });

  function update(next: string[]): void {
    setItems(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Browser privacy settings may disable local storage; the overlay still works in-memory.
    }
  }

  return [items, update];
}

function recommendedComponents(attached: Set<ComponentType>, layerId: string): Set<ComponentType> {
  const result = new Set<ComponentType>();
  const has = (type: ComponentType) => attached.has(type);

  if (has("sprite-renderer") || has("shape-renderer")) {
    result.add("box-collider");
    result.add("directional-animation");
    result.add("interaction");
  }
  if (has("player-input")) {
    result.add("top-down-movement");
    result.add("platformer-movement");
    result.add("health");
    result.add("inventory");
    result.add("camera-target");
    result.add("damage-receiver");
    result.add("save-state");
  }
  if (has("box-collider") || has("circle-collider")) {
    result.add("rigidbody-2d");
    result.add("damage-dealer");
    result.add("hazard");
  }
  if (has("camera")) {
    result.add("camera-zone");
    result.add("minimap");
  }
  if (layerId === "layer-interface" || [...attached].some((type) => type.startsWith("ui-") || type === "minimap")) {
    result.add("ui-style");
    result.add("ui-menu-screen");
    result.add("ui-menu-item");
    result.add("ui-action-guide");
    result.add("screen-transition");
  }
  for (const type of attached) result.delete(type);
  return result;
}

function OverlayFrame({
  title,
  subtitle,
  icon,
  wide = false,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [onClose]);

  return (
    <div className="creator-overlay-scrim" onPointerDown={onClose}>
      <section className={`creator-overlay-sheet ${wide ? "wide" : ""}`} onPointerDown={(event) => event.stopPropagation()}>
        <header className="creator-overlay-header">
          <div className="creator-overlay-title-icon">{icon}</div>
          <div><h2>{title}</h2><p>{subtitle}</p></div>
          <button className="creator-overlay-close" type="button" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="creator-overlay-content">{children}</div>
        {footer && <footer className="creator-overlay-footer">{footer}</footer>}
      </section>
    </div>
  );
}


function GameObjectLibraryOverlay({ onClose }: { onClose: () => void }) {
  const project = useEditorStore((state) => state.project);
  const addObject = useEditorStore((state) => state.addObject);
  const addTilemapObject = useEditorStore((state) => state.addTilemapObject);
  const addObjectFromPrefab = useEditorStore((state) => state.addObjectFromPrefab);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Recommended");
  const [favourites, setFavourites] = useStoredList("shadowiumui.object-favourites", "leonismaker.object-favourites");
  const [recent, setRecent] = useStoredList("shadowiumui.object-recent", "leonismaker.object-recent");
  const categories = useMemo(() => ["Recommended", "Recent", "Favourites", "All", ...Array.from(new Set(project.prefabs.map((template) => template.category ?? "Basics"))).sort()], [project.prefabs]);
  const selectedObject = getActiveScene(project).objects.find((object) => object.id === useEditorStore.getState().selectedObjectId) ?? null;

  const recommended = useMemo(() => {
    const values = new Set<string>();
    if (!selectedObject) {
      for (const name of ["Top-Down Player", "Platformer Player", "Tilemap", "Game Camera", "Solid Wall", "Menu Screen"]) {
        const template = project.prefabs.find((candidate) => candidate.name === name);
        if (template) values.add(template.id);
      }
      return values;
    }
    const types = new Set(selectedObject.components.map((component) => component.type));
    if (types.has("player-input")) for (const name of ["Game Camera", "Runtime Minimap", "Checkpoint", "Item Pickup"]) {
      const template = project.prefabs.find((candidate) => candidate.name === name);
      if (template) values.add(template.id);
    }
    if (types.has("tilemap-renderer")) for (const name of ["Top-Down Player", "Solid Wall", "Game Camera", "Scene Spawn Point"]) {
      const template = project.prefabs.find((candidate) => candidate.name === name);
      if (template) values.add(template.id);
    }
    if ([...types].some((type) => type.startsWith("ui-"))) for (const name of ["Menu Item", "Action Guide", "UI Text", "UI Button"]) {
      const template = project.prefabs.find((candidate) => candidate.name === name);
      if (template) values.add(template.id);
    }
    return values;
  }, [project.prefabs, selectedObject]);

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    return project.prefabs.filter((template) => {
      if (query && !`${template.name} ${template.description} ${template.category ?? "Basics"} ${template.object.components.map((component) => component.type).join(" ")}`.toLowerCase().includes(query)) return false;
      if (category === "Recommended") return recommended.has(template.id);
      if (category === "Recent") return recent.includes(template.id);
      if (category === "Favourites") return favourites.includes(template.id);
      if (category === "All") return true;
      return (template.category ?? "Basics") === category;
    }).sort((left, right) => {
      if (category === "Recent") return recent.indexOf(left.id) - recent.indexOf(right.id);
      if (category === "Favourites") return favourites.indexOf(left.id) - favourites.indexOf(right.id);
      return left.name.localeCompare(right.name);
    });
  }, [category, favourites, project.prefabs, recent, recommended, search]);

  function place(prefabId: string): void {
    addObjectFromPrefab(prefabId);
    setRecent([prefabId, ...recent.filter((id) => id !== prefabId)].slice(0, 16));
  }

  return (
    <OverlayFrame
      title="Add Game Object"
      subtitle="Choose a complete click-and-play recipe. Every recipe is built from normal Components that remain editable in the Inspector."
      icon={<Gamepad2 size={22} />}
      wide
      onClose={onClose}
      footer={<><span>{project.prefabs.length} recipes · click several without closing</span><button className="material-button text" type="button" onClick={() => { addObject(); onClose(); }}><Plus size={14} /> Create empty object</button></>}
    >
      <div className="object-library-layout">
        <aside className="object-library-categories">
          {categories.map((value) => (
            <button key={value} className={category === value ? "active" : ""} type="button" onClick={() => setCategory(value)}>
              {value === "Recommended" ? <Sparkles size={15} /> : value === "Recent" ? <Activity size={15} /> : value === "Favourites" ? <Star size={15} /> : value === "Cameras" ? <Aperture size={15} /> : <LayoutGrid size={15} />}
              <span>{value}</span>
              <small>{value === "Recommended" ? recommended.size : value === "Recent" ? recent.length : value === "Favourites" ? favourites.length : value === "All" ? project.prefabs.length : project.prefabs.filter((template) => (template.category ?? "Basics") === value).length}</small>
            </button>
          ))}
        </aside>
        <section className="object-library-results">
          <label className="creator-overlay-search"><Search size={16} /><input autoFocus value={search} placeholder="Search players, doors, platforms, cameras, menus, gimmicks…" onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="object-library-quick-row">
            <button type="button" onClick={() => { addObject(); onClose(); }}><Plus size={17} /><span><strong>Empty Object</strong><small>Start from nothing</small></span></button>
            <button type="button" onClick={() => { addTilemapObject(); onClose(); }}><Layers3 size={17} /><span><strong>Tilemap</strong><small>Paint a grid world</small></span></button>
          </div>
          <div className="object-library-grid">
            {results.map((template) => {
              const favourite = favourites.includes(template.id);
              return (
                <article key={template.id} className="object-library-card">
                  <button className="component-favourite-button" type="button" title={favourite ? "Remove favourite" : "Add favourite"} onClick={() => setFavourites(favourite ? favourites.filter((id) => id !== template.id) : [...favourites, template.id])}><Star size={15} fill={favourite ? "currentColor" : "none"} /></button>
                  <span className="object-library-card-icon" style={{ background: template.object.editorColor }}><Box size={20} /></span>
                  <div className="object-library-card-copy"><small>{template.category ?? "Basics"}</small><strong>{template.name}</strong><p>{template.description}</p></div>
                  <div className="object-library-element-chips">{template.object.components.slice(0, 5).map((element) => <span key={element.id}>{COMPONENT_CATALOG.find((definition) => definition.type === element.type)?.name ?? element.type}</span>)}{template.object.components.length > 5 && <span>+{template.object.components.length - 5}</span>}</div>
                  <button className="material-button filled full-width" type="button" onClick={() => place(template.id)}><Plus size={14} /> Add to scene</button>
                </article>
              );
            })}
            {results.length === 0 && <div className="creator-overlay-empty"><Search size={32} /><strong>No matching Game Objects</strong><span>Try another category or search term.</span></div>}
          </div>
        </section>
      </div>
    </OverlayFrame>
  );
}

function AddComponentOverlay({ onClose, onOpenComponentLibrary }: { onClose: () => void; onOpenComponentLibrary?: () => void }) {
  const project = useEditorStore((state) => state.project);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const addComponent = useEditorStore((state) => state.addComponent);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ComponentCategory | "all" | "recommended" | "compatible" | "advanced" | "favourites" | "recent">("recommended");
  const [favourites, setFavourites] = useStoredList("shadowiumui.component-favourites", "leonismaker.component-favourites");
  const [recent, setRecent] = useStoredList("shadowiumui.component-recent", "leonismaker.element-recent");
  const object = getActiveScene(project).objects.find((candidate) => candidate.id === selectedObjectId) ?? null;
  const attached = new Set<ComponentType>(object?.components.map((element) => element.type) ?? []);
  const legacyRecommended = recommendedComponents(attached, object?.layerId ?? "layer-gameplay");
  const profile = object ? profileForObject(object, project) : null;
  const recommended = new Set<ComponentType>([...(profile?.recommended ?? []), ...legacyRecommended]);
  for (const type of attached) recommended.delete(type);
  const isCompatible = (definition: ComponentDefinition) => {
    if (!object || !profile) return true;
    if (object.objectType === "custom" && !object.customTypeId) return true;
    if (definition.supportedObjectTypes?.length) return definition.supportedObjectTypes.includes(object.objectType);
    return !profile.hiddenCategories.includes(definition.category);
  };

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    return COMPONENT_CATALOG.filter((definition) => {
      if (query && !`${definition.name} ${definition.description} ${definition.category}`.toLowerCase().includes(query)) return false;
      if (category === "recommended") return recommended.has(definition.type) && isCompatible(definition);
      if (category === "compatible") return isCompatible(definition);
      if (category === "advanced") return !isCompatible(definition);
      if (category === "favourites") return favourites.includes(definition.type) && isCompatible(definition);
      if (category === "recent") return recent.includes(definition.type);
      if (category !== "all") return definition.category === category && isCompatible(definition);
      return true;
    }).sort((left, right) => {
      if (category === "recent") return recent.indexOf(left.type) - recent.indexOf(right.type);
      if (category === "favourites") return favourites.indexOf(left.type) - favourites.indexOf(right.type);
      return left.name.localeCompare(right.name);
    });
  }, [category, favourites, recent, recommended, search]);

  function attach(definition: ComponentDefinition): void {
    if (attached.has(definition.type)) return;
    addComponent(definition.type);
    setRecent([definition.type, ...recent.filter((type) => type !== definition.type)].slice(0, 12));
  }

  const categories = [...new Set(COMPONENT_CATALOG.map((definition) => definition.category))];

  return (
    <OverlayFrame
      title={object ? `Add Component to ${object.name}` : "Add Component"}
      subtitle={object ? `${profile?.label ?? GAME_OBJECT_TYPE_PROFILES[object.objectType].label} Components are scoped by purpose. Advanced shows unusual combinations.` : "Select a Game Object to attach Components."}
      icon={<Boxes size={22} />}
      wide
      onClose={onClose}
      footer={<><span>{attached.size} attached · {COMPONENT_CATALOG.length} available</span><button className="material-button text" type="button" onClick={onOpenComponentLibrary}>Open reusable Component library <ChevronRight size={14} /></button></>}
    >
      {!object ? (
        <div className="creator-overlay-empty"><Box size={36} /><strong>Select an object first</strong><span>Components are attached to the currently selected hierarchy object.</span></div>
      ) : (
        <div className="add-component-overlay-layout">
          <aside className="add-component-categories">
            <button className={category === "recommended" ? "active" : ""} type="button" onClick={() => setCategory("recommended")}><Sparkles size={15} /> Recommended <small>{recommended.size}</small></button>
            <button className={category === "compatible" ? "active" : ""} type="button" onClick={() => setCategory("compatible")}><Check size={15} /> Compatible <small>{COMPONENT_CATALOG.filter(isCompatible).length}</small></button>
            <button className={category === "recent" ? "active" : ""} type="button" onClick={() => setCategory("recent")}><Activity size={15} /> Recent <small>{recent.length}</small></button>
            <button className={category === "favourites" ? "active" : ""} type="button" onClick={() => setCategory("favourites")}><Star size={15} /> Favourites <small>{favourites.length}</small></button>
            <div className="overlay-nav-divider" />
            <button className={category === "all" ? "active" : ""} type="button" onClick={() => setCategory("all")}><Boxes size={15} /> All Components <small>{COMPONENT_CATALOG.length}</small></button>
            <button className={category === "advanced" ? "active" : ""} type="button" onClick={() => setCategory("advanced")}><Sparkles size={15} /> Advanced <small>{COMPONENT_CATALOG.filter((definition) => !isCompatible(definition)).length}</small></button>
            {categories.map((value) => <button key={value} className={category === value ? "active" : ""} type="button" onClick={() => setCategory(value)}><Box size={14} /> {CATEGORY_LABELS[value]} <small>{COMPONENT_CATALOG.filter((definition) => definition.category === value).length}</small></button>)}
          </aside>
          <section className="add-component-results">
            <label className="creator-overlay-search"><Search size={16} /><input autoFocus value={search} placeholder="Search Components by name, purpose, or category" onChange={(event) => setSearch(event.target.value)} /></label>
            <div className="add-component-grid">
              {results.map((definition) => {
                const isAttached = attached.has(definition.type);
                const favourite = favourites.includes(definition.type);
                return (
                  <article key={definition.type} className={`add-component-result ${isAttached ? "attached" : ""}`}>
                    <button className="component-favourite-button" type="button" title={favourite ? "Remove favourite" : "Add favourite"} onClick={() => setFavourites(favourite ? favourites.filter((type) => type !== definition.type) : [...favourites, definition.type])}><Star size={15} fill={favourite ? "currentColor" : "none"} /></button>
                    <span className="add-component-result-icon" style={{ background: definition.color }}><Box size={18} /></span>
                    <div><strong>{definition.name}</strong><small>{CATEGORY_LABELS[definition.category]} · {isCompatible(definition) ? "Compatible" : "Advanced"}</small><p>{definition.description}</p></div>
                    <button className={`material-button ${isAttached ? "text" : "tonal"}`} type="button" disabled={isAttached} onClick={() => attach(definition)}>{isAttached ? <><Check size={14} /> Attached</> : <><Plus size={14} /> Add</>}</button>
                  </article>
                );
              })}
              {results.length === 0 && <div className="creator-overlay-empty"><Search size={32} /><strong>No matching Components</strong><span>Try another search or category.</span></div>}
            </div>
          </section>
        </div>
      )}
    </OverlayFrame>
  );
}

function ObjectToolsOverlay({ onClose, onOpenMode }: { onClose: () => void; onOpenMode: CreatorOverlaysProps["onOpenMode"] }) {
  const project = useEditorStore((state) => state.project);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const addObject = useEditorStore((state) => state.addObject);
  const duplicateSelectedObject = useEditorStore((state) => state.duplicateSelectedObject);
  const renameSelectedObject = useEditorStore((state) => state.renameSelectedObject);
  const toggleSelectedObject = useEditorStore((state) => state.toggleSelectedObject);
  const toggleSelectedLocked = useEditorStore((state) => state.toggleSelectedLocked);
  const deleteSelectedObject = useEditorStore((state) => state.deleteSelectedObject);
  const saveSelectedAsPrefab = useEditorStore((state) => state.saveSelectedAsPrefab);
  const reparentSelectedObject = useEditorStore((state) => state.reparentSelectedObject);
  const object = getActiveScene(project).objects.find((candidate) => candidate.id === selectedObjectId) ?? null;

  function createChild(): void {
    if (!object) return;
    const parentId = object.id;
    addObject();
    window.setTimeout(() => reparentSelectedObject(parentId), 0);
    onClose();
  }

  if (!object) {
    return <OverlayFrame title="Object Tools" subtitle="Select an object to use contextual tools." icon={<MoreVertical size={22} />} onClose={onClose}><div className="creator-overlay-empty"><Box size={34} /><strong>No object selected</strong></div></OverlayFrame>;
  }

  const actions = [
    { icon: <Plus size={17} />, label: "Add Component", detail: "Attach pre-coded behaviour", run: () => window.dispatchEvent(new CustomEvent("shadowium:open-overlay", { detail: "add-component" })) },
    { icon: <Zap size={17} />, label: "Open Events", detail: "Triggers, conditions, and actions", run: () => window.dispatchEvent(new CustomEvent("shadowium:open-overlay", { detail: "events" })) },
    { icon: <Film size={17} />, label: "Open Animations", detail: "Clips and timeline editing", run: () => window.dispatchEvent(new CustomEvent("shadowium:open-overlay", { detail: "animations" })) },
    { icon: <AudioLines size={17} />, label: "Open Audio", detail: "Sources and mixer groups", run: () => window.dispatchEvent(new CustomEvent("shadowium:open-overlay", { detail: "audio" })) },
    { icon: <FolderPlus size={17} />, label: "Create Child", detail: "Add and parent a new object", run: createChild },
    { icon: <Copy size={17} />, label: "Duplicate", detail: "Clone object and descendants", run: () => { duplicateSelectedObject(); onClose(); } },
    { icon: <Link2 size={17} />, label: "Save as Prefab", detail: "Create a linked reusable recipe", run: () => { saveSelectedAsPrefab(); onClose(); } },
  ];

  return (
    <OverlayFrame title={object.name} subtitle="Contextual object tools" icon={<Box size={22} />} onClose={onClose} footer={<button className="material-button text" type="button" onClick={() => { onOpenMode("world"); onClose(); }}><Layers3 size={14} /> Return to World</button>}>
      <div className="object-tools-summary"><span style={{ background: object.editorColor }}><Box size={20} /></span><div><strong>{object.name}</strong><small>{object.components.length} Components · {object.tags.length ? object.tags.join(", ") : "No tags"}</small></div></div>
      <div className="creator-action-list">
        {actions.map((action) => <button key={action.label} type="button" onClick={() => { action.run(); if (!["Add Component", "Open Events", "Open Animations", "Open Audio"].includes(action.label)) onClose(); }}>{action.icon}<span><strong>{action.label}</strong><small>{action.detail}</small></span><ChevronRight size={15} /></button>)}
      </div>
      <div className="creator-action-grid">
        <button type="button" onClick={() => { const name = window.prompt("Object name", object.name); if (name?.trim()) renameSelectedObject(name.trim()); }}><Box size={15} /> Rename</button>
        <button type="button" onClick={toggleSelectedLocked}>{object.locked ? <Unlock size={15} /> : <Lock size={15} />}{object.locked ? "Unlock" : "Lock"}</button>
        <button type="button" onClick={toggleSelectedObject}>{object.enabled ? <EyeOff size={15} /> : <Eye size={15} />}{object.enabled ? "Hide" : "Show"}</button>
        <button className="danger" type="button" onClick={() => { if (window.confirm(`Delete ${object.name}?`)) { deleteSelectedObject(); onClose(); } }}><Trash2 size={15} /> Delete</button>
      </div>
    </OverlayFrame>
  );
}

function HierarchyToolsOverlay({ onClose }: { onClose: () => void }) {
  const addTilemapObject = useEditorStore((state) => state.addTilemapObject);
  const groupSelectedObjects = useEditorStore((state) => state.groupSelectedObjects);
  const pasteObjects = useEditorStore((state) => state.pasteObjects);
  const selectAllObjects = useEditorStore((state) => state.selectAllObjects);
  const actions = [
    { icon: <Plus size={17} />, label: "Open Game Object Library", run: () => window.dispatchEvent(new CustomEvent("shadowium:open-overlay", { detail: "add-object" })) },
    { icon: <Layers3 size={17} />, label: "Add Tilemap", run: addTilemapObject },
    { icon: <FolderPlus size={17} />, label: "Group Selected", run: groupSelectedObjects },
    { icon: <Copy size={17} />, label: "Paste Objects", run: pasteObjects },
    { icon: <Check size={17} />, label: "Select All", run: selectAllObjects },
  ];
  return <OverlayFrame title="Hierarchy Tools" subtitle="Create and organize scene objects." icon={<Layers3 size={22} />} onClose={onClose}><div className="creator-action-list compact">{actions.map((action) => <button key={action.label} type="button" onClick={() => { action.run(); onClose(); }}>{action.icon}<span><strong>{action.label}</strong></span><ChevronRight size={15} /></button>)}</div></OverlayFrame>;
}

export function CreatorOverlays({ kind, onClose, onOpenMode, onOpenComponentLibrary }: CreatorOverlaysProps) {
  useEffect(() => {
    function openFromContext(event: Event): void {
      const detail = (event as CustomEvent<CreatorOverlayKind>).detail;
      if (detail) window.dispatchEvent(new CustomEvent("shadowium:set-overlay", { detail }));
    }
    window.addEventListener("shadowium:open-overlay", openFromContext);
    return () => window.removeEventListener("shadowium:open-overlay", openFromContext);
  }, []);

  if (!kind) return null;
  if (kind === "add-object") return <GameObjectLibraryOverlay onClose={onClose} />;
  if (kind === "add-component") return <AddComponentOverlay onClose={onClose} onOpenComponentLibrary={onOpenComponentLibrary} />;
  if (kind === "object-tools") return <ObjectToolsOverlay onClose={onClose} onOpenMode={onOpenMode} />;
  if (kind === "hierarchy-tools") return <HierarchyToolsOverlay onClose={onClose} />;
  if (kind === "events") return <OverlayFrame title="Object Events" subtitle="Quick logic sheet. Expand into Logic mode for the full authoring workspace." icon={<Zap size={22} />} wide onClose={onClose} footer={<button className="material-button filled" type="button" onClick={() => { onOpenMode("logic", "events"); onClose(); }}>Open Logic Workspace <ChevronRight size={14} /></button>}><div className="context-editor-host"><EventEditor /></div></OverlayFrame>;
  if (kind === "animations") return <OverlayFrame title="Animations" subtitle="Create and tune clips while keeping the selected object in context." icon={<Film size={22} />} wide onClose={onClose} footer={<button className="material-button filled" type="button" onClick={() => { onOpenMode("logic", "animations"); onClose(); }}>Open Logic Workspace <ChevronRight size={14} /></button>}><div className="context-editor-host"><AnimationEditor /></div></OverlayFrame>;
  return <OverlayFrame title="Audio" subtitle="Quick source and mixer controls for the current project." icon={<AudioLines size={22} />} wide onClose={onClose} footer={<button className="material-button filled" type="button" onClick={() => { onOpenMode("logic", "audio"); onClose(); }}>Open Logic Workspace <ChevronRight size={14} /></button>}><div className="context-editor-host"><AudioPanel /></div></OverlayFrame>;
}
