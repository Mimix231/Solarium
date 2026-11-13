import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Box,
  CheckSquare,
  ChevronRight,
  Gamepad2,
  Gauge,
  Image,
  LayoutPanelTop,
  List,
  Menu,
  MessageSquare,
  Monitor,
  MousePointerClick,
  Plus,
  ScrollText,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Type,
} from "lucide-react";
import { getActiveScene } from "../editor/project";
import { useEditorStore } from "../editor/store";
import type { ComponentSettingValue, ComponentType, GameObjectDocument, SceneDocument } from "../editor/types";
import { AssetThumbnail } from "./AssetBrowser";

const UI_TYPES: Array<{ type: ComponentType; name: string; icon: typeof Box; description: string }> = [
  { type: "ui-panel", name: "Panel", icon: Box, description: "Anchored colour or image container." },
  { type: "ui-text", name: "Text", icon: Type, description: "HUD text with typed variable bindings." },
  { type: "ui-image", name: "Image", icon: Image, description: "Responsive interface artwork." },
  { type: "ui-button", name: "Button", icon: MousePointerClick, description: "Pointer-focused action button." },
  { type: "ui-menu-item", name: "Menu Item", icon: Menu, description: "Keyboard, pointer, and controller navigation." },
  { type: "ui-progress-bar", name: "Progress Bar", icon: Gauge, description: "Health, stamina, loading, or objective values." },
  { type: "ui-slider", name: "Slider", icon: SlidersHorizontal, description: "Variable and audio-group controls." },
  { type: "ui-checkbox", name: "Checkbox", icon: CheckSquare, description: "Boolean settings and toggles." },
  { type: "ui-action-guide", name: "Action Guide", icon: Gamepad2, description: "Device-aware Select, Confirm, and Back hints." },
  { type: "ui-input-glyph", name: "Input Glyph", icon: Gamepad2, description: "Live glyph for a project input action." },
  { type: "ui-scroll-list", name: "Scroll List", icon: List, description: "Clipped long lists for inventories and credits." },
  { type: "ui-tooltip", name: "Tooltip", icon: MessageSquare, description: "Conditionally visible help text." },
];

type PresetKind = "main-menu" | "pause-menu" | "settings" | "hud";

type ScreenRecord = {
  object: GameObjectDocument;
  element: GameObjectDocument["components"][number];
};

function addInterfaceObject(
  name: string,
  type: ComponentType,
  geometry: { x: number; y: number; width: number; height: number },
  settings: Record<string, ComponentSettingValue> = {},
  parentId: string | null = null,
): string | null {
  let state = useEditorStore.getState();
  state.addObject();
  state = useEditorStore.getState();
  const objectId = state.selectedObjectId;
  if (!objectId) return null;
  state.renameSelectedObject(name);
  state.updateSelectedPosition(geometry.x, geometry.y);
  state.updateSelectedSize(geometry.width, geometry.height);
  state.moveSelectedToLayer("layer-interface");
  const object = getActiveScene(state.project).objects.find((candidate) => candidate.id === objectId);
  const defaultSprite = object?.components.find((element) => element.type === "sprite-renderer");
  if (defaultSprite) state.removeComponent(defaultSprite.id);
  state.setSelectedObjectType(type === "ui-menu-screen" ? "ui-screen" : "ui-control");
  state.addComponent(type);
  if (!["ui-style", "ui-selection-indicator"].includes(type)) state.addComponent("responsive-layout");
  if (type === "ui-menu-screen") {
    state.addComponent("ui-theme-binding");
    state = useEditorStore.getState();
    const themeBinding = getActiveScene(state.project).objects.find((candidate) => candidate.id === objectId)?.components.find((element) => element.type === "ui-theme-binding");
    if (themeBinding) state.updateComponentSetting(themeBinding.id, "themeId", state.project.activeGameUiThemeId);
  }
  state = useEditorStore.getState();
  const attached = getActiveScene(state.project).objects.find((candidate) => candidate.id === objectId)?.components.find((element) => element.type === type);
  if (attached) for (const [key, value] of Object.entries(settings)) state.updateComponentSetting(attached.id, key, value);
  if (parentId) state.reparentSelectedObject(parentId);
  return objectId;
}

