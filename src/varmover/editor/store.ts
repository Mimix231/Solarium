import { createStore } from "./createStore";
import { createComponentInstance, getComponentDefinition } from "./catalog";
import { createId } from "./ids";
import {
  cloneObject,
  cloneProject,
  createAction,
  createCondition,
  createEventRule,
  createGameObject,
  createScene,
  createStarterProject,
  createUniqueAnimationName,
  createUniqueObjectName,
  createUniqueSceneName,
  getActiveScene,
} from "./project";
import type {
  ActivityEntry,
  AnimationClip,
  AssetDocument,
  AssetViewMode,
  BottomTab,
  DiagnosticEntry,
  EditorTool,
  ComponentCategory,
  ComponentSettingValue,
  ComponentSlot,
  ComponentType,
  EventActionDefinition,
  EventConditionDefinition,
  EventRuleDocument,
  GameObjectDocument,
  GameObjectType,
  InputActionDefinition,
  PrefabDocument,
  PanelSizes,
  PlayState,
  ProjectDocument,
  SpriteFrame,
  SpriteScalingRegion,
  TilePaletteEntry,
  Transform2D,
} from "./types";

interface EditorStore {
  project: ProjectDocument;
  projectPath: string | null;
  projectRoot: string | null;
  isDirty: boolean;

  selectedObjectId: string | null;
  selectedObjectIds: string[];
  selectedTileId: string;
  selectedTileBrush: { tileIds: string[]; columns: number; rows: number };
  clipboardObjects: GameObjectDocument[];
  selectedAssetId: string | null;
  selectedRuleId: string | null;
  selectedAnimationId: string | null;

  activeTool: EditorTool;
  activeBottomTab: BottomTab;
  playState: PlayState;
  showGrid: boolean;
  showColliders: boolean;
  snapToGrid: boolean;
  gridSize: number;
  viewportZoom: number;
  assetViewMode: AssetViewMode;
  assetSearch: string;
  panelSizes: PanelSizes;
  statusMessage: string;
  activityLog: ActivityEntry[];

  past: ProjectDocument[];
  future: ProjectDocument[];
  interactionSnapshot: ProjectDocument | null;

  createNewProject: (name?: string) => void;
  replaceProject: (project: ProjectDocument, path: string | null, root: string | null) => void;
  markSaved: (path: string | null, root?: string | null) => void;
  setStatus: (message: string, level?: ActivityEntry["level"]) => void;
  clearActivityLog: () => void;
  setActiveTool: (tool: EditorTool) => void;
  setActiveBottomTab: (tab: BottomTab) => void;
  setPlayState: (state: PlayState) => void;
  setViewportZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleColliders: () => void;
  toggleSnap: () => void;
  setAssetViewMode: (mode: AssetViewMode) => void;
  setAssetSearch: (search: string) => void;
  adjustPanelSize: (panel: keyof PanelSizes, delta: number) => void;

  selectScene: (sceneId: string) => void;
  addScene: () => void;
  renameScene: (sceneId: string, name: string) => void;
  deleteScene: (sceneId: string) => void;
  updateSceneBackground: (sceneId: string, color: string) => void;
  updateSceneSettings: (sceneId: string, patch: Partial<Omit<ProjectDocument["scenes"][number], "id" | "objects" | "layers">>) => void;

  selectObject: (objectId: string | null, additive?: boolean) => void;
  setSelectedObjects: (objectIds: string[], primaryId?: string | null) => void;
  selectAllObjects: () => void;
  addObject: () => void;
  addTilemapObject: () => void;
  addObjectFromAsset: (assetId: string, x: number, y: number) => void;
  addObjectFromPrefab: (prefabId: string, x?: number, y?: number) => void;
  duplicateSelectedObject: () => void;
  copySelectedObjects: () => void;
  pasteObjects: () => void;
  groupSelectedObjects: () => void;
  reparentSelectedObject: (parentId: string | null) => void;
  moveSelectedToLayer: (layerId: string) => void;
  deleteSelectedObject: () => void;
  renameSelectedObject: (name: string) => void;
  setSelectedObjectType: (type: GameObjectType) => void;
  setSelectedCustomObjectType: (customTypeId: string | null) => void;
  addCustomGameObjectType: () => void;
  updateCustomGameObjectType: (typeId: string, patch: Partial<ProjectDocument["customGameObjectTypes"][number]>) => void;
  deleteCustomGameObjectType: (typeId: string) => void;
  toggleSelectedObject: () => void;
  toggleSelectedEditorVisible: () => void;
  toggleSelectedRuntimeVisible: () => void;
  toggleSelectedCollision: () => void;
  toggleSelectedLogic: () => void;
  toggleSelectedLocked: () => void;
  updateSelectedTransform: (partial: Partial<Transform2D>) => void;
  updateSelectedPosition: (x: number | undefined, y: number | undefined) => void;
  updateSelectedSize: (width: number | undefined, height: number | undefined) => void;
  updateSelectedColor: (color: string) => void;
  updateSelectedTags: (tags: string[]) => void;
  setSelectedTile: (tileId: string) => void;
  setSelectedTileBrush: (tileIds: string[], columns?: number, rows?: number) => void;
  paintTileCell: (objectId: string, column: number, row: number, tileId: string | null) => void;
  paintTileBrush: (objectId: string, column: number, row: number, erase?: boolean) => void;
  fillTilemap: (objectId: string, tileId: string | null) => void;
  addTilesetFrames: (assetId: string, frames: SpriteFrame[], columns: number, rows: number) => string[];
  addTilesFromAsset: (assetId: string) => void;
  addColorTile: () => void;
  updateTilePaletteEntry: (tileId: string, patch: Partial<TilePaletteEntry>) => void;
  deleteTilePaletteEntry: (tileId: string) => void;
  addSceneLayer: () => void;
  updateSceneLayer: (layerId: string, patch: Partial<ProjectDocument["scenes"][number]["layers"][number]>) => void;
  deleteSceneLayer: (layerId: string) => void;

  addComponent: (type: ComponentType) => void;
  applyCameraPreset: (preset: "centered" | "smooth" | "platformer" | "top-down-lookahead") => void;
  removeComponent: (componentId: string) => void;
  toggleComponent: (componentId: string) => void;
  updateComponentSetting: (componentId: string, key: string, value: ComponentSettingValue) => void;

  addImportedAssets: (assets: AssetDocument[]) => void;
  selectAsset: (assetId: string | null) => void;
  renameAsset: (assetId: string, name: string) => void;
  removeAsset: (assetId: string) => void;
  setAssetFrames: (assetId: string, frames: SpriteFrame[]) => void;
  updateAssetFrame: (assetId: string, frameId: string, patch: Partial<SpriteFrame>) => void;
  setAssetScalingRegion: (assetId: string, region: SpriteScalingRegion) => void;

  createAnimation: (assetId: string, frameIds?: string[]) => void;
  commitFramesAndCreateAnimation: (assetId: string, frames: SpriteFrame[], name: string, fps?: number) => string | null;
  createNamedAnimation: (assetId: string, name: string, frameIds: string[], fps?: number) => string | null;
  createDirectionalAnimationSet: (assetId: string, frames: SpriteFrame[], baseName: string, fps?: number) => void;
  selectAnimation: (clipId: string | null) => void;
  updateAnimation: (clipId: string, patch: Partial<AnimationClip>) => void;
  deleteAnimation: (clipId: string) => void;

  addRule: () => void;
  selectRule: (ruleId: string | null) => void;
  updateRule: (ruleId: string, patch: Partial<EventRuleDocument>) => void;
  deleteRule: (ruleId: string) => void;
  addCondition: (ruleId: string, type?: EventConditionDefinition["type"]) => void;
  updateCondition: (ruleId: string, conditionId: string, patch: Partial<EventConditionDefinition>) => void;
  removeCondition: (ruleId: string, conditionId: string) => void;
  addAction: (ruleId: string, type?: EventActionDefinition["type"]) => void;
  updateAction: (ruleId: string, actionId: string, patch: Partial<EventActionDefinition>) => void;
  removeAction: (ruleId: string, actionId: string) => void;

  saveSelectedAsPrefab: () => void;
  applySelectedToPrefab: () => void;
  revertSelectedPrefab: () => void;
  unlinkSelectedPrefab: () => void;
  deletePrefab: (prefabId: string) => void;
  createPrefabVariant: (prefabId: string) => void;

  setProjectSettings: (patch: Partial<ProjectDocument["settings"]>) => void;
  renameProject: (name: string) => void;
  addInputAction: () => void;
  updateInputAction: (actionId: string, patch: Partial<InputActionDefinition>) => void;
  removeInputAction: (actionId: string) => void;
  addCollisionLayer: (name: string) => void;
  removeCollisionLayer: (name: string) => void;
  setCollisionPair: (leftLayer: string, rightLayer: string, enabled: boolean) => void;
  setProjectVariable: (key: string, value: ProjectDocument["variables"][string]) => void;
  removeProjectVariable: (key: string) => void;

  applyBehaviourRecipe: (recipeId: string) => void;
  updateDamageType: (id: string, patch: Partial<ProjectDocument["damageTypes"][number]>) => void;
  updateAbility: (id: string, patch: Partial<ProjectDocument["abilities"][number]>) => void;
  updateStatusEffect: (id: string, patch: Partial<ProjectDocument["statusEffects"][number]>) => void;
  updateLootTable: (id: string, patch: Partial<ProjectDocument["lootTables"][number]>) => void;
  updateExperienceCurve: (id: string, patch: Partial<ProjectDocument["experienceCurves"][number]>) => void;
  updateUpgradeTree: (id: string, patch: Partial<ProjectDocument["upgradeTrees"][number]>) => void;
  updateShader: (id: string, patch: Partial<ProjectDocument["shaders"][number]>) => void;
  updateMaterial: (id: string, patch: Partial<ProjectDocument["materials"][number]>) => void;
  updateScript: (id: string, patch: Partial<ProjectDocument["scripts"][number]>) => void;
  addScript: () => void;
  setActiveEditorTheme: (themeId: string) => void;
  duplicateEditorTheme: (themeId: string) => void;
  updateEditorTheme: (themeId: string, patch: Partial<ProjectDocument["editorThemes"][number]>) => void;
  setActiveGameUiTheme: (themeId: string) => void;
  duplicateGameUiTheme: (themeId: string) => void;
  updateGameUiTheme: (themeId: string, patch: Partial<ProjectDocument["gameUiThemes"][number]>) => void;
  createAnimationSet: (name: string, assetId: string, directions: Record<string, string>) => void;
  addDialogueGraph: () => void;
  updateDialogueGraph: (dialogueId: string, patch: Partial<ProjectDocument["dialogues"][number]>) => void;
  addDialogueNode: (dialogueId: string) => void;
  updateDialogueNode: (dialogueId: string, nodeId: string, patch: Partial<ProjectDocument["dialogues"][number]["nodes"][number]>) => void;
  deleteDialogueNode: (dialogueId: string, nodeId: string) => void;
  addDialogueChoice: (dialogueId: string, nodeId: string) => void;
  updateDialogueChoice: (dialogueId: string, nodeId: string, choiceId: string, patch: Partial<ProjectDocument["dialogues"][number]["nodes"][number]["choices"][number]>) => void;
  deleteDialogueChoice: (dialogueId: string, nodeId: string, choiceId: string) => void;
  addQuest: () => void;
  updateQuest: (questId: string, patch: Partial<ProjectDocument["quests"][number]>) => void;
  addQuestObjective: (questId: string) => void;
  updateQuestObjective: (questId: string, objectiveId: string, patch: Partial<ProjectDocument["quests"][number]["objectives"][number]>) => void;
  deleteQuestObjective: (questId: string, objectiveId: string) => void;
  applyGenreKit: (kitId: string) => void;
  addPackageManifest: () => void;
  togglePackage: (packageId: string) => void;

