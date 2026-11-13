import { useEffect, useState } from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Save,
  RotateCcw,
  Unlink,
  Upload,
  Trash2,
  Unlock,
} from "lucide-react";
import { getComponentDefinition } from "../editor/catalog";
import { getActiveScene } from "../editor/project";
import { GAME_OBJECT_TYPE_PROFILES, profileForObject, slotForCategory } from "../editor/phase10Architecture";
import { useEditorStore } from "../editor/store";
import type {
  ComponentInstance,
  ComponentSettingDefinition,
  ComponentSettingValue,
  ComponentSlot,
  GameObjectType,
} from "../editor/types";
import { CommitNumberField, CommitTextField, Switch } from "./EditorControls";

function SettingControl({
  element,
  definition,
}: {
  element: ComponentInstance;
  definition: ComponentSettingDefinition;
}) {
  const project = useEditorStore((state) => state.project);
  const updateComponentSetting = useEditorStore((state) => state.updateComponentSetting);
  const value = element.settings[definition.key] ?? definition.defaultValue;
  const update = (next: ComponentSettingValue) =>
    updateComponentSetting(element.id, definition.key, next);

  if (definition.control === "boolean") {
    return (
      <div className="property-row">
        <div className="property-label">
          <span>{definition.label}</span>
          {definition.description && <small>{definition.description}</small>}
        </div>
        <Switch checked={Boolean(value)} onChange={update} />
      </div>
    );
  }

  if (definition.control === "select") {
    return (
      <label className="property-row">
        <div className="property-label">
          <span>{definition.label}</span>
          {definition.description && <small>{definition.description}</small>}
        </div>
        <select
          className="material-select"
          value={String(value)}
          onChange={(event) => {
            const option = definition.options?.find(
              (candidate) => String(candidate.value) === event.target.value,
            );
            update(option?.value ?? event.target.value);
          }}
        >
          {definition.options?.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (definition.control === "asset") {
    return (
      <label className="property-row">
        <div className="property-label">
          <span>{definition.label}</span>
          {definition.description && <small>{definition.description}</small>}
        </div>
        <select className="material-select" value={String(value)} onChange={(event) => update(event.target.value)}>
          <option value="">No asset</option>
          {project.assets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.name}</option>
          ))}
        </select>
      </label>
    );
  }

  if (definition.control === "animation") {
    return (
      <label className="property-row">
        <div className="property-label"><span>{definition.label}</span></div>
        <select className="material-select" value={String(value)} onChange={(event) => update(event.target.value)}>
          <option value="">No clip</option>
          {project.animations.map((clip) => (
            <option key={clip.id} value={clip.id}>{clip.name}</option>
          ))}
        </select>
      </label>
    );
  }

  if (definition.control === "animation-set") {
    return (
      <label className="property-row">
        <div className="property-label"><span>{definition.label}</span></div>
        <select className="material-select" value={String(value)} onChange={(event) => update(event.target.value)}>
          <option value="">No Animation Set</option>
          {project.animationSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
        </select>
      </label>
    );
  }

  if (definition.control === "object") {
    const scene = getActiveScene(project);
    return (
      <label className="property-row">
        <div className="property-label">
          <span>{definition.label}</span>
          {definition.description && <small>{definition.description}</small>}
        </div>
        <select className="material-select" value={String(value)} onChange={(event) => update(event.target.value)}>
          <option value="">No Game Object</option>
          {scene.objects.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
          ))}
        </select>
      </label>
    );
  }

  if (definition.control === "input-action") {
    return (
      <label className="property-row">
        <div className="property-label"><span>{definition.label}</span></div>
        <select className="material-select" value={String(value)} onChange={(event) => update(event.target.value)}>
          {project.settings.inputActions.map((action) => (
            <option key={action.id} value={action.id}>{action.name}</option>
          ))}
        </select>
      </label>
    );
  }

  if (definition.control === "collision-layer") {
    return (
      <label className="property-row">
        <div className="property-label"><span>{definition.label}</span></div>
        <select className="material-select" value={String(value)} onChange={(event) => update(event.target.value)}>
          {project.settings.collisionLayers.map((layer) => (
            <option key={layer} value={layer}>{layer}</option>
          ))}
        </select>
      </label>
    );
  }

  if (definition.control === "color") {
    return (
      <label className="property-row">
        <div className="property-label"><span>{definition.label}</span></div>
        <div className="color-input-wrap">
          <input type="color" value={String(value)} onChange={(event) => update(event.target.value)} />
          <span>{String(value).toUpperCase()}</span>
        </div>
      </label>
    );
  }

  if (definition.control === "number") {
    return (
      <div className="property-row">
        <div className="property-label">
          <span>{definition.label}</span>
          {definition.description && <small>{definition.description}</small>}
        </div>
        <div className="suffix-field">
          <CommitNumberField
            value={Number(value)}
            minimum={definition.minimum}
            maximum={definition.maximum}
            step={definition.step}
            onCommit={update}
          />
          {definition.suffix && <small>{definition.suffix}</small>}
        </div>
      </div>
    );
  }

  return (
    <div className="property-row">
      <div className="property-label">
        <span>{definition.label}</span>
        {definition.description && <small>{definition.description}</small>}
      </div>
      <CommitTextField value={String(value)} onCommit={update} />
    </div>
  );
}