function findScreenRoot(scene: SceneDocument, objectId: string | null): GameObjectDocument | null {
  if (!objectId) return null;
  const byId = new Map(scene.objects.map((object) => [object.id, object]));
  let object = byId.get(objectId) ?? null;
  const visited = new Set<string>();
  while (object && !visited.has(object.id)) {
    visited.add(object.id);
    if (object.components.some((element) => element.type === "ui-menu-screen" && element.enabled)) return object;
    object = object.parentId ? byId.get(object.parentId) ?? null : null;
  }
  return null;
}

function createInterfacePreset(kind: PresetKind, dependency = false): void {
  const initialState = useEditorStore.getState();
  const scene = getActiveScene(initialState.project);
  const existing = scene.objects.find((object) => object.components.some((element) => element.type === "ui-menu-screen" && String(element.settings.screenId ?? "") === kind));
  if (existing) {
    if (!dependency) {
      initialState.selectObject(existing.id);
      initialState.setStatus(`${existing.name} already exists; selected the existing screen.`);
    }
    return;
  }

  const width = initialState.project.settings.gameWidth;
  const height = initialState.project.settings.gameHeight;
  const baseX = 68;
  const gameTheme = initialState.project.gameUiThemes.find((theme) => theme.id === initialState.project.activeGameUiThemeId) ?? initialState.project.gameUiThemes[0];

  if (kind === "hud") {
    addInterfaceObject("HUD Background", "ui-panel", { x: 20, y: 20, width: 320, height: 86 }, { anchor: "top-left", backgroundColor: "#101722cc", visible: true });
    addInterfaceObject("Health", "ui-progress-bar", { x: 42, y: 44, width: 270, height: 20 }, { valueSource: "playerHealth", maximumSource: "playerMaximumHealth", fillColor: "#ef5350", backgroundColor: "#2d3440" });
    addInterfaceObject("Objective", "ui-text", { x: 400, y: 26, width: 480, height: 54 }, { anchor: "top-left", text: "Objective: {objective}", fontSize: 22, color: "#ffffff", visible: true });
    addInterfaceObject("Interaction Hint", "ui-input-glyph", { x: Math.max(28, width - 248), y: Math.max(28, height - 72), width: 220, height: 44 }, { anchor: "top-left", actionId: "interact", label: "Interact" });
    useEditorStore.getState().setStatus("Created a responsive HUD group");
    return;
  }

  const rootId = addInterfaceObject(
    kind === "main-menu" ? "Main Menu Screen" : kind === "pause-menu" ? "Pause Menu Screen" : "Settings Screen",
    "ui-menu-screen",
    { x: 0, y: 0, width, height },
    {
      screenId: kind,
      startVisible: kind === "main-menu",
      pauseGameplay: true,
      backgroundColor: kind === "settings" ? String(gameTheme?.panelColor ?? "#18212f") : String(gameTheme?.accentColor ?? "#e51f35"),
      backgroundOpacity: kind === "pause-menu" ? 0.88 : 1,
      layout: "vertical-left",
      entrance: "slide-left",
      wrapNavigation: true,
    },
  );
  if (!rootId) return;

  addInterfaceObject("Menu Style", "ui-style", { x: 0, y: 0, width: 1, height: 1 }, {
    fontFamily: String(gameTheme?.fontFamily ?? "Inter, system-ui, sans-serif"),
    fontSize: 38,
    normalColor: String(gameTheme?.textColor ?? "#ffffff"),
    selectedColor: String(gameTheme?.selectedColor ?? "#2b2b2b"),
    selectionColor: String(gameTheme?.selectedBackground ?? "#ffffff"),
    accentColor: String(gameTheme?.accentColor ?? "#e51f35"),
    itemGap: Number(gameTheme?.spacing ?? 12),
  }, rootId);
  addInterfaceObject("Selection Indicator", "ui-selection-indicator", { x: 0, y: 0, width: 1, height: 1 }, {
    style: "bar",
    color: String(gameTheme?.selectedBackground ?? "#ffffff"),
    textColor: String(gameTheme?.selectedColor ?? "#292929"),
    accentColor: String(gameTheme?.accentColor ?? "#e51f35"),
    duration: 0.18,
    selectedScale: 1.045,
  }, rootId);

  const item = (
    name: string,
    y: number,
    order: number,
    action: string,
    targetScreenId = "",
    additional: Record<string, ComponentSettingValue> = {},
  ) => addInterfaceObject(name, "ui-menu-item", { x: baseX, y, width: 480, height: 58 }, {
    text: name,
    order,
    enabled: true,
    action,
    targetScreenId,
    ...additional,
  }, rootId);

  if (kind === "main-menu") {
    item("New Game", 330, 0, "close-screen");
    item("Continue", 402, 1, "load-game");
    item("Options", 474, 2, "open-screen", "settings");
    item("Quit", 546, 3, "quit");
  } else if (kind === "pause-menu") {
    item("Resume", 300, 0, "resume");
    item("Restart", 372, 1, "restart");
    item("Options", 444, 2, "open-screen", "settings");
    item("Return to Main Menu", 516, 3, "replace-screen", "main-menu");
  } else {
    addInterfaceObject("Master Volume", "ui-slider", { x: baseX, y: 260, width: 520, height: 46 }, { bindingType: "audio-group", audioGroupId: "master", minimum: 0, maximum: 1, step: 0.05, anchor: "top-left" }, rootId);
    addInterfaceObject("Music Volume", "ui-slider", { x: baseX, y: 330, width: 520, height: 46 }, { bindingType: "audio-group", audioGroupId: "music", minimum: 0, maximum: 1, step: 0.05, anchor: "top-left" }, rootId);
    addInterfaceObject("Fullscreen", "ui-checkbox", { x: baseX, y: 400, width: 260, height: 42 }, { variable: "fullscreen", label: "Fullscreen", anchor: "top-left" }, rootId);
    item("Back", 500, 3, "close-screen");
  }

  addInterfaceObject("Action Guide", "ui-action-guide", { x: 0, y: height - 66, width, height: 66 }, {
    anchor: "top-left",
    showSelect: true,
    showConfirm: true,
    showBack: kind !== "main-menu",
    selectText: "Select",
    confirmText: "Confirm",
    backText: "Back",
    backgroundColor: "#ffffff",
    textColor: "#a98900",
  }, rootId);
  if (kind === "main-menu") createInterfacePreset("settings", true);
  if (kind === "pause-menu") {
    createInterfacePreset("settings", true);
    createInterfacePreset("main-menu", true);
  }
  useEditorStore.getState().selectObject(rootId);
  if (!dependency) useEditorStore.getState().setStatus(`Created ${kind.replace("-", " ")} interface screen`);
}

