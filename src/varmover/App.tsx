import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AudioLines,
  Blocks,
  Brush,
  Bug,
  Check,
  Command,
  Search,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crosshair,
  FilePlus2,
  Gamepad2,
  Grid3X3,
  Hand,
  Move,
  RotateCw,
  Scaling,
  Expand,
  Image,
  LayoutPanelTop,
  Layers3,
  MonitorDown,
  PaintBucket,
  Pipette,
  Eraser,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Square,
  X,
  Zap,
} from "lucide-react";
import { AnimationEditor } from "./components/AnimationEditor";
import { AssetBrowser } from "./components/AssetBrowser";
import { CommitNumberField, CommitTextField, Switch } from "./components/EditorControls";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { EventEditor } from "./components/EventEditor";
import { GamePreview } from "./components/GamePreview";
import { GameplayWorkbench } from "./components/GameplayWorkbench";
import { InspectorPanel } from "./components/InspectorPanel";
import { InterfacePanel } from "./components/InterfacePanel";
import { ThemeStudio } from "./components/ThemeStudio";
import { ProductionToolkit } from "./components/ProductionToolkit";
import { AudioPanel } from "./components/AudioPanel";
import { BuildPanel } from "./components/BuildPanel";
import { ProjectPanel } from "./components/ProjectPanel";
import { SceneViewport } from "./components/SceneViewport";
import { SpriteSheetEditor } from "./components/SpriteSheetEditor";
import { PrefabBrowser } from "./components/PrefabBrowser";
import { WindowBar } from "./components/WindowBar";
import { WorldBuilderPanel } from "./components/WorldBuilderPanel";
import { WorkspaceErrorBoundary } from "./components/WorkspaceErrorBoundary";
import { CreatorOverlays } from "./components/CreatorOverlays";
import type { CreatorOverlayKind } from "./components/CreatorOverlays";
import { importedFileToAsset } from "./editor/assets";
import { buildDiagnostics } from "./editor/diagnostics";
import { createEmptyProject } from "./editor/project";
import {
  chooseAssetFiles,
  chooseAssetFolder,
  createProjectFolderOnDisk,
  importAssetDirectory,
  importAssetFiles,
  openProjectFromDisk,
  saveProjectToDisk,
} from "./editor/projectFile";
import { useEditorStore } from "./editor/store";
import type { BottomTab } from "./editor/types";
import "./styles.css";

type OpenMenu = "file" | "edit" | "project" | "view" | "debug" | null;

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT" ||
        element.isContentEditable),
  );
}

function MenuItem({
  label,
  shortcut,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  shortcut?: string;
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className="menu-item" type="button" disabled={disabled} onClick={onClick}>
      <span className="menu-check">{checked ? <Check size={13} /> : null}</span>
      <span>{label}</span>
      {shortcut && <small>{shortcut}</small>}
    </button>
  );
}

function Menu({
  label,
  id,
  openMenu,
  setOpenMenu,
  children,
}: {
  label: string;
  id: Exclude<OpenMenu, null>;
  openMenu: OpenMenu;
  setOpenMenu: (value: OpenMenu) => void;
  children: React.ReactNode;
}) {
  const open = openMenu === id;
  return (
    <div className="menu-root" onPointerDown={(event) => event.stopPropagation()}>
      <button className={`app-menu-button ${open ? "active" : ""}`} type="button" onClick={() => setOpenMenu(open ? null : id)}>
        {label}
      </button>
      {open && <div className="menu-popup" onClick={() => setOpenMenu(null)}>{children}</div>}
    </div>
  );
}