function ComponentCard({ element, detailLevel }: { element: ComponentInstance; detailLevel: "simple" | "detailed" | "all" }) {
  const [expanded, setExpanded] = useState(true);
  const project = useEditorStore((state) => state.project);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const toggleComponent = useEditorStore((state) => state.toggleComponent);
  const removeComponent = useEditorStore((state) => state.removeComponent);
  let definition;
  try {
    definition = getComponentDefinition(element.type);
  } catch {
    return (
      <section className={`element-card unknown-component-card ${element.enabled ? "" : "element-card-disabled"}`}>
        <header className="element-card-header">
          <span className="element-accent" />
          <span className="element-name">Unsupported Component</span>
          <button className="icon-button compact" type="button" onClick={() => toggleComponent(element.id)}>{element.enabled ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          <button className="icon-button compact danger" type="button" onClick={() => removeComponent(element.id)}><Trash2 size={14} /></button>
        </header>
        <div className="element-card-body">
          <p>ShadowiumUI does not recognize <code>{element.type}</code>. This can happen after opening a project that used a removed or third-party Component.</p>
          <small>Remove this Component or install the package that originally provided it. Its serialized settings have been preserved.</small>
        </div>
      </section>
    );
  }
  const settings = detailLevel === "simple" ? definition.settings.slice(0, 4) : detailLevel === "detailed" ? definition.settings.slice(0, 10) : definition.settings;

  return (
    <section
      className={`element-card ${element.enabled ? "" : "element-card-disabled"}`}
      style={{ "--element-accent": definition.color } as React.CSSProperties}
    >
      <header className="element-card-header">
        <button className="element-expand" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className="element-accent" />
        <span className="element-name">{definition.name}</span>
        <span className={`component-status status-${definition.implementationStatus ?? "ready"}`}>{(definition.implementationStatus ?? "ready").replace(/-/g, " ")}</span>
        <button className="icon-button compact" type="button" onClick={() => toggleComponent(element.id)}>
          {element.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button className="icon-button compact danger" type="button" onClick={() => removeComponent(element.id)}>
          <Trash2 size={14} />
        </button>
      </header>
      {expanded && (
        <div className="element-card-body">
          <p>{definition.description}</p>
          {settings.map((setting) => (
            <SettingControl key={setting.key} element={element} definition={setting} />
          ))}
          {settings.length < definition.settings.length && <button className="element-show-more" type="button" onClick={() => window.dispatchEvent(new CustomEvent("shadowium:inspector-all"))}>Show {definition.settings.length - settings.length} more settings</button>}
          {element.type === "animated-sprite" && (() => {
            const set = project.animationSets.find((candidate) => candidate.id === String(element.settings.animationSetId ?? ""));
            const clipId = String(element.settings.defaultClipId ?? "") || (set ? Object.values(set.states?.[String(element.settings.defaultState ?? set.defaultState ?? "idle")] ?? set.directions)[0] ?? "" : "");
            return <div className="phase11-inspector-animation-actions">
              <button type="button" disabled={!selectedObjectId || !clipId} onClick={() => selectedObjectId && clipId && window.dispatchEvent(new CustomEvent("shadowium:preview-object-animation", { detail: { objectId: selectedObjectId, clipId } }))}>▶ Preview in Scene</button>
              <button type="button" disabled={!selectedObjectId} onClick={() => selectedObjectId && window.dispatchEvent(new CustomEvent("shadowium:preview-object-animation", { detail: { objectId: selectedObjectId, stop: true } }))}>■ Stop</button>
              <button type="button" disabled={!clipId} onClick={() => clipId && window.dispatchEvent(new CustomEvent("shadowium:open-animation", { detail: { clipId } }))}>Open Clip</button>
            </div>;
          })()}
        </div>
      )}
    </section>
  );
}

export function InspectorPanel() {
  const [detailLevel, setDetailLevel] = useState<"simple" | "detailed" | "all">("detailed");
  const project = useEditorStore((state) => state.project);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const selectedObjectIds = useEditorStore((state) => state.selectedObjectIds);
  const renameSelectedObject = useEditorStore((state) => state.renameSelectedObject);
  const setSelectedObjectType = useEditorStore((state) => state.setSelectedObjectType);
  const setSelectedCustomObjectType = useEditorStore((state) => state.setSelectedCustomObjectType);
  const applyCameraPreset = useEditorStore((state) => state.applyCameraPreset);
  const toggleSelectedObject = useEditorStore((state) => state.toggleSelectedObject);
  const toggleSelectedEditorVisible = useEditorStore((state) => state.toggleSelectedEditorVisible);
  const toggleSelectedRuntimeVisible = useEditorStore((state) => state.toggleSelectedRuntimeVisible);
  const toggleSelectedCollision = useEditorStore((state) => state.toggleSelectedCollision);
  const toggleSelectedLogic = useEditorStore((state) => state.toggleSelectedLogic);
  const toggleSelectedLocked = useEditorStore((state) => state.toggleSelectedLocked);
  const duplicateSelectedObject = useEditorStore((state) => state.duplicateSelectedObject);
  const deleteSelectedObject = useEditorStore((state) => state.deleteSelectedObject);
  const updateSelectedPosition = useEditorStore((state) => state.updateSelectedPosition);
  const updateSelectedTransform = useEditorStore((state) => state.updateSelectedTransform);
  const updateSelectedSize = useEditorStore((state) => state.updateSelectedSize);
  const updateSelectedColor = useEditorStore((state) => state.updateSelectedColor);
  const updateSelectedTags = useEditorStore((state) => state.updateSelectedTags);
  const moveSelectedToLayer = useEditorStore((state) => state.moveSelectedToLayer);
  const reparentSelectedObject = useEditorStore((state) => state.reparentSelectedObject);
  const saveSelectedAsPrefab = useEditorStore((state) => state.saveSelectedAsPrefab);
  const applySelectedToPrefab = useEditorStore((state) => state.applySelectedToPrefab);
  const revertSelectedPrefab = useEditorStore((state) => state.revertSelectedPrefab);
  const unlinkSelectedPrefab = useEditorStore((state) => state.unlinkSelectedPrefab);
  const updateSceneSettings = useEditorStore((state) => state.updateSceneSettings);
  const scene = getActiveScene(project);
  const object = scene.objects.find((candidate) => candidate.id === selectedObjectId);
  const objectProfile = object ? profileForObject(object, project) : null;

  useEffect(() => {
    const openAll = () => setDetailLevel("all");
    const setFromExperience = (event: Event) => {
      const level = (event as CustomEvent<"simple" | "detailed" | "all">).detail;
      if (level === "simple" || level === "detailed" || level === "all") setDetailLevel(level);
    };
    window.addEventListener("shadowium:inspector-all", openAll);
    window.addEventListener("shadowium:inspector-level", setFromExperience);
    return () => {
      window.removeEventListener("shadowium:inspector-all", openAll);
      window.removeEventListener("shadowium:inspector-level", setFromExperience);
    };
  }, []);

  if (!object) {
    return (
      <aside className="dock-panel inspector-dock">
        <header className="dock-header"><div className="dock-title"><Box size={15} /><span>Scene Inspector</span></div></header>
        <div className="inspector-scroll">
          <section className="object-summary-card scene-summary-card">
            <div className="object-preview" style={{ background: scene.backgroundColor }}><Box size={22} /></div>
            <div className="object-summary-main"><strong>{scene.name}</strong><small>Scene properties are used by Game Preview and exported builds.</small></div>
          </section>
          <section className="inspector-group">
            <header><span>Room</span></header>
            <div className="vector-grid">
              <span>Size</span>
              <label><em>W</em><CommitNumberField value={scene.width} minimum={1} onCommit={(width) => updateSceneSettings(scene.id, { width })} /></label>
              <label><em>H</em><CommitNumberField value={scene.height} minimum={1} onCommit={(height) => updateSceneSettings(scene.id, { height })} /></label>
              <span>Gravity</span>
              <label><em>X</em><CommitNumberField value={scene.gravityX} onCommit={(gravityX) => updateSceneSettings(scene.id, { gravityX })} /></label>
              <label><em>Y</em><CommitNumberField value={scene.gravityY} onCommit={(gravityY) => updateSceneSettings(scene.id, { gravityY })} /></label>
              <span>Background</span>
              <label className="vector-wide color-input-wrap"><input type="color" value={scene.backgroundColor} onChange={(event) => updateSceneSettings(scene.id, { backgroundColor: event.target.value })} /><small>{scene.backgroundColor.toUpperCase()}</small></label>
              <span>Spawn ID</span>
              <div className="vector-wide"><CommitTextField value={scene.defaultSpawnId} onCommit={(defaultSpawnId) => updateSceneSettings(scene.id, { defaultSpawnId })} /></div>
              <span>Tags</span>
              <div className="vector-wide"><CommitTextField value={scene.tags.join(", ")} placeholder="Level, Indoor" onCommit={(value) => updateSceneSettings(scene.id, { tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })} /></div>
            </div>
          </section>
          <div className="empty-panel-message compact-empty"><Box size={28} /><strong>No object selected</strong><span>Select an object to edit its transform and Components.</span></div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="dock-panel inspector-dock">
      <header className="dock-header phase6-inspector-header">
        <div className="dock-title"><Box size={15} /><span>Inspector</span></div>
        <div className="inspector-detail-level" title="Choose how many Component settings are visible">
          {(["simple", "detailed", "all"] as const).map((level) => <button key={level} className={detailLevel === level ? "active" : ""} type="button" onClick={() => setDetailLevel(level)}>{level === "detailed" ? "Detail" : level[0].toUpperCase() + level.slice(1)}</button>)}
        </div>
        <button className="icon-button" type="button" title="Save as Prefab" onClick={saveSelectedAsPrefab}><Save size={15} /></button>
      </header>

      <div className="inspector-scroll">
        <section className="object-summary-card">
          <div className="object-preview" style={{ background: object.editorColor }}><Box size={22} /></div>
          <div className="object-summary-main">
            <CommitTextField value={object.name} onCommit={renameSelectedObject} />
            {selectedObjectIds.length > 1 && <small className="multi-selection-note">Editing primary object · {selectedObjectIds.length} selected</small>}
            <div className="object-summary-toggles">
              <button className={`chip ${object.enabled ? "chip-active" : ""}`} type="button" onClick={toggleSelectedObject}>
                {object.enabled ? <Eye size={13} /> : <EyeOff size={13} />} Enabled
              </button>
              <button className={`chip ${object.locked ? "chip-active" : ""}`} type="button" onClick={toggleSelectedLocked}>
                {object.locked ? <Lock size={13} /> : <Unlock size={13} />} Locked
              </button>
            </div>
          </div>
          <div className="object-summary-actions">
            <button className="icon-button" type="button" title="Duplicate" onClick={duplicateSelectedObject}><Copy size={15} /></button>
            <button className="icon-button danger" type="button" title="Delete" onClick={deleteSelectedObject}><Trash2 size={15} /></button>
          </div>
        </section>

        {object.prefabId && (
          <section className="linked-element-card">
            <div><Unlink size={16} /><span><strong>Linked Prefab Instance</strong><small>{project.prefabs.find((template) => template.id === object.prefabId)?.name ?? "Missing Prefab"} · {(object.prefabOverrides ?? []).length} overrides</small></span></div>
            <div>
              <button className="material-button text" type="button" onClick={revertSelectedPrefab}><RotateCcw size={13} /> Revert</button>
              <button className="material-button tonal" type="button" onClick={applySelectedToPrefab}><Upload size={13} /> Apply</button>
              <button className="material-button text danger" type="button" onClick={unlinkSelectedPrefab}><Unlink size={13} /> Unlink</button>
            </div>
          </section>
        )}

        <section className="inspector-group object-state-group">
          <header><span>Object State</span><small>Rendering, collision, and logic are independent.</small></header>
          <div className="object-state-list">
            <div><span><strong>Object Active</strong><small>Master runtime activation</small></span><Switch checked={object.enabled} onChange={toggleSelectedObject} /></div>
            <div><span><strong>Editor Visible</strong><small>Hierarchy and scene viewport only</small></span><Switch checked={object.editorVisible !== false} onChange={toggleSelectedEditorVisible} /></div>
            <div><span><strong>Runtime Visible</strong><small>Hide artwork while keeping collision intact</small></span><Switch checked={object.runtimeVisible !== false} onChange={toggleSelectedRuntimeVisible} /></div>
            <div><span><strong>Collision Enabled</strong><small>Solids, triggers, and hit areas</small></span><Switch checked={object.collisionEnabled !== false} onChange={toggleSelectedCollision} /></div>
            <div><span><strong>Logic Enabled</strong><small>Events and pre-coded behaviours</small></span><Switch checked={object.logicEnabled !== false} onChange={toggleSelectedLogic} /></div>
          </div>
        </section>

        <section className="inspector-group">
          <header><span>Transform</span></header>
          <div className="vector-grid">
            <span>Position</span>
            <label><em>X</em><CommitNumberField value={object.transform.position.x} onCommit={(x) => updateSelectedPosition(x, undefined)} /></label>
            <label><em>Y</em><CommitNumberField value={object.transform.position.y} onCommit={(y) => updateSelectedPosition(undefined, y)} /></label>
            <span>Rotation</span>
            <label className="vector-wide"><em>°</em><CommitNumberField value={object.transform.rotation} onCommit={(rotation) => updateSelectedTransform({ rotation })} /></label>
            <span>Scale</span>
            <label><em>X</em><CommitNumberField value={object.transform.scale.x} step={0.05} onCommit={(x) => updateSelectedTransform({ scale: { ...object.transform.scale, x } })} /></label>
            <label><em>Y</em><CommitNumberField value={object.transform.scale.y} step={0.05} onCommit={(y) => updateSelectedTransform({ scale: { ...object.transform.scale, y } })} /></label>
            <span>Pivot</span>
            <label><em>X</em><CommitNumberField value={object.transform.pivot?.x ?? 0.5} step={0.05} onCommit={(x) => updateSelectedTransform({ pivot: { ...(object.transform.pivot ?? { x: 0.5, y: 0.5 }), x } })} /></label>
            <label><em>Y</em><CommitNumberField value={object.transform.pivot?.y ?? 0.5} step={0.05} onCommit={(y) => updateSelectedTransform({ pivot: { ...(object.transform.pivot ?? { x: 0.5, y: 0.5 }), y } })} /></label>
          </div>
        </section>

        <section className="inspector-group">
          <header><span>Editor Object</span></header>
          <div className="vector-grid">
            <span>Type</span>
            <label className="vector-wide">
              <select className="material-select" value={object.objectType === "custom" && object.customTypeId ? `custom:${object.customTypeId}` : object.objectType} onChange={(event) => {
                const value = event.target.value;
                if (value.startsWith("custom:")) setSelectedCustomObjectType(value.slice(7));
                else { setSelectedCustomObjectType(null); setSelectedObjectType(value as GameObjectType); }
              }}>
                {Object.values(GAME_OBJECT_TYPE_PROFILES).map((profile) => <option key={profile.type} value={profile.type}>{profile.label}</option>)}
                {project.customGameObjectTypes.length > 0 && <optgroup label="Project Types">{project.customGameObjectTypes.map((definition) => <option key={definition.id} value={`custom:${definition.id}`}>{definition.name}</option>)}</optgroup>}
              </select>
            </label>
            <span>Size</span>
            <label><em>W</em><CommitNumberField value={object.size.width} minimum={1} onCommit={(width) => updateSelectedSize(width, undefined)} /></label>
            <label><em>H</em><CommitNumberField value={object.size.height} minimum={1} onCommit={(height) => updateSelectedSize(undefined, height)} /></label>
            <span>Colour</span>
            <label className="vector-wide color-input-wrap">
              <input type="color" value={object.editorColor} onChange={(event) => updateSelectedColor(event.target.value)} />
              <small>{object.editorColor.toUpperCase()}</small>
            </label>
            <span>Layer</span>
            <label className="vector-wide">
              <select className="material-select" value={object.layerId} onChange={(event) => moveSelectedToLayer(event.target.value)}>
                {getActiveScene(project).layers.map((layer) => <option key={layer.id} value={layer.id}>{layer.name} · order {layer.renderOrder}</option>)}
              </select>
            </label>
            <span>Parent</span>
            <label className="vector-wide">
              <select className="material-select" value={object.parentId ?? ""} onChange={(event) => reparentSelectedObject(event.target.value || null)}>
                <option value="">Scene root</option>
                {getActiveScene(project).objects.filter((candidate) => candidate.id !== object.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
              </select>
            </label>
            <span>Tags</span>
            <div className="vector-wide">
              <CommitTextField value={object.tags.join(", ")} placeholder="Player, Enemy" onCommit={(value) => updateSelectedTags(value.split(",").map((tag) => tag.trim()).filter(Boolean))} />
            </div>
          </div>
        </section>

        {object.objectType === "camera" && (
          <section className="inspector-group phase10-camera-setup">
            <header><span>Camera Quick Setup</span><small>Choose a starting behaviour, then tune its Camera Components below.</small></header>
            <div className="phase10-camera-presets">
              <button type="button" onClick={() => applyCameraPreset("centered")}><strong>Centered</strong><small>Locks the target to screen centre.</small></button>
              <button type="button" onClick={() => applyCameraPreset("smooth")}><strong>Smooth</strong><small>Frame-rate-independent soft tracking.</small></button>
              <button type="button" onClick={() => applyCameraPreset("platformer")}><strong>Platformer</strong><small>Horizontal focus with a forgiving vertical dead zone.</small></button>
              <button type="button" onClick={() => applyCameraPreset("top-down-lookahead")}><strong>Top-Down</strong><small>Tracks movement direction equally in every direction.</small></button>
            </div>
          </section>
        )}

        <div className="inspector-components-header"><span>Components</span><small>{object.components.length} · {objectProfile?.label}</small></div>
        <div className="phase10-component-slots">
          {Array.from(new Set(object.components.map((element) => {
            try { return getComponentDefinition(element.type).slot ?? slotForCategory(getComponentDefinition(element.type).category); }
            catch { return "debugging" as ComponentSlot; }
          }))).map((slot) => {
            const slotComponents = object.components.filter((element) => {
              try { const definition = getComponentDefinition(element.type); return (definition.slot ?? slotForCategory(definition.category)) === slot; }
              catch { return slot === "debugging"; }
            });
            return (
              <section key={slot} className="phase10-component-slot">
                <header><strong>{slot.replace(/(^|-)(\w)/g, (_m, _d, letter: string) => letter.toUpperCase())}</strong><small>{slotComponents.length}</small></header>
                <div className="element-card-stack">{slotComponents.map((element) => <ComponentCard key={element.id} element={element} detailLevel={detailLevel} />)}</div>
              </section>
            );
          })}
        </div>

        <button className="material-button tonal add-element-button" type="button" onClick={() => window.dispatchEvent(new CustomEvent("shadowium:set-overlay", { detail: "add-component" }))}>
          <Plus size={16} /> Add Component
        </button>
      </div>

    </aside>
  );
}