function uiElementName(type: ComponentType): string {
  return UI_TYPES.find((entry) => entry.type === type)?.name ?? type.replace(/^ui-/, "").replace(/-/g, " ");
}

function previewLabel(object: GameObjectDocument): string {
  const menuItem = object.components.find((element) => element.type === "ui-menu-item");
  const text = object.components.find((element) => element.type === "ui-text");
  const button = object.components.find((element) => element.type === "ui-button");
  const checkbox = object.components.find((element) => element.type === "ui-checkbox");
  const inputGlyph = object.components.find((element) => element.type === "ui-input-glyph");
  return String(menuItem?.settings.text ?? text?.settings.text ?? button?.settings.text ?? checkbox?.settings.label ?? inputGlyph?.settings.label ?? object.name);
}

export function InterfacePanel() {
  const project = useEditorStore((state) => state.project);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const selectObject = useEditorStore((state) => state.selectObject);
  const updateSelectedPosition = useEditorStore((state) => state.updateSelectedPosition);
  const updateSelectedSize = useEditorStore((state) => state.updateSelectedSize);
  const [section, setSection] = useState<"screens" | "controls" | "flow">("screens");
  const [safeArea, setSafeArea] = useState(true);
  const [previewProfile, setPreviewProfile] = useState<"project" | "1080p" | "steam-deck" | "ultrawide" | "mobile-portrait">("project");
  const designerRef = useRef<HTMLDivElement | null>(null);
  const scene = getActiveScene(project);
  const screens = useMemo<ScreenRecord[]>(() => scene.objects.flatMap((object) => object.components.filter((element) => element.type === "ui-menu-screen").map((element) => ({ object, element }))), [scene.objects]);
  const selectedScreen = findScreenRoot(scene, selectedObjectId);
  const activeScreen = selectedScreen ?? screens[0]?.object ?? null;
  const activeScreenElement = activeScreen?.components.find((element) => element.type === "ui-menu-screen") ?? null;
  const screenChildren = activeScreen ? scene.objects.filter((candidate) => candidate.parentId === activeScreen.id) : [];
  const previewDimensions = previewProfile === "1080p" ? { width: 1920, height: 1080 }
    : previewProfile === "steam-deck" ? { width: 1280, height: 800 }
      : previewProfile === "ultrawide" ? { width: 2560, height: 1080 }
        : previewProfile === "mobile-portrait" ? { width: 1080, height: 1920 }
          : { width: project.settings.gameWidth, height: project.settings.gameHeight };

  function addUiElement(type: ComponentType): void {
    const parentId = activeScreen?.id ?? null;
    const index = screenChildren.filter((object) => object.components.some((element) => element.type === type)).length;
    const name = `${uiElementName(type)}${index ? ` ${index + 1}` : ""}`;
    const geometry = type === "ui-action-guide"
      ? { x: 0, y: Math.max(0, project.settings.gameHeight - 64), width: project.settings.gameWidth, height: 64 }
      : { x: 68, y: 120 + screenChildren.length * 56, width: type === "ui-menu-item" ? 480 : 300, height: type === "ui-panel" ? 150 : 48 };
    const defaults: Record<string, ComponentSettingValue> = type === "ui-menu-item"
      ? { text: name, order: screenChildren.length, enabled: true, action: "none" }
      : type === "ui-text"
        ? { text: "New Text", fontSize: 24, color: "#ffffff", anchor: "top-left", visible: true }
        : type === "ui-button"
          ? { text: "Button", action: "none", anchor: "top-left" }
          : type === "ui-panel"
            ? { backgroundColor: "#101722cc", anchor: "top-left", visible: true }
            : type === "ui-progress-bar"
              ? { valueSource: "playerHealth", maximumSource: "playerMaximumHealth", fillColor: "#ef5350", backgroundColor: "#2d3440" }
              : type === "ui-slider"
                ? { bindingType: "variable", variable: "volume", minimum: 0, maximum: 1, step: 0.05, anchor: "top-left" }
                : type === "ui-checkbox"
                  ? { variable: "enabled", label: "Enabled", anchor: "top-left" }
                  : type === "ui-input-glyph"
                    ? { actionId: "interact", label: "Interact", anchor: "top-left" }
                    : type === "ui-action-guide"
                      ? { showSelect: true, showConfirm: true, showBack: true, selectText: "Select", confirmText: "Confirm", backText: "Back", backgroundColor: "#ffffff", textColor: "#a98900", anchor: "top-left" }
                      : {};
    const objectId = addInterfaceObject(name, type, geometry, defaults, parentId);
    if (objectId) useEditorStore.getState().selectObject(objectId);
  }

  function beginCanvasDrag(event: React.PointerEvent<HTMLDivElement>, object: GameObjectDocument): void {
    if (!designerRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    selectObject(object.id);
    const rect = designerRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = object.transform.position.x;
    const originY = object.transform.position.y;
    const scaleX = project.settings.gameWidth / Math.max(1, rect.width);
    const scaleY = project.settings.gameHeight / Math.max(1, rect.height);

    function move(pointerEvent: PointerEvent): void {
      updateSelectedPosition(
        Math.round(originX + (pointerEvent.clientX - startX) * scaleX),
        Math.round(originY + (pointerEvent.clientY - startY) * scaleY),
      );
    }
    function finish(): void {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  function beginCanvasResize(event: React.PointerEvent<HTMLSpanElement>, object: GameObjectDocument): void {
    if (!designerRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    selectObject(object.id);
    const rect = designerRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originWidth = object.size.width;
    const originHeight = object.size.height;
    const scaleX = project.settings.gameWidth / Math.max(1, rect.width);
    const scaleY = project.settings.gameHeight / Math.max(1, rect.height);

    function move(pointerEvent: PointerEvent): void {
      updateSelectedSize(
        Math.max(8, Math.round(originWidth + (pointerEvent.clientX - startX) * scaleX)),
        Math.max(8, Math.round(originHeight + (pointerEvent.clientY - startY) * scaleY)),
      );
    }
    function finish(): void {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish, { once: true });
  }

  return (
    <div className="phase6-interface-workspace">
      <aside className="interface-tool-rail">
        <button className={section === "screens" ? "active" : ""} type="button" onClick={() => setSection("screens")}><Monitor size={17} /><span>Designer</span></button>
        <button className={section === "controls" ? "active" : ""} type="button" onClick={() => setSection("controls")}><MousePointerClick size={17} /><span>Controls</span></button>
        <button className={section === "flow" ? "active" : ""} type="button" onClick={() => setSection("flow")}><ArrowRight size={17} /><span>Flow</span></button>
      </aside>

      <main className="interface-main-area">
        {section === "screens" && (
          <>
            <div className="interface-workspace-hero">
              <div><span><LayoutPanelTop size={24} /></span><div><h2>Game Interface Designer</h2><p>Create polished main menus, pause screens, settings, and HUDs with real input navigation and runtime screen stacking.</p></div></div>
              <small>{screens.length} screens in {scene.name}</small>
            </div>
            <div className="interface-preset-grid">
              <button type="button" onClick={() => createInterfacePreset("main-menu")}><span><Menu size={24} /></span><strong>Main Menu</strong><small>New Game, Continue, Options, Quit</small><ChevronRight size={16} /></button>
              <button type="button" onClick={() => createInterfacePreset("pause-menu")}><span><Gamepad2 size={24} /></span><strong>Pause Menu</strong><small>Resume, Restart, Options, Main Menu</small><ChevronRight size={16} /></button>
              <button type="button" onClick={() => createInterfacePreset("settings")}><span><Settings2 size={24} /></span><strong>Settings</strong><small>Audio sliders, fullscreen, and Back</small><ChevronRight size={16} /></button>
              <button type="button" onClick={() => createInterfacePreset("hud")}><span><Gauge size={24} /></span><strong>HUD</strong><small>Health, objective, and input hints</small><ChevronRight size={16} /></button>
            </div>

            <section className="interface-designer-layout">
              <div className="interface-screen-list designer-screen-list">
                <header><div><Sparkles size={16} /><strong>Screen Stack</strong></div><span>Select a screen to edit it.</span></header>
                {screens.length ? screens.map(({ object, element }) => {
                  const screenId = String(element.settings.screenId ?? object.name);
                  const children = scene.objects.filter((candidate) => candidate.parentId === object.id);
                  return <button key={object.id} className={activeScreen?.id === object.id ? "active" : ""} type="button" onClick={() => selectObject(object.id)}><span style={{ background: String(element.settings.backgroundColor ?? object.editorColor) }}><Monitor size={20} /></span><div><strong>{object.name}</strong><small>{screenId} · {children.length} controls · {element.settings.startVisible === true ? "opens at start" : "opened by flow"}</small></div><ChevronRight size={16} /></button>;
                }) : <div className="interface-empty-state"><Monitor size={34} /><strong>No menu screens yet</strong><span>Create one of the screen presets above or add a Menu Screen Component manually.</span></div>}
              </div>

              <div className="interface-designer-panel">
                <header>
                  <div><Monitor size={15} /><strong>{activeScreen?.name ?? "No screen selected"}</strong><span>{previewDimensions.width} × {previewDimensions.height}</span></div>
                  <div className="interface-preview-tools">
                    <select value={previewProfile} onChange={(event) => setPreviewProfile(event.target.value as typeof previewProfile)}><option value="project">Project</option><option value="1080p">1920 × 1080</option><option value="steam-deck">Steam Deck</option><option value="ultrawide">Ultrawide</option><option value="mobile-portrait">Mobile portrait</option></select>
                    <label><input type="checkbox" checked={safeArea} onChange={(event) => setSafeArea(event.target.checked)} /> Safe area</label>
                  </div>
                </header>
                {activeScreen && activeScreenElement ? (
                  <div className="interface-canvas-shell">
                    <div
                      ref={designerRef}
                      className={`interface-design-canvas ${safeArea ? "show-safe-area" : ""}`}
                      style={{
                        aspectRatio: `${previewDimensions.width} / ${previewDimensions.height}`,
                        background: String(activeScreenElement.settings.backgroundColor ?? "#151c25"),
                      }}
                      onPointerDown={() => selectObject(activeScreen.id)}
                    >
                      {project.assets.find((asset) => asset.id === String(activeScreenElement.settings.backgroundAssetId ?? "")) && (
                        <AssetThumbnail asset={project.assets.find((asset) => asset.id === String(activeScreenElement.settings.backgroundAssetId ?? ""))!} className="interface-design-background" />
                      )}
                      <div className="interface-safe-area" />
                      {screenChildren.map((object, index) => {
                        const visualElement = object.components.find((element) => !["ui-style", "ui-selection-indicator"].includes(element.type));
                        if (!visualElement) return null;
                        const isMenu = visualElement.type === "ui-menu-item";
                        const isGuide = visualElement.type === "ui-action-guide";
                        const isPanel = visualElement.type === "ui-panel";
                        const selected = selectedObjectId === object.id;
                        const left = `${object.transform.position.x / project.settings.gameWidth * 100}%`;
                        const top = `${object.transform.position.y / project.settings.gameHeight * 100}%`;
                        const width = `${object.size.width / project.settings.gameWidth * 100}%`;
                        const height = `${object.size.height / project.settings.gameHeight * 100}%`;
                        return (
                          <div
                            key={object.id}
                            className={`interface-design-object ${selected ? "selected" : ""} ${isMenu ? "menu-item" : ""} ${isGuide ? "action-guide" : ""} ${isPanel ? "panel" : ""}`}
                            style={{ left, top, width, height, background: isPanel ? String(visualElement.settings.backgroundColor ?? "#101722cc") : undefined }}
                            onPointerDown={(event) => beginCanvasDrag(event, object)}
                            title={`${object.name} · drag to move`}
                          >
                            {visualElement.type === "ui-image" && project.assets.find((asset) => asset.id === String(visualElement.settings.assetId ?? ""))
                              ? <AssetThumbnail asset={project.assets.find((asset) => asset.id === String(visualElement.settings.assetId ?? ""))!} />
                              : visualElement.type === "ui-progress-bar"
                                ? <><span className="interface-design-progress" /><em>{object.name}</em></>
                                : visualElement.type === "ui-slider"
                                  ? <><strong>{object.name}</strong><span className="interface-design-slider" /></>
                                  : visualElement.type === "ui-checkbox"
                                    ? <><span className="interface-design-check">✓</span><strong>{previewLabel(object)}</strong></>
                                    : isGuide
                                      ? <><span>↑↓ Select</span><span>A Confirm</span><span>B Back</span></>
                                      : <strong>{previewLabel(object)}</strong>}
                            {isMenu && index === screenChildren.findIndex((candidate) => candidate.components.some((element) => element.type === "ui-menu-item")) && <span className="interface-design-selection" />}
                            {selected && <span className="interface-design-resize" onPointerDown={(event) => beginCanvasResize(event, object)} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : <div className="interface-empty-state designer-empty"><LayoutPanelTop size={38} /><strong>Create or select a UI screen</strong><span>The live design canvas will appear here. Nothing is inserted into a new project until you choose a preset.</span></div>}
              </div>
            </section>
          </>
        )}

        {section === "controls" && (
          <>
            <div className="interface-workspace-hero"><div><span><MousePointerClick size={24} /></span><div><h2>Interface Controls</h2><p>Add individual responsive controls to the active screen. Each control is a separate hierarchy object that can be dragged, resized, and configured.</p></div></div><small>{activeScreen ? `Target: ${activeScreen.name}` : "No screen selected"}</small></div>
            <div className="interface-element-grid phase6-control-grid">
              {UI_TYPES.map(({ type, name, icon: Icon, description }) => (
                <article key={type}><span><Icon size={22} /></span><div><strong>{name}</strong><p>{description}</p></div><button className="material-button tonal" type="button" onClick={() => addUiElement(type)}><Plus size={14} /> Add</button></article>
              ))}
            </div>
          </>
        )}

        {section === "flow" && (
          <>
            <div className="interface-workspace-hero"><div><span><ArrowRight size={24} /></span><div><h2>UI Flow</h2><p>Screen actions create a visible map of how players move through menus.</p></div></div></div>
            <div className="ui-flow-map">
              {screens.map(({ object, element }, index) => {
                const screenId = String(element.settings.screenId ?? object.name);
                const targets = scene.objects.filter((candidate) => candidate.parentId === object.id).flatMap((candidate) => candidate.components.filter((child) => child.type === "ui-menu-item")).map((item) => String(item.settings.targetScreenId ?? "")).filter(Boolean);
                return <button key={object.id} className="ui-flow-node" type="button" onClick={() => { selectObject(object.id); setSection("screens"); }}><span>{index + 1}</span><div><strong>{object.name}</strong><small>{screenId}</small></div>{targets.length ? <p>{targets.map((target) => <em key={target}>{target}</em>)}</p> : <p><i>No linked screens</i></p>}</button>;
              })}
              {screens.length === 0 && <div className="interface-empty-state"><ScrollText size={34} /><strong>No flow to display</strong><span>Create two or more screens, then use Open Screen or Close Screen actions on Menu Items.</span></div>}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