function ResizeHandle({
  direction,
  onDelta,
}: {
  direction: "horizontal" | "vertical";
  onDelta: (delta: number) => void;
}) {
  function start(event: React.PointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    let previous = direction === "vertical" ? event.clientX : event.clientY;
    element.setPointerCapture(pointerId);
    element.classList.add("active");

    function move(pointerEvent: PointerEvent): void {
      const current = direction === "vertical" ? pointerEvent.clientX : pointerEvent.clientY;
      onDelta(current - previous);
      previous = current;
    }

    function finish(): void {
      element.classList.remove("active");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  return <div className={`resize-handle ${direction}`} onPointerDown={start} />;
}

function NewProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("Untitled Game");
  const [creating, setCreating] = useState(false);

  return (
    <div className="modal-scrim" onPointerDown={onClose}>
      <section className="material-dialog new-project-dialog" onPointerDown={(event) => event.stopPropagation()}>
        <header className="dialog-header">
          <div><h2>Create Project</h2><p>ShadowiumUI will create a project folder with Assets, Scenes, Components, World, Interface, Audio, Builds, and cache directories.</p></div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="new-project-body">
          <label className="stacked-field"><span>Project Name</span><input autoFocus className="material-input" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <div className="new-project-template-card">
            <span className="new-project-template-icon"><Layers3 size={24} /></span>
            <div><strong>Empty 2D Project</strong><p>Starts with one empty scene and the reusable Component library. No sample player, walls, key, door, events, assets, or hardcoded gameplay are inserted.</p></div>
            <Check size={18} />
          </div>
          <div className="new-project-summary">
            <span>1280 × 720</span><span>Pixel perfect</span><span>2D sprites</span><span>Grid 32px</span>
          </div>
        </div>
        <footer className="dialog-footer">
          <button className="material-button text" type="button" onClick={onClose}>Cancel</button>
          <button
            className="material-button filled"
            type="button"
            disabled={creating || !name.trim()}
            onClick={() => {
              setCreating(true);
              void onCreate(name.trim()).finally(() => setCreating(false));
            }}
          >
            <FilePlus2 size={15} /> {creating ? "Creating…" : "Choose Location and Create"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatKeyCode(code: string): string {
  return code
    .replace(/^Key/, "")
    .replace(/^Digit/, "")
    .replace(/^Arrow/, "Arrow ")
    .replace("Space", "Spacebar");
}

function KeyBindingRecorder({
  onRecord,
}: {
  onRecord: (code: string) => void;
}) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;

    function capture(event: KeyboardEvent): void {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        setRecording(false);
        return;
      }

      onRecord(event.code);
      setRecording(false);
    }

    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [recording, onRecord]);

  return (
    <button
      className={`material-button ${recording ? "filled" : "tonal"}`}
      type="button"
      onClick={() => setRecording(true)}
    >
      {recording ? "Press a key…" : "+ Binding"}
    </button>
  );
}

function ProjectSettingsDialog({ onClose }: { onClose: () => void }) {
  const project = useEditorStore((state) => state.project);
  const setProjectSettings = useEditorStore((state) => state.setProjectSettings);
  const renameProject = useEditorStore((state) => state.renameProject);
  const addInputAction = useEditorStore((state) => state.addInputAction);
  const updateInputAction = useEditorStore((state) => state.updateInputAction);
  const removeInputAction = useEditorStore((state) => state.removeInputAction);
  const addCollisionLayer = useEditorStore((state) => state.addCollisionLayer);
  const removeCollisionLayer = useEditorStore((state) => state.removeCollisionLayer);
  const setCollisionPair = useEditorStore((state) => state.setCollisionPair);
  const setProjectVariable = useEditorStore((state) => state.setProjectVariable);
  const removeProjectVariable = useEditorStore((state) => state.removeProjectVariable);
  const [newVariable, setNewVariable] = useState("");
  const [newCollisionLayer, setNewCollisionLayer] = useState("");

  return (
    <div className="modal-scrim" onPointerDown={onClose}>
      <section className="material-dialog settings-dialog" onPointerDown={(event) => event.stopPropagation()}>
        <header className="dialog-header">
          <div><h2>Project Settings</h2><p>Game display, deterministic input actions, collision layers, and project variables.</p></div>
          <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="settings-layout">
          <section className="settings-section">
            <h3>Display</h3>
            <div className="settings-grid">
              <label><span>Project Name</span><CommitTextField value={project.metadata.name} onCommit={renameProject} /></label>
              <label><span>Game Width</span><CommitNumberField value={project.settings.gameWidth} minimum={320} maximum={7680} onCommit={(gameWidth) => setProjectSettings({ gameWidth })} /></label>
              <label><span>Game Height</span><CommitNumberField value={project.settings.gameHeight} minimum={180} maximum={4320} onCommit={(gameHeight) => setProjectSettings({ gameHeight })} /></label>
              <label><span>Default Background</span><div className="color-input-wrap"><input type="color" value={project.settings.defaultBackgroundColor} onChange={(event) => setProjectSettings({ defaultBackgroundColor: event.target.value })} /><small>{project.settings.defaultBackgroundColor.toUpperCase()}</small></div></label>
              <div className="settings-switch-row"><span>Pixel Perfect</span><Switch checked={project.settings.pixelPerfect} onChange={(pixelPerfect) => setProjectSettings({ pixelPerfect })} /></div>
            </div>
          </section>

          <section className="settings-section">
            <h3>Runtime & Persistence</h3>
            <div className="settings-grid">
              <label><span>Initial Scene</span><select className="material-select" value={project.settings.initialSceneId} onChange={(event) => setProjectSettings({ initialSceneId: event.target.value })}>{project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>
              <label><span>Save Slots</span><CommitNumberField value={project.settings.saveSlots} minimum={1} maximum={99} onCommit={(saveSlots) => setProjectSettings({ saveSlots })} /></label>
              <div className="settings-switch-row"><span>Auto-save on Scene Change</span><Switch checked={project.settings.autoSaveOnSceneChange} onChange={(autoSaveOnSceneChange) => setProjectSettings({ autoSaveOnSceneChange })} /></div>
              <div className="settings-switch-row"><span>Resizable Window</span><Switch checked={project.settings.resizable} onChange={(resizable) => setProjectSettings({ resizable })} /></div>
              <div className="settings-switch-row"><span>Start Fullscreen</span><Switch checked={project.settings.fullscreen} onChange={(fullscreen) => setProjectSettings({ fullscreen })} /></div>
              <div className="settings-switch-row"><span>VSync</span><Switch checked={project.settings.vsync} onChange={(vsync) => setProjectSettings({ vsync })} /></div>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-title">
              <h3>Input Actions</h3>
              <button className="material-button tonal" type="button" onClick={addInputAction}>
                <Plus size={14} /> Add Action
              </button>
            </div>
            <div className="input-action-table">
              {project.settings.inputActions.map((action) => (
                <div key={action.id} className="input-action-row input-action-row-editable">
                  <div className="input-action-identity">
                    <CommitTextField
                      value={action.name}
                      onCommit={(name) => updateInputAction(action.id, { name })}
                    />
                    <code>{action.id}</code>
                  </div>
                  <div className="binding-chip-list">
                    {action.keys.map((key) => (
                      <button
                        key={key}
                        className="binding-chip"
                        type="button"
                        title="Remove binding"
                        onClick={() => updateInputAction(action.id, { keys: action.keys.filter((candidate) => candidate !== key) })}
                      >
                        {formatKeyCode(key)} <X size={11} />
                      </button>
                    ))}
                    {action.keys.length === 0 && <span className="unbound-label">Unbound</span>}
                  </div>
                  <KeyBindingRecorder
                    onRecord={(code) => {
                      if (!action.keys.includes(code)) {
                        updateInputAction(action.id, { keys: [...action.keys, code] });
                      }
                    }}
                  />
                  <button
                    className="icon-button compact danger"
                    type="button"
                    title="Delete input action"
                    onClick={() => removeInputAction(action.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <p className="settings-note">Components reference these action IDs, so controls can be rebound without changing movement or interaction behaviour.</p>
          </section>

          <section className="settings-section">
            <h3>Collision Matrix</h3>
            <p className="settings-note">Choose which layers are allowed to collide or trigger one another. Changes are mirrored automatically across the matrix.</p>
            <div className="collision-layer-editor">
              <div className="collision-layer-chips">
                {project.settings.collisionLayers.map((layer) => (
                  <span key={layer} className="collision-layer-chip">
                    {layer}
                    <button
                      type="button"
                      disabled={project.settings.collisionLayers.length <= 1}
                      title={`Remove ${layer}`}
                      onClick={() => removeCollisionLayer(layer)}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="add-collision-layer">
                <input
                  className="material-input"
                  value={newCollisionLayer}
                  placeholder="New layer"
                  onChange={(event) => setNewCollisionLayer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && newCollisionLayer.trim()) {
                      addCollisionLayer(newCollisionLayer);
                      setNewCollisionLayer("");
                    }
                  }}
                />
                <button
                  className="material-button tonal"
                  type="button"
                  disabled={!newCollisionLayer.trim()}
                  onClick={() => {
                    addCollisionLayer(newCollisionLayer);
                    setNewCollisionLayer("");
                  }}
                >
                  <Plus size={14} /> Add Layer
                </button>
              </div>
            </div>
            <div className="collision-matrix-wrap">
              <table className="collision-matrix">
                <thead>
                  <tr>
                    <th>Layer</th>
                    {project.settings.collisionLayers.map((layer) => <th key={layer}>{layer}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {project.settings.collisionLayers.map((leftLayer) => (
                    <tr key={leftLayer}>
                      <th>{leftLayer}</th>
                      {project.settings.collisionLayers.map((rightLayer) => {
                        const enabled = project.settings.collisionMatrix[leftLayer]?.includes(rightLayer) ?? false;
                        return (
                          <td key={rightLayer}>
                            <input
                              type="checkbox"
                              checked={enabled}
                              aria-label={`${leftLayer} collides with ${rightLayer}`}
                              onChange={(event) => setCollisionPair(leftLayer, rightLayer, event.target.checked)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="settings-section">
            <h3>Project Variables</h3>
            <div className="variable-list">
              {Object.entries(project.variables).map(([key, value]) => (
                <div key={key} className="variable-row">
                  <code>{key}</code>
                  {typeof value === "boolean" ? (
                    <Switch checked={value} onChange={(next) => setProjectVariable(key, next)} />
                  ) : typeof value === "number" ? (
                    <CommitNumberField value={value} onCommit={(next) => setProjectVariable(key, next)} />
                  ) : (
                    <CommitTextField value={String(value ?? "")} onCommit={(next) => setProjectVariable(key, next)} />
                  )}
                  <button className="icon-button compact danger" type="button" onClick={() => removeProjectVariable(key)}><X size={13} /></button>
                </div>
              ))}
            </div>
            <div className="add-variable-row">
              <input className="material-input" value={newVariable} placeholder="newVariable" onChange={(event) => setNewVariable(event.target.value)} />
              <button className="material-button tonal" type="button" disabled={!newVariable.trim()} onClick={() => { setProjectVariable(newVariable.trim(), false); setNewVariable(""); }}><Plus size={14} /> Add Boolean</button>
            </div>
          </section>
        </div>
        <footer className="dialog-footer"><button className="material-button filled" type="button" onClick={onClose}>Done</button></footer>
      </section>
    </div>
  );
}

function DebugLog() {
  const activityLog = useEditorStore((state) => state.activityLog);
  const clearActivityLog = useEditorStore((state) => state.clearActivityLog);
  const [levels, setLevels] = useState<Record<"info" | "warning" | "error" | "runtime", boolean>>({ info: true, warning: true, error: true, runtime: true });
  const [collapseRepeats, setCollapseRepeats] = useState(true);
  const visibleEntries = useMemo(() => {
    const filtered = activityLog.filter((entry) => levels[entry.level]);
    if (!collapseRepeats) return filtered.map((entry) => ({ entry, count: 1 }));
    const collapsed: Array<{ entry: (typeof filtered)[number]; count: number }> = [];
    for (const entry of filtered) {
      const previous = collapsed[collapsed.length - 1];
      if (previous && previous.entry.level === entry.level && previous.entry.message === entry.message) previous.count += 1;
      else collapsed.push({ entry, count: 1 });
    }
    return collapsed;
  }, [activityLog, collapseRepeats, levels]);
  return (
    <div className="debug-log phase10-console">
      <header className="console-toolbar">
        <div className="console-filter-group">
          {(["info", "warning", "error", "runtime"] as const).map((level) => (
            <button key={level} type="button" className={levels[level] ? `active ${level}` : level} onClick={() => setLevels((current) => ({ ...current, [level]: !current[level] }))}>{level}</button>
          ))}
        </div>
        <label className="console-collapse-toggle"><input type="checkbox" checked={collapseRepeats} onChange={(event) => setCollapseRepeats(event.target.checked)} /> Collapse repeats</label>
        <button className="material-button text compact" type="button" onClick={clearActivityLog}>Clear</button>
      </header>
      <div className="console-entry-list">
        {visibleEntries.map(({ entry, count }) => (
          <div key={entry.id} className={`debug-row ${entry.level}`}>
            <span>{entry.time}</span><em>{entry.level}</em><p>{entry.message}</p>{count > 1 && <strong className="console-repeat-count">×{count}</strong>}
          </div>
        ))}
        {visibleEntries.length === 0 && <div className="console-empty-state"><Bug size={20} /><span>No messages match the active filters.</span></div>}
      </div>
    </div>
  );
}

type WorkspaceId = "scene" | BottomTab;
type CreatorMode = "world" | "logic" | "interface" | "play";
type WorldView = "scene" | "world" | "assets" | "components";
type LogicView = "gameplay" | "events" | "animations" | "audio";
type PlayView = "preview" | "build" | "diagnostics" | "debug";
type InterfaceView = "designer" | "themes" | "production";

interface WorkspaceRoute {
  mode: CreatorMode;
  view: WorldView | LogicView | InterfaceView | PlayView;
}

function workspaceRouteLabel(route: WorkspaceRoute): string {
  const labels: Record<string, string> = {
    scene: "Scene Editor", world: "Tileset & Tilemap Studio", assets: "Assets", components: "Game Object Recipes",
    gameplay: "Gameplay Framework", events: "Event Sheet", animations: "Animation Studio", audio: "Audio Mixer", designer: "Interface Designer", themes: "Theme Studio", production: "Production Toolkit",
    preview: "Game Preview", build: "Build", diagnostics: "Diagnostics", debug: "Runtime Log",
  };
  return labels[route.view] ?? String(route.view);
}

function ModeContextButton({ active, icon, label, count, onClick }: { active: boolean; icon: React.ReactNode; label: string; count?: number; onClick: () => void }) {
  return <button className={active ? "active" : ""} type="button" onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <small>{count}</small>}</button>;
}

function PlayWorkspace({ view, setView }: { view: PlayView; setView: (view: PlayView) => void }) {
  const project = useEditorStore((state) => state.project);
  const playState = useEditorStore((state) => state.playState);
  const setPlayState = useEditorStore((state) => state.setPlayState);
  const diagnostics = buildDiagnostics(project);
  return (
    <div className="creator-mode-workspace">
      <header className="mode-context-bar">
        <div><Gamepad2 size={16} /><strong>Play & Release</strong><span>Test, diagnose, and package the same shared runtime.</span></div>
        <nav>
          <ModeContextButton active={view === "preview"} icon={<Play size={14} />} label="Preview" onClick={() => setView("preview")} />
          <ModeContextButton active={view === "build"} icon={<MonitorDown size={14} />} label="Build" onClick={() => setView("build")} />
          <ModeContextButton active={view === "diagnostics"} icon={<AlertTriangle size={14} />} label="Diagnostics" count={diagnostics.filter((entry) => entry.severity !== "info").length} onClick={() => setView("diagnostics")} />
          <ModeContextButton active={view === "debug"} icon={<Bug size={14} />} label="Runtime Log" onClick={() => setView("debug")} />
        </nav>
      </header>
      <div className="creator-mode-content">
        {view === "preview" && (
          <section className="play-launch-workspace">
            <div className="play-launch-hero">
              <span><Gamepad2 size={34} /></span>
              <div><h2>In-Viewport Play Mode</h2><p>Run an isolated copy of the current project directly inside the persistent Scene viewport. Stop restores the original editor view, camera, selection, and tools.</p></div>
              <button className="material-button filled large" type="button" onClick={() => setPlayState(playState === "stopped" ? "playing" : playState === "paused" ? "playing" : "stopped")}>{playState === "stopped" ? <><Play size={17} /> Start Play Mode</> : <><Square size={16} /> Stop Play Mode</>}</button>
            </div>
            <div className="play-check-grid">
              <article><strong>Input-aware menus</strong><span>Keyboard, pointer, D-pad, analogue stick, confirm, and back navigation.</span></article>
              <article><strong>Screen stack</strong><span>Main menus, pause screens, settings, dialogs, and HUD layers.</span></article>
              <article><strong>Runtime inspection</strong><span>Camera minimap, FOV, colliders, variables, inventory, and event logs.</span></article>
              <article><strong>Build parity</strong><span>Preview and packaged games use the same project data and runtime systems.</span></article>
            </div>
          </section>
        )}
        {view === "build" && <BuildPanel />}
        {view === "diagnostics" && <DiagnosticsPanel />}
        {view === "debug" && <DebugLog />}
      </div>
    </div>
  );
}

function CreatorModeWorkspace({
  mode,
  worldView,
  logicView,
  playView,
  interfaceView,
  setWorldView,
  setLogicView,
  setInterfaceView,
  setPlayView,
  onImport,
  onImportFolder,
  onSlice,
  onOpenOverlay,
}: {
  mode: CreatorMode;
  worldView: WorldView;
  logicView: LogicView;
  playView: PlayView;
  interfaceView: InterfaceView;
  setWorldView: (view: WorldView) => void;
  setLogicView: (view: LogicView) => void;
  setInterfaceView: (view: InterfaceView) => void;
  setPlayView: (view: PlayView) => void;
  onImport: () => void;
  onImportFolder: () => void;
  onSlice: (assetId: string) => void;
  onOpenOverlay: (kind: CreatorOverlayKind) => void;
}) {
  const project = useEditorStore((state) => state.project);
  if (mode === "world") {
    return (
      <div className="creator-mode-workspace">
        <header className="mode-context-bar">
          <div><Layers3 size={16} /><strong>World</strong><span>Build scenes and place gameplay objects.</span></div>
          <nav>
            <ModeContextButton active={worldView === "scene"} icon={<Layers3 size={14} />} label="Scene" onClick={() => setWorldView("scene")} />
            <ModeContextButton active={worldView === "world"} icon={<Grid3X3 size={14} />} label="Terrain" onClick={() => setWorldView("world")} />
            <ModeContextButton active={worldView === "assets"} icon={<Image size={14} />} label="Assets" count={project.assets.length} onClick={() => setWorldView("assets")} />
            <ModeContextButton active={worldView === "components"} icon={<Blocks size={14} />} label="Game Objects" count={Array.isArray(project.prefabs) ? project.prefabs.length : 0} onClick={() => setWorldView("components")} />
          </nav>
          <button className="context-primary-action" type="button" onClick={() => onOpenOverlay("add-object")}><Plus size={14} /> Add Game Object</button>
        </header>
        <div className="creator-mode-content">
          {worldView === "scene" && <WorkspaceErrorBoundary name="Scene Editor"><SceneViewport /></WorkspaceErrorBoundary>}
          {worldView === "world" && <WorkspaceErrorBoundary name="Tilemap Studio"><WorldBuilderPanel /></WorkspaceErrorBoundary>}
          {worldView === "assets" && <WorkspaceErrorBoundary name="Asset Browser"><AssetBrowser onImport={onImport} onImportFolder={onImportFolder} onSlice={onSlice} /></WorkspaceErrorBoundary>}
          {worldView === "components" && <WorkspaceErrorBoundary name="Game Object Recipes"><PrefabBrowser /></WorkspaceErrorBoundary>}
        </div>
      </div>
    );
  }
  if (mode === "logic") {
    return (
      <div className="creator-mode-workspace">
        <header className="mode-context-bar">
          <div><Zap size={16} /><strong>Logic</strong><span>Events, animation behaviour, and audio response.</span></div>
          <nav>
            <ModeContextButton active={logicView === "gameplay"} icon={<Blocks size={14} />} label="Gameplay" count={Array.isArray(project.behaviourRecipes) ? project.behaviourRecipes.length : 0} onClick={() => setLogicView("gameplay")} />
            <ModeContextButton active={logicView === "events"} icon={<Zap size={14} />} label="Events" count={project.eventRules.length} onClick={() => setLogicView("events")} />
            <ModeContextButton active={logicView === "animations"} icon={<CircleDot size={14} />} label="Animations" count={project.animations.length} onClick={() => setLogicView("animations")} />
            <ModeContextButton active={logicView === "audio"} icon={<AudioLines size={14} />} label="Audio" count={project.assets.filter((asset) => asset.kind === "audio").length} onClick={() => setLogicView("audio")} />
          </nav>
        </header>
        <div className="creator-mode-content">
          {logicView === "gameplay" && <WorkspaceErrorBoundary name="Gameplay Framework"><GameplayWorkbench /></WorkspaceErrorBoundary>}
          {logicView === "events" && <WorkspaceErrorBoundary name="Logic" onReturn={() => window.dispatchEvent(new CustomEvent("shadowium:return-world"))}><EventEditor /></WorkspaceErrorBoundary>}
          {logicView === "animations" && <WorkspaceErrorBoundary name="Animation Studio"><AnimationEditor /></WorkspaceErrorBoundary>}
          {logicView === "audio" && <WorkspaceErrorBoundary name="Audio Mixer"><AudioPanel /></WorkspaceErrorBoundary>}
        </div>
      </div>
    );
  }
  if (mode === "interface") {
    return (
      <div className="creator-mode-workspace">
        <header className="mode-context-bar">
          <div><LayoutPanelTop size={16} /><strong>Interface & Production</strong><span>Responsive UI, themes, game flow, genre kits, world production, and quality rules.</span></div>
          <nav>
            <ModeContextButton active={interfaceView === "designer"} icon={<LayoutPanelTop size={14} />} label="UI Designer" onClick={() => setInterfaceView("designer")} />
            <ModeContextButton active={interfaceView === "themes"} icon={<Brush size={14} />} label="Themes" count={project.editorThemes.length + project.gameUiThemes.length} onClick={() => setInterfaceView("themes")} />
            <ModeContextButton active={interfaceView === "production"} icon={<Sparkles size={14} />} label="Production" count={project.genreKits.length} onClick={() => setInterfaceView("production")} />
          </nav>
          {interfaceView === "designer" && <button className="context-primary-action" type="button" onClick={() => onOpenOverlay("add-component")}><Plus size={14} /> Add UI Component</button>}
        </header>
        <div className="creator-mode-content">
          {interfaceView === "designer" && <WorkspaceErrorBoundary name="Interface Designer"><InterfacePanel /></WorkspaceErrorBoundary>}
          {interfaceView === "themes" && <WorkspaceErrorBoundary name="Theme Studio"><ThemeStudio /></WorkspaceErrorBoundary>}
          {interfaceView === "production" && <WorkspaceErrorBoundary name="Production Toolkit"><ProductionToolkit /></WorkspaceErrorBoundary>}
        </div>
      </div>
    );
  }
  return <PlayWorkspace view={playView} setView={setPlayView} />;
}

function StatusBar() {
  const statusMessage = useEditorStore((state) => state.statusMessage);
  const projectPath = useEditorStore((state) => state.projectPath);
  const viewportZoom = useEditorStore((state) => state.viewportZoom);
  const playState = useEditorStore((state) => state.playState);
  const diagnostics = buildDiagnostics(useEditorStore((state) => state.project));
  return (
    <footer className="status-bar">
      <div className="status-message"><span className={`status-dot ${playState}`} />{statusMessage}</div>
      <div className="status-details">
        <span>{playState === "stopped" ? "Edit mode" : playState === "playing" ? "Preview running" : "Preview paused"}</span>
        <span>{Math.round(viewportZoom * 100)}%</span>
        <span className={diagnostics.some((item) => item.severity === "error") ? "status-problems" : ""}>{diagnostics.filter((item) => item.severity === "error").length} errors · {diagnostics.filter((item) => item.severity === "warning").length} warnings</span>
        <span title={projectPath ?? "Project has not been saved to a folder"}>{projectPath ?? "Unsaved project"}</span>
      </div>
    </footer>
  );
}

export default function App({ packagedPlayer = false }: { packagedPlayer?: boolean }) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [sliceAssetId, setSliceAssetId] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<CreatorMode>("world");
  const [worldView, setWorldView] = useState<WorldView>("scene");
  const [logicView, setLogicView] = useState<LogicView>("gameplay");
  const [playView, setPlayView] = useState<PlayView>("preview");
  const [interfaceView, setInterfaceView] = useState<InterfaceView>("designer");
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceRoute[]>([{ mode: "world", view: "scene" }]);
  const [workspaceHistoryIndex, setWorkspaceHistoryIndex] = useState(0);
  const applyingHistoryRef = useRef(false);
  const [appearance, setAppearance] = useState<"system" | "dark" | "light" | "contrast">(() => {
    try {
      const stored = window.localStorage.getItem("shadowiumui.appearance");
      return stored === "dark" || stored === "light" || stored === "contrast" ? stored : "system";
    } catch { return "system"; }
  });
  const [density, setDensity] = useState<"comfortable" | "compact" | "touch">(() => {
    try {
      const stored = window.localStorage.getItem("shadowiumui.density");
      return stored === "compact" || stored === "touch" ? stored : "comfortable";
    } catch { return "comfortable"; }
  });
  const [creatorOverlay, setCreatorOverlay] = useState<CreatorOverlayKind>(null);
  const [editorViewportGeneration, setEditorViewportGeneration] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [creatorExperience, setCreatorExperience] = useState<"basic" | "advanced">(() => {
    try { return window.localStorage.getItem("shadowiumui.creator-experience") === "advanced" ? "advanced" : "basic"; }
    catch { return "basic"; }
  });

  const project = useEditorStore((state) => state.project);

  useEffect(() => {
    const theme = project.editorThemes?.find((candidate) => candidate.id === project.activeEditorThemeId);
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", theme.accent);
    root.style.setProperty("--secondary", theme.secondaryAccent);
    root.style.setProperty("--app-bg", theme.background);
    root.style.setProperty("--surface-0", theme.background);
    root.style.setProperty("--surface-1", theme.surface);
    root.style.setProperty("--surface-2", theme.raisedSurface);
    root.style.setProperty("--surface-3", theme.raisedSurface);
    root.style.setProperty("--text", theme.text);
    root.style.setProperty("--text-muted", theme.mutedText);
    root.style.setProperty("--phase10-radius", `${theme.radius}px`);
    root.style.setProperty("--phase10-blur", `${theme.blur}px`);
    root.dataset.density = theme.density;
  }, [project.activeEditorThemeId, project.editorThemes]);

  useEffect(() => {
    try { window.localStorage.setItem("shadowiumui.creator-experience", creatorExperience); } catch { /* Preferences remain session-local when storage is unavailable. */ }
    document.documentElement.dataset.creatorExperience = creatorExperience;
    window.dispatchEvent(new CustomEvent("shadowium:inspector-level", { detail: creatorExperience === "advanced" ? "all" : "simple" }));
  }, [creatorExperience]);

  useEffect(() => {
    function hardResetEditorViewport(): void {
      setEditorViewportGeneration((generation) => generation + 1);
    }
    window.addEventListener("shadowium:hard-reset-editor-viewport", hardResetEditorViewport);
    return () => window.removeEventListener("shadowium:hard-reset-editor-viewport", hardResetEditorViewport);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("shadowiumui.appearance", appearance);
      window.localStorage.setItem("shadowiumui.density", density);
    } catch { /* Preferences remain session-local when storage is unavailable. */ }
    document.documentElement.dataset.appearance = appearance;
    document.documentElement.dataset.density = density;
  }, [appearance, density]);
  const projectPath = useEditorStore((state) => state.projectPath);
  const projectRoot = useEditorStore((state) => state.projectRoot);
  const isDirty = useEditorStore((state) => state.isDirty);
  const panelSizes = useEditorStore((state) => state.panelSizes);
  const playState = useEditorStore((state) => state.playState);
  const activeTool = useEditorStore((state) => state.activeTool);
  const showGrid = useEditorStore((state) => state.showGrid);
  const showColliders = useEditorStore((state) => state.showColliders);
  const snapToGrid = useEditorStore((state) => state.snapToGrid);
  const past = useEditorStore((state) => state.past);
  const future = useEditorStore((state) => state.future);

  const replaceProject = useEditorStore((state) => state.replaceProject);
  const markSaved = useEditorStore((state) => state.markSaved);
  const setStatus = useEditorStore((state) => state.setStatus);
  const setPlayState = useEditorStore((state) => state.setPlayState);
  const setActiveTool = useEditorStore((state) => state.setActiveTool);
  const toggleGrid = useEditorStore((state) => state.toggleGrid);
  const toggleColliders = useEditorStore((state) => state.toggleColliders);
  const toggleSnap = useEditorStore((state) => state.toggleSnap);
  const adjustPanelSize = useEditorStore((state) => state.adjustPanelSize);
  const addTilemapObject = useEditorStore((state) => state.addTilemapObject);
  const addScene = useEditorStore((state) => state.addScene);
  const selectAllObjects = useEditorStore((state) => state.selectAllObjects);
  const copySelectedObjects = useEditorStore((state) => state.copySelectedObjects);
  const pasteObjects = useEditorStore((state) => state.pasteObjects);
  const groupSelectedObjects = useEditorStore((state) => state.groupSelectedObjects);
  const duplicateSelectedObject = useEditorStore((state) => state.duplicateSelectedObject);
  const deleteSelectedObject = useEditorStore((state) => state.deleteSelectedObject);
  const saveSelectedAsPrefab = useEditorStore((state) => state.saveSelectedAsPrefab);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const addImportedAssets = useEditorStore((state) => state.addImportedAssets);
  const setActiveBottomTab = useEditorStore((state) => state.setActiveBottomTab);

  const panelStyle = useMemo(
    () =>
      ({
        "--left-panel-width": `${panelSizes.left}px`,
        "--right-panel-width": `${panelSizes.right}px`,
        "--bottom-panel-height": `${panelSizes.bottom}px`,
      }) as React.CSSProperties,
    [panelSizes],
  );

  const sceneWorkspaceActive = activeMode === "world" && worldView === "scene";

  function currentWorkspaceRoute(): WorkspaceRoute {
    if (activeMode === "world") return { mode: "world", view: worldView };
    if (activeMode === "logic") return { mode: "logic", view: logicView };
    if (activeMode === "interface") return { mode: "interface", view: interfaceView };
    return { mode: "play", view: playView };
  }

  function applyWorkspaceRoute(route: WorkspaceRoute): void {
    setActiveMode(route.mode);
    if (route.mode === "world") setWorldView(route.view as WorldView);
    else if (route.mode === "logic") setLogicView(route.view as LogicView);
    else if (route.mode === "interface") setInterfaceView(route.view as InterfaceView);
    else if (route.mode === "play") setPlayView(route.view as PlayView);
  }

  function navigateWorkspace(route: WorkspaceRoute): void {
    const current = currentWorkspaceRoute();
    if (current.mode === route.mode && current.view === route.view) return;
    applyWorkspaceRoute(route);
    if (applyingHistoryRef.current) return;
    setWorkspaceHistory((history) => {
      const next = history.slice(0, workspaceHistoryIndex + 1);
      next.push(route);
      return next.slice(-60);
    });
    setWorkspaceHistoryIndex((index) => Math.min(59, index + 1));
  }

  function moveWorkspaceHistory(delta: number): void {
    const targetIndex = Math.max(0, Math.min(workspaceHistory.length - 1, workspaceHistoryIndex + delta));
    if (targetIndex === workspaceHistoryIndex) return;
    applyingHistoryRef.current = true;
    setWorkspaceHistoryIndex(targetIndex);
    applyWorkspaceRoute(workspaceHistory[targetIndex]);
    window.setTimeout(() => { applyingHistoryRef.current = false; }, 0);
  }

  function openWorkspace(workspace: WorkspaceId): void {
    if (workspace === "scene") { navigateWorkspace({ mode: "world", view: "scene" }); return; }
    setActiveBottomTab(workspace);
    if (workspace === "world" || workspace === "assets" || workspace === "components") navigateWorkspace({ mode: "world", view: workspace });
    else if (workspace === "events" || workspace === "animations" || workspace === "audio") navigateWorkspace({ mode: "logic", view: workspace });
    else if (workspace === "ui") navigateWorkspace({ mode: "interface", view: "designer" });
    else navigateWorkspace({ mode: "play", view: workspace === "build" || workspace === "diagnostics" || workspace === "debug" ? workspace : "preview" });
  }

  async function saveProject(forceSaveAs = false): Promise<boolean> {
    try {
      if (!projectPath && !forceSaveAs) {
        const location = await createProjectFolderOnDisk(project);
        if (!location) {
          setStatus("Project creation cancelled", "warning");
          return false;
        }
        markSaved(location.projectPath, location.rootPath);
        return true;
      }
      const result = await saveProjectToDisk(project, projectPath, projectRoot, forceSaveAs);
      if (!result) {
        setStatus("Save cancelled", "warning");
        return false;
      }
      markSaved(result.path, result.root);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Could not save project: ${message}`, "error");
      window.alert(`Could not save project.\n\n${message}`);
      return false;
    }
  }

  async function openProject(): Promise<void> {
    setOpenMenu(null);
    if (isDirty && !window.confirm("Open another project and discard unsaved changes?")) return;
    try {
      const loaded = await openProjectFromDisk();
      if (!loaded) return;
      replaceProject(loaded.project, loaded.path, loaded.root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Could not open project: ${message}`, "error");
      window.alert(`Could not open project.\n\n${message}`);
    }
  }

  async function createProject(name: string): Promise<void> {
    const nextProject = createEmptyProject(name);
    try {
      const location = await createProjectFolderOnDisk(nextProject);
      if (!location) {
        setStatus("Project folder selection cancelled", "warning");
        return;
      }
      replaceProject(nextProject, location.projectPath, location.rootPath);
      markSaved(location.projectPath, location.rootPath);
      setActiveMode("world");
      setWorldView("scene");
      setShowNewProject(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Could not create project folder: ${message}`, "error");
      window.alert(`Could not create project.\n\n${message}`);
    }
  }

  async function importAssets(): Promise<void> {
    let path = useEditorStore.getState().projectPath;
    if (!path) {
      const saved = await saveProject(false);
      if (!saved) return;
      path = useEditorStore.getState().projectPath;
    }
    if (!path) return;

    try {
      const sources = await chooseAssetFiles();
      if (sources.length === 0) return;
      setStatus(`Importing ${sources.length} asset${sources.length === 1 ? "" : "s"}…`);
      const imported = await importAssetFiles(path, sources);
      const assets = await Promise.all(imported.map((file) => importedFileToAsset(path!, file)));
      addImportedAssets(assets);
      openWorkspace("assets");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Asset import failed: ${message}`, "error");
      window.alert(`Asset import failed.\n\n${message}`);
    }
  }

  async function importAssetFolder(): Promise<void> {
    let path = useEditorStore.getState().projectPath;
    if (!path) {
      const saved = await saveProject(false);
      if (!saved) return;
      path = useEditorStore.getState().projectPath;
    }
    if (!path) return;

    try {
      const sourceDirectory = await chooseAssetFolder();
      if (!sourceDirectory) return;
      setStatus("Importing asset folder…");
      const imported = await importAssetDirectory(path, sourceDirectory);
      if (imported.length === 0) {
        setStatus("The selected folder contained no supported assets", "warning");
        return;
      }
      const assets = await Promise.all(imported.map((file) => importedFileToAsset(path!, file)));
      addImportedAssets(assets);
      openWorkspace("assets");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Folder import failed: ${message}`, "error");
      window.alert(`Folder import failed.\n\n${message}`);
    }
  }

  useEffect(() => {
    const closeMenus = () => setOpenMenu(null);
    window.addEventListener("pointerdown", closeMenus);
    return () => window.removeEventListener("pointerdown", closeMenus);
  }, []);

  useEffect(() => {
    function returnToWorld(): void {
      setActiveMode("world");
      setWorldView("scene");
    }
    window.addEventListener("shadowium:return-world", returnToWorld);
    return () => window.removeEventListener("shadowium:return-world", returnToWorld);
  }, []);
  useEffect(() => {
    function openAnimation(event: Event): void {
      const clipId = String((event as CustomEvent<{ clipId?: string }>).detail?.clipId ?? "");
      if (clipId) useEditorStore.getState().selectAnimation(clipId);
      setActiveMode("logic");
      setLogicView("animations");
    }
    window.addEventListener("shadowium:open-animation", openAnimation);
    return () => window.removeEventListener("shadowium:open-animation", openAnimation);
  }, []);


  useEffect(() => {
    function openContextOverlay(event: Event): void {
      const kind = (event as CustomEvent<CreatorOverlayKind>).detail;
      if (kind) setCreatorOverlay(kind);
    }
    window.addEventListener("shadowium:set-overlay", openContextOverlay);
    return () => window.removeEventListener("shadowium:set-overlay", openContextOverlay);
  }, []);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent): void {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        setCommandQuery("");
        return;
      }
      if (event.key === "Escape" && commandPaletteOpen) {
        event.preventDefault();
        setCommandPaletteOpen(false);
        return;
      }
      if (isTypingTarget(event.target)) return;

      if (modifier && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setShowNewProject(true);
      } else if (modifier && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openProject();
      } else if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveProject(event.shiftKey);
      } else if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        selectAllObjects();
      } else if (modifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedObjects();
      } else if (modifier && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteObjects();
      } else if (modifier && event.key.toLowerCase() === "g") {
        event.preventDefault();
        groupSelectedObjects();
      } else if (modifier && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedObject();
      } else if (!modifier && event.key.toLowerCase() === "q") {
        setActiveTool("select");
      } else if (!modifier && event.key.toLowerCase() === "w") {
        setActiveTool("move");
      } else if (!modifier && event.key.toLowerCase() === "e") {
        setActiveTool("rotate");
      } else if (!modifier && event.key.toLowerCase() === "r") {
        setActiveTool("scale");
      } else if (!modifier && event.key.toLowerCase() === "t") {
        setActiveTool("resize");
      } else if (!modifier && event.key.toLowerCase() === "y") {
        setActiveTool("pivot");
      } else if (event.key === "Delete") {
        event.preventDefault();
        deleteSelectedObject();
      } else if (event.key === "Escape" && playState !== "stopped") {
        event.preventDefault();
        setPlayState("stopped");
      } else if (event.key === "F6") {
        event.preventDefault();
        setPlayState(playState === "stopped" ? "playing" : "stopped");
      }
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [playState, project, projectPath, projectRoot, isDirty, commandPaletteOpen]);

  useEffect(() => {
    document.title = `${project.metadata.name}${isDirty ? " •" : ""} — ShadowiumUI`;
  }, [project.metadata.name, isDirty]);

  if (packagedPlayer) return <GamePreview packagedPlayer />;

  const commandPaletteCommands = [
    { label: "Add Game Object", detail: "Open the typed Game Object Library", run: () => setCreatorOverlay("add-object") },
    { label: "Add Component", detail: "Open Recommended / Compatible Components for the selection", run: () => setCreatorOverlay("add-component") },
    { label: "Open Scene Editor", detail: "World › Scene", run: () => navigateWorkspace({ mode: "world", view: "scene" }) },
    { label: "Open Tileset & Tilemap Studio", detail: "World › Terrain", run: () => navigateWorkspace({ mode: "world", view: "world" }) },
    { label: "Open Assets", detail: "World › Assets", run: () => navigateWorkspace({ mode: "world", view: "assets" }) },
    { label: "Open Gameplay Framework", detail: "Logic › Gameplay", run: () => navigateWorkspace({ mode: "logic", view: "gameplay" }) },
    { label: "Open Event Sheet", detail: "Logic › Events", run: () => navigateWorkspace({ mode: "logic", view: "events" }) },
    { label: "Open Interface Designer", detail: "Interface › Designer", run: () => navigateWorkspace({ mode: "interface", view: "designer" }) },
    { label: "Open Theme Studio", detail: "Interface › Themes", run: () => navigateWorkspace({ mode: "interface", view: "themes" }) },
    { label: "Open Production Toolkit", detail: "Interface › Production", run: () => navigateWorkspace({ mode: "interface", view: "production" }) },
    { label: "Open Build", detail: "Play › Build", run: () => navigateWorkspace({ mode: "play", view: "build" }) },
    { label: "Open Diagnostics", detail: "Play › Diagnostics", run: () => navigateWorkspace({ mode: "play", view: "diagnostics" }) },
    { label: playState === "stopped" ? "Start Play Mode" : "Stop Play Mode", detail: "Toggle the isolated runtime in the Scene viewport", run: () => setPlayState(playState === "stopped" ? "playing" : "stopped") },
    { label: consoleOpen ? "Collapse Console" : "Open Console", detail: "Toggle the utility console", run: () => setConsoleOpen((value) => !value) },
  ].filter((command) => { const query = commandQuery.trim().toLowerCase(); return !query || `${command.label} ${command.detail}`.toLowerCase().includes(query); });

  return (
    <div className="editor-app" style={panelStyle} onPointerDown={() => setOpenMenu(null)}>
      <WindowBar />

      <header className="app-command-bar">
        <nav className="app-menu-strip">
          <Menu label="File" id="file" openMenu={openMenu} setOpenMenu={setOpenMenu}>
            <MenuItem label="New Project" shortcut="Ctrl+N" onClick={() => { setOpenMenu(null); setShowNewProject(true); }} />
            <MenuItem label="Open Project" shortcut="Ctrl+O" onClick={() => void openProject()} />
            <div className="menu-divider" />
            <MenuItem label="Save Project" shortcut="Ctrl+S" onClick={() => void saveProject(false)} />
            <MenuItem label="Save Project As" shortcut="Ctrl+Shift+S" onClick={() => void saveProject(true)} />
            <div className="menu-divider" />
            <MenuItem label="Import Assets" onClick={() => { setOpenMenu(null); void importAssets(); }} />
            <MenuItem label="Import Asset Folder" onClick={() => { setOpenMenu(null); void importAssetFolder(); }} />
          </Menu>
          <Menu label="Edit" id="edit" openMenu={openMenu} setOpenMenu={setOpenMenu}>
            <MenuItem label="Undo" shortcut="Ctrl+Z" disabled={past.length === 0} onClick={undo} />
            <MenuItem label="Redo" shortcut="Ctrl+Y" disabled={future.length === 0} onClick={redo} />
            <div className="menu-divider" />
            <MenuItem label="Select All Objects" shortcut="Ctrl+A" onClick={selectAllObjects} />
            <MenuItem label="Copy Objects" shortcut="Ctrl+C" onClick={copySelectedObjects} />
            <MenuItem label="Paste Objects" shortcut="Ctrl+V" onClick={pasteObjects} />
            <MenuItem label="Duplicate Objects" shortcut="Ctrl+D" onClick={duplicateSelectedObject} />
            <MenuItem label="Group Objects" shortcut="Ctrl+G" onClick={groupSelectedObjects} />
            <MenuItem label="Delete Objects" shortcut="Delete" onClick={deleteSelectedObject} />
          </Menu>
          <Menu label="Project" id="project" openMenu={openMenu} setOpenMenu={setOpenMenu}>
            <MenuItem label="Add Scene" onClick={addScene} />
            <MenuItem label="Add Game Object…" onClick={() => setCreatorOverlay("add-object")} />
            <MenuItem label="Add Tilemap" onClick={addTilemapObject} />
            <MenuItem label="Save Selected As Prefab" onClick={saveSelectedAsPrefab} />
            <div className="menu-divider" />
            <MenuItem label="Project Settings" onClick={() => { setOpenMenu(null); setShowProjectSettings(true); }} />
          </Menu>
          <Menu label="View" id="view" openMenu={openMenu} setOpenMenu={setOpenMenu}>
            <MenuItem label="Show Grid" checked={showGrid} onClick={toggleGrid} />
            <MenuItem label="Show Colliders" checked={showColliders} onClick={toggleColliders} />
            <MenuItem label="Snap To Grid" checked={snapToGrid} onClick={toggleSnap} />
            <div className="menu-divider" />
            <MenuItem label="System Appearance" checked={appearance === "system"} onClick={() => setAppearance("system")} />
            <MenuItem label="Dark Appearance" checked={appearance === "dark"} onClick={() => setAppearance("dark")} />
            <MenuItem label="Light Appearance" checked={appearance === "light"} onClick={() => setAppearance("light")} />
            <MenuItem label="High Contrast" checked={appearance === "contrast"} onClick={() => setAppearance("contrast")} />
            <div className="menu-divider" />
            <MenuItem label="Comfortable Density" checked={density === "comfortable"} onClick={() => setDensity("comfortable")} />
            <MenuItem label="Compact Density" checked={density === "compact"} onClick={() => setDensity("compact")} />
            <MenuItem label="Touch-Friendly Density" checked={density === "touch"} onClick={() => setDensity("touch")} />
          </Menu>
          <Menu label="Debug" id="debug" openMenu={openMenu} setOpenMenu={setOpenMenu}>
            <MenuItem label="Start Play Mode" shortcut="F6" onClick={() => setPlayState("playing")} />
            <MenuItem label="Pause Play Mode" onClick={() => setPlayState("paused")} />
            <MenuItem label="Stop Play Mode" onClick={() => setPlayState("stopped")} />
          </Menu>
        </nav>


        {activeMode === "world" ? <div className="command-toolbar">
          <div className="tool-segment">
            <button className={activeTool === "select" ? "active" : ""} type="button" title="Select (Q)" onClick={() => setActiveTool("select")}><Crosshair size={15} /></button>
            <button className={activeTool === "move" ? "active" : ""} type="button" title="Move (W)" onClick={() => setActiveTool("move")}><Move size={15} /></button>
            <button className={activeTool === "rotate" ? "active" : ""} type="button" title="Rotate (E)" onClick={() => setActiveTool("rotate")}><RotateCw size={15} /></button>
            <button className={activeTool === "scale" ? "active" : ""} type="button" title="Scale (R)" onClick={() => setActiveTool("scale")}><Scaling size={15} /></button>
            <button className={activeTool === "resize" ? "active" : ""} type="button" title="Resize (T)" onClick={() => setActiveTool("resize")}><Expand size={15} /></button>
            <button className={activeTool === "pivot" ? "active" : ""} type="button" title="Pivot (Y)" onClick={() => setActiveTool("pivot")}><CircleDot size={15} /></button>
            <button className={activeTool === "pan" ? "active" : ""} type="button" title="Pan viewport" onClick={() => setActiveTool("pan")}><Hand size={15} /></button>
            <button className={activeTool === "collider" ? "active" : ""} type="button" title="Edit collider" onClick={() => setActiveTool("collider")}><Square size={14} /></button>
            <button className={activeTool === "tile-paint" ? "active" : ""} type="button" title="Paint tiles" onClick={() => { setActiveTool("tile-paint"); openWorkspace("world"); }}><Brush size={14} /></button>
            <button className={activeTool === "tile-erase" ? "active" : ""} type="button" title="Erase tiles" onClick={() => { setActiveTool("tile-erase"); openWorkspace("world"); }}><Eraser size={14} /></button>
            <button className={activeTool === "tile-fill" ? "active" : ""} type="button" title="Fill tilemap" onClick={() => { setActiveTool("tile-fill"); openWorkspace("world"); }}><PaintBucket size={14} /></button>
            <button className={activeTool === "tile-picker" ? "active" : ""} type="button" title="Pick tile" onClick={() => { setActiveTool("tile-picker"); openWorkspace("world"); }}><Pipette size={14} /></button>
          </div>
          <button className="toolbar-action emphasized" type="button" onClick={() => setCreatorOverlay("add-object")}><Plus size={15} /> Game Object</button>
          <button className="toolbar-action" type="button" onClick={addTilemapObject}><Grid3X3 size={15} /> Tilemap</button>
          <button className={`toolbar-action icon-only ${showGrid ? "active" : ""}`} type="button" title="Toggle grid" onClick={toggleGrid}><Grid3X3 size={15} /></button>
          <button className={`toolbar-action ${snapToGrid ? "active" : ""}`} type="button" title="Snap to 32 pixel grid" onClick={toggleSnap}>Snap 32</button>
          <button className={`toolbar-action creator-experience-button ${creatorExperience === "advanced" ? "active" : ""}`} type="button" title="Switch between beginner-friendly and advanced authoring" onClick={() => setCreatorExperience((value) => value === "basic" ? "advanced" : "basic")}><SlidersHorizontal size={14} /> {creatorExperience === "basic" ? "Basic" : "Advanced"}</button>
        </div> : <div className="command-toolbar mode-summary-toolbar">
          <SlidersHorizontal size={15} />
          <span>{activeMode === "logic" ? "Compose Components, combat, AI, abilities, progression, scripts, and events" : activeMode === "interface" ? "Design menus and HUD screens" : "Test and release the game"}</span>
          <button className={`toolbar-action creator-experience-button ${creatorExperience === "advanced" ? "active" : ""}`} type="button" onClick={() => setCreatorExperience((value) => value === "basic" ? "advanced" : "basic")}><SlidersHorizontal size={14} /> {creatorExperience === "basic" ? "Basic" : "Advanced"}</button>
        </div>}

        <div className="preview-controls">
          <button className="play-button" type="button" disabled={playState === "playing"} onClick={() => setPlayState("playing")}><Play size={14} /> {playState === "paused" ? "Resume" : "Play"}</button>
          <button type="button" disabled={playState !== "playing"} onClick={() => setPlayState("paused")}><Pause size={14} /></button>
          <button type="button" disabled={playState === "stopped"} onClick={() => setPlayState("stopped")}><Square size={13} /></button>
        </div>
      </header>

      <main className="workspace-row phase6-workspace-row phase7-workbench">
        <aside className="creator-mode-rail" aria-label="Creator workbench">
          <button className={activeMode === "world" ? "active" : ""} type="button" title="World" onClick={() => navigateWorkspace({ mode: "world", view: worldView })}><Layers3 size={19} /><span>World</span></button>
          <button className={activeMode === "logic" ? "active" : ""} type="button" title="Logic" onClick={() => navigateWorkspace({ mode: "logic", view: logicView })}><Zap size={19} /><span>Logic</span></button>
          <button className={activeMode === "interface" ? "active" : ""} type="button" title="Interface" onClick={() => navigateWorkspace({ mode: "interface", view: "designer" })}><LayoutPanelTop size={19} /><span>UI</span></button>
          <button className={activeMode === "play" ? "active" : ""} type="button" title="Play and build" onClick={() => navigateWorkspace({ mode: "play", view: playView })}><Gamepad2 size={19} /><span>Play</span></button>
        </aside>
        <div className="left-dock-host" style={{ width: panelSizes.left }}>
          <ProjectPanel onOpenScene={() => openWorkspace("scene")} onOpenOverlay={setCreatorOverlay} />
        </div>
        <ResizeHandle direction="vertical" onDelta={(delta) => adjustPanelSize("left", delta)} />
        <section className="scene-dock phase6-creator-host shadowium-workbench-host">
          <div className="workbench-navigation">
            <div className="workbench-history-controls">
              <button type="button" title="Back" disabled={workspaceHistoryIndex <= 0} onClick={() => moveWorkspaceHistory(-1)}><ChevronLeft size={16} /></button>
              <button type="button" title="Forward" disabled={workspaceHistoryIndex >= workspaceHistory.length - 1} onClick={() => moveWorkspaceHistory(1)}><ChevronRight size={16} /></button>
            </div>
            <div className="workbench-breadcrumb"><span>{project.metadata.name}</span><ChevronRight size={13} /><strong>{activeMode === "interface" ? "Interface" : activeMode[0].toUpperCase() + activeMode.slice(1)}</strong><ChevronRight size={13} /><em>{workspaceRouteLabel(currentWorkspaceRoute())}</em></div>
          </div>

          <div className={`persistent-scene-workspace ${sceneWorkspaceActive ? "active" : "parked"}`} aria-hidden={!sceneWorkspaceActive}>
            <header className="mode-context-bar shadowium-scene-context">
              <div><Layers3 size={16} /><strong>Scene</strong><span>{playState === "stopped" ? "Edit the world" : playState === "paused" ? "Play Mode paused" : "Play Mode running"}</span></div>
              <nav>
                <ModeContextButton active icon={<Layers3 size={14} />} label="Scene" onClick={() => navigateWorkspace({ mode: "world", view: "scene" })} />
                <ModeContextButton active={false} icon={<Grid3X3 size={14} />} label="Terrain" onClick={() => navigateWorkspace({ mode: "world", view: "world" })} />
                <ModeContextButton active={false} icon={<Image size={14} />} label="Assets" count={project.assets.length} onClick={() => navigateWorkspace({ mode: "world", view: "assets" })} />
                <ModeContextButton active={false} icon={<Blocks size={14} />} label="Game Objects" count={Array.isArray(project.prefabs) ? project.prefabs.length : 0} onClick={() => navigateWorkspace({ mode: "world", view: "components" })} />
              </nav>
              <button className="context-primary-action" type="button" onClick={() => setCreatorOverlay("add-object")}><Plus size={14} /> Add Game Object</button>
            </header>
            <div className={`persistent-scene-canvas ${playState !== "stopped" ? "play-mode" : "edit-mode"}`}>
              <WorkspaceErrorBoundary name="Scene Editor"><SceneViewport key={`editor-viewport-${editorViewportGeneration}`} /></WorkspaceErrorBoundary>
              <GamePreview inline />
              {playState !== "stopped" && <div className="play-mode-ribbon"><span /> Play Mode · runtime changes are isolated</div>}
            </div>
          </div>

          <div className={`focus-workspace-layer ${sceneWorkspaceActive ? "parked" : "active"}`}>
            {!sceneWorkspaceActive && <CreatorModeWorkspace
              mode={activeMode}
              worldView={worldView}
              logicView={logicView}
              playView={playView}
              interfaceView={interfaceView}
              setWorldView={(view) => navigateWorkspace({ mode: "world", view })}
              setLogicView={(view) => navigateWorkspace({ mode: "logic", view })}
              setInterfaceView={(view) => navigateWorkspace({ mode: "interface", view })}
              setPlayView={(view) => navigateWorkspace({ mode: "play", view })}
              onImport={() => void importAssets()}
              onImportFolder={() => void importAssetFolder()}
              onSlice={setSliceAssetId}
              onOpenOverlay={setCreatorOverlay}
            />}
          </div>
        </section>
        <ResizeHandle direction="vertical" onDelta={(delta) => adjustPanelSize("right", -delta)} />
        <div className="right-dock-host" style={{ width: panelSizes.right }}><InspectorPanel /></div>
      </main>

      <section className={`utility-console-dock ${consoleOpen ? "open" : ""}`}>
        <button type="button" className="utility-console-toggle" onClick={() => setConsoleOpen((value) => !value)}><Bug size={13} /> Console <small>{useEditorStore.getState().activityLog.length}</small></button>
        {consoleOpen && <DebugLog />}
      </section>
      <StatusBar />

      {commandPaletteOpen && (
        <div className="command-palette-backdrop" role="presentation" onPointerDown={() => setCommandPaletteOpen(false)}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-label="Command Palette" onPointerDown={(event) => event.stopPropagation()}>
            <header><Command size={18} /><strong>Command Palette</strong><kbd>Ctrl Shift P</kbd></header>
            <label className="command-palette-search"><Search size={16} /><input autoFocus value={commandQuery} placeholder="Search commands, workspaces, and tools…" onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setCommandPaletteOpen(false); }} /></label>
            <div className="command-palette-list">
              {commandPaletteCommands.map((command) => <button key={command.label} type="button" onClick={() => { command.run(); setCommandPaletteOpen(false); }}><span><strong>{command.label}</strong><small>{command.detail}</small></span><ChevronRight size={15} /></button>)}
              {commandPaletteCommands.length === 0 && <div className="command-palette-empty">No matching commands.</div>}
            </div>
          </section>
        </div>
      )}

      <CreatorOverlays
        kind={creatorOverlay}
        onClose={() => setCreatorOverlay(null)}
        onOpenMode={(mode, view) => navigateWorkspace(mode === "logic" ? { mode, view: view ?? "gameplay" } : mode === "interface" ? { mode, view: "designer" } : mode === "play" ? { mode, view: "preview" } : { mode, view: "scene" })}
        onOpenComponentLibrary={() => { navigateWorkspace({ mode: "world", view: "components" }); setCreatorOverlay(null); }}
      />
      {showNewProject && <NewProjectDialog onClose={() => setShowNewProject(false)} onCreate={createProject} />}
      {showProjectSettings && <ProjectSettingsDialog onClose={() => setShowProjectSettings(false)} />}
      {sliceAssetId && <SpriteSheetEditor assetId={sliceAssetId} onClose={() => setSliceAssetId(null)} />}
    </div>
  );
}