  focusDiagnostic: (diagnostic: DiagnosticEntry) => void;
  repairDiagnostic: (diagnostic: DiagnosticEntry) => void;
  beginInteraction: () => void;
  previewObjectPosition: (objectId: string, x: number, y: number) => void;
  previewObjectGeometry: (objectId: string, patch: { x?: number; y?: number; width?: number; height?: number; scaleX?: number; scaleY?: number; rotation?: number; pivotX?: number; pivotY?: number }) => void;
  previewCollider: (objectId: string, componentId: string, patch: Record<string, number>) => void;
  commitInteraction: (message: string) => void;
  cancelInteraction: () => void;
  undo: () => void;
  redo: () => void;
}

const HISTORY_LIMIT = 80;

function createActivity(
  message: string,
  level: ActivityEntry["level"] = "info",
): ActivityEntry {
  return {
    id: createId("activity"),
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    level,
    message,
  };
}

function appendActivity(
  entries: ActivityEntry[],
  message: string,
  level: ActivityEntry["level"] = "info",
): ActivityEntry[] {
  return [createActivity(message, level), ...entries].slice(0, 250);
}

function clampPanelSize(panel: keyof PanelSizes, value: number): number {
  if (panel === "left") {
    return Math.min(500, Math.max(220, value));
  }
  if (panel === "right") {
    return Math.min(620, Math.max(300, value));
  }
  return Math.min(480, Math.max(150, value));
}

function getSelectedObject(project: ProjectDocument, objectId: string | null): GameObjectDocument | undefined {
  if (!objectId) {
    return undefined;
  }
  return getActiveScene(project).objects.find((object) => object.id === objectId);
}

function regenerateObjectIds(object: GameObjectDocument): GameObjectDocument {
  const clone = cloneObject(object);
  clone.id = createId("object");
  clone.parentId = null;
  clone.components = clone.components.map((element) => ({
    ...element,
    id: createId("element"),
  }));
  return clone;
}

function collectDescendantIds(objects: GameObjectDocument[], parentId: string): Set<string> {
  const result = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const object of objects) {
      if (object.parentId && (object.parentId === parentId || result.has(object.parentId)) && !result.has(object.id)) {
        result.add(object.id);
        changed = true;
      }
    }
  }
  return result;
}

function moveObjectAndDescendants(objects: GameObjectDocument[], objectId: string, x: number, y: number): void {
  const object = objects.find((candidate) => candidate.id === objectId);
  if (!object) return;
  const deltaX = x - object.transform.position.x;
  const deltaY = y - object.transform.position.y;
  object.transform.position = { x, y };
  if (deltaX === 0 && deltaY === 0) return;
  const descendants = collectDescendantIds(objects, objectId);
  for (const child of objects) {
    if (!descendants.has(child.id)) continue;
    child.transform.position.x += deltaX;
    child.transform.position.y += deltaY;
  }
}

function updateAutotileNeighbours(palette: TilePaletteEntry[], cells: Record<string, string>, column: number, row: number): void {
  const byId = new Map(palette.map((tile) => [tile.id, tile]));
  const affected = [[column, row], [column, row - 1], [column + 1, row], [column, row + 1], [column - 1, row]] as const;
  for (const [x, y] of affected) {
    const key = `${x},${y}`;
    const current = byId.get(cells[key]);
    const terrain = current?.terrainType?.trim();
    if (!terrain) continue;
    const sameTerrain = (checkX: number, checkY: number): boolean => byId.get(cells[`${checkX},${checkY}`])?.terrainType === terrain;
    const mask = (sameTerrain(x, y - 1) ? 1 : 0) | (sameTerrain(x + 1, y) ? 2 : 0) | (sameTerrain(x, y + 1) ? 4 : 0) | (sameTerrain(x - 1, y) ? 8 : 0);
    const variant = palette.find((tile) => tile.terrainType === terrain && tile.terrainMask === mask);
    if (variant) cells[key] = variant.id;
  }
}

export const useEditorStore = createStore<EditorStore>()((set, get) => {
  const commitProject = (
    message: string,
    mutate: (draft: ProjectDocument) => void,
    level: ActivityEntry["level"] = "info",
  ): void => {
    const state = get();
    const previous = cloneProject(state.project);
    const draft = cloneProject(state.project);
    mutate(draft);
    draft.metadata.updatedAt = new Date().toISOString();

    set({
      project: draft,
      isDirty: true,
      past: [...state.past.slice(-(HISTORY_LIMIT - 1)), previous],
      future: [],
      interactionSnapshot: null,
      statusMessage: message,
      activityLog: appendActivity(state.activityLog, message, level),
    });
  };

  return {
    project: createStarterProject(),
    projectPath: null,
    projectRoot: null,
    isDirty: false,
    selectedObjectId: null,
    selectedObjectIds: [],
    selectedTileId: "",
    selectedTileBrush: { tileIds: [], columns: 1, rows: 1 },
    clipboardObjects: [],
    selectedAssetId: null,
    selectedRuleId: null,
    selectedAnimationId: null,
    activeTool: "select",
    activeBottomTab: "assets",
    playState: "stopped",
    showGrid: true,
    showColliders: true,
    snapToGrid: false,
    gridSize: 32,
    viewportZoom: 1,
    assetViewMode: "grid",
    assetSearch: "",
    panelSizes: { left: 280, right: 370, bottom: 250 },
    statusMessage: "Phase 9 ready",
    activityLog: [createActivity("ShadowiumUI Phase 9 started")],
    past: [],
    future: [],
    interactionSnapshot: null,

    createNewProject: (name = "Untitled Game") => {
      const project = createStarterProject(name);
      set((state) => ({
        project,
        projectPath: null,
        projectRoot: null,
        isDirty: true,
        selectedObjectId: getActiveScene(project).objects[0]?.id ?? null,
        selectedObjectIds: getActiveScene(project).objects[0] ? [getActiveScene(project).objects[0].id] : [],
        selectedTileId: "",
        selectedTileBrush: { tileIds: [], columns: 1, rows: 1 },
        clipboardObjects: [],
        selectedAssetId: null,
        selectedRuleId: project.eventRules[0]?.id ?? null,
        selectedAnimationId: null,
        playState: "stopped",
        past: [],
        future: [],
        interactionSnapshot: null,
        statusMessage: `Created ${name}`,
        activityLog: appendActivity(state.activityLog, `Created project: ${name}`),
      }));
    },

    replaceProject: (project, path, root) => {
      const activeScene = getActiveScene(project);
      set((state) => ({
        project,
        projectPath: path,
        projectRoot: root,
        isDirty: false,
        selectedObjectId: activeScene.objects[0]?.id ?? null,
        selectedObjectIds: activeScene.objects[0] ? [activeScene.objects[0].id] : [],
        selectedTileId: project.tilePalette[0]?.id ?? "",
        selectedTileBrush: { tileIds: project.tilePalette[0] ? [project.tilePalette[0].id] : [], columns: 1, rows: 1 },
        clipboardObjects: [],
        selectedAssetId: project.assets[0]?.id ?? null,
        selectedRuleId: project.eventRules[0]?.id ?? null,
        selectedAnimationId: project.animations[0]?.id ?? null,
        playState: "stopped",
        past: [],
        future: [],
        interactionSnapshot: null,
        statusMessage: `Opened ${project.metadata.name}`,
        activityLog: appendActivity(state.activityLog, `Opened project: ${project.metadata.name}`),
      }));
    },

    markSaved: (path, root) => {
      set((state) => ({
        projectPath: path ?? state.projectPath,
        projectRoot: root === undefined ? state.projectRoot : root,
        isDirty: false,
        statusMessage: "Project saved",
        activityLog: appendActivity(state.activityLog, "Project saved"),
      }));
    },

    setStatus: (message, level = "info") => {
      set((state) => ({
        statusMessage: message,
        activityLog: appendActivity(state.activityLog, message, level),
      }));
    },
    clearActivityLog: () => set({ activityLog: [] }),
    setActiveTool: (activeTool) => set({ activeTool }),
    setActiveBottomTab: (activeBottomTab) => set({ activeBottomTab }),
    setPlayState: (playState) => {
      const message =
        playState === "playing"
          ? "Play Mode running"
          : playState === "paused"
            ? "Play Mode paused"
            : "Play Mode stopped";
      set((state) => ({
        playState,
        statusMessage: message,
        activityLog: appendActivity(state.activityLog, message, "runtime"),
      }));
    },
    setViewportZoom: (viewportZoom) => set({ viewportZoom }),
    toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
    toggleColliders: () => set((state) => ({ showColliders: !state.showColliders })),
    toggleSnap: () => set((state) => ({ snapToGrid: !state.snapToGrid })),
    setAssetViewMode: (assetViewMode) => set({ assetViewMode }),
    setAssetSearch: (assetSearch) => set({ assetSearch }),
    adjustPanelSize: (panel, delta) =>
      set((state) => ({
        panelSizes: {
          ...state.panelSizes,
          [panel]: clampPanelSize(panel, state.panelSizes[panel] + delta),
        },
      })),

    selectScene: (sceneId) => {
      const state = get();
      if (!state.project.scenes.some((scene) => scene.id === sceneId)) {
        return;
      }
      set({
        project: { ...state.project, activeSceneId: sceneId },
        selectedObjectId: null,
        selectedObjectIds: [],
        playState: "stopped",
      });
    },
    addScene: () => {
      const scene = createScene(createUniqueSceneName(get().project, "New Scene"));
      commitProject(`Added scene: ${scene.name}`, (draft) => {
        draft.scenes.push(scene);
        draft.activeSceneId = scene.id;
      });
      set({ selectedObjectId: null, selectedObjectIds: [], playState: "stopped" });
    },
    renameScene: (sceneId, name) => {
      const clean = name.trim();
      if (!clean) return;
      commitProject("Renamed scene", (draft) => {
        const scene = draft.scenes.find((candidate) => candidate.id === sceneId);
        if (scene) scene.name = clean;
      });
    },
    deleteScene: (sceneId) => {
      const state = get();
      if (state.project.scenes.length <= 1) {
        state.setStatus("A project must contain at least one scene", "warning");
        return;
      }
      const scene = state.project.scenes.find((candidate) => candidate.id === sceneId);
      if (!scene) return;
      const references = state.project.scenes.reduce((count, candidateScene) => count + candidateScene.objects.filter((object) => object.components.some((element) =>
        (element.type === "scene-exit" || element.type === "teleporter" || element.type === "ui-button") && String(element.settings.destinationSceneId ?? "") === sceneId,
      )).length, 0) + state.project.eventRules.reduce((count, rule) => count + rule.actions.filter((action) => action.type === "change-scene" && action.sceneId === sceneId).length, 0);
      if (references > 0 && !window.confirm(`Delete “${scene.name}”? ${references} scene reference${references === 1 ? "" : "s"} will be cleared.`)) return;
      commitProject(`Deleted scene: ${scene.name}`, (draft) => {
        draft.scenes = draft.scenes.filter((candidate) => candidate.id !== sceneId);
        const fallbackId = draft.scenes[0].id;
        if (draft.activeSceneId === sceneId) draft.activeSceneId = fallbackId;
        if (draft.settings.initialSceneId === sceneId || !draft.scenes.some((candidate) => candidate.id === draft.settings.initialSceneId)) {
          draft.settings.initialSceneId = fallbackId;
        }
        for (const candidateScene of draft.scenes) {
          if (candidateScene.defaultCameraId && !candidateScene.objects.some((object) => object.id === candidateScene.defaultCameraId)) candidateScene.defaultCameraId = null;
          for (const object of candidateScene.objects) {
            for (const element of object.components) {
              if ((element.type === "scene-exit" || element.type === "teleporter" || element.type === "ui-button") && element.settings.destinationSceneId === sceneId) {
                element.settings.destinationSceneId = "";
              }
            }
          }
        }
        for (const rule of draft.eventRules) for (const action of rule.actions) if (action.type === "change-scene" && action.sceneId === sceneId) action.sceneId = null;
      });
      set({ selectedObjectId: null, selectedObjectIds: [], playState: "stopped" });
    },
    updateSceneBackground: (sceneId, backgroundColor) => {
      commitProject("Changed scene background", (draft) => {
        const scene = draft.scenes.find((candidate) => candidate.id === sceneId);
        if (scene) scene.backgroundColor = backgroundColor;
      });
    },
    updateSceneSettings: (sceneId, patch) => {
      commitProject("Changed scene settings", (draft) => {
        const scene = draft.scenes.find((candidate) => candidate.id === sceneId);
        if (!scene) return;
        Object.assign(scene, patch);
      });
    },

    selectObject: (selectedObjectId, additive = false) => {
      if (!selectedObjectId) {
        set({ selectedObjectId: null, selectedObjectIds: [] });
        return;
      }
      if (!additive) {
        set({ selectedObjectId, selectedObjectIds: [selectedObjectId] });
        return;
      }
      const current = get().selectedObjectIds;
      const selectedObjectIds = current.includes(selectedObjectId)
        ? current.filter((id) => id !== selectedObjectId)
        : [...current, selectedObjectId];
      set({
        selectedObjectIds,
        selectedObjectId: selectedObjectIds.includes(selectedObjectId)
          ? selectedObjectId
          : selectedObjectIds[selectedObjectIds.length - 1] ?? null,
      });
    },
    setSelectedObjects: (objectIds, primaryId = null) => {
      const validIds = new Set(getActiveScene(get().project).objects.map((object) => object.id));
      const selectedObjectIds = [...new Set(objectIds)].filter((id) => validIds.has(id));
      set({
        selectedObjectIds,
        selectedObjectId: primaryId && selectedObjectIds.includes(primaryId) ? primaryId : selectedObjectIds[selectedObjectIds.length - 1] ?? null,
      });
    },

    selectAllObjects: () => {
      const scene = getActiveScene(get().project);
      const layerById = new Map(scene.layers.map((layer) => [layer.id, layer]));
      const ids = scene.objects
        .filter((object) => {
          const layer = layerById.get(object.layerId);
          return object.enabled && object.editorVisible !== false && !object.locked && layer?.visible !== false && layer?.locked !== true;
        })
        .map((object) => object.id);
      set({ selectedObjectIds: ids, selectedObjectId: ids[ids.length - 1] ?? null });
    },
    addObject: () => {
      const state = get();
      const scene = getActiveScene(state.project);
      const object = createGameObject(createUniqueObjectName(scene, "Game Object"));
      commitProject(`Added object: ${object.name}`, (draft) => {
        getActiveScene(draft).objects.push(object);
      });
      set({ selectedObjectId: object.id, selectedObjectIds: [object.id] });
    },
    addTilemapObject: () => {
      const state = get();
      const scene = getActiveScene(state.project);
      const object = createGameObject(createUniqueObjectName(scene, "World Tilemap"), 0, 0, "#4f9da6");
      object.layerId = "layer-ground";
      object.size = { width: 1024, height: 768 };
      object.components = [createComponentInstance("tilemap-renderer")];
      commitProject(`Added tilemap: ${object.name}`, (draft) => getActiveScene(draft).objects.push(object));
      set({ selectedObjectId: object.id, selectedObjectIds: [object.id], activeBottomTab: "world", activeTool: "tile-paint" });
    },
    addObjectFromAsset: (assetId, x, y) => {
      const state = get();
      const asset = state.project.assets.find((candidate) => candidate.id === assetId);
      if (!asset) return;
      const scene = getActiveScene(state.project);
      const baseName = asset.name.replace(/\.[^.]+$/, "") || "Sprite";
      const object = createGameObject(createUniqueObjectName(scene, baseName), x, y, "#78909c");
      object.size = {
        width: Math.max(1, asset.frames[0]?.width ?? asset.width),
        height: Math.max(1, asset.frames[0]?.height ?? asset.height),
      };
      const renderer = object.components[0];
      renderer.settings.assetId = asset.id;
      renderer.settings.frameId = asset.frames[0]?.id ?? "";
      commitProject(`Created ${object.name} from ${asset.name}`, (draft) => {
        getActiveScene(draft).objects.push(object);
      });
      set({ selectedObjectId: object.id, selectedObjectIds: [object.id] });
    },
    addObjectFromPrefab: (prefabId, x = 0, y = 0) => {
      const state = get();
      const template = state.project.prefabs.find((candidate) => candidate.id === prefabId);
      if (!template) return;
      const scene = getActiveScene(state.project);
      const sourceRoot = template.object;
      const sourceChildren = Array.isArray(template.children) ? template.children : [];
      const allSources = [sourceRoot, ...sourceChildren];
      const idMap = new Map<string, string>();
      const copies = allSources.map((source, index) => {
        const copy = regenerateObjectIds(source);
        idMap.set(source.id, copy.id);
        if (index === 0) {
          copy.name = createUniqueObjectName(scene, template.name);
          copy.transform.position = { x, y };
          copy.prefabId = template.id;
          copy.prefabOverrides = ["transform.position", "name"];
        }
        return copy;
      });
      const root = copies[0];
      for (let index = 1; index < copies.length; index += 1) {
        const source = allSources[index];
        const child = copies[index];
        child.parentId = source.parentId ? idMap.get(source.parentId) ?? root.id : root.id;
        child.prefabId = template.id;
        child.prefabOverrides = [];
      }
      commitProject(`Created Prefab instance: ${template.name}`, (draft) => {
        getActiveScene(draft).objects.push(...copies);
      });
      set({ selectedObjectId: root.id, selectedObjectIds: copies.map((object) => object.id) });
    },
    duplicateSelectedObject: () => {
      const state = get();
      const scene = getActiveScene(state.project);
      const ids = state.selectedObjectIds.length > 0 ? state.selectedObjectIds : state.selectedObjectId ? [state.selectedObjectId] : [];
      const originals = scene.objects.filter((object) => ids.includes(object.id));
      if (originals.length === 0) return;
      const duplicates = originals.map((original) => {
        const duplicate = regenerateObjectIds(original);
        duplicate.name = createUniqueObjectName(scene, `${original.name} Copy`);
        duplicate.transform.position.x += 24;
        duplicate.transform.position.y += 24;
        return duplicate;
      });
      commitProject(`Duplicated ${duplicates.length} object${duplicates.length === 1 ? "" : "s"}`, (draft) => {
        getActiveScene(draft).objects.push(...duplicates);
      });
      set({ selectedObjectId: duplicates[duplicates.length - 1]?.id ?? null, selectedObjectIds: duplicates.map((object) => object.id) });
    },
    copySelectedObjects: () => {
      const state = get();
      const ids = state.selectedObjectIds.length > 0 ? state.selectedObjectIds : state.selectedObjectId ? [state.selectedObjectId] : [];
      const scene = getActiveScene(state.project);
      const copiedIds = new Set(ids);
      for (const id of ids) for (const descendantId of collectDescendantIds(scene.objects, id)) copiedIds.add(descendantId);
      const copies = scene.objects.filter((object) => copiedIds.has(object.id)).map(cloneObject);
      set({ clipboardObjects: copies, statusMessage: `Copied ${copies.length} object${copies.length === 1 ? "" : "s"}` });
    },
    pasteObjects: () => {
      const state = get();
      if (state.clipboardObjects.length === 0) return;
      const scene = getActiveScene(state.project);
      const idMap = new Map<string, string>();
      const pasted = state.clipboardObjects.map((source) => {
        const copy = regenerateObjectIds(source);
        idMap.set(source.id, copy.id);
        copy.name = createUniqueObjectName(scene, `${source.name} Copy`);
        copy.transform.position.x += 32;
        copy.transform.position.y += 32;
        return copy;
      });
      pasted.forEach((copy, index) => {
        const sourceParentId = state.clipboardObjects[index].parentId;
        copy.parentId = sourceParentId ? idMap.get(sourceParentId) ?? null : null;
      });
      commitProject(`Pasted ${pasted.length} object${pasted.length === 1 ? "" : "s"}`, (draft) => getActiveScene(draft).objects.push(...pasted));
      set({ selectedObjectIds: pasted.map((object) => object.id), selectedObjectId: pasted[pasted.length - 1]?.id ?? null });
    },
    groupSelectedObjects: () => {
      const state = get();
      if (state.selectedObjectIds.length < 2) return;
      const scene = getActiveScene(state.project);
      const selected = scene.objects.filter((object) => state.selectedObjectIds.includes(object.id));
      if (selected.length < 2) return;
      const group = createGameObject(createUniqueObjectName(scene, "Object Group"), 0, 0, "#607d8b");
      group.components = [];
      group.size = { width: 48, height: 48 };
      group.transform.position = {
        x: selected.reduce((sum, object) => sum + object.transform.position.x, 0) / selected.length,
        y: selected.reduce((sum, object) => sum + object.transform.position.y, 0) / selected.length,
      };
      commitProject("Grouped selected objects", (draft) => {
        const draftScene = getActiveScene(draft);
        draftScene.objects.push(group);
        for (const object of draftScene.objects) if (state.selectedObjectIds.includes(object.id)) object.parentId = group.id;
      });
      set({ selectedObjectId: group.id, selectedObjectIds: [group.id] });
    },
    reparentSelectedObject: (parentId) => {
      const state = get();
      const objectId = state.selectedObjectId;
      if (!objectId || parentId === objectId) return;
      const descendants = collectDescendantIds(getActiveScene(state.project).objects, objectId);
      if (parentId && descendants.has(parentId)) {
        state.setStatus("An object cannot be parented to one of its descendants", "warning");
        return;
      }
      commitProject("Changed object parent", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.parentId = parentId;
      });
    },
    moveSelectedToLayer: (layerId) => {
      const state = get();
      const ids = state.selectedObjectIds.length > 0 ? state.selectedObjectIds : state.selectedObjectId ? [state.selectedObjectId] : [];
      commitProject("Moved objects to scene layer", (draft) => {
        for (const object of getActiveScene(draft).objects) if (ids.includes(object.id)) object.layerId = layerId;
      });
    },
    deleteSelectedObject: () => {
      const state = get();
      const ids = state.selectedObjectIds.length > 0 ? state.selectedObjectIds : state.selectedObjectId ? [state.selectedObjectId] : [];
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      commitProject(`Deleted ${ids.length} object${ids.length === 1 ? "" : "s"}`, (draft) => {
        const scene = getActiveScene(draft);
        let changed = true;
        while (changed) {
          changed = false;
          for (const object of scene.objects) {
            if (object.parentId && idSet.has(object.parentId) && !idSet.has(object.id)) {
              idSet.add(object.id);
              changed = true;
            }
          }
        }
        scene.objects = scene.objects.filter((object) => !idSet.has(object.id));
        draft.eventRules = draft.eventRules.filter(
          (rule) => !idSet.has(rule.trigger.sourceObjectId ?? "") && !idSet.has(rule.trigger.targetObjectId ?? ""),
        );
      });
      set({ selectedObjectId: null, selectedObjectIds: [] });
    },
    renameSelectedObject: (name) => {
      const clean = name.trim();
      const objectId = get().selectedObjectId;
      if (!objectId || !clean) return;
      commitProject("Renamed object", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.name = clean;
      });
    },
    setSelectedObjectType: (type) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject(`Changed Game Object Type to ${type}`, (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.objectType = type;
      });
    },
    setSelectedCustomObjectType: (customTypeId) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Changed custom Game Object Type", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (!object) return;
        object.objectType = "custom";
        object.customTypeId = customTypeId;
      });
    },
    addCustomGameObjectType: () => {
      const definition = {
        id: createId("game-object-type"),
        name: `Custom Type ${get().project.customGameObjectTypes.length + 1}`,
        description: "Project-specific Game Object type with scoped Component recommendations.",
        slots: ["rendering", "physics", "gameplay", "scripting"] as ComponentSlot[],
        recommended: ["sprite-renderer"] as ComponentType[],
        required: [] as ComponentType[],
        hiddenCategories: [] as ComponentCategory[],
      };
      commitProject(`Created Game Object Type: ${definition.name}`, (draft) => draft.customGameObjectTypes.push(definition));
    },
    updateCustomGameObjectType: (typeId, patch) => {
      commitProject("Updated custom Game Object Type", (draft) => {
        const definition = draft.customGameObjectTypes.find((candidate) => candidate.id === typeId);
        if (definition) Object.assign(definition, patch);
      });
    },
    deleteCustomGameObjectType: (typeId) => {
      commitProject("Deleted custom Game Object Type", (draft) => {
        draft.customGameObjectTypes = draft.customGameObjectTypes.filter((candidate) => candidate.id !== typeId);
        for (const scene of draft.scenes) for (const object of scene.objects) if (object.customTypeId === typeId) object.customTypeId = null;
        for (const prefab of draft.prefabs) if (prefab.object.customTypeId === typeId) prefab.object.customTypeId = null;
      });
    },
    toggleSelectedObject: () => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Toggled object activation", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.enabled = !object.enabled;
      });
    },
    toggleSelectedEditorVisible: () => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Toggled editor visibility", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.editorVisible = !object.editorVisible;
      });
    },
    toggleSelectedRuntimeVisible: () => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Toggled runtime renderer", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.runtimeVisible = !object.runtimeVisible;
      });
    },
    toggleSelectedCollision: () => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Toggled collision", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.collisionEnabled = !object.collisionEnabled;
      });
    },
    toggleSelectedLogic: () => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Toggled object logic", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.logicEnabled = !object.logicEnabled;
      });
    },
    toggleSelectedLocked: () => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Toggled object lock", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.locked = !object.locked;
      });
    },
    updateSelectedTransform: (partial) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Changed object transform", (draft) => {
        const scene = getActiveScene(draft);
        const object = scene.objects.find((candidate) => candidate.id === objectId);
        if (!object) return;
        if (partial.position) moveObjectAndDescendants(scene.objects, objectId, partial.position.x, partial.position.y);
        if (partial.scale) object.transform.scale = { ...object.transform.scale, ...partial.scale };
        if (partial.pivot) object.transform.pivot = { ...object.transform.pivot, ...partial.pivot };
        if (partial.rotation !== undefined) object.transform.rotation = partial.rotation;
        if (object.prefabId) object.prefabOverrides = [...new Set([...(object.prefabOverrides ?? []), "transform"])];
      });
    },
    updateSelectedPosition: (x, y) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Changed object position", (draft) => {
        const scene = getActiveScene(draft);
        const object = scene.objects.find((candidate) => candidate.id === objectId);
        if (!object) return;
        moveObjectAndDescendants(scene.objects, objectId, x ?? object.transform.position.x, y ?? object.transform.position.y);
        if (object.prefabId) object.prefabOverrides = [...new Set([...(object.prefabOverrides ?? []), "transform.position"])];
      });
    },
    updateSelectedSize: (width, height) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Changed object size", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (!object) return;
        if (width !== undefined) object.size.width = Math.max(1, width);
        if (height !== undefined) object.size.height = Math.max(1, height);
        if (object.prefabId) object.prefabOverrides = [...new Set([...(object.prefabOverrides ?? []), "size"])];
      });
    },
    updateSelectedColor: (editorColor) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Changed editor colour", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) {
          object.editorColor = editorColor;
          if (object.prefabId) object.prefabOverrides = [...new Set([...(object.prefabOverrides ?? []), "editorColor"])];
        }
      });
    },
    updateSelectedTags: (tags) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Changed object tags", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.tags = tags;
      });
    },

    setSelectedTile: (selectedTileId) => set({ selectedTileId, selectedTileBrush: { tileIds: selectedTileId ? [selectedTileId] : [], columns: 1, rows: 1 } }),
    setSelectedTileBrush: (tileIds, columns = 1, rows = 1) => set({ selectedTileId: tileIds[0] ?? "", selectedTileBrush: { tileIds, columns: Math.max(1, columns), rows: Math.max(1, rows) } }),
    paintTileCell: (objectId, column, row, tileId) => {
      const state = get();
      const object = getActiveScene(state.project).objects.find((candidate) => candidate.id === objectId);
      const element = object?.components.find((candidate) => candidate.type === "tilemap-renderer");
      if (!element) return;
      const key = `${column},${row}`;
      commitProject(tileId ? "Painted tile" : "Erased tile", (draft) => {
        const target = getActiveScene(draft).objects.find((candidate) => candidate.id === objectId)
          ?.components.find((candidate) => candidate.type === "tilemap-renderer");
        if (!target) return;
        let cells: Record<string, string> = {};
        try { cells = JSON.parse(String(target.settings.cells ?? "{}")) as Record<string, string>; } catch { cells = {}; }
        if (tileId) cells[key] = tileId;
        else delete cells[key];
        updateAutotileNeighbours(draft.tilePalette, cells, column, row);
        target.settings.cells = JSON.stringify(cells);
      });
    },
    paintTileBrush: (objectId, column, row, erase = false) => {
      const brush = get().selectedTileBrush;
      if (!erase && brush.tileIds.length === 0) return;
      commitProject(erase ? "Erased tile stamp" : "Painted tile stamp", (draft) => {
        const target = getActiveScene(draft).objects.find((candidate) => candidate.id === objectId)
          ?.components.find((candidate) => candidate.type === "tilemap-renderer");
        if (!target) return;
        let cells: Record<string, string> = {};
        try { cells = JSON.parse(String(target.settings.cells ?? "{}")) as Record<string, string>; } catch { cells = {}; }
        const columns = Math.max(1, brush.columns);
        const rows = Math.max(1, brush.rows);
        for (let y = 0; y < rows; y += 1) {
          for (let x = 0; x < columns; x += 1) {
            const key = `${column + x},${row + y}`;
            const tileId = brush.tileIds[y * columns + x];
            if (erase || !tileId) delete cells[key];
            else cells[key] = tileId;
            updateAutotileNeighbours(draft.tilePalette, cells, column + x, row + y);
          }
        }
        target.settings.cells = JSON.stringify(cells);
      });
    },
    addTilesetFrames: (assetId, frames, columns, rows) => {
      const asset = get().project.assets.find((candidate) => candidate.id === assetId);
      if (!asset || asset.kind === "audio" || frames.length === 0) return [];
      const existingFramesByRegion = new Map(asset.frames.map((frame) => [`${frame.x}:${frame.y}:${frame.width}:${frame.height}`, frame]));
      const resolvedFrames = frames.map((frame) => existingFramesByRegion.get(`${frame.x}:${frame.y}:${frame.width}:${frame.height}`) ?? frame);
      const paletteEntries = resolvedFrames.map((frame): TilePaletteEntry => ({
        id: createId("tile"),
        name: `${asset.name.replace(/\.[^.]+$/, "")} ${frame.x},${frame.y}`,
        color: "#78909c",
        assetId,
        frameId: frame.id,
        collision: "none",
        tags: ["tileset", "atlas-cell"],
        terrainType: "",
        terrainMask: null,
      }));
      commitProject(`Added ${frames.length} selected tiles from ${asset.name}`, (draft) => {
        const targetAsset = draft.assets.find((candidate) => candidate.id === assetId);
        if (!targetAsset) return;
        targetAsset.kind = "tileset";
        const existing = new Set(targetAsset.frames.map((frame) => `${frame.x}:${frame.y}:${frame.width}:${frame.height}`));
        for (const frame of resolvedFrames) if (!existing.has(`${frame.x}:${frame.y}:${frame.width}:${frame.height}`)) targetAsset.frames.push(frame);
        targetAsset.tileWidth = resolvedFrames[0]?.width ?? targetAsset.tileWidth ?? 32;
        targetAsset.tileHeight = resolvedFrames[0]?.height ?? targetAsset.tileHeight ?? 32;
        draft.tilePalette.push(...paletteEntries);
      });
      const tileIds = paletteEntries.map((entry) => entry.id);
      set({ selectedTileId: tileIds[0] ?? "", selectedTileBrush: { tileIds, columns: Math.max(1, columns), rows: Math.max(1, rows) }, activeBottomTab: "world" });
      return tileIds;
    },
    fillTilemap: (objectId, tileId) => {
      commitProject(tileId ? "Filled tilemap" : "Cleared tilemap", (draft) => {
        const target = getActiveScene(draft).objects.find((candidate) => candidate.id === objectId)
          ?.components.find((candidate) => candidate.type === "tilemap-renderer");
        if (!target) return;
        const width = Math.max(1, Number(target.settings.mapWidth ?? 32));
        const height = Math.max(1, Number(target.settings.mapHeight ?? 24));
        const cells: Record<string, string> = {};
        if (tileId) for (let row = 0; row < height; row += 1) for (let column = 0; column < width; column += 1) cells[`${column},${row}`] = tileId;
        target.settings.cells = JSON.stringify(cells);
      });
    },
    addTilesFromAsset: (assetId) => {
      const asset = get().project.assets.find((candidate) => candidate.id === assetId);
      if (!asset || asset.kind === "audio" || asset.frames.length === 0) return;
      const existing = new Set(get().project.tilePalette.map((tile) => `${tile.assetId}:${tile.frameId}`));
      const entries: TilePaletteEntry[] = asset.frames
        .filter((frame) => !existing.has(`${asset.id}:${frame.id}`))
        .map((frame, index) => ({
          id: createId("tile"),
          name: `${asset.name.replace(/\.[^.]+$/, "")} ${index + 1}`,
          color: "#78909c",
          assetId: asset.id,
          frameId: frame.id,
          collision: "none",
          tags: ["tileset"],
          terrainType: "",
          terrainMask: null,
        }));
      if (entries.length === 0) { get().setStatus("All frames from this asset are already in the tile palette", "warning"); return; }
      commitProject(`Added ${entries.length} tiles from ${asset.name}`, (draft) => {
        const targetAsset = draft.assets.find((candidate) => candidate.id === assetId);
        if (targetAsset) targetAsset.kind = "tileset";
        draft.tilePalette.push(...entries);
      });
      set({ selectedTileId: entries[0].id, selectedTileBrush: { tileIds: [entries[0].id], columns: 1, rows: 1 }, activeBottomTab: "world" });
    },
    addColorTile: () => {
      const tile: TilePaletteEntry = { id: createId("tile"), name: "New Tile", color: "#78909c", assetId: "", frameId: "", collision: "none", tags: [], terrainType: "", terrainMask: null };
      commitProject("Added colour tile", (draft) => draft.tilePalette.push(tile));
      set({ selectedTileId: tile.id, selectedTileBrush: { tileIds: [tile.id], columns: 1, rows: 1 } });
    },
    updateTilePaletteEntry: (tileId, patch) => {
      commitProject("Updated tile palette", (draft) => {
        const tile = draft.tilePalette.find((candidate) => candidate.id === tileId);
        if (tile) Object.assign(tile, patch);
      });
    },
    deleteTilePaletteEntry: (tileId) => {
      commitProject("Deleted palette tile", (draft) => {
        draft.tilePalette = draft.tilePalette.filter((tile) => tile.id !== tileId);
        for (const scene of draft.scenes) for (const object of scene.objects) {
          const tilemap = object.components.find((element) => element.type === "tilemap-renderer");
          if (!tilemap) continue;
          let cells: Record<string, string> = {};
          try { cells = JSON.parse(String(tilemap.settings.cells ?? "{}")) as Record<string, string>; } catch { continue; }
          for (const key of Object.keys(cells)) if (cells[key] === tileId) delete cells[key];
          tilemap.settings.cells = JSON.stringify(cells);
        }
      });
      const next = get().project.tilePalette.find((tile) => tile.id !== tileId)?.id ?? "";
      set({ selectedTileId: next, selectedTileBrush: { tileIds: next ? [next] : [], columns: 1, rows: 1 } });
    },
    addSceneLayer: () => {
      const layerId = createId("layer");
      commitProject("Added scene layer", (draft) => {
        const scene = getActiveScene(draft);
        scene.layers.push({ id: layerId, name: `Layer ${scene.layers.length + 1}`, visible: true, locked: false, renderOrder: scene.layers.length * 10, parallaxX: 1, parallaxY: 1, editorColor: "#78909c", runtimeIncluded: true });
      });
    },
    updateSceneLayer: (layerId, patch) => {
      commitProject("Updated scene layer", (draft) => {
        const layer = getActiveScene(draft).layers.find((candidate) => candidate.id === layerId);
        if (layer) Object.assign(layer, patch);
      });
    },
    deleteSceneLayer: (layerId) => {
      const scene = getActiveScene(get().project);
      if (scene.layers.length <= 1) return;
      commitProject("Deleted scene layer", (draft) => {
        const draftScene = getActiveScene(draft);
        draftScene.layers = draftScene.layers.filter((layer) => layer.id !== layerId);
        const fallbackLayer = draftScene.layers.find((layer) => layer.id === "layer-gameplay") ?? draftScene.layers[0];
        for (const object of draftScene.objects) if (object.layerId === layerId) object.layerId = fallbackLayer.id;
      });
    },

    addComponent: (type) => {
      const state = get();
      const object = getSelectedObject(state.project, state.selectedObjectId);
      if (!object) return;
      const definition = getComponentDefinition(type);
      if (definition.supportedObjectTypes?.length && !definition.supportedObjectTypes.includes(object.objectType) && object.objectType !== "custom") {
        get().setStatus(`${definition.name} is an advanced combination for ${object.objectType}; it was added intentionally.`, "warning");
      }
      if (definition.allowMultiple !== true && object.components.some((component) => component.type === type)) {
        get().setStatus("That Component is already attached", "warning");
        return;
      }
      const conflict = definition.incompatibleWith?.find((candidate) => object.components.some((component) => component.type === candidate));
      if (conflict) {
        get().setStatus(`${definition.name} conflicts with ${getComponentDefinition(conflict).name}`, "warning");
        return;
      }
      commitProject(`Added Component: ${definition.name}`, (draft) => {
        const target = getSelectedObject(draft, state.selectedObjectId);
        if (!target) return;
        for (const dependency of definition.dependencies) {
          if (!target.components.some((component) => component.type === dependency)) target.components.push(createComponentInstance(dependency));
        }
        target.components.push(createComponentInstance(type));
      });
    },
    applyCameraPreset: (preset) => {
      const state = get();
      if (!state.selectedObjectId) return;
      commitProject(`Applied camera preset: ${preset}`, (draft) => {
        const object = getSelectedObject(draft, state.selectedObjectId);
        if (!object) return;
        object.objectType = "camera";
        const ensure = (type: ComponentType) => {
          let component = object.components.find((candidate) => candidate.type === type);
          if (!component) { component = createComponentInstance(type); object.components.push(component); }
          component.enabled = true;
          return component;
        };
        const camera = ensure("camera");
        const follow = ensure("camera-follow");
        const smoothing = ensure("camera-smoothing");
        if (preset === "centered") {
          follow.settings.mode = "centered";
          smoothing.settings.horizontal = 0;
          smoothing.settings.vertical = 0;
          camera.settings.deadZoneWidth = 0; camera.settings.deadZoneHeight = 0;
        } else if (preset === "smooth") {
          follow.settings.mode = "smooth";
          smoothing.settings.horizontal = 0.12;
          smoothing.settings.vertical = 0.12;
          camera.settings.deadZoneWidth = 0; camera.settings.deadZoneHeight = 0;
        } else if (preset === "platformer") {
          follow.settings.mode = "platformer";
          smoothing.settings.horizontal = 0.1;
          smoothing.settings.vertical = 0.18;
          camera.settings.deadZoneWidth = 72; camera.settings.deadZoneHeight = 104;
          const look = ensure("camera-look-ahead");
          look.settings.source = "movement"; look.settings.horizontal = 120; look.settings.vertical = 24;
        } else {
          follow.settings.mode = "smooth";
          smoothing.settings.horizontal = 0.1;
          smoothing.settings.vertical = 0.1;
          const look = ensure("camera-look-ahead");
          look.settings.source = "movement"; look.settings.horizontal = 150; look.settings.vertical = 80; look.settings.response = 0.14;
        }
      });
    },
    removeComponent: (componentId) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Removed Component", (draft) => {
        const object = getSelectedObject(draft, objectId);
        if (object) object.components = object.components.filter((element) => element.id !== componentId);
      });
    },
    toggleComponent: (componentId) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Toggled Component", (draft) => {
        const element = getSelectedObject(draft, objectId)?.components.find((candidate) => candidate.id === componentId);
        if (element) element.enabled = !element.enabled;
      });
    },
    updateComponentSetting: (componentId, key, value) => {
      const objectId = get().selectedObjectId;
      if (!objectId) return;
      commitProject("Changed Component setting", (draft) => {
        const object = getSelectedObject(draft, objectId);
        const element = object?.components.find((candidate) => candidate.id === componentId);
        if (element) {
          element.settings[key] = value;
          if (object?.prefabId) object.prefabOverrides = [...new Set([...(object.prefabOverrides ?? []), `${element.type}.${key}`])];
        }
      });
    },

    addImportedAssets: (assets) => {
      if (assets.length === 0) return;
      commitProject(`Imported ${assets.length} asset${assets.length === 1 ? "" : "s"}`, (draft) => {
        draft.assets.push(...assets);
      });
      set({ selectedAssetId: assets[0].id, activeBottomTab: "assets" });
    },
    selectAsset: (selectedAssetId) => set({ selectedAssetId }),
    renameAsset: (assetId, name) => {
      const clean = name.trim();
      if (!clean) return;
      commitProject("Renamed asset", (draft) => {
        const asset = draft.assets.find((candidate) => candidate.id === assetId);
        if (asset) asset.name = clean;
      });
    },
    removeAsset: (assetId) => {
      commitProject("Removed asset", (draft) => {
        draft.assets = draft.assets.filter((asset) => asset.id !== assetId);
        draft.animations = draft.animations.filter((clip) => clip.assetId !== assetId);
        for (const scene of draft.scenes) {
          for (const object of scene.objects) {
            const renderer = object.components.find((element) => element.type === "sprite-renderer");
            if (renderer?.settings.assetId === assetId) {
              renderer.settings.assetId = "";
              renderer.settings.frameId = "";
            }
          }
        }
      });
      set((state) => ({ selectedAssetId: state.selectedAssetId === assetId ? null : state.selectedAssetId }));
    },
    setAssetFrames: (assetId, frames) => {
      commitProject("Updated sprite-sheet slices", (draft) => {
        const asset = draft.assets.find((candidate) => candidate.id === assetId);
        if (asset) {
          asset.kind = frames.length > 1 ? "sprite-sheet" : "image";
          asset.frames = frames;
        }
      });
    },
    updateAssetFrame: (assetId, frameId, patch) => {
      commitProject("Updated sprite frame", (draft) => {
        const frame = draft.assets.find((candidate) => candidate.id === assetId)?.frames.find((candidate) => candidate.id === frameId);
        if (frame) Object.assign(frame, patch);
      });
    },
    setAssetScalingRegion: (assetId, region) => {
      commitProject("Updated sprite scaling region", (draft) => {
        const asset = draft.assets.find((candidate) => candidate.id === assetId);
        if (asset) asset.scalingRegion = { ...region };
      });
    },

    createAnimation: (assetId, frameIds) => {
      const state = get();
      const asset = state.project.assets.find((candidate) => candidate.id === assetId);
      if (!asset || asset.frames.length === 0) return;
      const chosen = frameIds?.length ? frameIds : asset.frames.map((frame) => frame.id);
      const clip: AnimationClip = {
        id: createId("clip"),
        name: createUniqueAnimationName(state.project, `${asset.name.replace(/\.[^.]+$/, "")} Animation`),
        assetId,
        loop: true,
        pingPong: false,
        framesPerSecond: 8,
        frames: chosen.map((frameId) => ({ frameId, durationMs: 125, rootMotionX: 0, rootMotionY: 0 })),
        category: "Uncategorized",
        tags: [],
        rootMotionMode: "ignore",
        events: [],
      };
      commitProject(`Created animation: ${clip.name}`, (draft) => {
        draft.animations.push(clip);
      });
      set({ selectedAnimationId: clip.id, activeBottomTab: "animations" });
    },
    commitFramesAndCreateAnimation: (assetId, frames, name, fps = 8) => {
      const state = get();
      if (frames.length === 0) return null;
      const asset = state.project.assets.find((candidate) => candidate.id === assetId);
      if (!asset) return null;
      const clipId = createId("clip");
      const clipName = createUniqueAnimationName(state.project, name.trim() || `${asset.name.replace(/\.[^.]+$/, "")} Animation`);
      const safeFps = Math.max(1, Math.min(120, Number(fps) || 8));
      commitProject(`Created animation: ${clipName}`, (draft) => {
        const draftAsset = draft.assets.find((candidate) => candidate.id === assetId);
        if (!draftAsset) return;
        draftAsset.kind = frames.length > 1 ? "sprite-sheet" : "image";
        draftAsset.frames = frames.map((frame) => ({ ...frame, sockets: [...(frame.sockets ?? [])], collisionPolygon: frame.collisionPolygon?.map((point) => ({ ...point })) }));
        draft.animations.push({
          id: clipId, name: clipName, assetId, loop: true, pingPong: false, framesPerSecond: safeFps,
          frames: frames.map((frame) => ({ frameId: frame.id, durationMs: Math.round(1000 / safeFps), rootMotionX: 0, rootMotionY: 0 })),
          category: "Uncategorized", tags: [], rootMotionMode: "ignore", events: [],
        });
      });
      set({ selectedAnimationId: clipId, activeBottomTab: "animations" });
      return clipId;
    },
    createNamedAnimation: (assetId, name, frameIds, fps = 8) => {
      const state = get();
      const asset = state.project.assets.find((candidate) => candidate.id === assetId);
      const chosen = frameIds.filter((frameId) => asset?.frames.some((frame) => frame.id === frameId));
      if (!asset || chosen.length === 0) return null;
      const clip: AnimationClip = {
        id: createId("clip"),
        name: createUniqueAnimationName(state.project, name.trim() || `${asset.name.replace(/\.[^.]+$/, "")} Animation`),
        assetId, loop: true, pingPong: false, framesPerSecond: Math.max(1, fps),
        frames: chosen.map((frameId) => ({ frameId, durationMs: Math.max(1, Math.round(1000 / Math.max(1, fps))), rootMotionX: 0, rootMotionY: 0 })),
        category: "Uncategorized", tags: [], rootMotionMode: "ignore", events: [],
      };
      commitProject(`Created animation: ${clip.name}`, (draft) => { draft.animations.push(clip); });
      set({ selectedAnimationId: clip.id, activeBottomTab: "animations" });
      return clip.id;
    },
    createDirectionalAnimationSet: (assetId, frames, baseName, fps = 8) => {
      if (frames.length === 0) return;
      const rows = [...new Set(frames.map((frame) => frame.y))].sort((a, b) => a - b);
      const directionNames = ["Down", "Left", "Right", "Up"];
      const clips: AnimationClip[] = [];
      const directions: Record<string, string> = {};
      commitProject(`Created directional animation set: ${baseName}`, (draft) => {
        const asset = draft.assets.find((candidate) => candidate.id === assetId);
        if (!asset) return;
        asset.frames = frames.map((frame) => ({ ...frame }));
        rows.slice(0, 4).forEach((rowY, rowIndex) => {
          const rowFrames = frames.filter((frame) => frame.y === rowY).sort((left, right) => left.x - right.x);
          if (!rowFrames.length) return;
          const direction = directionNames[rowIndex] ?? `Row ${rowIndex + 1}`;
          const clipId = createId("clip");
          clips.push({ id: clipId, name: createUniqueAnimationName(draft, `${baseName} ${direction}`), assetId, loop: true, pingPong: false, framesPerSecond: Math.max(1, fps), frames: rowFrames.map((frame) => ({ frameId: frame.id, durationMs: Math.round(1000 / Math.max(1, fps)), rootMotionX: 0, rootMotionY: 0 })), category: "Character", tags: [baseName.toLowerCase(), direction.toLowerCase()], rootMotionMode: "ignore", events: [] });
          directions[direction.toLowerCase()] = clipId;
        });
        draft.animations.push(...clips);
        draft.animationSets.push({ id: createId("animation-set"), name: baseName, assetId, directions, states: { [baseName.toLowerCase()]: { ...directions } }, defaultState: baseName.toLowerCase(), builtIn: false });
      });
      set({ selectedAnimationId: clips[0]?.id ?? null, activeBottomTab: "animations" });
    },
    selectAnimation: (selectedAnimationId) => set({ selectedAnimationId }),
    updateAnimation: (clipId, patch) => {
      commitProject("Updated animation clip", (draft) => {
        const clip = draft.animations.find((candidate) => candidate.id === clipId);
        if (clip) Object.assign(clip, patch);
      });
    },
    deleteAnimation: (clipId) => {
      commitProject("Deleted animation clip", (draft) => {
        draft.animations = draft.animations.filter((clip) => clip.id !== clipId);
        for (const scene of draft.scenes) {
          for (const object of scene.objects) {
            for (const element of object.components) {
              if (!["directional-animation", "animated-sprite", "animation-state-machine"].includes(element.type)) continue;
              for (const [key, value] of Object.entries(element.settings)) {
                if (value === clipId) element.settings[key] = "";
              }
            }
          }
        }
        for (const set of draft.animationSets) {
          for (const [key, value] of Object.entries(set.directions)) if (value === clipId) delete set.directions[key];
          for (const state of Object.values(set.states ?? {})) for (const [key, value] of Object.entries(state)) if (value === clipId) delete state[key];
        }
      });
      set((state) => ({ selectedAnimationId: state.selectedAnimationId === clipId ? null : state.selectedAnimationId }));
    },

    addRule: () => {
      const rule = createEventRule();
      commitProject("Added event rule", (draft) => draft.eventRules.push(rule));
      set({ selectedRuleId: rule.id, activeBottomTab: "events" });
    },
    selectRule: (selectedRuleId) => set({ selectedRuleId }),
    updateRule: (ruleId, patch) => {
      commitProject("Updated event rule", (draft) => {
        const rule = draft.eventRules.find((candidate) => candidate.id === ruleId);
        if (rule) Object.assign(rule, patch);
      });
    },
    deleteRule: (ruleId) => {
      commitProject("Deleted event rule", (draft) => {
        draft.eventRules = draft.eventRules.filter((rule) => rule.id !== ruleId);
      });
      set((state) => ({ selectedRuleId: state.selectedRuleId === ruleId ? null : state.selectedRuleId }));
    },
    addCondition: (ruleId, type = "always") => {
      const condition = createCondition(type);
      commitProject("Added event condition", (draft) => {
        draft.eventRules.find((rule) => rule.id === ruleId)?.conditions.push(condition);
      });
    },
    updateCondition: (ruleId, conditionId, patch) => {
      commitProject("Updated event condition", (draft) => {
        const condition = draft.eventRules
          .find((rule) => rule.id === ruleId)
          ?.conditions.find((candidate) => candidate.id === conditionId);
        if (condition) Object.assign(condition, patch);
      });
    },
    removeCondition: (ruleId, conditionId) => {
      commitProject("Removed event condition", (draft) => {
        const rule = draft.eventRules.find((candidate) => candidate.id === ruleId);
        if (rule) rule.conditions = rule.conditions.filter((condition) => condition.id !== conditionId);
      });
    },
    addAction: (ruleId, type = "debug-message") => {
      const action = createAction(type);
      commitProject("Added event action", (draft) => {
        draft.eventRules.find((rule) => rule.id === ruleId)?.actions.push(action);
      });
    },
    updateAction: (ruleId, actionId, patch) => {
      commitProject("Updated event action", (draft) => {
        const action = draft.eventRules
          .find((rule) => rule.id === ruleId)
          ?.actions.find((candidate) => candidate.id === actionId);
        if (action) Object.assign(action, patch);
      });
    },
    removeAction: (ruleId, actionId) => {
      commitProject("Removed event action", (draft) => {
        const rule = draft.eventRules.find((candidate) => candidate.id === ruleId);
        if (rule) rule.actions = rule.actions.filter((action) => action.id !== actionId);
      });
    },

    saveSelectedAsPrefab: () => {
      const state = get();
      const object = getSelectedObject(state.project, state.selectedObjectId);
      if (!object) return;
      const scene = getActiveScene(state.project);
      const descendantIds = new Set(collectDescendantIds(scene.objects, object.id));
      const nestedChildren = scene.objects
        .filter((candidate) => descendantIds.has(candidate.id))
        .map((candidate) => ({ ...cloneObject(candidate), prefabId: null, prefabOverrides: [] }));
      const template: PrefabDocument = {
        id: createId("prefab"),
        name: object.name,
        description: `Reusable Prefab created from ${object.name}${nestedChildren.length ? ` with ${nestedChildren.length} nested child${nestedChildren.length === 1 ? "" : "ren"}` : ""}.`,
        builtIn: false,
        object: { ...cloneObject(object), parentId: null, prefabId: null, prefabOverrides: [] },
        children: nestedChildren,
      };
      commitProject(`Saved Prefab: ${template.name}`, (draft) => draft.prefabs.push(template));
      set({ activeBottomTab: "components" });
    },
    applySelectedToPrefab: () => {
      const state = get();
      const source = getSelectedObject(state.project, state.selectedObjectId);
      if (!source?.prefabId) return;
      const prefabId = source.prefabId;
      commitProject(`Applied ${source.name} to linked Prefab`, (draft) => {
        const sceneObjects = draft.scenes.flatMap((scene) => scene.objects);
        const selected = sceneObjects.find((object) => object.id === source.id);
        const template = draft.prefabs.find((candidate) => candidate.id === prefabId);
        if (!selected || !template) return;
        template.object = { ...cloneObject(selected), id: template.object.id, name: template.name, parentId: null, prefabId: null, prefabOverrides: [], transform: { ...cloneObject(template.object).transform, position: { x: 0, y: 0 } } };
        for (const instance of sceneObjects) {
          if (instance.prefabId !== prefabId || instance.id === selected.id) continue;
          instance.size = cloneObject(template.object).size;
          instance.editorColor = template.object.editorColor;
          instance.tags = [...template.object.tags];
          instance.components = cloneObject(template.object).components.map((element) => ({ ...element, id: createId("element") }));
          instance.prefabOverrides = ["transform.position", "name"];
        }
        selected.prefabOverrides = ["transform.position", "name"];
      });
    },
    revertSelectedPrefab: () => {
      const state = get();
      const selected = getSelectedObject(state.project, state.selectedObjectId);
      if (!selected?.prefabId) return;
      const prefabId = selected.prefabId;
      commitProject(`Reverted ${selected.name} to linked Prefab`, (draft) => {
        const object = draft.scenes.flatMap((scene) => scene.objects).find((candidate) => candidate.id === selected.id);
        const template = draft.prefabs.find((candidate) => candidate.id === prefabId);
        if (!object || !template) return;
        object.size = cloneObject(template.object).size;
        object.editorColor = template.object.editorColor;
        object.tags = [...template.object.tags];
        object.components = cloneObject(template.object).components.map((element) => ({ ...element, id: createId("element") }));
        object.prefabOverrides = ["transform.position", "name"];
      });
    },
    unlinkSelectedPrefab: () => {
      const selectedId = get().selectedObjectId;
      if (!selectedId) return;
      commitProject("Unlinked Prefab instance", (draft) => {
        const object = draft.scenes.flatMap((scene) => scene.objects).find((candidate) => candidate.id === selectedId);
        if (object) { object.prefabId = null; object.prefabOverrides = []; }
      });
    },
    createPrefabVariant: (prefabId) => {
      const source = get().project.prefabs.find((candidate) => candidate.id === prefabId);
      if (!source) return;
      const variant: PrefabDocument = {
        ...structuredClone(source),
        id: createId("prefab"),
        name: `${source.name} Variant`,
        description: `Variant of ${source.name}. Inherits the source recipe until explicitly overridden.`,
        builtIn: false,
        parentPrefabId: source.id,
        variantOf: source.id,
        object: { ...cloneObject(source.object), id: createId("object"), prefabId: null, prefabOverrides: [] },
      };
      commitProject(`Created Prefab Variant: ${variant.name}`, (draft) => { draft.prefabs.push(variant); });
      set({ activeBottomTab: "components" });
    },
    deletePrefab: (prefabId) => {
      const template = get().project.prefabs.find((candidate) => candidate.id === prefabId);
      if (template?.builtIn) {
        get().setStatus("Built-in Game Object recipes cannot be deleted", "warning");
        return;
      }
      commitProject("Deleted Component", (draft) => {
        draft.prefabs = draft.prefabs.filter((candidate) => candidate.id !== prefabId);
      });
    },

    setProjectSettings: (patch) => {
      commitProject("Updated project settings", (draft) => {
        draft.settings = { ...draft.settings, ...patch };
      });
    },
    renameProject: (name) => {
      const clean = name.trim();
      if (!clean) return;
      commitProject(`Renamed project to ${clean}`, (draft) => {
        const previousName = draft.metadata.name;
        draft.metadata.name = clean;
        if (!draft.settings.executableName.trim() || draft.settings.executableName === previousName) {
          draft.settings.executableName = clean;
        }
      });
    },
    addInputAction: () => {
      commitProject("Added input action", (draft) => {
        const existing = new Set(draft.settings.inputActions.map((action) => action.id));
        let index = draft.settings.inputActions.length + 1;
        let id = `action-${index}`;
        while (existing.has(id)) {
          index += 1;
          id = `action-${index}`;
        }
        draft.settings.inputActions.push({
          id,
          name: `Action ${index}`,
          keys: [],
        });
      });
    },
    updateInputAction: (actionId, patch) => {
      commitProject("Updated input action", (draft) => {
        const action = draft.settings.inputActions.find((candidate) => candidate.id === actionId);
        if (action) Object.assign(action, patch);
      });
    },
    removeInputAction: (actionId) => {
      commitProject("Removed input action", (draft) => {
        draft.settings.inputActions = draft.settings.inputActions.filter((action) => action.id !== actionId);
      });
    },
    addCollisionLayer: (name) => {
      const clean = name.trim();
      if (!clean) return;
      commitProject(`Added collision layer: ${clean}`, (draft) => {
        if (draft.settings.collisionLayers.some((layer) => layer.toLowerCase() === clean.toLowerCase())) return;
        draft.settings.collisionLayers.push(clean);
        draft.settings.collisionMatrix[clean] = [];
      });
    },
    removeCollisionLayer: (name) => {
      commitProject(`Removed collision layer: ${name}`, (draft) => {
        if (draft.settings.collisionLayers.length <= 1) return;
        draft.settings.collisionLayers = draft.settings.collisionLayers.filter((layer) => layer !== name);
        delete draft.settings.collisionMatrix[name];
        for (const layer of Object.keys(draft.settings.collisionMatrix)) {
          draft.settings.collisionMatrix[layer] = draft.settings.collisionMatrix[layer].filter((candidate) => candidate !== name);
        }
      });
    },
    setCollisionPair: (leftLayer, rightLayer, enabled) => {
      commitProject("Updated collision matrix", (draft) => {
        const matrix = draft.settings.collisionMatrix;
        const update = (from: string, to: string): void => {
          const values = new Set(matrix[from] ?? []);
          if (enabled) values.add(to);
          else values.delete(to);
          matrix[from] = [...values];
        };
        update(leftLayer, rightLayer);
        update(rightLayer, leftLayer);
      });
    },
    setProjectVariable: (key, value) => {
      const clean = key.trim();
      if (!clean) return;
      commitProject(`Updated variable: ${clean}`, (draft) => {
        draft.variables[clean] = value;
      });
    },
    removeProjectVariable: (key) => {
      commitProject(`Removed variable: ${key}`, (draft) => {
        delete draft.variables[key];
      });
    },

    applyBehaviourRecipe: (recipeId) => {
      const state = get();
      const selectedId = state.selectedObjectId;
      const recipe = state.project.behaviourRecipes.find((candidate) => candidate.id === recipeId);
      if (!selectedId || !recipe) return;
      commitProject(`Applied behaviour recipe: ${recipe.name}`, (draft) => {
        const object = getSelectedObject(draft, selectedId);
        if (!object) return;
        for (const componentType of recipe.requiredComponents) {
          let instance = object.components.find((component) => component.type === componentType);
          if (!instance) {
            instance = createComponentInstance(componentType);
            object.components.push(instance);
          }
          Object.assign(instance.settings, recipe.componentSettings[componentType] ?? {});
        }
        if (recipe.stateMachineJson.trim()) {
          let machine = object.components.find((component) => component.type === "state-machine");
          if (!machine) {
            machine = createComponentInstance("state-machine");
            object.components.push(machine);
          }
          machine.settings.definition = recipe.stateMachineJson;
        }
      });
    },
    updateDamageType: (id, patch) => commitProject("Updated damage type", (draft) => { const entry = draft.damageTypes.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    updateAbility: (id, patch) => commitProject("Updated ability", (draft) => { const entry = draft.abilities.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    updateStatusEffect: (id, patch) => commitProject("Updated status effect", (draft) => { const entry = draft.statusEffects.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    updateLootTable: (id, patch) => commitProject("Updated loot table", (draft) => { const entry = draft.lootTables.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    updateExperienceCurve: (id, patch) => commitProject("Updated experience curve", (draft) => { const entry = draft.experienceCurves.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    updateUpgradeTree: (id, patch) => commitProject("Updated upgrade tree", (draft) => { const entry = draft.upgradeTrees.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    updateShader: (id, patch) => commitProject("Updated shader", (draft) => { const entry = draft.shaders.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    updateMaterial: (id, patch) => commitProject("Updated material", (draft) => { const entry = draft.materials.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    updateScript: (id, patch) => commitProject("Updated Shadowium Script", (draft) => { const entry = draft.scripts.find((candidate) => candidate.id === id); if (entry) Object.assign(entry, patch); }),
    addScript: () => {
      const script = { id: createId("script"), name: `New Script ${get().project.scripts.length + 1}`, source: "fn on_start() {\n  log(\"Game Object started\");\n}\n\nfn on_update(delta) {\n  // Add approved commands here.\n}", executionOrder: 0, enabled: true, exposedProperties: {} };
      commitProject(`Created Shadowium Script: ${script.name}`, (draft) => draft.scripts.push(script));
    },

    setActiveEditorTheme: (themeId) => {
      commitProject("Changed editor theme", (draft) => { if (draft.editorThemes.some((theme) => theme.id === themeId)) draft.activeEditorThemeId = themeId; });
    },
    duplicateEditorTheme: (themeId) => {
      const source = get().project.editorThemes.find((theme) => theme.id === themeId);
      if (!source) return;
      const copy = { ...structuredClone(source), id: createId("editor-theme"), name: `${source.name} Custom`, builtIn: false };
      commitProject(`Created editor theme: ${copy.name}`, (draft) => { draft.editorThemes.push(copy); draft.activeEditorThemeId = copy.id; });
    },
    updateEditorTheme: (themeId, patch) => {
      commitProject("Updated editor theme", (draft) => { const theme = draft.editorThemes.find((candidate) => candidate.id === themeId); if (theme) Object.assign(theme, patch); });
    },
    setActiveGameUiTheme: (themeId) => {
      commitProject("Changed game UI theme", (draft) => { if (draft.gameUiThemes.some((theme) => theme.id === themeId)) draft.activeGameUiThemeId = themeId; });
    },
    duplicateGameUiTheme: (themeId) => {
      const source = get().project.gameUiThemes.find((theme) => theme.id === themeId);
      if (!source) return;
      const copy = { ...structuredClone(source), id: createId("ui-theme"), name: `${source.name} Custom`, builtIn: false };
      commitProject(`Created game UI theme: ${copy.name}`, (draft) => { draft.gameUiThemes.push(copy); draft.activeGameUiThemeId = copy.id; });
    },
    updateGameUiTheme: (themeId, patch) => {
      commitProject("Updated game UI theme", (draft) => { const theme = draft.gameUiThemes.find((candidate) => candidate.id === themeId); if (theme) Object.assign(theme, patch); });
    },
    createAnimationSet: (name, assetId, directions) => {
      commitProject(`Created Animation Set: ${name}`, (draft) => { draft.animationSets.push({ id: createId("animation-set"), name, assetId, directions, states: { default: { ...directions } }, defaultState: "default", builtIn: false }); });
    },
    addDialogueGraph: () => {
      commitProject("Created dialogue graph", (draft) => { const nodeId = createId("dialogue-node"); draft.dialogues.push({ id: createId("dialogue"), name: `Dialogue ${draft.dialogues.length + 1}`, startNodeId: nodeId, nodes: [{ id: nodeId, speaker: "Speaker", text: "New dialogue line", nextId: null, choices: [] }] }); });
    },
    updateDialogueGraph: (dialogueId, patch) => {
      commitProject("Updated dialogue graph", (draft) => { const graph = draft.dialogues.find((candidate) => candidate.id === dialogueId); if (graph) Object.assign(graph, patch); });
    },
    addDialogueNode: (dialogueId) => {
      commitProject("Added dialogue node", (draft) => { const graph = draft.dialogues.find((candidate) => candidate.id === dialogueId); if (!graph) return; const node = { id: createId("dialogue-node"), speaker: "Speaker", text: "New dialogue line", nextId: null, choices: [] }; graph.nodes.push(node); if (!graph.startNodeId) graph.startNodeId = node.id; });
    },
    updateDialogueNode: (dialogueId, nodeId, patch) => {
      commitProject("Updated dialogue node", (draft) => { const node = draft.dialogues.find((candidate) => candidate.id === dialogueId)?.nodes.find((candidate) => candidate.id === nodeId); if (node) Object.assign(node, patch); });
    },
    deleteDialogueNode: (dialogueId, nodeId) => {
      commitProject("Deleted dialogue node", (draft) => { const graph = draft.dialogues.find((candidate) => candidate.id === dialogueId); if (!graph) return; graph.nodes = graph.nodes.filter((candidate) => candidate.id !== nodeId); if (graph.startNodeId === nodeId) graph.startNodeId = graph.nodes[0]?.id ?? null; for (const node of graph.nodes) { if (node.nextId === nodeId) node.nextId = null; for (const choice of node.choices) if (choice.nextId === nodeId) choice.nextId = null; } });
    },
    addDialogueChoice: (dialogueId, nodeId) => {
      commitProject("Added dialogue choice", (draft) => { const node = draft.dialogues.find((candidate) => candidate.id === dialogueId)?.nodes.find((candidate) => candidate.id === nodeId); if (node) node.choices.push({ id: createId("dialogue-choice"), label: "Choice", nextId: null, conditionKey: "" }); });
    },
    updateDialogueChoice: (dialogueId, nodeId, choiceId, patch) => {
      commitProject("Updated dialogue choice", (draft) => { const choice = draft.dialogues.find((candidate) => candidate.id === dialogueId)?.nodes.find((candidate) => candidate.id === nodeId)?.choices.find((candidate) => candidate.id === choiceId); if (choice) Object.assign(choice, patch); });
    },
    deleteDialogueChoice: (dialogueId, nodeId, choiceId) => {
      commitProject("Deleted dialogue choice", (draft) => { const node = draft.dialogues.find((candidate) => candidate.id === dialogueId)?.nodes.find((candidate) => candidate.id === nodeId); if (node) node.choices = node.choices.filter((candidate) => candidate.id !== choiceId); });
    },
    addQuest: () => {
      commitProject("Created quest", (draft) => { draft.quests.push({ id: createId("quest"), name: `Quest ${draft.quests.length + 1}`, description: "", objectives: [], rewardTableId: "", followUpQuestIds: [] }); });
    },
    updateQuest: (questId, patch) => {
      commitProject("Updated quest", (draft) => { const quest = draft.quests.find((candidate) => candidate.id === questId); if (quest) Object.assign(quest, patch); });
    },
    addQuestObjective: (questId) => {
      commitProject("Added quest objective", (draft) => { const quest = draft.quests.find((candidate) => candidate.id === questId); if (quest) quest.objectives.push({ id: createId("quest-objective"), kind: "interact", targetId: "", amount: 1, optional: false }); });
    },
    updateQuestObjective: (questId, objectiveId, patch) => {
      commitProject("Updated quest objective", (draft) => { const objective = draft.quests.find((candidate) => candidate.id === questId)?.objectives.find((candidate) => candidate.id === objectiveId); if (objective) Object.assign(objective, patch); });
    },
    deleteQuestObjective: (questId, objectiveId) => {
      commitProject("Deleted quest objective", (draft) => { const quest = draft.quests.find((candidate) => candidate.id === questId); if (quest) quest.objectives = quest.objectives.filter((candidate) => candidate.id !== objectiveId); });
    },
    applyGenreKit: (kitId) => {
      const kit = get().project.genreKits.find((candidate) => candidate.id === kitId);
      if (!kit) return;
      commitProject(`Applied Genre Kit: ${kit.name}`, (draft) => {
        if (draft.gameUiThemes.some((theme) => theme.id === kit.uiThemeId)) draft.activeGameUiThemeId = kit.uiThemeId;
        for (const inputActionId of kit.inputActionIds) if (!draft.settings.inputActions.some((action) => action.id === inputActionId)) draft.settings.inputActions.push({ id: inputActionId, name: inputActionId.replace(/-/g, " "), keys: [] });
      });
      get().setStatus(`${kit.name} is active. Its recipes remain optional and were not inserted into the scene.`);
    },
    addPackageManifest: () => {
      commitProject("Created local package manifest", (draft) => { draft.packages.push({ id: createId("package"), name: `Local Package ${draft.packages.length + 1}`, version: "0.1.0", description: "Project-local extension manifest", enabled: false, dependencies: [], componentTypes: [], recipeIds: [], themeIds: [] }); });
    },
    togglePackage: (packageId) => {
      commitProject("Toggled project package", (draft) => { const pkg = draft.packages.find((candidate) => candidate.id === packageId); if (pkg) pkg.enabled = !pkg.enabled; });
    },

    focusDiagnostic: (diagnostic) => {
      if (diagnostic.sceneId) {
        const project = get().project;
        if (project.scenes.some((scene) => scene.id === diagnostic.sceneId)) {
          set({ project: { ...project, activeSceneId: diagnostic.sceneId } });
        }
      }
      set({ selectedObjectId: diagnostic.objectId, selectedObjectIds: diagnostic.objectId ? [diagnostic.objectId] : [], activeBottomTab: "diagnostics" });
    },
    repairDiagnostic: (diagnostic) => {
      commitProject("Repaired diagnostic", (draft) => {
        if (diagnostic.id === "project:missing-initial-scene") {
          draft.settings.initialSceneId = draft.scenes[0]?.id ?? draft.activeSceneId;
          return;
        }
        if (diagnostic.id.endsWith(":no-camera") && diagnostic.sceneId) {
          const scene = draft.scenes.find((candidate) => candidate.id === diagnostic.sceneId);
          if (!scene) return;
          const camera = createGameObject(createUniqueObjectName(scene, "Game Camera"), 0, 0, "#42a5f5");
          camera.size = { width: 64, height: 64 };
          camera.layerId = scene.layers.find((layer) => layer.name === "Gameplay")?.id ?? scene.layers[0]?.id ?? camera.layerId;
          camera.components = [createComponentInstance("camera")];
          scene.objects.push(camera);
          scene.defaultCameraId = camera.id;
          return;
        }
        if (diagnostic.id.endsWith(":missing-scene-layer") && diagnostic.sceneId && diagnostic.objectId) {
          const scene = draft.scenes.find((candidate) => candidate.id === diagnostic.sceneId);
          const object = scene?.objects.find((candidate) => candidate.id === diagnostic.objectId);
          if (scene && object) object.layerId = scene.layers.find((layer) => !layer.locked)?.id ?? scene.layers[0]?.id ?? object.layerId;
          return;
        }
        if (diagnostic.id.includes(":missing-parent") && diagnostic.sceneId && diagnostic.objectId) {
          const object = draft.scenes.find((candidate) => candidate.id === diagnostic.sceneId)?.objects.find((candidate) => candidate.id === diagnostic.objectId);
          if (object) object.parentId = null;
        }
      });
      set({ activeBottomTab: "diagnostics" });
    },
    beginInteraction: () => {
      const state = get();
      if (!state.interactionSnapshot) {
        set({ interactionSnapshot: cloneProject(state.project) });
      }
    },
    previewObjectPosition: (objectId, x, y) => {
      const project = cloneProject(get().project);
      const scene = getActiveScene(project);
      const object = scene.objects.find((candidate) => candidate.id === objectId);
      if (!object) return;
      moveObjectAndDescendants(scene.objects, objectId, x, y);
      set({ project, isDirty: true });
    },
    previewObjectGeometry: (objectId, patch) => {
      const project = cloneProject(get().project);
      const scene = getActiveScene(project);
      const object = scene.objects.find((candidate) => candidate.id === objectId);
      if (!object) return;
      if (patch.x !== undefined || patch.y !== undefined) {
        moveObjectAndDescendants(scene.objects, objectId, patch.x ?? object.transform.position.x, patch.y ?? object.transform.position.y);
      }
      if (patch.width !== undefined) object.size.width = Math.max(1, patch.width);
      if (patch.height !== undefined) object.size.height = Math.max(1, patch.height);
      if (patch.scaleX !== undefined) object.transform.scale.x = Math.abs(patch.scaleX) < 0.001 ? Math.sign(patch.scaleX || 1) * 0.001 : patch.scaleX;
      if (patch.scaleY !== undefined) object.transform.scale.y = Math.abs(patch.scaleY) < 0.001 ? Math.sign(patch.scaleY || 1) * 0.001 : patch.scaleY;
      if (patch.rotation !== undefined) object.transform.rotation = patch.rotation;
      if (patch.pivotX !== undefined) object.transform.pivot.x = Math.min(1, Math.max(0, patch.pivotX));
      if (patch.pivotY !== undefined) object.transform.pivot.y = Math.min(1, Math.max(0, patch.pivotY));
      set({ project, isDirty: true });
    },
    previewCollider: (objectId, componentId, patch) => {
      const project = cloneProject(get().project);
      const element = getActiveScene(project)
        .objects.find((candidate) => candidate.id === objectId)
        ?.components.find((candidate) => candidate.id === componentId);
      if (!element) return;
      for (const [key, value] of Object.entries(patch)) {
        element.settings[key] = value;
      }
      set({ project, isDirty: true });
    },
    commitInteraction: (message) => {
      const state = get();
      if (!state.interactionSnapshot) return;
      const project = cloneProject(state.project);
      project.metadata.updatedAt = new Date().toISOString();
      set({
        project,
        isDirty: true,
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), state.interactionSnapshot],
        future: [],
        interactionSnapshot: null,
        statusMessage: message,
        activityLog: appendActivity(state.activityLog, message),
      });
    },
    cancelInteraction: () => {
      const state = get();
      if (!state.interactionSnapshot) return;
      set({ project: state.interactionSnapshot, interactionSnapshot: null, statusMessage: "Interaction cancelled" });
    },
    undo: () => {
      const state = get();
      if (state.interactionSnapshot) {
        set({ project: state.interactionSnapshot, interactionSnapshot: null });
        return;
      }
      const previous = state.past[state.past.length - 1];
      if (!previous) {
        set({ statusMessage: "Nothing to undo" });
        return;
      }
      set({
        project: cloneProject(previous),
        past: state.past.slice(0, -1),
        future: [cloneProject(state.project), ...state.future].slice(0, HISTORY_LIMIT),
        selectedObjectId: null,
        isDirty: true,
        statusMessage: "Undo",
        activityLog: appendActivity(state.activityLog, "Undo"),
      });
    },
    redo: () => {
      const state = get();
      const next = state.future[0];
      if (!next) {
        set({ statusMessage: "Nothing to redo" });
        return;
      }
      set({
        project: cloneProject(next),
        past: [...state.past, cloneProject(state.project)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selectedObjectId: null,
        isDirty: true,
        statusMessage: "Redo",
        activityLog: appendActivity(state.activityLog, "Redo"),
      });
    },
  };
});
