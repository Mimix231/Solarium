import { invoke } from "@tauri-apps/api/core";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { createComponentInstance, getComponentDefinition } from "./catalog";
import { buildDiagnostics } from "./diagnostics";
import { createId } from "./ids";
import { normalizeGameObjectDocument, normalizePrefabDocuments } from "./projectSanitizer";
import { projectWithPhase10Defaults } from "./phase10Architecture";
import {
  createDefaultCollisionMatrix,
  createDefaultInputActions,
  createDefaultDamageTypes,
  createDefaultAbilities,
  createDefaultStatusEffects,
  createDefaultLootTables,
  createDefaultExperienceCurves,
  createDefaultUpgradeTrees,
  createDefaultShaders,
  createDefaultMaterials,
  createDefaultScripts,
  createDefaultBehaviourRecipes,
  createStarterProject,
} from "./project";
import type {
  ImportedAssetFile,
  ProjectDocument,
  ProjectLocation,
} from "./types";

const PROJECT_EXTENSION = "shadowium";
const LEGACY_PROJECT_EXTENSIONS = ["leonis"] as const;

export interface LoadedProject {
  project: ProjectDocument;
  path: string | null;
  root: string | null;
}

export interface SavedProject {
  path: string | null;
  root: string | null;
}

export interface BuildGameResult {
  outputPath: string | null;
  files: string[];
}

function isRunningInsideTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function parentPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : normalized;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function documentArray<T extends { id: string }>(value: unknown, fallback: T[] = []): T[] {
  if (!Array.isArray(value)) return fallback.map((entry) => structuredClone(entry));
  return value.filter((entry): entry is T => isRecord(entry) && typeof entry.id === "string" && entry.id.trim().length > 0);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function textValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function finiteValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function migrateVersionOne(value: Record<string, unknown>): ProjectDocument {
  const old = value as any;
  const fallback = createStarterProject(old.metadata?.name ?? "Migrated Project");

  return {
    version: 11,
    metadata: {
      id: String(old.metadata?.id ?? createId("project")),
      name: String(old.metadata?.name ?? "Migrated Project"),
      createdAt: String(old.metadata?.createdAt ?? new Date().toISOString()),
      updatedAt: new Date().toISOString(),
    },
    settings: { ...fallback.settings },
    activeSceneId: String(old.activeSceneId ?? fallback.activeSceneId),
    scenes: Array.isArray(old.scenes)
      ? old.scenes.map((scene: any) => ({
          id: String(scene.id ?? createId("scene")),
          name: String(scene.name ?? "Scene"),
          backgroundColor: "#12161d",
          layers: fallback.scenes[0].layers.map((layer) => ({ ...layer })),
          objects: Array.isArray(scene.objects)
            ? scene.objects.map((object: any) => ({
                id: String(object.id ?? createId("object")),
                name: String(object.name ?? "Game Object"),
                parentId: object.parentId ?? null,
                layerId: "layer-gameplay",
                enabled: object.enabled !== false,
                editorVisible: object.editorVisible !== false,
                runtimeVisible: object.runtimeVisible !== false,
                collisionEnabled: object.collisionEnabled !== false,
                logicEnabled: object.logicEnabled !== false,
                locked: object.locked === true,
                tags: [],
                transform: object.transform ?? {
                  position: { x: 0, y: 0 },
                  rotation: 0,
                  scale: { x: 1, y: 1 },
                  pivot: { x: 0.5, y: 0.5 },
                },
                size: object.size ?? { width: 64, height: 64 },
                editorColor: String(object.editorColor ?? "#78909c"),
                components: Array.isArray(object.components ?? object.elements)
                  ? (object.components ?? object.elements).map((element: any) => ({
                      id: String(element.id ?? createId("element")),
                      type: element.type,
                      enabled: element.enabled !== false,
                      settings: element.settings ?? {},
                    }))
                  : [createComponentInstance("sprite-renderer")],
              }))
            : [],
        }))
      : fallback.scenes,
    assets: Array.isArray(old.assets)
      ? old.assets.map((asset: any) => ({
          id: String(asset.id ?? createId("asset")),
          name: String(asset.name ?? "Asset"),
          kind: "image" as const,
          relativePath: String(asset.relativePath ?? asset.sourcePath ?? ""),
          mimeType: "image/png",
          width: Number(asset.width ?? 64),
          height: Number(asset.height ?? 64),
          importedAt: String(asset.importedAt ?? new Date().toISOString()),
          frames: [],
        }))
      : [],
    animations: [],
    eventRules: [],
    prefabs: fallback.prefabs,
    variables: {},
    items: fallback.items,
    tilePalette: fallback.tilePalette,
    damageTypes: fallback.damageTypes,
    stats: fallback.stats,
    abilities: fallback.abilities,
    statusEffects: fallback.statusEffects,
    lootTables: fallback.lootTables,
    experienceCurves: fallback.experienceCurves,
    upgradeTrees: fallback.upgradeTrees,
    shaders: fallback.shaders,
    materials: fallback.materials,
    scripts: fallback.scripts,
    behaviourRecipes: fallback.behaviourRecipes,
    customGameObjectTypes: [], editorThemes: fallback.editorThemes, activeEditorThemeId: fallback.activeEditorThemeId,
    gameUiThemes: fallback.gameUiThemes, activeGameUiThemeId: fallback.activeGameUiThemeId,
    animationSets: [], dialogues: [], quests: [], genreKits: fallback.genreKits, packages: [],
  };
}

function validateProject(value: unknown): ProjectDocument {
  if (!value || typeof value !== "object") {
    throw new Error("The selected file is not a valid ShadowiumUI project.");
  }

  const record = value as Record<string, unknown>;
  if (record.version === 1) {
    return migrateVersionOne(record);
  }

  if (record.version !== 2 && record.version !== 3 && record.version !== 4 && record.version !== 5 && record.version !== 6 && record.version !== 7 && record.version !== 8 && record.version !== 9 && record.version !== 10 && record.version !== 11) {
    throw new Error(`Unsupported project version: ${String(record.version)}`);
  }

  const project = record as unknown as ProjectDocument;
  project.version = 11;
  if (!project.metadata || typeof project.metadata.name !== "string") {
    throw new Error("The project metadata is invalid.");
  }
  const fallback = createStarterProject(project.metadata.name);
  project.scenes = documentArray(project.scenes, fallback.scenes);
  if (project.scenes.length === 0) project.scenes = fallback.scenes.map((scene) => structuredClone(scene));
  if (!project.scenes.some((scene) => scene.id === project.activeSceneId)) project.activeSceneId = project.scenes[0].id;
  project.assets = documentArray(project.assets);
  project.animations = documentArray(project.animations);
  project.eventRules = documentArray(project.eventRules);
  const legacyPrefabs = Array.isArray((record as any).templates) ? (record as any).templates : [];
  project.prefabs = normalizePrefabDocuments(Array.isArray(project.prefabs) ? project.prefabs : legacyPrefabs, fallback.prefabs);
  project.variables = project.variables && typeof project.variables === "object" && !Array.isArray(project.variables) ? project.variables : {};
  project.items = documentArray(project.items, fallback.items);
  project.tilePalette = documentArray(project.tilePalette, fallback.tilePalette);
  project.damageTypes = documentArray(project.damageTypes, createDefaultDamageTypes());
  project.stats = documentArray(project.stats, fallback.stats);
  project.abilities = documentArray(project.abilities, createDefaultAbilities());
  project.statusEffects = documentArray(project.statusEffects, createDefaultStatusEffects());
  project.lootTables = documentArray(project.lootTables, createDefaultLootTables());
  project.experienceCurves = documentArray(project.experienceCurves, createDefaultExperienceCurves());
  project.upgradeTrees = documentArray(project.upgradeTrees, createDefaultUpgradeTrees());
  project.shaders = documentArray(project.shaders, createDefaultShaders());
  project.materials = documentArray(project.materials, createDefaultMaterials());
  project.scripts = documentArray(project.scripts, createDefaultScripts());
  project.behaviourRecipes = documentArray(project.behaviourRecipes, createDefaultBehaviourRecipes());
  project.customGameObjectTypes = documentArray(project.customGameObjectTypes);
  for (const definition of project.customGameObjectTypes) {
    definition.name = textValue(definition.name, "Custom Game Object Type");
    definition.description = textValue(definition.description);
    definition.slots = stringArray(definition.slots) as ProjectDocument["customGameObjectTypes"][number]["slots"];
    definition.recommended = stringArray(definition.recommended) as ProjectDocument["customGameObjectTypes"][number]["recommended"];
    definition.required = stringArray(definition.required) as ProjectDocument["customGameObjectTypes"][number]["required"];
    definition.hiddenCategories = stringArray(definition.hiddenCategories) as ProjectDocument["customGameObjectTypes"][number]["hiddenCategories"];
  }

  for (const asset of project.assets) {
    asset.name = textValue(asset.name, "Asset");
    asset.kind = ["image", "sprite-sheet", "tileset", "audio", "dialogue", "shader", "material", "script", "data"].includes(String(asset.kind)) ? asset.kind : "image";
    asset.relativePath = textValue(asset.relativePath);
    asset.mimeType = textValue(asset.mimeType, asset.kind === "audio" ? "audio/mpeg" : "image/png");
    asset.width = Math.max(1, finiteValue(asset.width, 64));
    asset.height = Math.max(1, finiteValue(asset.height, 64));
    asset.importedAt = textValue(asset.importedAt, new Date().toISOString());
    asset.frames = documentArray(asset.frames);
    asset.tags = stringArray(asset.tags);
    for (const frame of asset.frames) {
      frame.name = textValue(frame.name, "Frame");
      frame.x = finiteValue(frame.x);
      frame.y = finiteValue(frame.y);
      frame.width = Math.max(1, finiteValue(frame.width, 1));
      frame.height = Math.max(1, finiteValue(frame.height, 1));
      frame.pivotX = finiteValue(frame.pivotX, 0.5);
      frame.pivotY = finiteValue(frame.pivotY, 0.5);
      frame.sockets = Array.isArray(frame.sockets) ? frame.sockets.filter(isRecord).map((socket) => ({
        id: textValue(socket.id, createId("socket")), name: textValue(socket.name, "Socket"), x: finiteValue(socket.x), y: finiteValue(socket.y), rotation: finiteValue(socket.rotation),
      })) : [];
      frame.collisionPolygon = Array.isArray(frame.collisionPolygon) ? frame.collisionPolygon.filter(isRecord).map((point) => ({ x: finiteValue(point.x), y: finiteValue(point.y) })) : undefined;
    }
  }
  for (const animation of project.animations) {
    animation.name = textValue(animation.name, "Animation");
    animation.assetId = textValue(animation.assetId);
    animation.loop = animation.loop !== false;
    animation.pingPong = animation.pingPong === true;
    animation.framesPerSecond = Math.max(1, finiteValue(animation.framesPerSecond, 10));
    animation.frames = Array.isArray(animation.frames) ? animation.frames.filter(isRecord).map((frame) => ({ frameId: textValue(frame.frameId), durationMs: Math.max(1, finiteValue(frame.durationMs, 100)), rootMotionX: finiteValue(frame.rootMotionX), rootMotionY: finiteValue(frame.rootMotionY) })) : [];
    animation.category = textValue(animation.category, "Uncategorized");
    animation.tags = stringArray(animation.tags);
    animation.rootMotionMode = ["ignore", "apply-position", "extract-only"].includes(String(animation.rootMotionMode)) ? animation.rootMotionMode : "ignore";
    animation.events = Array.isArray(animation.events) ? animation.events.filter(isRecord).map((event) => ({
      id: textValue(event.id, createId("animation-event")), name: textValue(event.name, "Animation Event"), frameIndex: Math.max(0, Math.floor(finiteValue(event.frameIndex))),
      type: ["emit-event", "play-sound", "enable-component", "disable-component", "spawn-prefab", "camera-shake", "set-variable"].includes(String(event.type)) ? event.type : "emit-event",
      targetId: textValue(event.targetId), key: textValue(event.key), value: event.value === undefined ? null : event.value,
    })) : [];
  }
  for (const item of project.items) {
    item.name = textValue(item.name, "Item");
    item.description = textValue(item.description);
    item.iconAssetId = typeof item.iconAssetId === "string" ? item.iconAssetId : null;
    item.maximumStack = Math.max(1, finiteValue(item.maximumStack, 1));
    item.tags = stringArray(item.tags);
  }
  for (const tile of project.tilePalette) {
    tile.name = textValue(tile.name, "Tile");
    tile.color = textValue(tile.color, "#78909c");
    tile.assetId = textValue(tile.assetId);
    tile.frameId = textValue(tile.frameId);
    tile.collision = ["none", "solid", "trigger"].includes(String(tile.collision)) ? tile.collision : "none";
    tile.tags = stringArray(tile.tags);
  }
  for (const damageType of project.damageTypes) {
    damageType.name = textValue(damageType.name, "Damage Type");
    damageType.color = textValue(damageType.color, "#ffffff");
    damageType.healing = damageType.healing === true;
    damageType.tags = stringArray(damageType.tags);
  }
  for (const stat of project.stats) {
    stat.name = textValue(stat.name, "Stat");
    stat.baseValue = finiteValue(stat.baseValue);
    stat.minimum = finiteValue(stat.minimum);
    stat.maximum = finiteValue(stat.maximum, 9999);
    stat.regenerationPerSecond = finiteValue(stat.regenerationPerSecond);
    stat.persistent = stat.persistent !== false;
    stat.formula = textValue(stat.formula);
  }
  for (const ability of project.abilities) {
    ability.name = textValue(ability.name, "Ability");
    ability.description = textValue(ability.description);
    ability.iconAssetId = typeof ability.iconAssetId === "string" ? ability.iconAssetId : null;
    ability.activationActionId = textValue(ability.activationActionId);
    ability.castTimeSeconds = Math.max(0, finiteValue(ability.castTimeSeconds));
    ability.channelTimeSeconds = Math.max(0, finiteValue(ability.channelTimeSeconds));
    ability.cooldownSeconds = Math.max(0, finiteValue(ability.cooldownSeconds));
    ability.resourceId = textValue(ability.resourceId, "mana");
    ability.resourceCost = Math.max(0, finiteValue(ability.resourceCost));
    ability.targetingMode = ["self", "direction", "point", "object", "area", "cone", "line", "chain", "nearest", "all-in-range"].includes(String(ability.targetingMode)) ? ability.targetingMode : "self";
    ability.range = Math.max(0, finiteValue(ability.range));
    ability.maximumTargets = Math.max(1, finiteValue(ability.maximumTargets, 1));
    ability.effects = documentArray(ability.effects);
    ability.tags = stringArray(ability.tags);
    for (const effect of ability.effects) {
      effect.type = ["damage", "heal", "apply-status", "remove-status", "spawn-prefab", "teleport", "knockback", "pull", "dash", "summon", "modify-stat", "set-variable", "screen-effect"].includes(String(effect.type)) ? effect.type : "damage";
      effect.amount = finiteValue(effect.amount);
      effect.damageTypeId = textValue(effect.damageTypeId, "physical");
      effect.statusEffectId = textValue(effect.statusEffectId);
      effect.prefabId = textValue(effect.prefabId);
      effect.statId = textValue(effect.statId);
      effect.durationSeconds = Math.max(0, finiteValue(effect.durationSeconds));
      effect.radius = Math.max(0, finiteValue(effect.radius));
      effect.value = effect.value ?? null;
    }
  }
  for (const status of project.statusEffects) {
    status.name = textValue(status.name, "Status Effect");
    status.description = textValue(status.description);
    status.durationSeconds = Math.max(0, finiteValue(status.durationSeconds));
    status.tickIntervalSeconds = Math.max(0.01, finiteValue(status.tickIntervalSeconds, 1));
    status.maximumStacks = Math.max(1, finiteValue(status.maximumStacks, 1));
    status.stacking = ["refresh", "stack-duration", "stack-intensity", "ignore"].includes(String(status.stacking)) ? status.stacking : "refresh";
    status.damagePerTick = finiteValue(status.damagePerTick);
    status.damageTypeId = textValue(status.damageTypeId, "physical");
    status.speedMultiplier = finiteValue(status.speedMultiplier, 1);
    status.damageMultiplier = finiteValue(status.damageMultiplier, 1);
    status.materialId = textValue(status.materialId);
    status.tags = stringArray(status.tags);
  }
  for (const table of project.lootTables) {
    table.name = textValue(table.name, "Loot Table");
    table.rolls = Math.max(0, finiteValue(table.rolls, 1));
    table.pityCounterKey = textValue(table.pityCounterKey);
    table.pityThreshold = Math.max(0, finiteValue(table.pityThreshold));
    table.entries = documentArray(table.entries);
    for (const entry of table.entries) {
      entry.kind = ["item", "currency", "experience", "prefab", "loot-table"].includes(String(entry.kind)) ? entry.kind : "item";
      entry.referenceId = textValue(entry.referenceId);
      entry.weight = Math.max(0, finiteValue(entry.weight, 1));
      entry.minimumAmount = finiteValue(entry.minimumAmount, 1);
      entry.maximumAmount = Math.max(entry.minimumAmount, finiteValue(entry.maximumAmount, entry.minimumAmount));
      entry.guaranteed = entry.guaranteed === true;
      entry.unique = entry.unique === true;
      entry.conditionVariable = textValue(entry.conditionVariable);
      entry.conditionValue = entry.conditionValue ?? null;
    }
  }
  for (const curve of project.experienceCurves) {
    curve.name = textValue(curve.name, "Experience Curve");
    curve.maximumLevel = Math.max(1, finiteValue(curve.maximumLevel, 100));
    curve.baseExperience = Math.max(0, finiteValue(curve.baseExperience, 100));
    curve.growthFactor = Math.max(0, finiteValue(curve.growthFactor, 1));
    curve.formula = ["linear", "quadratic", "exponential"].includes(String(curve.formula)) ? curve.formula : "exponential";
  }
  for (const tree of project.upgradeTrees) {
    tree.name = textValue(tree.name, "Upgrade Tree");
    tree.nodes = documentArray(tree.nodes);
    for (const node of tree.nodes) {
      node.name = textValue(node.name, "Upgrade");
      node.description = textValue(node.description);
      node.cost = Math.max(0, finiteValue(node.cost));
      node.currencyId = textValue(node.currencyId, "skill-points");
      node.prerequisites = stringArray(node.prerequisites);
      node.mutuallyExclusiveWith = stringArray(node.mutuallyExclusiveWith);
      node.unlockAbilityId = textValue(node.unlockAbilityId);
      node.statModifiers = documentArray(node.statModifiers);
      node.position = isRecord(node.position) ? { x: finiteValue(node.position.x), y: finiteValue(node.position.y) } : { x: 0, y: 0 };
      for (const modifier of node.statModifiers) {
        modifier.source = textValue(modifier.source, node.name);
        modifier.statId = textValue(modifier.statId);
        modifier.mode = ["flat", "additive-percent", "multiplicative"].includes(String(modifier.mode)) ? modifier.mode : "flat";
        modifier.value = finiteValue(modifier.value);
        modifier.durationSeconds = modifier.durationSeconds === null ? null : Math.max(0, finiteValue(modifier.durationSeconds));
        modifier.stacking = ["stack", "replace", "highest"].includes(String(modifier.stacking)) ? modifier.stacking : "stack";
      }
    }
  }
  for (const shader of project.shaders) {
    shader.name = textValue(shader.name, "Shader");
    shader.vertexSource = textValue(shader.vertexSource);
    shader.fragmentSource = textValue(shader.fragmentSource);
    shader.target = ["sprite", "tilemap", "particle", "ui", "fullscreen"].includes(String(shader.target)) ? shader.target : "sprite";
    shader.uniforms = isRecord(shader.uniforms) ? shader.uniforms : {};
    shader.builtIn = shader.builtIn === true;
  }
  for (const material of project.materials) {
    material.name = textValue(material.name, "Material");
    material.shaderId = textValue(material.shaderId);
    material.blendMode = textValue(material.blendMode, "normal");
    material.uniforms = isRecord(material.uniforms) ? material.uniforms : {};
    material.enabled = material.enabled !== false;
  }
  for (const script of project.scripts) {
    script.name = textValue(script.name, "Shadowium Script");
    script.source = textValue(script.source);
    script.executionOrder = finiteValue(script.executionOrder);
    script.enabled = script.enabled !== false;
    script.exposedProperties = isRecord(script.exposedProperties) ? script.exposedProperties : {};
  }
  for (const recipe of project.behaviourRecipes) {
    recipe.name = textValue(recipe.name, "Behaviour Recipe");
    recipe.description = textValue(recipe.description);
    recipe.category = textValue(recipe.category, "Custom");
    recipe.requiredComponents = stringArray(recipe.requiredComponents) as typeof recipe.requiredComponents;
    recipe.componentSettings = isRecord(recipe.componentSettings) ? recipe.componentSettings : {};
    recipe.stateMachineJson = textValue(recipe.stateMachineJson);
    recipe.eventRuleIds = stringArray(recipe.eventRuleIds);
    recipe.tutorialSteps = stringArray(recipe.tutorialSteps);
    recipe.builtIn = recipe.builtIn === true;
  }
  project.animationSets = documentArray(project.animationSets);
  for (const set of project.animationSets) {
    set.name = textValue(set.name, "Animation Set");
    set.assetId = textValue(set.assetId);
    set.directions = isRecord(set.directions) ? Object.fromEntries(Object.entries(set.directions).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};
    set.states = isRecord(set.states) ? Object.fromEntries(Object.entries(set.states).filter(([, state]) => isRecord(state)).map(([name, state]) => [name, Object.fromEntries(Object.entries(state as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"))])) : undefined;
    set.defaultState = textValue(set.defaultState, Object.keys(set.states ?? {})[0] ?? "default");
    set.builtIn = set.builtIn === true;
  }

  project.settings = { ...fallback.settings, ...(project.settings ?? {}) };
  project.settings.inputActions = documentArray(project.settings.inputActions, createDefaultInputActions());
  for (const action of project.settings.inputActions) action.keys = stringArray(action.keys);
  project.settings.collisionLayers = stringArray(project.settings.collisionLayers);
  if (project.settings.collisionLayers.length === 0) project.settings.collisionLayers = ["World", "Player", "Enemy", "Trigger"];
  project.settings.collisionMatrix = isRecord(project.settings.collisionMatrix) ? project.settings.collisionMatrix : createDefaultCollisionMatrix();
  project.settings.audioGroups = documentArray(project.settings.audioGroups, fallback.settings.audioGroups);
  project.settings.runtimeDebug ??= fallback.settings.runtimeDebug;
  project.settings.scriptingEnabled ??= true;
  if ((project.settings.physicsBackend as string) === "leonis") project.settings.physicsBackend = "shadowium";
  project.settings.physicsBackend ??= "rapier-compatible";
  project.settings.missingSpriteBehavior = ["checker", "hide", "stop-play"].includes(String(project.settings.missingSpriteBehavior)) ? project.settings.missingSpriteBehavior : "checker";
  project.settings.initialSceneId ??= project.scenes[0].id;
  if (!project.scenes.some((scene) => scene.id === project.settings.initialSceneId)) {
    project.settings.initialSceneId = project.scenes[0].id;
  }
  project.settings.buildProfile ??= "development";
  project.settings.scalingMode ??= "fit";
  project.settings.executableName ??= project.metadata.name;
  for (const tile of project.tilePalette) {
    tile.tags ??= [];
    tile.terrainType ??= "";
    tile.terrainMask ??= null;
  }

  for (const rule of project.eventRules) {
    rule.trigger = isRecord(rule.trigger) ? rule.trigger : { type: "preview-start", sourceObjectId: null, targetObjectId: null };
    rule.trigger.type ??= "preview-start";
    rule.trigger.sourceObjectId ??= null;
    rule.trigger.targetObjectId ??= null;
    rule.conditions = Array.isArray(rule.conditions) ? rule.conditions.filter(isRecord) as typeof rule.conditions : [];
    rule.actions = Array.isArray(rule.actions) ? rule.actions.filter(isRecord) as typeof rule.actions : [];
    for (const condition of rule.conditions) {
      condition.operator ??= "==";
      if ((condition as any).type === "object-has-element") (condition as any).type = "object-has-component";
      condition.componentType ??= (condition as any).elementType ?? null;
      if (condition.type === "object-has-element") condition.type = "object-has-component";
      delete (condition as any).elementType;
    }
    for (const action of rule.actions) {
      action.componentType ??= (action as any).elementType ?? null;
      if (action.type === "set-element-property") action.type = "set-component-property";
      action.propertyKey ??= "";
      delete (action as any).elementType;
    }
  }

  for (const scene of project.scenes) {
    scene.objects = Array.isArray(scene.objects) ? scene.objects : [];
    scene.backgroundColor ??= project.settings.defaultBackgroundColor ?? "#12161d";
    scene.width ??= project.settings.gameWidth ?? 1280;
    scene.height ??= project.settings.gameHeight ?? 720;
    scene.gravityX ??= 0;
    scene.gravityY ??= 1200;
    scene.defaultCameraId ??= null;
    scene.defaultSpawnId ??= "default";
    scene.musicAssetId ??= null;
    scene.resetOnEnter ??= true;
    scene.tags ??= [];
    scene.layers = documentArray(scene.layers, fallback.scenes[0].layers);
    if (scene.layers.length === 0) scene.layers = fallback.scenes[0].layers.map((layer) => ({ ...layer }));
    for (const layer of scene.layers) {
      layer.visible ??= true;
      layer.locked ??= false;
      layer.renderOrder ??= 0;
      layer.parallaxX ??= 1;
      layer.parallaxY ??= 1;
      layer.editorColor ??= "#78909c";
      layer.runtimeIncluded ??= true;
    }
    for (let objectIndex = 0; objectIndex < scene.objects.length; objectIndex += 1) {
      const normalizedObject = normalizeGameObjectDocument(scene.objects[objectIndex], "layer-gameplay");
      if (!normalizedObject) {
        scene.objects.splice(objectIndex, 1);
        objectIndex -= 1;
        continue;
      }
      scene.objects[objectIndex] = normalizedObject;
      const object = scene.objects[objectIndex];
      object.tags ??= [];
      object.layerId ??= "layer-gameplay";
      object.prefabId ??= null;
      object.prefabOverrides ??= [];
      object.parentId ??= null;
      object.enabled ??= true;
      object.editorVisible ??= true;
      object.runtimeVisible ??= true;
      object.collisionEnabled ??= true;
      object.logicEnabled ??= true;
      object.locked ??= false;
      object.size ??= { width: 64, height: 64 };
      object.transform ??= { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, pivot: { x: 0.5, y: 0.5 } };
      object.transform.position ??= { x: 0, y: 0 };
      object.transform.rotation ??= 0;
      object.transform.scale ??= { x: 1, y: 1 };
      object.transform.pivot ??= { x: 0.5, y: 0.5 };
      object.components ??= (object as any).elements ?? [];
      delete (object as any).elements;
      for (const element of object.components) {
        element.enabled ??= true;
        element.settings ??= {};
        try {
          const definition = getComponentDefinition(element.type);
          for (const setting of definition.settings) {
            if (element.settings[setting.key] === undefined) element.settings[setting.key] = setting.defaultValue;
          }
        } catch {
          // Diagnostics will report unsupported legacy element types without discarding project data.
        }
        if (element.type === "camera") {
          element.settings.primary ??= true;
          element.settings.fieldOfView ??= 60;
          element.settings.zoom ??= 1;
          element.settings.boundsLeft ??= -640;
          element.settings.boundsTop ??= -360;
          element.settings.boundsRight ??= 640;
          element.settings.boundsBottom ??= 360;
        } else if (element.type === "camera-zone") {
          element.settings.fieldOfView ??= 60;
        } else if (element.type === "scene-exit") {
          element.settings.destinationSpawnId ??= "default";
        } else if (element.type === "save-state") {
          element.settings.persistAcrossScenes ??= false;
        } else if (element.type === "tilemap-renderer") {
          element.settings.cells ??= "{}";
          element.settings.collisionEnabled ??= true;
          element.settings.visibleInPreview ??= true;
        }
      }
    }
  }

  project.metadata.updatedAt = new Date().toISOString();
  return projectWithPhase10Defaults(project);
}

function parseProject(contents: string): ProjectDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("The selected file does not contain valid project JSON.");
  }
  return validateProject(parsed);
}

export function parseProjectContents(contents: string): ProjectDocument {
  return parseProject(contents);
}

export async function readPackagedPlayerProject(): Promise<string | null> {
  if (!isRunningInsideTauri()) return null;
  return invoke<string | null>("read_player_launch_package");
}

function browserOpenProject(): Promise<LoadedProject | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `.${PROJECT_EXTENSION},${LEGACY_PROJECT_EXTENSIONS.map((extension) => `.${extension}`).join(",")},application/json`;
    input.addEventListener(
      "change",
      async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          resolve({ project: parseProject(await file.text()), path: null, root: null });
        } catch (error) {
          reject(error);
        }
      },
      { once: true },
    );
    input.click();
  });
}

function browserSaveProject(project: ProjectDocument): SavedProject {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeName =
    project.metadata.name
      .trim()
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, " ") || "Untitled Game";
  anchor.href = url;
  anchor.download = `${safeName}.${PROJECT_EXTENSION}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { path: null, root: null };
}

function ensureProjectExtension(path: string): string {
  const lower = path.toLowerCase();
  if ([PROJECT_EXTENSION, ...LEGACY_PROJECT_EXTENSIONS].some((extension) => lower.endsWith(`.${extension}`))) return path;
  return `${path}.${PROJECT_EXTENSION}`;
}

export async function createProjectFolderOnDisk(
  project: ProjectDocument,
  baseDirectory?: string,
): Promise<ProjectLocation | null> {
  if (!isRunningInsideTauri()) {
    browserSaveProject(project);
    return null;
  }

  let directory = baseDirectory;
  if (!directory) {
    const selected = await openDialog({
      title: "Choose a folder for the new project",
      directory: true,
      multiple: false,
    });
    directory = Array.isArray(selected) ? selected[0] : selected ?? undefined;
  }

  if (!directory) {
    return null;
  }

  return invoke<ProjectLocation>("create_project_folder", {
    baseDirectory: directory,
    projectName: project.metadata.name,
    contents: JSON.stringify(project, null, 2),
  });
}

export async function openProjectFromDisk(): Promise<LoadedProject | null> {
  if (!isRunningInsideTauri()) {
    return browserOpenProject();
  }

  const selected = await openDialog({
    title: "Open ShadowiumUI Project",
    multiple: false,
    directory: false,
    filters: [
      { name: "ShadowiumUI Project", extensions: [PROJECT_EXTENSION, ...LEGACY_PROJECT_EXTENSIONS] },
    ],
  });
  const path = Array.isArray(selected) ? selected[0] : selected;
  if (!path) return null;

  const contents = await invoke<string>("read_project_file", { path });
  return {
    project: parseProject(contents),
    path,
    root: parentPath(path),
  };
}

export async function saveProjectToDisk(
  project: ProjectDocument,
  currentPath: string | null,
  currentRoot: string | null,
  forceSaveAs = false,
): Promise<SavedProject | null> {
  if (!isRunningInsideTauri()) {
    return browserSaveProject(project);
  }

  let path = forceSaveAs || !currentPath ? null : currentPath;
  if (!path) {
    const safeName =
      project.metadata.name
        .trim()
        .replace(/[<>:"/\\|?*]+/g, "-")
        .replace(/\s+/g, " ") || "Untitled Game";
    const selected = await saveDialog({
      title: "Save ShadowiumUI Project",
      defaultPath: currentRoot
        ? `${currentRoot}/${safeName}.${PROJECT_EXTENSION}`
        : `${safeName}.${PROJECT_EXTENSION}`,
      filters: [
        { name: "ShadowiumUI Project", extensions: [PROJECT_EXTENSION, ...LEGACY_PROJECT_EXTENSIONS] },
      ],
    });
    if (!selected) return null;
    path = ensureProjectExtension(selected);
  }

  await invoke("write_project_file", {
    path,
    contents: JSON.stringify(project, null, 2),
  });

  return { path, root: parentPath(path) };
}

export async function chooseAssetFiles(): Promise<string[]> {
  if (!isRunningInsideTauri()) {
    return [];
  }
  const selected = await openDialog({
    title: "Import project assets",
    multiple: true,
    directory: false,
    filters: [
      { name: "Game Assets", extensions: ["png", "jpg", "jpeg", "webp", "wav", "mp3", "ogg"] },
    ],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}


export async function chooseAssetFolder(): Promise<string | null> {
  if (!isRunningInsideTauri()) {
    return null;
  }

  const selected = await openDialog({
    title: "Import an asset folder",
    multiple: false,
    directory: true,
  });

  if (!selected) return null;
  return Array.isArray(selected) ? selected[0] ?? null : selected;
}

export async function importAssetDirectory(
  projectPath: string,
  sourceDirectory: string,
): Promise<ImportedAssetFile[]> {
  return invoke<ImportedAssetFile[]>("import_asset_directory", {
    projectPath,
    sourceDirectory,
  });
}

export async function importAssetFiles(
  projectPath: string,
  sources: string[],
): Promise<ImportedAssetFile[]> {
  return invoke<ImportedAssetFile[]>("import_asset_files", {
    projectPath,
    sources,
  });
}

export async function readAssetDataUrl(
  projectPath: string,
  relativePath: string,
): Promise<string> {
  return invoke<string>("read_asset_data_url", {
    projectPath,
    relativePath,
  });
}

export async function readPackagedAssetDataUrl(relativePath: string): Promise<string> {
  return invoke<string>("read_packaged_asset_data_url", { relativePath });
}

export async function deleteAssetFile(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  await invoke("delete_project_asset", { projectPath, relativePath });
}

export async function revealAssetFile(
  projectPath: string,
  relativePath: string,
): Promise<void> {
  await invoke("reveal_project_asset", { projectPath, relativePath });
}

export { isRunningInsideTauri };


function downloadBuildFile(name: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createRuntimeHtml(project: ProjectDocument): string {
  const safeJson = JSON.stringify(project).replace(/<\/script/gi, "<\\/script");
  const title = project.metadata.name.replace(/[<>&"]/g, "");
  const uiTheme = project.gameUiThemes?.find((theme) => theme.id === project.activeGameUiThemeId) ?? project.gameUiThemes?.[0];
  const uiFont = (uiTheme?.fontFamily || "Segoe UI, Arial, sans-serif").replace(/[<>]/g, "");
  const uiText = uiTheme?.textColor || "#ffffff";
  const uiAccent = uiTheme?.accentColor || "#90caf9";
  const uiPanel = uiTheme?.panelColor || "#081019ed";
  const uiButton = uiTheme?.buttonColor || "#111a28";
  const uiSelected = uiTheme?.selectedColor || "#ffffff";
  const uiSelectedBackground = uiTheme?.selectedBackground || "#705cff";
  const uiRadius = Math.max(0, Number(uiTheme?.cornerRadius ?? 10));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090d12;color:${uiText};font-family:${uiFont}}body{display:grid;place-items:center}
#frame{position:relative;width:min(100vw,calc(100vh * ${project.settings.gameWidth}/${project.settings.gameHeight}));aspect-ratio:${project.settings.gameWidth}/${project.settings.gameHeight};overflow:hidden;background:#111820;box-shadow:0 24px 80px #000a}
canvas{width:100%;height:100%;display:block;image-rendering:${project.settings.pixelPerfect ? "pixelated" : "auto"}}
#prompt{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);padding:10px 16px;border:1px solid #ffffff33;border-radius:8px;background:#0b1017dd;font-weight:700;opacity:0;transition:.15s;pointer-events:none}
#toast{position:absolute;left:16px;top:16px;padding:8px 12px;border-radius:6px;background:#0b1017cc;color:#cfe1ff;font-size:13px;pointer-events:none}
#dialogue{position:absolute;left:8%;right:8%;bottom:6%;display:none;padding:18px 20px;border:1px solid #ffffff2f;border-radius:${uiRadius}px;background:${uiPanel};box-shadow:0 18px 60px #0009}
#dialogue strong{display:block;margin-bottom:8px;color:${uiAccent}}#dialogue p{margin:0;line-height:1.45}#dialogue small{display:block;margin-top:10px;color:#8fa4b8}.dialogue-choices{display:grid;gap:7px;margin-top:12px}.dialogue-choices button{border:0;border-radius:${uiRadius}px;padding:9px 11px;text-align:left;background:${uiButton};color:${uiText};font:inherit}.dialogue-choices button:hover,.dialogue-choices button:focus{background:${uiSelectedBackground};color:${uiSelected};outline:none}
</style></head><body><div id="frame"><canvas id="game" width="${project.settings.gameWidth}" height="${project.settings.gameHeight}"></canvas><div id="prompt"></div><div id="toast">Shadowium Runtime</div><div id="dialogue"><strong></strong><p></p><div class="dialogue-choices"></div><small>Press E, Enter, or Space to continue</small></div></div>
<script id="game-data" type="application/json">${safeJson}</script><script>
(() => {
  'use strict';
  const project = JSON.parse(document.getElementById('game-data').textContent || '{}');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const prompt = document.getElementById('prompt');
  const toast = document.getElementById('toast');
  const dialogueBox = document.getElementById('dialogue');
  const keys = new Set();
  const justPressed = new Set();
  const triggerPairs = new Set();
  const images = new Map();
  const audioChannels = new Map();
  let variables = { ...(project.variables || {}) };
  let inventory = {};
  let persisted = {};
  let sceneId = project.settings.initialSceneId || project.activeSceneId;
  let objects = [];
  let activeCameraZoneId = null;
  let dialogue = null;
  let paused = false;
  let lastFrame = performance.now();
  let camera = { x: 0, y: 0, zoom: 1, fov: 60, lookAheadX: 0, lookAheadY: 0, shakeMs: 0, shakeAmount: 0, shakePhase: 0 };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const element = (object, type) => object && object.components.find((entry) => entry.type === type && entry.enabled);
  const colliderTypes = ['box-collider','circle-collider','polygon-collider','capsule-collider','edge-collider','chain-collider','sensor'];
  const colliderFor = (object) => object && object.components.find((entry) => entry.enabled && colliderTypes.includes(entry.type));
  const colliderBehavior = (object) => {
    const collider = colliderFor(object);
    const body = element(object, 'rigidbody-2d');
    if (!collider) return 'none';
    if (collider.type === 'sensor' || collider.settings.sensor === true || collider.settings.behavior === 'trigger') return 'trigger';
    if (body && String(body.settings.bodyType || 'dynamic') !== 'static') return 'dynamic';
    return String(collider.settings.behavior || 'static');
  };
  const scene = () => project.scenes.find((entry) => entry.id === sceneId) || project.scenes[0];
  const layer = (id) => scene().layers.find((entry) => entry.id === id);
  const actionKeys = (id) => (project.settings.inputActions.find((entry) => entry.id === id) || { keys: [] }).keys;
  const runtimeSaveKey = (object) => String((element(object, 'save-state') || { settings: {} }).settings.saveKey || object.sourceSceneId + '/' + object.id);
  const hasWorldRenderer = (object) => Boolean(element(object, 'sprite-renderer') || element(object, 'tilemap-renderer'));
  const controllerOnly = (object) => !hasWorldRenderer(object) && Boolean(element(object, 'camera') || element(object, 'scene-spawn-point') || element(object, 'audio-source'));
  const worldLayerIncluded = (object) => (layer(object.layerId) || { runtimeIncluded: true }).runtimeIncluded !== false;

  function showToast(message, duration) {
    toast.textContent = String(message || project.metadata.name);
    if (duration !== 0) window.setTimeout(() => { toast.textContent = project.metadata.name; }, duration || 1600);
  }

  function imageFor(asset) {
    if (!asset) return null;
    if (!images.has(asset.id)) {
      const image = new Image();
      image.src = asset.relativePath;
      images.set(asset.id, image);
    }
    return images.get(asset.id);
  }

  function audioGroupVolume(groupId) {
    const groups = project.settings.audioGroups || [];
    const master = groups.find((entry) => entry.id === 'master');
    const group = groups.find((entry) => entry.id === groupId);
    if (master && master.muted) return 0;
    if (group && group.muted) return 0;
    return clamp(Number(master ? master.volume : 1) * Number(group ? group.volume : 1), 0, 1);
  }

  function stopAudio(objectId) {
    if (objectId) {
      const channel = audioChannels.get(objectId);
      if (channel) {
        channel.pause();
        channel.currentTime = 0;
        audioChannels.delete(objectId);
      }
      return;
    }
    for (const channel of audioChannels.values()) {
      channel.pause();
      channel.currentTime = 0;
    }
    audioChannels.clear();
  }

  function playAudio(object) {
    const source = element(object, 'audio-source');
    const asset = source && project.assets.find((entry) => entry.id === source.settings.assetId);
    if (!source || !asset) return;
    stopAudio(object.id);
    const channel = new Audio(asset.relativePath);
    channel.loop = source.settings.loop === true;
    channel.playbackRate = clamp(Number(source.settings.pitch || 1), 0.25, 4);
    channel.volume = clamp(Number(source.settings.volume == null ? 1 : source.settings.volume) * audioGroupVolume(String(source.settings.group || 'sfx')), 0, 1);
    channel.addEventListener('ended', () => {
      audioChannels.delete(object.id);
      fireRules('audio-finished', object.id, null);
    }, { once: true });
    audioChannels.set(object.id, channel);
    channel.play().catch(() => showToast('Audio is waiting for a user interaction.', 1600));
  }

  function playSceneAudio() {
    for (const object of objects) {
      const source = element(object, 'audio-source');
      if (object.enabled && !object.destroyed && object.logicEnabled !== false && source && source.settings.playOnStart === true) playAudio(object);
    }
  }

  function rotateCollisionPoint(point, center, degrees) {
    const radians = Number(degrees || 0) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const offsetX = point.x - center.x;
    const offsetY = point.y - center.y;
    return { x: center.x + offsetX * cosine - offsetY * sine, y: center.y + offsetX * sine + offsetY * cosine };
  }

  function polygonAabb(points) {
    let left = points[0].x;
    let right = points[0].x;
    let top = points[0].y;
    let bottom = points[0].y;
    for (const point of points.slice(1)) {
      left = Math.min(left, point.x); right = Math.max(right, point.x);
      top = Math.min(top, point.y); bottom = Math.max(bottom, point.y);
    }
    return { left, right, top, bottom };
  }

  function collisionShape(object, x, y) {
    if (!object || object.collisionEnabled === false) return null;
    const collider = colliderFor(object);
    if (!collider) return null;
    const scaleX = Number(object.transform.scale.x || 1);
    const scaleY = Number(object.transform.scale.y || 1);
    const rotation = Number(object.transform.rotation || 0);
    const colliderRotation = rotation + Number(collider.settings.localRotation || 0);
    const center = { x: x == null ? object.x : x, y: y == null ? object.y : y };
    const rawOffset = { x: Number(collider.settings.offsetX || 0) * scaleX, y: Number(collider.settings.offsetY || 0) * scaleY };
    const offset = rotateCollisionPoint({ x: center.x + rawOffset.x, y: center.y + rawOffset.y }, center, rotation);
    if (collider.type === 'circle-collider') {
      const radius = Number(collider.settings.radius || Math.min(object.size.width, object.size.height) / 2);
      const radiusX = radius * Math.abs(scaleX);
      const radiusY = radius * Math.abs(scaleY);
      if (Math.abs(radiusX - radiusY) < 0.001) return { kind: 'circle', center: offset, radius: radiusX, points: [], aabb: { left: offset.x - radiusX, right: offset.x + radiusX, top: offset.y - radiusX, bottom: offset.y + radiusX } };
      const points = Array.from({ length: 24 }, (_, index) => {
        const angle = index / 24 * Math.PI * 2;
        return rotateCollisionPoint({ x: offset.x + Math.cos(angle) * radiusX, y: offset.y + Math.sin(angle) * radiusY }, offset, colliderRotation);
      });
      return { kind: 'polygon', center: offset, radius: 0, points, aabb: polygonAabb(points) };
    }
    if (collider.type === 'capsule-collider') {
      const width = Number(collider.settings.width || object.size.width) * Math.abs(scaleX);
      const height = Number(collider.settings.height || object.size.height) * Math.abs(scaleY);
      const radius = Math.min(width / 2, height / 2);
      const vertical = height >= width;
      const points = [];
      for (let index = 0; index < 20; index += 1) {
        const angle = index / 20 * Math.PI * 2;
        const offsetAxis = vertical ? Math.max(0, height / 2 - radius) * (Math.sin(angle) >= 0 ? 1 : -1) : Math.max(0, width / 2 - radius) * (Math.cos(angle) >= 0 ? 1 : -1);
        const point = vertical
          ? { x: offset.x + Math.cos(angle) * radius, y: offset.y + Math.sin(angle) * radius + offsetAxis }
          : { x: offset.x + Math.cos(angle) * radius + offsetAxis, y: offset.y + Math.sin(angle) * radius };
        points.push(rotateCollisionPoint(point, offset, colliderRotation));
      }
      return { kind: 'polygon', center: offset, radius: 0, points, aabb: polygonAabb(points) };
    }
    if (collider.type === 'edge-collider') {
      const start = rotateCollisionPoint({ x: offset.x + Number(collider.settings.startX || -32) * scaleX, y: offset.y + Number(collider.settings.startY || 0) * scaleY }, offset, colliderRotation);
      const end = rotateCollisionPoint({ x: offset.x + Number(collider.settings.endX || 32) * scaleX, y: offset.y + Number(collider.settings.endY || 0) * scaleY }, offset, colliderRotation);
      const dx = end.x - start.x; const dy = end.y - start.y; const length = Math.hypot(dx, dy) || 1; const thickness = 2;
      const nx = -dy / length * thickness; const ny = dx / length * thickness;
      const points = [{ x: start.x + nx, y: start.y + ny }, { x: end.x + nx, y: end.y + ny }, { x: end.x - nx, y: end.y - ny }, { x: start.x - nx, y: start.y - ny }];
      return { kind: 'polygon', center: offset, radius: 0, points, aabb: polygonAabb(points) };
    }
    if (collider.type === 'chain-collider') {
      const sourcePoints = String(collider.settings.points || '-64,0;0,-16;64,0').split(';').map((pair) => pair.split(',').map(Number)).filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
      if (sourcePoints.length < 2) return null;
      const transformed = sourcePoints.map((pair) => rotateCollisionPoint({ x: offset.x + pair[0] * scaleX, y: offset.y + pair[1] * scaleY }, offset, colliderRotation));
      const bounds = polygonAabb(transformed);
      const padding = 2;
      const points = [{ x: bounds.left - padding, y: bounds.top - padding }, { x: bounds.right + padding, y: bounds.top - padding }, { x: bounds.right + padding, y: bounds.bottom + padding }, { x: bounds.left - padding, y: bounds.bottom + padding }];
      return { kind: 'polygon', center: offset, radius: 0, points, aabb: polygonAabb(points) };
    }
    if (collider.type === 'sensor' && String(collider.settings.shape || 'box') === 'circle') {
      const radius = Number(collider.settings.radius || 48) * Math.max(Math.abs(scaleX), Math.abs(scaleY));
      return { kind: 'circle', center: offset, radius, points: [], aabb: { left: offset.x - radius, right: offset.x + radius, top: offset.y - radius, bottom: offset.y + radius } };
    }
    if (collider.type === 'sensor' && String(collider.settings.shape || 'box') === 'capsule') {
      const width = Number(collider.settings.width || 96) * Math.abs(scaleX);
      const height = Number(collider.settings.height || 96) * Math.abs(scaleY);
      const radius = Math.min(width / 2, height / 2);
      const points = Array.from({ length: 20 }, (_, index) => {
        const angle = index / 20 * Math.PI * 2;
        return rotateCollisionPoint({ x: offset.x + Math.cos(angle) * radius, y: offset.y + Math.sin(angle) * radius + Math.sign(Math.sin(angle)) * Math.max(0, height / 2 - radius) }, offset, colliderRotation);
      });
      return { kind: 'polygon', center: offset, radius: 0, points, aabb: polygonAabb(points) };
    }
    if (collider.type === 'polygon-collider') {
      const points = String(collider.settings.points || '-32,-32;32,-32;32,32;-32,32').split(';').map((pair) => pair.split(',').map((value) => Number(value.trim()))).filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1])).map((pair) => rotateCollisionPoint({ x: offset.x + pair[0] * scaleX, y: offset.y + pair[1] * scaleY }, offset, colliderRotation));
      if (points.length < 3) return null;
      return { kind: 'polygon', center: offset, radius: 0, points, aabb: polygonAabb(points) };
    }
    const width = Number(collider.settings.width || object.size.width) * Math.abs(scaleX);
    const height = Number(collider.settings.height || object.size.height) * Math.abs(scaleY);
    const points = [
      { x: offset.x - width / 2, y: offset.y - height / 2 },
      { x: offset.x + width / 2, y: offset.y - height / 2 },
      { x: offset.x + width / 2, y: offset.y + height / 2 },
      { x: offset.x - width / 2, y: offset.y + height / 2 },
    ].map((point) => rotateCollisionPoint(point, offset, colliderRotation));
    return { kind: 'polygon', center: offset, radius: 0, points, aabb: polygonAabb(points) };
  }

  function box(object, x, y) {
    const shape = collisionShape(object, x, y);
    if (shape) return shape.aabb;
    const width = object.size.width * Math.abs(object.transform.scale.x);
    const height = object.size.height * Math.abs(object.transform.scale.y);
    const centerX = x == null ? object.x : x;
    const centerY = y == null ? object.y : y;
    return { left: centerX - width / 2, right: centerX + width / 2, top: centerY - height / 2, bottom: centerY + height / 2 };
  }

  function intersects(left, right) {
    return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
  }

  function polygonAxes(points) {
    return points.map((point, index) => {
      const next = points[(index + 1) % points.length];
      const edgeX = next.x - point.x;
      const edgeY = next.y - point.y;
      const length = Math.hypot(edgeX, edgeY) || 1;
      return { x: -edgeY / length, y: edgeX / length };
    });
  }

  function projectPoints(points, axis) {
    const values = points.map((point) => point.x * axis.x + point.y * axis.y);
    return { min: Math.min(...values), max: Math.max(...values) };
  }

  function polygonIntersects(left, right) {
    for (const axis of polygonAxes(left).concat(polygonAxes(right))) {
      const a = projectPoints(left, axis);
      const b = projectPoints(right, axis);
      if (a.max <= b.min || b.max <= a.min) return false;
    }
    return true;
  }

  function pointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
      const current = polygon[index];
      const before = polygon[previous];
      if ((current.y > point.y) !== (before.y > point.y) && point.x < (before.x - current.x) * (point.y - current.y) / ((before.y - current.y) || Number.EPSILON) + current.x) inside = !inside;
    }
    return inside;
  }

  function circlePolygonIntersects(circle, polygon) {
    if (pointInPolygon(circle.center, polygon)) return true;
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index];
      const end = polygon[(index + 1) % polygon.length];
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      const lengthSquared = deltaX * deltaX + deltaY * deltaY;
      const t = lengthSquared <= Number.EPSILON ? 0 : clamp(((circle.center.x - start.x) * deltaX + (circle.center.y - start.y) * deltaY) / lengthSquared, 0, 1);
      const closest = { x: start.x + deltaX * t, y: start.y + deltaY * t };
      if (Math.hypot(circle.center.x - closest.x, circle.center.y - closest.y) < circle.radius) return true;
    }
    return false;
  }

  function collisionShapesIntersect(left, right) {
    if (!left || !right || !intersects(left.aabb, right.aabb)) return false;
    if (left.kind === 'circle' && right.kind === 'circle') return Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y) < left.radius + right.radius;
    if (left.kind === 'circle') return circlePolygonIntersects(left, right.points);
    if (right.kind === 'circle') return circlePolygonIntersects(right, left.points);
    return polygonIntersects(left.points, right.points);
  }

  function cameraObjects() {
    return objects.filter((object) => object.enabled && !object.destroyed && element(object, 'camera'));
  }

  function activeCameraObject() {
    const candidates = cameraObjects();
    return candidates.find((object) => element(object, 'camera').settings.primary === true) || candidates[0] || null;
  }

  function activeCameraElement() {
    return element(activeCameraObject(), 'camera');
  }

  function activeCameraZone() {
    return objects.find((object) => object.id === activeCameraZoneId) || null;
  }

  function effectiveCameraZoom(cameraElement, zoneElement) {
    const fieldOfView = clamp(Number(zoneElement ? zoneElement.settings.fieldOfView || 60 : cameraElement ? cameraElement.settings.fieldOfView || 60 : 60), 20, 160);
    const baseZoom = Number(zoneElement ? zoneElement.settings.zoom || 1 : cameraElement ? cameraElement.settings.zoom || 1 : 1);
    return { fieldOfView, zoom: clamp(baseZoom * (60 / fieldOfView), 0.05, 8) };
  }

  function capturePersistent() {
    for (const object of objects) {
      const save = element(object, 'save-state');
      const pickup = element(object, 'item-pickup');
      const player = element(object, 'player-input');
      if (!save && !(pickup && pickup.settings.persistent === true) && !player) continue;
      const key = runtimeSaveKey(object);
      persisted[key] = {
        ...(persisted[key] || {}),
        enabled: object.enabled,
        destroyed: object.destroyed,
        x: save && save.settings.saveTransform === true ? object.x : undefined,
        y: save && save.settings.saveTransform === true ? object.y : undefined,
        health: save && save.settings.saveHealth !== false ? object.health : undefined,
        shield: save && save.settings.saveHealth !== false ? object.shield : undefined,
        resources: save && save.settings.saveInventory !== false ? clone(object.resources || {}) : undefined,
        cooldowns: save && save.settings.saveVariables === true ? clone(object.cooldowns || {}) : undefined,
        statuses: save && save.settings.saveVariables === true ? clone(object.statuses || []) : undefined,
        stats: save && save.settings.saveVariables === true ? clone(object.stats || {}) : undefined,
        experience: save && save.settings.saveVariables !== false ? object.experience : undefined,
        level: save && save.settings.saveVariables !== false ? object.level : undefined,
        currencies: save && save.settings.saveInventory !== false ? clone(object.currencies || {}) : undefined,
        skills: save && save.settings.saveVariables !== false ? clone(object.skills || []) : undefined,
        upgrades: save && save.settings.saveVariables !== false ? clone(object.upgrades || []) : undefined,
        dead: object.dead === true,
        runtimeVisible: object.runtimeVisible,
        collisionEnabled: object.collisionEnabled,
        logicEnabled: object.logicEnabled,
        object: save && save.settings.persistAcrossScenes === true || player ? clone(object) : undefined,
        sourceSceneId: object.sourceSceneId,
      };
    }
  }

  function writeSave(targetSceneId) {
    capturePersistent();
    localStorage.setItem('shadowium:' + project.metadata.id, JSON.stringify({
      version: 1,
      variables,
      inventory,
      persisted,
      sceneId: targetSceneId || sceneId,
    }));
  }

  function readSave() {
    const raw = localStorage.getItem('shadowium:' + project.metadata.id);
    if (!raw) return false;
    try {
      const saved = JSON.parse(raw);
      variables = { ...(project.variables || {}), ...(saved.variables || {}) };
      inventory = { ...(saved.inventory || {}) };
      persisted = { ...(saved.persisted || {}) };
      loadScene(saved.sceneId || project.settings.initialSceneId, '', false);
      showToast('Save loaded.');
      return true;
    } catch (error) {
      showToast('Could not load save: ' + String(error));
      return false;
    }
  }

  function parseList(value) {
    if (Array.isArray(value)) return value.map(String).map((entry) => entry.trim()).filter(Boolean);
    return String(value == null ? '' : value).split(/[,;\n]/).map((entry) => entry.trim()).filter(Boolean);
  }

  function parseNumberMap(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, Number(entry) || 0]));
    const source = String(value == null ? '' : value).trim();
    if (!source) return {};
    if (source.startsWith('{')) {
      try { return Object.fromEntries(Object.entries(JSON.parse(source)).map(([key, entry]) => [key, Number(entry) || 0])); }
      catch { /* Fall through to key:value syntax. */ }
    }
    const result = {};
    for (const part of source.split(/[,;\n]/)) {
      const pair = part.split(':');
      const key = String(pair.shift() || '').trim();
      if (key) result[key] = Number(pair.join(':')) || 0;
    }
    return result;
  }

  function parseJsonRecord(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) return { ...value };
    try {
      const parsed = JSON.parse(String(value == null ? '{}' : value));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  function experienceRequired(curve, level) {
    if (!curve) return Math.max(1, 100 * level);
    const base = Math.max(1, Number(curve.baseExperience || 100));
    const growth = Math.max(0.01, Number(curve.growthFactor || 1.25));
    if (curve.formula === 'linear') return Math.max(1, Math.round(base + (level - 1) * base * Math.max(0, growth - 1)));
    if (curve.formula === 'quadratic') return Math.max(1, Math.round(base * (1 + Math.max(0, growth - 1) * Math.pow(level - 1, 2))));
    return Math.max(1, Math.round(base * Math.pow(growth, Math.max(0, level - 1))));
  }

  function teamId(object) {
    const team = element(object, 'team');
    return String(team ? team.settings.teamId || 'Neutral' : 'Neutral').trim() || 'Neutral';
  }

  function teamsHostile(source, target) {
    if (!source || !target || source === target) return false;
    const sourceTeam = element(source, 'team');
    const own = teamId(source);
    const other = teamId(target);
    if (!sourceTeam) return own !== other;
    if (own === other) return sourceTeam.settings.friendlyFire === true;
    const hostile = parseList(sourceTeam.settings.hostileTeams);
    if (hostile.length) return hostile.includes(other) || hostile.includes('*');
    if (parseList(sourceTeam.settings.friendlyTeams).includes(other)) return false;
    return own !== 'Neutral' && other !== 'Neutral';
  }

  function resistanceFor(object, damageTypeId) {
    const resistance = element(object, 'resistance');
    if (!resistance) return 0;
    if (parseList(resistance.settings.immunities).includes(damageTypeId)) return 1;
    const value = Number(parseNumberMap(resistance.settings.values)[damageTypeId] || 0);
    return clamp(value > 1 || value < -1 ? value / 100 : value, -10, 1);
  }

  function setAiState(object, nextState, reason) {
    if (!object || object.aiState === nextState) return;
    const previous = object.aiState || 'Idle';
    object.previousAiState = previous;
    object.aiState = nextState;
    object.aiReason = reason || '';
    fireRules('ai-state-exited', object.id, null);
    fireRules('ai-state-entered', object.id, null);
  }

  function applyStatus(target, statusId, sourceId, duration) {
    const definition = project.statusEffects.find((entry) => entry.id === statusId);
    const receiver = element(target, 'status-receiver');
    if (!definition || !receiver || parseList(receiver.settings.immunities).includes(statusId)) return;
    const requestedDuration = Math.max(0, Number(duration == null ? definition.durationSeconds : duration) * Number(receiver.settings.durationMultiplier == null ? 1 : receiver.settings.durationMultiplier));
    const current = target.statuses.find((entry) => entry.id === statusId);
    if (!current) target.statuses.push({ id: statusId, remaining: requestedDuration, tickRemaining: Math.max(0.001, Number(definition.tickIntervalSeconds || 0.001)), stacks: 1, sourceId: sourceId || target.id });
    else if (definition.stacking === 'refresh') current.remaining = Math.max(current.remaining, requestedDuration);
    else if (definition.stacking === 'stack-duration') current.remaining += requestedDuration;
    else if (definition.stacking === 'stack-intensity') { current.stacks = Math.min(Number(definition.maximumStacks || 1), current.stacks + 1); current.remaining = Math.max(current.remaining, requestedDuration); }
    fireRules('status-applied', sourceId || null, target.id);
  }

  function removeStatus(target, statusId) {
    const before = target.statuses.length;
    target.statuses = target.statuses.filter((entry) => entry.id !== statusId);
    if (target.statuses.length !== before) fireRules('status-removed', target.id, null);
  }

  function grantLoot(receiver, result) {
    if (!receiver || !result || result.amount <= 0) return;
    if (result.kind === 'item') inventory[result.referenceId] = Number(inventory[result.referenceId] || 0) + result.amount;
    else if (result.kind === 'currency') receiver.currencies[result.referenceId] = Number(receiver.currencies[result.referenceId] || 0) + result.amount;
    else if (result.kind === 'experience') awardExperience(receiver, result.amount);
    else if (result.kind === 'prefab') spawnPrefab(result.referenceId, receiver.x, receiver.y, receiver);
    else if (result.kind === 'loot-table') rollLoot(result.referenceId, receiver, 1);
  }

  function rollLoot(tableId, receiver, depth) {
    if ((depth || 0) > 6) return [];
    const table = project.lootTables.find((entry) => entry.id === tableId);
    if (!table) return [];
    const results = [];
    const eligible = table.entries.filter((entry) => !entry.conditionVariable || variables[entry.conditionVariable] === entry.conditionValue);
    for (const entry of eligible.filter((candidate) => candidate.guaranteed)) {
      const amount = Math.floor(Number(entry.minimumAmount || 0) + Math.random() * (Math.max(Number(entry.minimumAmount || 0), Number(entry.maximumAmount || 0)) - Number(entry.minimumAmount || 0) + 1));
      results.push({ ...entry, amount });
    }
    const weighted = eligible.filter((entry) => !entry.guaranteed && Number(entry.weight || 0) > 0);
    for (let roll = 0; roll < Math.max(0, Number(table.rolls || 0)); roll += 1) {
      const total = weighted.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
      if (total <= 0) break;
      let cursor = Math.random() * total;
      let picked = weighted[weighted.length - 1];
      for (const entry of weighted) { cursor -= Number(entry.weight || 0); if (cursor <= 0) { picked = entry; break; } }
      const amount = Math.floor(Number(picked.minimumAmount || 0) + Math.random() * (Math.max(Number(picked.minimumAmount || 0), Number(picked.maximumAmount || 0)) - Number(picked.minimumAmount || 0) + 1));
      results.push({ ...picked, amount });
    }
    for (const result of results) grantLoot(receiver, result);
    if (results.length) fireRules('loot-dropped', receiver ? receiver.id : null, null);
    return results;
  }

  function awardExperience(object, amount) {
    if (!object || !element(object, 'experience') || amount <= 0) return;
    object.experience += amount;
    const experienceComponent = element(object, 'experience');
    const levelComponent = element(object, 'level');
    const curve = project.experienceCurves.find((entry) => entry.id === String(experienceComponent.settings.curveId || 'default')) || project.experienceCurves[0];
    const maximumLevel = Math.max(1, Number(levelComponent ? levelComponent.settings.maximumLevel || curve && curve.maximumLevel || 100 : curve && curve.maximumLevel || 100));
    while (object.level < maximumLevel) {
      const required = experienceRequired(curve, object.level);
      if (object.experience < required) break;
      object.experience -= required;
      object.level += 1;
      const growth = parseNumberMap(levelComponent ? levelComponent.settings.growthStats : '');
      for (const [statId, value] of Object.entries(growth)) object.stats[statId] = Number(object.stats[statId] || 0) + Number(value || 0);
      if (levelComponent && levelComponent.settings.restoreResourcesOnLevel !== false) {
        object.health = object.maxHealth;
        for (const [resourceId, maximum] of Object.entries(object.maxResources)) object.resources[resourceId] = maximum;
      }
      fireRules('level-up', object.id, null);
      showToast(object.name + ' reached level ' + object.level + '.');
    }
  }

  function damageObject(target, amount, sourceId, damageTypeId, ignoreTeam) {
    if (!target || target.destroyed || target.dead || target.health == null || amount <= 0) return 0;
    const source = objects.find((entry) => entry.id === sourceId) || target;
    const damageType = project.damageTypes.find((entry) => entry.id === damageTypeId);
    const healing = damageType && damageType.healing === true || damageTypeId === 'healing';
    if (!healing && !ignoreTeam && source !== target && !teamsHostile(source, target)) return 0;
    const now = performance.now() / 1000;
    if (!healing && now < Number(target.invulnerableUntil || 0)) return 0;
    const stats = source.stats || {};
    const base = Math.max(0, Math.abs(Number(amount)) + (healing ? 0 : Number(stats['attack-power'] || 0)));
    const critical = !healing && Math.random() < clamp(Number(stats['critical-chance'] || 0), 0, 1);
    const criticalMultiplier = critical ? Math.max(1, Number(stats['critical-multiplier'] || 1.5)) : 1;
    const statusMultiplier = target.statuses.reduce((total, status) => {
      const definition = project.statusEffects.find((entry) => entry.id === status.id);
      return total * Math.pow(Number(definition ? definition.damageMultiplier || 1 : 1), Number(status.stacks || 1));
    }, 1);
    const total = Math.max(0, base * criticalMultiplier * (healing ? 1 : 1 - resistanceFor(target, damageTypeId)) * statusMultiplier);
    let finalAmount = total;
    let shieldAbsorbed = 0;
    if (healing) target.health = Math.min(target.maxHealth == null ? Number.POSITIVE_INFINITY : target.maxHealth, target.health + total);
    else {
      shieldAbsorbed = Math.min(Math.max(0, Number(target.shield || 0)), total);
      target.shield = Math.max(0, Number(target.shield || 0) - shieldAbsorbed);
      finalAmount = Math.max(0, total - shieldAbsorbed);
      target.health = Math.max(0, target.health - finalAmount);
      const invulnerability = element(target, 'invulnerability');
      target.invulnerableUntil = now + Math.max(0, Number(invulnerability ? invulnerability.settings.duration || 0 : 0));
      fireRules('damage-dealt', source.id, target.id);
      fireRules('damage-received', target.id, source.id);
      runScripts(target, 'on_damage', { amount: finalAmount, damage_type: damageTypeId, source_id: source.id });
    }
    target.lastDamage = { sourceId: source.id, damageTypeId, baseAmount: base, finalAmount, shieldAbsorbed, critical, at: performance.now() };
    if (target.health <= 0 && !target.dead) handleDeath(target, source);
    return finalAmount;
  }

  function handleDeath(target, source) {
    target.dead = true;
    runScripts(target, 'on_destroy', { source_id: source ? source.id : '' });
    setAiState(target, 'Dead', 'Health reached zero');
    const death = element(target, 'death-behaviour');
    if (death && death.settings.disableCollision !== false) target.collisionEnabled = false;
    const receiver = source && element(source, 'reward-receiver') ? source : objects.find((entry) => element(entry, 'player-input') || element(entry, 'reward-receiver'));
    const loot = element(target, 'loot-dropper');
    const lootTableId = String(death && death.settings.lootTableId || loot && loot.settings.lootTableId || '');
    if (lootTableId) rollLoot(lootTableId, receiver || source || target, 0);
    const experienceAward = Math.max(0, Number(death && death.settings.experienceAward || 0));
    if (receiver && experienceAward) awardExperience(receiver, experienceAward);
    const delay = Math.max(0, Number(death && death.settings.delay || 0));
    target.deathTimer = delay;
    fireRules('damage-received', target.id, source ? source.id : null);
  }

  function spawnPrefab(prefabId, x, y, source) {
    const prefab = project.prefabs.find((entry) => entry.id === prefabId);
    if (!prefab || !prefab.object) return null;
    const copy = instantiate(prefab.object, sceneId);
    copy.id = 'runtime-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    copy.sourceSceneId = sceneId;
    copy.x = Number(x || 0);
    copy.y = Number(y || 0);
    copy.transform.position.x = copy.x;
    copy.transform.position.y = copy.y;
    copy.spawnedBy = source ? source.id : null;
    objects.push(copy);
    return copy;
  }

  function abilityTargets(caster, ability, explicitTargetId) {
    const explicit = explicitTargetId && objects.find((entry) => entry.id === explicitTargetId && entry.enabled && !entry.destroyed);
    if (ability.targetingMode === 'self') return [caster];
    if (explicit) return [explicit];
    const candidates = objects.filter((entry) => entry !== caster && entry.enabled && !entry.destroyed && teamsHostile(caster, entry));
    candidates.sort((left, right) => Math.hypot(left.x - caster.x, left.y - caster.y) - Math.hypot(right.x - caster.x, right.y - caster.y));
    const inRange = candidates.filter((entry) => Math.hypot(entry.x - caster.x, entry.y - caster.y) <= Math.max(0, Number(ability.range || 0)));
    return inRange.slice(0, Math.max(1, Number(ability.maximumTargets || 1)));
  }

  function executeAbility(caster, ability, explicitTargetId) {
    const targets = abilityTargets(caster, ability, explicitTargetId);
    for (const effect of ability.effects || []) {
      const targetList = ability.targetingMode === 'self' ? [caster] : targets;
      if (effect.type === 'spawn-prefab' || effect.type === 'summon') {
        const spawned = spawnPrefab(effect.prefabId, caster.x, caster.y, caster);
        if (spawned && element(spawned, 'projectile')) {
          const target = targets[0];
          const dx = target ? target.x - caster.x : caster.lastDirection === 'left' ? -1 : caster.lastDirection === 'right' ? 1 : 0;
          const dy = target ? target.y - caster.y : caster.lastDirection === 'up' ? -1 : caster.lastDirection === 'down' ? 1 : 0;
          const length = Math.hypot(dx, dy) || 1;
          const speed = Number(element(spawned, 'projectile').settings.speed || 320);
          spawned.velocityX = dx / length * speed;
          spawned.velocityY = dy / length * speed;
        }
        continue;
      }
      for (const target of targetList) {
        if (effect.type === 'damage') damageObject(target, effect.amount, caster.id, effect.damageTypeId || 'physical', false);
        else if (effect.type === 'heal') damageObject(target, effect.amount, caster.id, 'healing', true);
        else if (effect.type === 'apply-status') applyStatus(target, effect.statusEffectId, caster.id, effect.durationSeconds);
        else if (effect.type === 'remove-status') removeStatus(target, effect.statusEffectId);
        else if (effect.type === 'teleport') { caster.x = target.x; caster.y = target.y; }
        else if (effect.type === 'dash') {
          const dx = target.x - caster.x; const dy = target.y - caster.y; const length = Math.hypot(dx, dy) || 1;
          caster.x += dx / length * Number(effect.amount || 96); caster.y += dy / length * Number(effect.amount || 96);
        } else if (effect.type === 'knockback' || effect.type === 'pull') {
          const direction = effect.type === 'pull' ? -1 : 1;
          const dx = target.x - caster.x; const dy = target.y - caster.y; const length = Math.hypot(dx, dy) || 1;
          target.velocityX += dx / length * Number(effect.amount || 120) * direction;
          target.velocityY += dy / length * Number(effect.amount || 120) * direction;
        } else if (effect.type === 'modify-stat') target.stats[effect.statId] = Number(target.stats[effect.statId] || 0) + Number(effect.amount || 0);
        else if (effect.type === 'set-variable') variables[effect.statId || ability.id] = effect.value;
        else if (effect.type === 'screen-effect') { camera.shakeMs = Math.max(camera.shakeMs, Number(effect.durationSeconds || 0.25) * 1000); camera.shakeAmount = Math.max(camera.shakeAmount, Number(effect.amount || 4)); }
      }
    }
    caster.cooldowns[ability.id] = Math.max(0, Number(ability.cooldownSeconds || 0));
    caster.activeCast = null;
    fireRules('ability-finished', caster.id, targets[0] ? targets[0].id : null);
  }

  function castAbility(caster, abilityId, explicitTargetId) {
    if (!caster || caster.destroyed || caster.dead || caster.logicEnabled === false) return false;
    const abilityUser = element(caster, 'ability-user');
    const ability = project.abilities.find((entry) => entry.id === abilityId);
    if (!abilityUser || !ability || caster.cooldowns[ability.id] > 0 || caster.activeCast) return false;
    const allowed = parseList(abilityUser.settings.abilityIds);
    if (allowed.length && !allowed.includes(ability.id)) return false;
    if (ability.resourceId) {
      const current = Number(caster.resources[ability.resourceId] || 0);
      if (current < Number(ability.resourceCost || 0)) return false;
      caster.resources[ability.resourceId] = current - Number(ability.resourceCost || 0);
    }
    const castTime = Math.max(0, Number(ability.castTimeSeconds || 0));
    caster.activeCast = { abilityId: ability.id, remaining: castTime, targetId: explicitTargetId || null };
    fireRules('ability-cast', caster.id, explicitTargetId || null);
    if (castTime <= 0) executeAbility(caster, ability, explicitTargetId);
    return true;
  }

  function nearestHostile(source, maximumDistance) {
    let result = null;
    for (const candidate of objects) {
      if (candidate === source || !candidate.enabled || candidate.destroyed || candidate.dead || !teamsHostile(source, candidate)) continue;
      const distance = Math.hypot(candidate.x - source.x, candidate.y - source.y);
      if (distance <= maximumDistance && (!result || distance < result.distance)) result = { object: candidate, distance };
    }
    return result;
  }

  function updateAi(object, deltaSeconds) {
    const controller = element(object, 'ai-controller');
    if (!controller || controller.settings.enabledAtStart === false || object.dead) return;
    object.aiDecisionRemaining -= deltaSeconds;
    if (object.aiDecisionRemaining > 0) return;
    object.aiDecisionRemaining = Math.max(0.02, Number(controller.settings.decisionInterval || 0.12));
    const vision = element(object, 'vision-sensor');
    const range = Math.max(1, Number(vision ? vision.settings.range || 320 : 320));
    const targetResult = nearestHostile(object, range);
    const target = targetResult ? targetResult.object : object.aiTargetId && objects.find((entry) => entry.id === object.aiTargetId) || null;
    object.aiTargetId = target ? target.id : null;
    const healthPercent = object.health == null || !object.maxHealth ? 100 : object.health / object.maxHealth * 100;
    const flee = element(object, 'flee-target');
    const attack = element(object, 'attack-target') || element(object, 'attack');
    const attackRange = Math.max(0, Number(attack ? attack.settings.range || 64 : 64));
    const distance = target ? Math.hypot(target.x - object.x, target.y - object.y) : Number.POSITIVE_INFINITY;
    if (healthPercent <= Number(flee ? flee.settings.healthThreshold || 25 : -1)) setAiState(object, 'Flee', 'Health below flee threshold');
    else if (object.aiState === 'Flee' && healthPercent < Number(flee ? flee.settings.recoverThreshold || 50 : 50)) { /* Remain fleeing. */ }
    else if (target && distance <= attackRange) setAiState(object, 'Attack', 'Target in attack range');
    else if (target) setAiState(object, 'Chase', 'Hostile target detected');
    else if (element(object, 'patrol')) setAiState(object, 'Patrol', 'No target; patrol route active');
    else if (element(object, 'wander')) setAiState(object, 'Wander', 'No target; wandering');
    else setAiState(object, 'Idle', 'No target');
    object.blackboard.targetId = object.aiTargetId;
    object.blackboard.distance = Number.isFinite(distance) ? distance : -1;
    object.blackboard.healthPercent = healthPercent;
  }

  function moveAi(object, deltaSeconds) {
    const target = object.aiTargetId && objects.find((entry) => entry.id === object.aiTargetId && entry.enabled && !entry.destroyed);
    if (!target) return;
    const navigation = element(object, 'navigation-agent');
    const flee = element(object, 'flee-target');
    const speed = Number(object.aiState === 'Flee' && flee ? flee.settings.speed || 140 : navigation ? navigation.settings.speed || 100 : element(object, 'chase-target') ? element(object, 'chase-target').settings.speed || 100 : 100);
    if (object.aiState === 'Attack' || object.aiState === 'Idle' || object.aiState === 'Dead') return;
    let dx = target.x - object.x; let dy = target.y - object.y;
    if (object.aiState === 'Flee') { dx = -dx; dy = -dy; }
    const length = Math.hypot(dx, dy) || 1;
    const nextX = object.x + dx / length * speed * deltaSeconds;
    const nextY = object.y + dy / length * speed * deltaSeconds;
    if (!collidesAt(object, nextX, object.y)) object.x = nextX;
    if (!collidesAt(object, object.x, nextY)) object.y = nextY;
  }

  function processCombat() {
    const active = objects.filter((entry) => entry.enabled && !entry.destroyed && !entry.dead && entry.logicEnabled !== false);
    for (const source of active) {
      const hitbox = element(source, 'hitbox');
      const dealer = element(source, 'damage-dealer');
      const attack = element(source, 'attack');
      const inputActive = Boolean(attack && element(source, 'player-input') && actionKeys(String(attack.settings.inputAction || 'attack')).some((key) => justPressed.has(key)));
      const activeHitbox = hitbox && (hitbox.settings.startActive === true || source.aiState === 'Attack' || inputActive);
      if (!activeHitbox && !dealer) continue;
      const component = activeHitbox || dealer;
      const damage = Number(component.settings.damage || attack && attack.settings.damage || 10);
      const damageTypeId = String(component.settings.damageTypeId || attack && attack.settings.damageTypeId || 'physical');
      for (const target of active) {
        if (target === source || target.health == null || !teamsHostile(source, target)) continue;
        if (!collisionShapesIntersect(collisionShape(source), collisionShape(target))) continue;
        const hurtbox = element(target, 'hurtbox');
        const allowed = parseList(hurtbox ? hurtbox.settings.allowedDamageTypes : '');
        if (allowed.length && !allowed.includes(damageTypeId)) continue;
        damageObject(target, damage * Number(hurtbox ? hurtbox.settings.damageMultiplier || 1 : 1), source.id, damageTypeId, false);
        const statusId = String(component.settings.statusEffectId || '');
        if (statusId) applyStatus(target, statusId, source.id);
        if (component.settings.destroyOnHit === true || element(source, 'projectile')) { source.destroyed = true; source.enabled = false; break; }
      }
    }
  }

  function updatePhase8(deltaSeconds) {
    for (const object of objects) {
      if (!object.enabled || object.destroyed || object.logicEnabled === false) continue;
      runScripts(object, 'on_update', { delta: deltaSeconds });
      for (const key of Object.keys(object.cooldowns)) object.cooldowns[key] = Math.max(0, Number(object.cooldowns[key] || 0) - deltaSeconds);
      for (const pool of object.components.filter((entry) => entry.enabled && entry.type === 'resource-pool')) {
        const resourceId = String(pool.settings.resourceId || 'mana');
        const delayKey = 'resource:' + resourceId;
        object.resourceDelays[delayKey] = Math.max(0, Number(object.resourceDelays[delayKey] || 0) - deltaSeconds);
        if (object.resourceDelays[delayKey] <= 0) object.resources[resourceId] = Math.min(object.maxResources[resourceId], Number(object.resources[resourceId] || 0) + Number(pool.settings.regenerationPerSecond || 0) * deltaSeconds);
      }
      if (object.shield < object.maxShield) {
        object.shieldDelay = Math.max(0, object.shieldDelay - deltaSeconds);
        const shield = element(object, 'shield');
        if (shield && object.shieldDelay <= 0) object.shield = Math.min(object.maxShield, object.shield + Number(shield.settings.regenerationPerSecond || 0) * deltaSeconds);
      }
      const statusResult = [];
      for (const status of object.statuses) {
        const definition = project.statusEffects.find((entry) => entry.id === status.id);
        if (!definition) continue;
        status.remaining -= deltaSeconds;
        status.tickRemaining -= deltaSeconds;
        if (definition.tickIntervalSeconds > 0 && status.tickRemaining <= 0) {
          while (status.tickRemaining <= 0) status.tickRemaining += Math.max(0.001, Number(definition.tickIntervalSeconds));
          if (Number(definition.damagePerTick || 0) > 0) damageObject(object, Number(definition.damagePerTick) * Number(status.stacks || 1), status.sourceId, definition.damageTypeId || 'physical', true);
        }
        if (status.remaining > 0) statusResult.push(status); else fireRules('status-removed', object.id, null);
      }
      object.statuses = statusResult;
      if (object.activeCast) {
        object.activeCast.remaining -= deltaSeconds;
        if (object.activeCast.remaining <= 0) {
          const ability = project.abilities.find((entry) => entry.id === object.activeCast.abilityId);
          const targetId = object.activeCast.targetId;
          if (ability) executeAbility(object, ability, targetId);
          else object.activeCast = null;
        }
      }
      const abilityUser = element(object, 'ability-user');
      if (abilityUser && element(object, 'player-input')) {
        for (const abilityId of parseList(abilityUser.settings.abilityIds)) {
          const ability = project.abilities.find((entry) => entry.id === abilityId);
          if (ability && actionKeys(ability.activationActionId).some((key) => justPressed.has(key))) castAbility(object, ability.id, null);
        }
      }
      updateAi(object, deltaSeconds);
      moveAi(object, deltaSeconds);
      if (object.aiState === 'Attack' && object.aiTargetId) {
        const useAbility = element(object, 'use-ability');
        const attackTarget = element(object, 'attack-target');
        const abilityIds = parseList(useAbility ? useAbility.settings.abilityIds : attackTarget ? attackTarget.settings.abilityId : '');
        if (abilityIds.length) castAbility(object, abilityIds.find((id) => Number(object.cooldowns[id] || 0) <= 0) || abilityIds[0], object.aiTargetId);
      }
      if (object.dead) {
        object.deathTimer -= deltaSeconds;
        if (object.deathTimer <= 0) {
          const death = element(object, 'death-behaviour');
          if (death && death.settings.respawn === true) {
            object.dead = false; object.health = object.maxHealth; object.enabled = true; object.destroyed = false; object.collisionEnabled = true; object.x = object.spawnX; object.y = object.spawnY; setAiState(object, String(element(object, 'ai-controller') ? element(object, 'ai-controller').settings.initialState || 'Idle' : 'Idle'), 'Respawned');
          } else if (!death || death.settings.destroyObject !== false) { object.destroyed = true; object.enabled = false; }
        }
      }
    }
    processCombat();
  }

  const scriptCache = new Map();

  function splitScriptArguments(source) {
    const values = [];
    let current = '';
    let quote = '';
    for (const character of String(source || '')) {
      if (quote) { current += character; if (character === quote) quote = ''; continue; }
      if (character === '"' || character === "'") { quote = character; current += character; continue; }
      if (character === ',') { values.push(current.trim()); current = ''; } else current += character;
    }
    if (current.trim()) values.push(current.trim());
    return values;
  }

  function scriptPrimitive(source, args) {
    const value = String(source || '').trim();
    if (value.startsWith('$')) return args[value.slice(1)] == null ? null : args[value.slice(1)];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1).replace(/\\n/g, '\n');
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }

  function compileScript(definition) {
    if (scriptCache.has(definition.id)) return scriptCache.get(definition.id);
    const functions = {};
    const errors = [];
    const allowed = new Set(['log','set_variable','emit','ai_set_state','damage','heal','cast_ability','add_currency','award_experience']);
    const source = String(definition.source || '').split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
    const pattern = /fn\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{([\s\S]*?)\}/g;
    let match;
    while ((match = pattern.exec(source))) {
      const commands = [];
      for (const statement of match[3].split(/;|\n/).map((entry) => entry.trim()).filter(Boolean)) {
        const command = statement.match(/^([a-zA-Z_][\w]*)\s*\((.*)\)$/);
        if (!command || !allowed.has(command[1])) { errors.push('Unsupported Shadowium Script statement: ' + statement); continue; }
        commands.push({ name: command[1], arguments: splitScriptArguments(command[2]) });
      }
      functions[match[1]] = commands;
    }
    const compiled = { functions, errors };
    scriptCache.set(definition.id, compiled);
    return compiled;
  }

  function runScripts(object, callback, args) {
    if (project.settings.scriptingEnabled === false || !object || object.logicEnabled === false) return;
    const scriptComponents = object.components.filter((entry) => entry.enabled && entry.type === 'script').sort((left, right) => Number(left.settings.executionOrder || 0) - Number(right.settings.executionOrder || 0));
    for (const component of scriptComponents) {
      const definition = project.scripts.find((entry) => entry.id === String(component.settings.scriptId || '') && entry.enabled);
      if (!definition) continue;
      const compiled = compileScript(definition);
      const commands = compiled.functions[callback] || [];
      const operationLimit = clamp(Number(component.settings.operationLimit || 512), 1, 10000);
      for (let index = 0; index < commands.length && index < operationLimit; index += 1) {
        const command = commands[index];
        const values = command.arguments.map((value) => scriptPrimitive(value, args || {}));
        try {
          if (command.name === 'log') showToast(object.name + ': ' + String(values[0] || ''), 1800);
          else if (command.name === 'set_variable') { variables[String(values[0] || '')] = values[1] == null ? null : values[1]; fireRules('variable-changed', object.id, null); }
          else if (command.name === 'emit') { variables.__scriptEvent = String(values[0] || 'script-event'); variables.__scriptValue = values[1] == null ? null : values[1]; fireRules('script-event', object.id, null); }
          else if (command.name === 'ai_set_state') setAiState(object, String(values[0] || 'Idle'), 'Shadowium Script');
          else if (command.name === 'damage') damageObject(object, Number(values[0] || 0), object.id, String(values[1] || 'physical'), true);
          else if (command.name === 'heal') damageObject(object, Number(values[0] || 0), object.id, 'healing', true);
          else if (command.name === 'cast_ability') castAbility(object, String(values[0] || ''), null);
          else if (command.name === 'add_currency') object.currencies[String(values[0] || 'coins')] = Number(object.currencies[String(values[0] || 'coins')] || 0) + Number(values[1] || 0);
          else if (command.name === 'award_experience') awardExperience(object, Number(values[0] || 0));
        } catch (error) { showToast('Script error in ' + definition.name + ': ' + String(error), 2400); }
      }
      for (const error of compiled.errors) showToast('Script error in ' + definition.name + ': ' + error, 2400);
    }
  }

  function instantiate(source, sourceSceneId) {
    const object = clone(source);
    object.components = Array.isArray(object.components) ? object.components : Array.isArray(object.elements) ? object.elements : [];
    object.sourceSceneId = sourceSceneId;
    const saved = persisted[runtimeSaveKey(object)] || persisted[object.id] || {};
    const health = element(object, 'health');
    const shield = element(object, 'shield');
    const stats = element(object, 'stats');
    const experience = element(object, 'experience');
    const level = element(object, 'level');
    object.x = saved.x == null ? object.transform.position.x : saved.x;
    object.y = saved.y == null ? object.transform.position.y : saved.y;
    object.spawnX = object.x;
    object.spawnY = object.y;
    object.enabled = saved.enabled == null ? object.enabled !== false : saved.enabled;
    object.runtimeVisible = saved.runtimeVisible == null ? object.runtimeVisible !== false : saved.runtimeVisible;
    object.collisionEnabled = saved.collisionEnabled == null ? object.collisionEnabled !== false : saved.collisionEnabled;
    object.logicEnabled = saved.logicEnabled == null ? object.logicEnabled !== false : saved.logicEnabled;
    object.destroyed = saved.destroyed === true;
    object.maxHealth = health ? Number(health.settings.maximumHealth || 100) : null;
    object.health = saved.health == null ? (health ? Number(health.settings.startingHealth || object.maxHealth || 100) : null) : saved.health;
    object.maxShield = shield ? Number(shield.settings.maximumShield || 0) : 0;
    object.shield = saved.shield == null ? (shield ? Number(shield.settings.startingShield || object.maxShield || 0) : 0) : saved.shield;
    object.shieldDelay = 0;
    object.resources = {};
    object.maxResources = {};
    object.resourceDelays = {};
    for (const pool of object.components.filter((entry) => entry.enabled && entry.type === 'resource-pool')) {
      const resourceId = String(pool.settings.resourceId || 'mana');
      object.maxResources[resourceId] = Math.max(0, Number(pool.settings.maximum || 100));
      object.resources[resourceId] = Number(saved.resources && saved.resources[resourceId] == null ? pool.settings.starting || object.maxResources[resourceId] : saved.resources && saved.resources[resourceId] || pool.settings.starting || object.maxResources[resourceId]);
    }
    object.cooldowns = { ...(saved.cooldowns || {}) };
    object.activeCast = null;
    object.statuses = Array.isArray(saved.statuses) ? clone(saved.statuses) : [];
    object.stats = { ...Object.fromEntries((project.stats || []).map((entry) => [entry.id, Number(entry.baseValue || 0)])), ...parseNumberMap(stats ? stats.settings.values : '{}'), ...(saved.stats || {}) };
    object.experience = Number(saved.experience == null ? experience ? experience.settings.startingExperience || 0 : 0 : saved.experience);
    object.level = Number(saved.level == null ? level ? level.settings.startingLevel || 1 : 1 : saved.level);
    object.currencies = { ...parseNumberMap(element(object, 'currency-wallet') ? element(object, 'currency-wallet').settings.currencies : ''), ...(saved.currencies || {}) };
    object.skills = Array.isArray(saved.skills) ? [...saved.skills] : parseList(element(object, 'skill-unlocker') ? element(object, 'skill-unlocker').settings.startingSkills : '');
    object.upgrades = Array.isArray(saved.upgrades) ? [...saved.upgrades] : [];
    object.dead = saved.dead === true;
    object.deathTimer = 0;
    object.invulnerableUntil = 0;
    object.lastDamage = null;
    object.teamId = teamId(object);
    object.aiState = String(element(object, 'ai-controller') ? element(object, 'ai-controller').settings.initialState || 'Idle' : 'Idle');
    object.previousAiState = '';
    object.aiReason = '';
    object.aiTargetId = null;
    object.aiDecisionRemaining = 0;
    object.blackboard = parseJsonRecord(element(object, 'blackboard') ? element(object, 'blackboard').settings.values : '{}');
    object.velocityX = 0;
    object.velocityY = 0;
    object.lastDirection = 'down';
    object.activeClipId = null;
    object.animationState = '';
    object.animationFrame = 0;
    object.animationElapsed = 0;
    object.animationDirection = 1;
    object.animationFinished = false;
    return object;
  }

  function loadScene(id, spawnId, preserveState) {
    const destination = project.scenes.find((entry) => entry.id === id) || project.scenes[0];
    const carried = preserveState === false ? [] : objects.filter((object) => element(object, 'player-input') || (element(object, 'save-state') || { settings: {} }).settings.persistAcrossScenes === true);
    stopAudio();
    triggerPairs.clear();
    activeCameraZoneId = null;
    sceneId = destination.id;
    objects = destination.objects.map((object) => instantiate(object, destination.id));
    for (const carriedObject of carried) {
      if (!objects.some((object) => runtimeSaveKey(object) === runtimeSaveKey(carriedObject))) {
        const copy = clone(carriedObject);
        if (!destination.layers.some((entry) => entry.id === copy.layerId)) copy.layerId = (destination.layers.find((entry) => entry.runtimeIncluded !== false) || destination.layers[0] || { id: copy.layerId }).id;
        objects.push(copy);
      }
    }
    const spawns = objects.filter((object) => element(object, 'scene-spawn-point'));
    const spawn = spawns.find((object) => String(element(object, 'scene-spawn-point').settings.spawnId || 'default') === String(spawnId || '')) || spawns.find((object) => element(object, 'scene-spawn-point').settings.defaultSpawn === true) || spawns[0];
    if (spawn) {
      for (const player of objects.filter((object) => element(object, 'player-input'))) {
        player.x = spawn.x;
        player.y = spawn.y;
        player.lastDirection = String(element(spawn, 'scene-spawn-point').settings.facing || 'down');
      }
    }
    const cameraObject = activeCameraObject();
    const cameraElement = element(cameraObject, 'camera');
    const cameraSettings = effectiveCameraZoom(cameraElement, null);
    camera.fov = cameraSettings.fieldOfView;
    camera.zoom = cameraSettings.zoom;
    const player = objects.find((object) => element(object, 'player-input'));
    camera.x = player ? player.x : cameraObject ? cameraObject.x : 0;
    camera.y = player ? player.y : cameraObject ? cameraObject.y : 0;
    dialogue = null;
    updateDialogue();
    showToast(destination.name, 1400);
    playSceneAudio();
    for (const object of objects) runScripts(object, 'on_start', {});
    fireRules('scene-started', null, null);
  }

  function compare(left, operator, right) {
    if (operator === '==') return left === right;
    if (operator === '!=') return left !== right;
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false;
    if (operator === '>') return leftNumber > rightNumber;
    if (operator === '>=') return leftNumber >= rightNumber;
    if (operator === '<') return leftNumber < rightNumber;
    return leftNumber <= rightNumber;
  }

  function conditionPasses(condition) {
    if (condition.type === 'always') return true;
    if (condition.type === 'variable-equals') return variables[condition.key] === condition.value;
    if (condition.type === 'variable-compare') return compare(variables[condition.key], condition.operator || '==', condition.value);
    if (condition.type === 'object-enabled') {
      const object = objects.find((entry) => entry.id === condition.objectId);
      return Boolean(object && object.enabled && !object.destroyed) === Boolean(condition.value);
    }
    if (condition.type === 'object-has-component' || condition.type === 'object-has-element') {
      const object = objects.find((entry) => entry.id === condition.objectId);
      return Boolean(object && condition.componentType && element(object, condition.componentType));
    }
    if (condition.type === 'object-has-tag') {
      const object = objects.find((entry) => entry.id === condition.objectId);
      return Boolean(object && object.tags.includes(condition.key));
    }
    if (condition.type === 'inventory-contains') return Number(inventory[condition.key] || 0) >= Number(condition.value || 1);
    if (condition.type === 'scene-is-active') return sceneId === String(condition.value || condition.key);
    if (condition.type === 'random-chance') return Math.random() * 100 < Number(condition.value || 50);
    return false;
  }

  function executeActions(rule, actions, index) {
    const actionIndex = index || 0;
    if (actionIndex >= actions.length) return;
    const action = actions[actionIndex];
    if (action.type === 'wait') {
      window.setTimeout(() => executeActions(rule, actions, actionIndex + 1), Math.max(0, Number(action.durationMs || action.value || 0)));
      return;
    }
    const object = objects.find((entry) => entry.id === action.objectId);
    if (action.type === 'set-object-enabled' && object) {
      object.enabled = Boolean(action.value);
      persisted[runtimeSaveKey(object)] = { ...(persisted[runtimeSaveKey(object)] || {}), enabled: object.enabled, destroyed: object.destroyed };
    } else if (action.type === 'set-runtime-visible' && object) {
      object.runtimeVisible = action.value !== false;
    } else if (action.type === 'set-collision-enabled' && object) {
      object.collisionEnabled = action.value !== false;
    } else if (action.type === 'set-logic-enabled' && object) {
      object.logicEnabled = action.value !== false;
    } else if ((action.type === 'set-component-property' || action.type === 'set-element-property') && object && action.componentType && action.propertyKey) {
      const targetElement = element(object, action.componentType);
      if (targetElement) targetElement.settings[action.propertyKey] = action.value;
    } else if (action.type === 'set-health' && object) {
      object.health = Number(action.value || 0);
    } else if (action.type === 'change-health' && object) {
      object.health = Number(object.health || 0) + Number(action.value || 0);
    } else if (action.type === 'destroy-object' && object) {
      object.destroyed = true;
      object.enabled = false;
      persisted[runtimeSaveKey(object)] = { enabled: false, destroyed: true };
    } else if (action.type === 'move-object' && object) {
      object.x += Number(action.x || 0);
      object.y += Number(action.y || 0);
    } else if (action.type === 'set-object-position' && object) {
      object.x = Number(action.x || 0);
      object.y = Number(action.y || 0);
    } else if (action.type === 'set-variable') {
      variables[action.key] = action.value;
      fireRules('variable-changed', null, null);
    } else if (action.type === 'change-scene' && action.sceneId) {
      fireRules('scene-ended', null, null);
      capturePersistent();
      loadScene(action.sceneId, action.key || '', true);
      if (project.settings.autoSaveOnSceneChange) writeSave(action.sceneId);
      return;
    } else if (action.type === 'give-item') {
      inventory[action.key] = Number(inventory[action.key] || 0) + Math.max(1, Number(action.value || 1));
    } else if (action.type === 'remove-item') {
      inventory[action.key] = Math.max(0, Number(inventory[action.key] || 0) - Math.max(1, Number(action.value || 1)));
    } else if (action.type === 'play-sound' && object) {
      playAudio(object);
    } else if (action.type === 'stop-sound') {
      stopAudio(action.objectId || undefined);
    } else if (action.type === 'set-camera-zoom') {
      const cameraElement = activeCameraElement();
      if (cameraElement) cameraElement.settings.zoom = Number(action.value || 1);
      const settings = effectiveCameraZoom(cameraElement, element(activeCameraZone(), 'camera-zone'));
      camera.zoom = settings.zoom;
    } else if (action.type === 'set-camera-fov') {
      const cameraElement = activeCameraElement();
      if (cameraElement) cameraElement.settings.fieldOfView = clamp(Number(action.value || 60), 20, 160);
      const settings = effectiveCameraZoom(cameraElement, element(activeCameraZone(), 'camera-zone'));
      camera.fov = settings.fieldOfView;
      camera.zoom = settings.zoom;
    } else if (action.type === 'shake-camera') {
      camera.shakeMs = Math.max(0, Number(action.durationMs || 450));
      camera.shakeAmount = Math.max(0, Number(action.value || 8));
      camera.shakePhase = 0;
    } else if ((action.type === 'show-ui' || action.type === 'hide-ui') && object) {
      object.enabled = action.type === 'show-ui';
    } else if (action.type === 'set-text' && object) {
      const textElement = element(object, 'ui-text');
      if (textElement) textElement.settings.text = action.value;
    } else if (action.type === 'save-game') {
      writeSave();
      showToast('Game saved.');
    } else if (action.type === 'load-game') {
      if (readSave()) return;
    } else if (action.type === 'deal-damage' && object) {
      damageObject(object, Number(action.value || 0), action.key || action.objectId || object.id, action.message || 'physical', action.key === 'ignore-team');
    } else if (action.type === 'heal' && object) {
      damageObject(object, Number(action.value || 0), action.key || object.id, 'healing', true);
    } else if (action.type === 'apply-status' && object) {
      applyStatus(object, action.key || String(action.value || ''), action.sceneId || object.id, Number(action.durationMs || 0) / 1000 || undefined);
    } else if (action.type === 'remove-status' && object) {
      removeStatus(object, action.key || String(action.value || ''));
    } else if (action.type === 'cast-ability' && object) {
      castAbility(object, action.key || String(action.value || ''), action.sceneId || null);
    } else if (action.type === 'set-ai-state' && object) {
      setAiState(object, action.key || String(action.value || 'Idle'), 'Event action');
    } else if (action.type === 'award-experience' && object) {
      awardExperience(object, Math.max(0, Number(action.value || 0)));
    } else if (action.type === 'add-currency' && object) {
      object.currencies[action.key || 'coins'] = Math.max(0, Number(object.currencies[action.key || 'coins'] || 0) + Number(action.value || 0));
    } else if (action.type === 'roll-loot-table') {
      rollLoot(action.key || String(action.value || ''), object || objects.find((entry) => element(entry, 'reward-receiver') || element(entry, 'player-input')), 0);
    } else if (action.type === 'spawn-prefab') {
      spawnPrefab(action.key || String(action.value || ''), object ? object.x + Number(action.x || 0) : Number(action.x || 0), object ? object.y + Number(action.y || 0) : Number(action.y || 0), object || null);
    } else if (action.type === 'emit-script-event') {
      variables.__scriptEvent = action.key || action.message || rule.name;
      variables.__scriptValue = action.value;
      fireRules('script-event', action.objectId || null, null);
    } else if (action.type === 'debug-message') {
      showToast(action.message || rule.name);
    }
    executeActions(rule, actions, actionIndex + 1);
  }

  function fireRules(type, sourceId, targetId) {
    for (const rule of project.eventRules) {
      if (!rule.enabled || rule.trigger.type !== type) continue;
      if (rule.trigger.sourceObjectId && rule.trigger.sourceObjectId !== sourceId) continue;
      if (rule.trigger.targetObjectId && rule.trigger.targetObjectId !== targetId) continue;
      if (!rule.conditions.every(conditionPasses)) continue;
      executeActions(rule, rule.actions, 0);
    }
  }

  function setDialogueGraphNode(graphId, nodeId) {
    const graph = (project.dialogues || []).find((entry) => entry.id === graphId);
    const node = graph && graph.nodes.find((entry) => entry.id === nodeId);
    if (!graph || !node) { dialogue = null; updateDialogue(); return; }
    dialogue = {
      graphId: graph.id,
      nodeId: node.id,
      speaker: String(node.speaker || ''),
      lines: [String(node.text || '')],
      index: 0,
      color: '${uiText}',
      choices: (node.choices || []).filter((choice) => !choice.conditionKey || Boolean(variables[choice.conditionKey])).map((choice) => ({ id: choice.id, label: choice.label, nextId: choice.nextId })),
    };
    updateDialogue();
  }

  function updateDialogue() {
    if (!dialogue) {
      dialogueBox.style.display = 'none';
      return;
    }
    dialogueBox.style.display = 'block';
    dialogueBox.querySelector('strong').textContent = dialogue.speaker;
    dialogueBox.querySelector('p').textContent = dialogue.lines[dialogue.index] || '';
    dialogueBox.querySelector('p').style.color = dialogue.color || '${uiText}';
    const choiceHost = dialogueBox.querySelector('.dialogue-choices');
    choiceHost.innerHTML = '';
    for (const choice of dialogue.choices || []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice.label;
      button.addEventListener('click', () => { if (dialogue && dialogue.graphId) setDialogueGraphNode(dialogue.graphId, choice.nextId); });
      choiceHost.appendChild(button);
    }
    dialogueBox.querySelector('small').style.display = dialogue.choices && dialogue.choices.length ? 'none' : 'block';
  }

  function advanceDialogue() {
    if (!dialogue || (dialogue.choices && dialogue.choices.length)) return;
    if (dialogue.graphId && dialogue.nodeId) {
      const graph = (project.dialogues || []).find((entry) => entry.id === dialogue.graphId);
      const node = graph && graph.nodes.find((entry) => entry.id === dialogue.nodeId);
      if (node && node.nextId) setDialogueGraphNode(graph.id, node.nextId);
      else { dialogue = null; updateDialogue(); }
      return;
    }
    if (dialogue.index + 1 >= dialogue.lines.length) dialogue = null;
    else dialogue.index += 1;
    updateDialogue();
  }

  function activateBuiltIn(player, target) {
    const dialogueController = element(target, 'dialogue-controller');
    if (dialogueController && dialogueController.settings.startOnInteract !== false) {
      const graph = (project.dialogues || []).find((entry) => entry.id === String(dialogueController.settings.dialogueId || ''));
      if (graph && graph.startNodeId) { setDialogueGraphNode(graph.id, graph.startNodeId); return; }
    }
    const speaker = element(target, 'dialogue-speaker');
    if (speaker) {
      const lines = String(speaker.settings.dialogueText || '').split(/\\r?\\n|\\|/).map((line) => line.trim()).filter(Boolean);
      if (lines.length) {
        dialogue = { speaker: String(speaker.settings.displayName || target.name), lines, index: 0, color: String(speaker.settings.textColor || '#ffffff') };
        updateDialogue();
      }
      return;
    }

    const pickup = element(target, 'item-pickup');
    if (pickup && !target.destroyed) {
      const itemId = String(pickup.settings.itemId || 'item');
      const amount = Math.max(1, Number(pickup.settings.amount || 1));
      inventory[itemId] = Number(inventory[itemId] || 0) + amount;
      if (pickup.settings.destroyOnCollect !== false) {
        target.destroyed = true;
        target.enabled = false;
        persisted[runtimeSaveKey(target)] = { enabled: false, destroyed: true };
      }
      fireRules('item-collected', player.id, target.id);
      showToast('Collected ' + amount + ' × ' + itemId);
    }

    const exit = element(target, 'scene-exit');
    if (!exit) return;
    const requiredVariable = String(exit.settings.requiredVariable || '').trim();
    if (requiredVariable && String(variables[requiredVariable]) !== String(exit.settings.requiredValue == null ? 'true' : exit.settings.requiredValue)) {
      showToast('Exit requires ' + requiredVariable + ' = ' + String(exit.settings.requiredValue));
      return;
    }
    const destination = String(exit.settings.destinationSceneId || '');
    if (!project.scenes.some((entry) => entry.id === destination)) return;
    fireRules('scene-ended', null, null);
    capturePersistent();
    loadScene(destination, String(exit.settings.destinationSpawnId || ''), true);
    if (exit.settings.autoSave !== false && project.settings.autoSaveOnSceneChange) writeSave(destination);
  }

  function intersectsSolidTilemap(bounds) {
    for (const object of objects) {
      const tilemap = element(object, 'tilemap-renderer');
      if (!object.enabled || object.destroyed || object.collisionEnabled === false || !tilemap || tilemap.settings.collisionEnabled === false) continue;
      let cells = {};
      try { cells = JSON.parse(String(tilemap.settings.cells || '{}')); } catch { continue; }
      const tileWidth = Math.max(1, Number(tilemap.settings.tileWidth || 32));
      const tileHeight = Math.max(1, Number(tilemap.settings.tileHeight || 32));
      const mapWidth = Math.max(1, Number(tilemap.settings.mapWidth || 32));
      const mapHeight = Math.max(1, Number(tilemap.settings.mapHeight || 24));
      const originX = object.x - mapWidth * tileWidth / 2;
      const originY = object.y - mapHeight * tileHeight / 2;
      const firstColumn = Math.max(0, Math.floor((bounds.left - originX) / tileWidth));
      const lastColumn = Math.min(mapWidth - 1, Math.floor((bounds.right - originX - 0.001) / tileWidth));
      const firstRow = Math.max(0, Math.floor((bounds.top - originY) / tileHeight));
      const lastRow = Math.min(mapHeight - 1, Math.floor((bounds.bottom - originY - 0.001) / tileHeight));
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const tileId = cells[String(column) + ',' + String(row)];
          const palette = project.tilePalette.find((entry) => entry.id === tileId);
          if (palette && palette.collision === 'solid') return true;
        }
      }
    }
    return false;
  }

  function collidesAt(player, x, y) {
    const bounds = box(player, x, y);
    const playerShape = collisionShape(player, x, y);
    const playerCollider = colliderFor(player);
    const playerLayer = String(playerCollider ? playerCollider.settings.layer || 'Player' : 'Player');
    const matrix = project.settings.collisionMatrix || {};
    for (const object of objects) {
      if (object === player || !object.enabled || object.destroyed || object.collisionEnabled === false) continue;
      const collider = colliderFor(object);
      if (!collider || colliderBehavior(object) !== 'static') continue;
      const objectLayer = String(collider.settings.layer || 'World');
      const interacts = (matrix[playerLayer] || []).includes(objectLayer) || (matrix[objectLayer] || []).includes(playerLayer);
      if (interacts && playerShape && collisionShapesIntersect(playerShape, collisionShape(object))) return true;
    }
    return intersectsSolidTilemap(bounds);
  }

  function animationDirectionKey(direction) {
    const value = String(direction || 'down').toLowerCase();
    if (value === 'up-left' || value === 'up-right') return value;
    if (value === 'down-left' || value === 'down-right') return value;
    if (['up','down','left','right'].includes(value)) return value;
    return 'down';
  }

  function animationSetClip(set, stateName, direction) {
    if (!set) return null;
    const normalizedDirection = animationDirectionKey(direction);
    const states = set.states || {};
    const state = states[stateName] || states[String(stateName || '').toLowerCase()] || null;
    const directions = state || set.directions || {};
    return directions[normalizedDirection]
      || (normalizedDirection.endsWith('right') && directions[normalizedDirection.replace('right','left')])
      || directions.down || directions.right || directions.left || directions.up
      || Object.values(directions)[0] || null;
  }

  function animationMachineClip(object, moving) {
    const machine = element(object, 'animation-state-machine');
    if (!machine) return null;
    let states = [];
    try { states = JSON.parse(String(machine.settings.states || '[]')); } catch { states = []; }
    if (!Array.isArray(states)) states = [];
    let current = String(object.animationState || machine.settings.initialState || '');
    if (!current && states[0]) current = String(states[0].name || states[0].id || '');
    const speed = Math.hypot(Number(object.velocityX || 0), Number(object.velocityY || 0));
    const dead = object.health != null && Number(object.health) <= 0;
    for (const state of states) {
      if (!state || String(state.name || state.id || '') !== current) continue;
      const transitions = Array.isArray(state.transitions) ? state.transitions : [];
      for (const transition of transitions) {
        const key = String(transition.condition || transition.parameter || '').toLowerCase();
        const value = Number(transition.value == null ? 0 : transition.value);
        const passed = key === 'speed' ? speed > value
          : key === 'stopped' ? speed <= Math.max(0.001, value)
          : key === 'moving' ? moving
          : key === 'dead' ? dead
          : key && Object.prototype.hasOwnProperty.call(variables, key) ? Boolean(variables[key])
          : false;
        if (passed && transition.to) { current = String(transition.to); break; }
      }
      break;
    }
    object.animationState = current;
    const state = states.find((entry) => entry && String(entry.name || entry.id || '') === current);
    if (!state) return null;
    const setId = String(state.animationSetId || machine.settings.animationSetId || '');
    if (setId) {
      const set = (project.animationSets || []).find((entry) => entry.id === setId);
      return animationSetClip(set, String(state.animationState || state.name || current), object.lastDirection);
    }
    return String(state.clipId || state.animationId || '') || null;
  }

  function animationClipForObject(object) {
    const speed = Math.hypot(Number(object.velocityX || 0), Number(object.velocityY || 0));
    const moving = speed > 0.01;
    let clipId = animationMachineClip(object, moving);
    const animated = element(object, 'animated-sprite');
    const visual = element(object, 'character-visual-controller');
    const setId = String((visual && visual.settings.animationSetId) || (animated && animated.settings.animationSetId) || '');
    const set = setId ? (project.animationSets || []).find((entry) => entry.id === setId) : null;
    if (!clipId && set) {
      let stateName = moving
        ? String((visual && visual.settings.moveState) || (animated && animated.settings.moveState) || 'walk')
        : String((visual && visual.settings.idleState) || (animated && animated.settings.defaultState) || set.defaultState || 'idle');
      const runThreshold = Number(visual && visual.settings.runSpeedThreshold == null ? Number.POSITIVE_INFINITY : visual.settings.runSpeedThreshold);
      if (moving && speed >= runThreshold) stateName = String((visual && visual.settings.runState) || 'run');
      if (object.health != null && Number(object.health) <= 0) stateName = String((visual && visual.settings.deadState) || 'dead');
      clipId = animationSetClip(set, stateName, object.lastDirection);
      object.animationState = stateName;
    }
    const directional = element(object, 'directional-animation');
    if (!clipId && directional) {
      const direction = animationDirectionKey(object.lastDirection);
      const prefix = moving ? 'walk' : 'idle';
      const directKey = prefix + direction.charAt(0).toUpperCase() + direction.slice(1).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      clipId = String(directional.settings[directKey] || '');
      if (!clipId && direction === 'right' && directional.settings.mirrorHorizontal !== false) clipId = String(directional.settings[prefix + 'Left'] || '');
      object.animationState = prefix;
    }
    if (!clipId && animated) clipId = String(animated.settings.defaultClipId || '');
    return clipId ? (project.animations || []).find((entry) => entry.id === clipId) || null : null;
  }

  function animationFrameDuration(clip, frame) {
    const explicit = Number(frame && frame.durationMs || 0);
    return explicit > 0 ? explicit / 1000 : 1 / Math.max(0.001, Number(clip.framesPerSecond || 8));
  }

  function fireAnimationEvent(object, event) {
    if (!event) return;
    const target = event.targetId ? objects.find((entry) => entry.id === event.targetId) || object : object;
    if (event.type === 'emit-event') {
      variables.__animationEvent = event.name || event.key || 'animation-event';
      variables.__animationEventSource = object.id;
      fireRules('script-event', object.id, target ? target.id : null);
    } else if (event.type === 'play-sound') {
      const asset = (project.assets || []).find((entry) => entry.id === event.targetId && entry.kind === 'audio');
      if (asset) { const channel = new Audio(asset.relativePath); channel.volume = audioGroupVolume('sfx'); channel.play().catch(() => {}); }
      else if (target) playAudio(target);
    } else if (event.type === 'enable-component' || event.type === 'disable-component') {
      const component = target && target.components.find((entry) => entry.id === event.key || entry.type === event.key);
      if (component) component.enabled = event.type === 'enable-component';
    } else if (event.type === 'spawn-prefab') {
      spawnPrefab(event.targetId || event.key, object.x, object.y, object);
    } else if (event.type === 'camera-shake') {
      camera.shakeMs = Math.max(camera.shakeMs, Math.max(1, Number(event.value || 180)));
      camera.shakeAmount = Math.max(camera.shakeAmount, Math.max(0, Number(event.key || 5)));
    } else if (event.type === 'set-variable') {
      variables[String(event.key || event.name || '')] = event.value;
      fireRules('variable-changed', object.id, target ? target.id : null);
    }
  }

  function updateAnimations(deltaSeconds) {
    for (const object of objects) {
      if (!object.enabled || object.destroyed || object.logicEnabled === false) continue;
      const animated = element(object, 'animated-sprite') || element(object, 'directional-animation') || element(object, 'animation-state-machine') || element(object, 'character-visual-controller');
      if (!animated) continue;
      const clip = animationClipForObject(object);
      if (!clip || !Array.isArray(clip.frames) || clip.frames.length === 0) {
        object.activeClipId = null;
        object.animationFrame = 0;
        object.animationElapsed = 0;
        continue;
      }
      const changedClip = object.activeClipId !== clip.id;
      if (changedClip) {
        object.activeClipId = clip.id;
        object.animationFrame = 0;
        object.animationElapsed = 0;
        object.animationDirection = 1;
        object.animationFinished = false;
      }
      if (object.animationFinished && !clip.loop) continue;
      const playbackSpeed = Math.max(0, Number(element(object, 'animated-sprite') ? element(object, 'animated-sprite').settings.playbackSpeed || 1 : 1));
      object.animationElapsed += Math.max(0, deltaSeconds * playbackSpeed);
      let guard = Math.max(8, clip.frames.length * 4);
      while (guard-- > 0) {
        const frame = clip.frames[Math.max(0, Math.min(clip.frames.length - 1, object.animationFrame))];
        const duration = animationFrameDuration(clip, frame);
        if (object.animationElapsed < duration) break;
        object.animationElapsed -= duration;
        const previous = object.animationFrame;
        let next = previous + Number(object.animationDirection || 1);
        if (clip.pingPong && clip.frames.length > 1) {
          if (next >= clip.frames.length) { object.animationDirection = -1; next = clip.frames.length - 2; }
          else if (next < 0) {
            if (clip.loop) { object.animationDirection = 1; next = 1; }
            else { object.animationFinished = true; next = 0; }
          }
        } else if (next >= clip.frames.length) {
          if (clip.loop) next = 0;
          else { next = clip.frames.length - 1; object.animationFinished = true; }
        } else if (next < 0) next = clip.loop ? clip.frames.length - 1 : 0;
        object.animationFrame = next;
        const entered = clip.frames[next];
        if (clip.rootMotionMode === 'apply-position' && entered) {
          const localX = Number(entered.rootMotionX || 0), localY = Number(entered.rootMotionY || 0);
          if (localX || localY) {
            const radians = Number(object.transform.rotation || 0) * Math.PI / 180;
            const worldX = localX * Math.cos(radians) - localY * Math.sin(radians);
            const worldY = localX * Math.sin(radians) + localY * Math.cos(radians);
            if (!collidesAt(object, object.x + worldX, object.y)) object.x += worldX;
            if (!collidesAt(object, object.x, object.y + worldY)) object.y += worldY;
          }
        }
        for (const event of (clip.events || []).filter((entry) => Number(entry.frameIndex || 0) === next)) fireAnimationEvent(object, event);
        if (object.animationFinished) break;
      }
    }
  }

  function currentAnimationFrame(object) {
    const clip = object && object.activeClipId ? (project.animations || []).find((entry) => entry.id === object.activeClipId) : null;
    if (!clip || !Array.isArray(clip.frames) || clip.frames.length === 0) return null;
    const reference = clip.frames[Math.max(0, Math.min(clip.frames.length - 1, Number(object.animationFrame || 0)))];
    const assetId = String(reference && reference.assetId || clip.assetId || '');
    const asset = (project.assets || []).find((entry) => entry.id === assetId);
    const frame = asset && asset.frames.find((entry) => entry.id === reference.frameId);
    return asset && frame ? { asset, frame, clip } : null;
  }

  function movePlayers(deltaSeconds) {
    for (const player of objects.filter((object) => object.enabled && !object.destroyed && object.logicEnabled !== false && element(object, 'player-input') && element(object, 'top-down-movement'))) {
      if (dialogue) continue;
      const input = element(player, 'player-input');
      const movement = element(player, 'top-down-movement');
      if (input.settings.acceptInput === false) continue;
      let horizontal = 0;
      let vertical = 0;
      if (actionKeys(input.settings.moveLeftAction || 'move-left').some((key) => keys.has(key))) horizontal -= 1;
      if (actionKeys(input.settings.moveRightAction || 'move-right').some((key) => keys.has(key))) horizontal += 1;
      if (actionKeys(input.settings.moveUpAction || 'move-up').some((key) => keys.has(key))) vertical -= 1;
      if (actionKeys(input.settings.moveDownAction || 'move-down').some((key) => keys.has(key))) vertical += 1;
      if (movement.settings.allowDiagonal === false && horizontal && vertical) vertical = 0;
      if (movement.settings.normalizeDiagonal !== false && horizontal && vertical) {
        horizontal /= Math.SQRT2;
        vertical /= Math.SQRT2;
      }
      if (Math.abs(horizontal) > Math.abs(vertical) && horizontal) player.lastDirection = horizontal < 0 ? 'left' : 'right';
      else if (vertical) player.lastDirection = vertical < 0 ? 'up' : 'down';
      const speed = Number(movement.settings.speed || 180);
      const startX = player.x;
      const startY = player.y;
      const nextX = player.x + horizontal * speed * deltaSeconds;
      if (!collidesAt(player, nextX, player.y)) player.x = nextX;
      const nextY = player.y + vertical * speed * deltaSeconds;
      if (!collidesAt(player, player.x, nextY)) player.y = nextY;
      player.velocityX = deltaSeconds > 0 ? (player.x - startX) / deltaSeconds : 0;
      player.velocityY = deltaSeconds > 0 ? (player.y - startY) / deltaSeconds : 0;
    }
  }

  function processTriggers() {
    const active = objects.filter((object) => object.enabled && !object.destroyed && object.collisionEnabled !== false);
    const dynamics = active.filter((object) => colliderBehavior(object) === 'dynamic');
    const triggers = active.filter((object) => object.logicEnabled !== false && colliderBehavior(object) === 'trigger');
    const currentPairs = new Set();
    for (const source of dynamics) {
      for (const target of triggers) {
        if (!collisionShapesIntersect(collisionShape(source), collisionShape(target))) continue;
        const pair = source.id + '|' + target.id;
        currentPairs.add(pair);
        if (!triggerPairs.has(pair)) {
          fireRules('trigger-enter', source.id, target.id);
          const zone = element(target, 'camera-zone');
          if (zone) activeCameraZoneId = target.id;
          const exit = element(target, 'scene-exit');
          if (exit && exit.settings.activation === 'trigger-enter') activateBuiltIn(source, target);
          const pickup = element(target, 'item-pickup');
          if (pickup && pickup.settings.collectAutomatically === true) activateBuiltIn(source, target);
        }
      }
    }
    for (const pair of triggerPairs) {
      if (currentPairs.has(pair)) continue;
      const ids = pair.split('|');
      fireRules('trigger-exit', ids[0], ids[1]);
      if (activeCameraZoneId === ids[1]) activeCameraZoneId = null;
    }
    triggerPairs.clear();
    for (const pair of currentPairs) triggerPairs.add(pair);
  }

  function processInteraction() {
    if (dialogue) {
      prompt.style.opacity = 0;
      return;
    }
    const player = objects.find((object) => object.enabled && !object.destroyed && element(object, 'player-input'));
    if (!player) return;
    const input = element(player, 'player-input');
    const defaultAction = String(input.settings.interactionAction || 'interact');
    let nearest = null;
    for (const object of objects) {
      const interaction = element(object, 'interaction');
      if (!object.enabled || object.destroyed || object.logicEnabled === false || !interaction) continue;
      const distance = Math.hypot(player.x - object.x, player.y - object.y);
      const range = Number(interaction.settings.interactionRange || 72);
      if (distance <= range && (!nearest || distance < nearest.distance)) nearest = { object, interaction, distance };
    }
    if (!nearest) {
      prompt.style.opacity = 0;
      return;
    }
    const actionId = String(nearest.interaction.settings.interactionAction || defaultAction);
    const inputKeys = actionKeys(actionId);
    prompt.textContent = '[' + inputKeys.map((key) => key.replace('Key', '')).join(' / ') + '] ' + String(nearest.interaction.settings.promptText || 'Interact');
    prompt.style.opacity = 1;
    if (inputKeys.some((key) => justPressed.has(key))) {
      fireRules('interaction', player.id, nearest.object.id);
      runScripts(nearest.object, 'on_interact', { actor_id: player.id });
      if (objects.includes(nearest.object) && nearest.object.enabled && !nearest.object.destroyed) activateBuiltIn(player, nearest.object);
    }
  }

  function updateCamera(deltaSeconds) {
    const cameraObject = activeCameraObject();
    const cameraElement = element(cameraObject, 'camera');
    const follow = element(cameraObject, 'camera-follow');
    const smoothingComponent = element(cameraObject, 'camera-smoothing');
    const lookAheadComponent = element(cameraObject, 'camera-look-ahead');
    const boundsComponent = element(cameraObject, 'camera-bounds');
    const zoneElement = element(activeCameraZone(), 'camera-zone');
    const targetId = String(follow ? follow.settings.targetObjectId || '' : '');
    const targetName = String(follow ? follow.settings.targetName || '' : cameraElement ? cameraElement.settings.followTargetName || '' : '');
    const runtimeObjects = objects.filter((object) => object.enabled && !object.destroyed);
    const target = runtimeObjects.find((object) => targetId && object.id === targetId)
      || runtimeObjects.find((object) => targetName && object.name === targetName)
      || runtimeObjects.find((object) => element(object, 'player-input'));
    const desired = effectiveCameraZoom(cameraElement, zoneElement);
    const mode = String(follow ? follow.settings.mode || 'centered' : 'smooth');
    const legacySmoothing = clamp(Number(zoneElement ? zoneElement.settings.smoothing || 0.12 : cameraElement ? cameraElement.settings.smoothing || 0.15 : 0.15), 0.001, 1);
    const smoothingX = mode === 'centered' ? 1 : clamp(Number(smoothingComponent ? smoothingComponent.settings.horizontal ?? legacySmoothing : legacySmoothing), 0.001, 1);
    const smoothingY = mode === 'centered' ? 1 : clamp(Number(smoothingComponent ? smoothingComponent.settings.vertical ?? legacySmoothing : legacySmoothing), 0.001, 1);
    const zoomBlend = 1 - Math.pow(1 - Math.max(smoothingX, smoothingY), Math.max(1, deltaSeconds * 60));
    camera.fov += (desired.fieldOfView - camera.fov) * zoomBlend;
    camera.zoom += (desired.zoom - camera.zoom) * zoomBlend;

    if (target) {
      const additionalIds = String(follow ? follow.settings.additionalTargets || '' : '').split(',').map((value) => value.trim()).filter(Boolean);
      const followed = mode === 'multi-target'
        ? [target, ...runtimeObjects.filter((object) => additionalIds.includes(object.id) || additionalIds.includes(object.name))].filter((object, index, array) => array.findIndex((candidate) => candidate.id === object.id) === index)
        : [target];
      let focusX = followed.reduce((sum, object) => sum + object.x, 0) / followed.length;
      let focusY = followed.reduce((sum, object) => sum + object.y, 0) / followed.length;
      let desiredZoom = desired.zoom;
      if (mode === 'multi-target' && followed.length > 1) {
        const padding = Math.max(0, Number(follow ? follow.settings.multiTargetPadding || 96 : 96));
        const left = Math.min(...followed.map((object) => object.x - object.size.width / 2));
        const right = Math.max(...followed.map((object) => object.x + object.size.width / 2));
        const top = Math.min(...followed.map((object) => object.y - object.size.height / 2));
        const bottom = Math.max(...followed.map((object) => object.y + object.size.height / 2));
        const fitZoom = Math.min(canvas.width / Math.max(1, right - left + padding * 2), canvas.height / Math.max(1, bottom - top + padding * 2));
        desiredZoom = Math.min(desiredZoom, fitZoom);
        focusX = (left + right) / 2;
        focusY = (top + bottom) / 2;
        camera.zoom += (desiredZoom - camera.zoom) * zoomBlend;
      }

      const velocityLength = Math.hypot(Number(target.velocityX || 0), Number(target.velocityY || 0));
      const directionX = velocityLength > 0.001 ? Number(target.velocityX || 0) / velocityLength : target.lastDirection === 'left' ? -1 : target.lastDirection === 'right' ? 1 : 0;
      const directionY = velocityLength > 0.001 ? Number(target.velocityY || 0) / velocityLength : target.lastDirection === 'up' ? -1 : target.lastDirection === 'down' ? 1 : 0;
      const legacyLookAhead = Number(cameraElement ? cameraElement.settings.lookAhead || 0 : 0);
      const lookX = Number(lookAheadComponent ? lookAheadComponent.settings.horizontal ?? legacyLookAhead : legacyLookAhead);
      const lookY = Number(lookAheadComponent ? lookAheadComponent.settings.vertical ?? legacyLookAhead : legacyLookAhead);
      const response = clamp(Number(lookAheadComponent ? lookAheadComponent.settings.response ?? 0.14 : 0.14), 0.001, 1);
      const lookBlend = 1 - Math.pow(1 - response, Math.max(1, deltaSeconds * 60));
      camera.lookAheadX += (directionX * lookX - camera.lookAheadX) * lookBlend;
      camera.lookAheadY += (directionY * lookY - camera.lookAheadY) * lookBlend;
      focusX += Number(follow ? follow.settings.offsetX || 0 : 0) + camera.lookAheadX;
      focusY += Number(follow ? follow.settings.offsetY || 0 : 0) + camera.lookAheadY;

      const deadZoneWidth = mode === 'dead-zone' || mode === 'platformer' ? Math.max(0, Number(cameraElement ? cameraElement.settings.deadZoneWidth || 64 : 64)) : 0;
      const deadZoneHeight = mode === 'dead-zone' || mode === 'platformer' ? Math.max(0, Number(cameraElement ? cameraElement.settings.deadZoneHeight || (mode === 'platformer' ? 96 : 48) : 48)) : 0;
      const differenceX = focusX - camera.x;
      const differenceY = focusY - camera.y;
      let desiredX = deadZoneWidth > 0 && Math.abs(differenceX) <= deadZoneWidth / 2 ? camera.x : focusX - (deadZoneWidth > 0 ? Math.sign(differenceX) * deadZoneWidth / 2 : 0);
      let desiredY = deadZoneHeight > 0 && Math.abs(differenceY) <= deadZoneHeight / 2 ? camera.y : focusY - (deadZoneHeight > 0 ? Math.sign(differenceY) * deadZoneHeight / 2 : 0);
      if ((follow && follow.settings.followX === false) || (zoneElement && zoneElement.settings.lockX === true)) desiredX = camera.x;
      if ((follow && follow.settings.followY === false) || (zoneElement && zoneElement.settings.lockY === true)) desiredY = camera.y;

      const shouldClamp = (boundsComponent && boundsComponent.settings.enabled === true) || (cameraElement && cameraElement.settings.clampToBounds === true);
      if (shouldClamp) {
        const halfWidth = canvas.width / camera.zoom / 2;
        const halfHeight = canvas.height / camera.zoom / 2;
        const left = Number(boundsComponent ? boundsComponent.settings.left ?? -640 : cameraElement ? cameraElement.settings.boundsLeft || -640 : -640);
        const right = Number(boundsComponent ? boundsComponent.settings.right ?? 640 : cameraElement ? cameraElement.settings.boundsRight || 640 : 640);
        const top = Number(boundsComponent ? boundsComponent.settings.top ?? -360 : cameraElement ? cameraElement.settings.boundsTop || -360 : -360);
        const bottom = Number(boundsComponent ? boundsComponent.settings.bottom ?? 360 : cameraElement ? cameraElement.settings.boundsBottom || 360 : 360);
        desiredX = left + halfWidth > right - halfWidth ? (left + right) / 2 : clamp(desiredX, left + halfWidth, right - halfWidth);
        desiredY = top + halfHeight > bottom - halfHeight ? (top + bottom) / 2 : clamp(desiredY, top + halfHeight, bottom - halfHeight);
      }

      const maximumSpeed = Math.max(0, Number(follow ? follow.settings.maximumSpeed || 0 : 0));
      if (maximumSpeed > 0) {
        const dx = desiredX - camera.x, dy = desiredY - camera.y, distance = Math.hypot(dx, dy), maximumDistance = maximumSpeed * deltaSeconds;
        if (distance > maximumDistance && distance > 0.0001) { desiredX = camera.x + dx / distance * maximumDistance; desiredY = camera.y + dy / distance * maximumDistance; }
      }
      const blendX = 1 - Math.pow(1 - smoothingX, Math.max(1, deltaSeconds * 60));
      const blendY = 1 - Math.pow(1 - smoothingY, Math.max(1, deltaSeconds * 60));
      camera.x += (desiredX - camera.x) * blendX;
      camera.y += (desiredY - camera.y) * blendY;
    }
    if (camera.shakeMs > 0) {
      camera.shakeMs = Math.max(0, camera.shakeMs - deltaSeconds * 1000);
      camera.shakePhase += deltaSeconds * 60;
    }
  }

  function resolveBinding(source) {
    const key = String(source || '').trim();
    if (key === 'playerHealth' || key === 'playerMaximumHealth') {
      const player = objects.find((object) => element(object, 'player-input'));
      if (!player) return 0;
      if (key === 'playerHealth') return Number(player.health || 0);
      const health = element(player, 'health');
      return Number(health ? health.settings.maximumHealth || 100 : 100);
    }
    if (key.startsWith('inventory.')) return Number(inventory[key.slice('inventory.'.length)] || 0);
    if (Object.prototype.hasOwnProperty.call(inventory, key)) return Number(inventory[key] || 0);
    return variables[key] == null ? 0 : variables[key];
  }

  function boundText(template) {
    return String(template || '').replace(/\{([^}]+)\}/g, (_match, key) => String(resolveBinding(key)));
  }

  function anchorPosition(object, settings) {
    const anchor = String(settings.anchor || 'top-left');
    let x = object.transform.position.x;
    let y = object.transform.position.y;
    if (anchor.includes('right')) x = canvas.width - object.size.width - Math.abs(x);
    else if (anchor.includes('centre') || anchor === 'center') x = canvas.width / 2 - object.size.width / 2 + x;
    if (anchor.includes('bottom')) y = canvas.height - object.size.height - Math.abs(y);
    else if (anchor === 'centre' || anchor === 'center') y = canvas.height / 2 - object.size.height / 2 + y;
    return { x, y };
  }

  function drawRepeatedFrame(image, frame, width, height) {
    const tileWidth = Math.max(1, frame.width);
    const tileHeight = Math.max(1, frame.height);
    for (let y = -height / 2; y < height / 2; y += tileHeight) {
      for (let x = -width / 2; x < width / 2; x += tileWidth) {
        const drawWidth = Math.min(tileWidth, width / 2 - x);
        const drawHeight = Math.min(tileHeight, height / 2 - y);
        ctx.drawImage(image, frame.x, frame.y, drawWidth, drawHeight, x, y, drawWidth, drawHeight);
      }
    }
  }

  function drawNineSliceFrame(image, frame, width, height, settings) {
    const left = clamp(Number(settings.nineSliceLeft || 8), 0, Math.min(frame.width / 2, width / 2));
    const right = clamp(Number(settings.nineSliceRight || 8), 0, Math.min(frame.width / 2, width / 2));
    const top = clamp(Number(settings.nineSliceTop || 8), 0, Math.min(frame.height / 2, height / 2));
    const bottom = clamp(Number(settings.nineSliceBottom || 8), 0, Math.min(frame.height / 2, height / 2));
    const sourceX = [frame.x, frame.x + left, frame.x + frame.width - right];
    const sourceY = [frame.y, frame.y + top, frame.y + frame.height - bottom];
    const sourceW = [left, Math.max(0, frame.width - left - right), right];
    const sourceH = [top, Math.max(0, frame.height - top - bottom), bottom];
    const destinationX = [-width / 2, -width / 2 + left, width / 2 - right];
    const destinationY = [-height / 2, -height / 2 + top, height / 2 - bottom];
    const destinationW = [left, Math.max(0, width - left - right), right];
    const destinationH = [top, Math.max(0, height - top - bottom), bottom];
    for (let row = 0; row < 3; row += 1) for (let column = 0; column < 3; column += 1) {
      if (sourceW[column] > 0 && sourceH[row] > 0 && destinationW[column] > 0 && destinationH[row] > 0) ctx.drawImage(image, sourceX[column], sourceY[row], sourceW[column], sourceH[row], destinationX[column], destinationY[row], destinationW[column], destinationH[row]);
    }
  }

  function drawWorldObject(object) {
    const objectLayer = layer(object.layerId);
    const parallax = element(object, 'parallax-layer');
    const factorX = Number(parallax ? parallax.settings.horizontalFactor || 1 : objectLayer ? objectLayer.parallaxX == null ? 1 : objectLayer.parallaxX : 1);
    const factorY = Number(parallax ? parallax.settings.verticalFactor || 1 : objectLayer ? objectLayer.parallaxY == null ? 1 : objectLayer.parallaxY : 1);
    const drawX = object.x + camera.x * (1 - factorX);
    const drawY = object.y + camera.y * (1 - factorY);
    const tilemap = element(object, 'tilemap-renderer');
    if (tilemap) {
      let cells = {};
      try { cells = JSON.parse(String(tilemap.settings.cells || '{}')); } catch { cells = {}; }
      const tileWidth = Number(tilemap.settings.tileWidth || 32);
      const tileHeight = Number(tilemap.settings.tileHeight || 32);
      const mapWidth = Number(tilemap.settings.mapWidth || 32);
      const mapHeight = Number(tilemap.settings.mapHeight || 24);
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(Number(object.transform.rotation || 0) * Math.PI / 180);
      ctx.scale(Number(object.transform.scale.x || 1), Number(object.transform.scale.y || 1));
      ctx.globalAlpha = clamp(Number(tilemap.settings.opacity == null ? 1 : tilemap.settings.opacity), 0, 1);
      for (const [key, tileId] of Object.entries(cells)) {
        const coordinate = key.split(',').map(Number);
        const palette = project.tilePalette.find((entry) => entry.id === tileId);
        const asset = palette && project.assets.find((entry) => entry.id === palette.assetId);
        const frame = asset && asset.frames.find((entry) => entry.id === palette.frameId);
        const image = imageFor(asset);
        const x = -mapWidth * tileWidth / 2 + coordinate[0] * tileWidth;
        const y = -mapHeight * tileHeight / 2 + coordinate[1] * tileHeight;
        if (image && image.complete && frame) ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, x, y, tileWidth, tileHeight);
        else {
          ctx.fillStyle = palette ? palette.color : '#78909c';
          ctx.fillRect(x, y, tileWidth, tileHeight);
        }
      }
      ctx.restore();
      return;
    }

    const renderer = element(object, 'sprite-renderer');
    const animatedFrame = currentAnimationFrame(object);
    const asset = animatedFrame ? animatedFrame.asset : renderer && project.assets.find((entry) => entry.id === renderer.settings.assetId);
    const frame = animatedFrame ? animatedFrame.frame : asset && (asset.frames.find((entry) => entry.id === renderer.settings.frameId) || asset.frames[0]);
    const image = imageFor(asset);
    const expectsSprite = Boolean(renderer || element(object, 'animated-sprite') || element(object, 'directional-animation') || element(object, 'animation-state-machine') || element(object, 'character-visual-controller'));
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(Number(object.transform.rotation || 0) * Math.PI / 180);
    ctx.scale(Number(object.transform.scale.x || 1), Number(object.transform.scale.y || 1));
    const renderSettings = renderer ? renderer.settings : {};
    ctx.globalAlpha = clamp(Number(renderSettings.opacity != null ? renderSettings.opacity : 1), 0, 1);
    if (renderSettings.visible === false) {
      ctx.restore();
      return;
    }
    if (image && image.complete && frame) {
      const flipX = renderSettings.flipX === true ? -1 : 1;
      const flipY = renderSettings.flipY === true ? -1 : 1;
      ctx.scale(flipX, flipY);
      const resizeMode = String(renderSettings.resizeMode || 'stretch');
      if (resizeMode === 'tile') drawRepeatedFrame(image, frame, object.size.width, object.size.height);
      else if (resizeMode === 'nine-slice' || resizeMode === 'protected-region') drawNineSliceFrame(image, frame, object.size.width, object.size.height, resizeMode === 'protected-region' ? { ...renderSettings, nineSliceLeft: asset.scalingRegion?.left ?? renderSettings.nineSliceLeft, nineSliceTop: asset.scalingRegion?.top ?? renderSettings.nineSliceTop, nineSliceRight: asset.scalingRegion?.right ?? renderSettings.nineSliceRight, nineSliceBottom: asset.scalingRegion?.bottom ?? renderSettings.nineSliceBottom } : renderSettings);
      else if (resizeMode === 'scale') {
        const fit = Math.min(object.size.width / Math.max(1, frame.width), object.size.height / Math.max(1, frame.height));
        const width = frame.width * fit;
        const height = frame.height * fit;
        ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, -width / 2, -height / 2, width, height);
      } else ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, -object.size.width / 2, -object.size.height / 2, object.size.width, object.size.height);
    } else if (expectsSprite) {
      const behavior = String(project.settings.missingSpriteBehavior || 'checker');
      if (behavior === 'hide') { ctx.restore(); return; }
      const cell = 12;
      for (let y = -object.size.height / 2; y < object.size.height / 2; y += cell) {
        for (let x = -object.size.width / 2; x < object.size.width / 2; x += cell) {
          const alternate = (Math.floor((x + object.size.width / 2) / cell) + Math.floor((y + object.size.height / 2) / cell)) % 2 === 0;
          ctx.fillStyle = alternate ? '#ff2bd6' : '#1a0b22';
          ctx.fillRect(x, y, Math.min(cell, object.size.width / 2 - x), Math.min(cell, object.size.height / 2 - y));
        }
      }
    } else {
      ctx.fillStyle = object.editorColor || '#78909c';
      ctx.fillRect(-object.size.width / 2, -object.size.height / 2, object.size.width, object.size.height);
    }
    const materialStack = element(object, 'material-stack');
    if (materialStack) {
      for (const materialId of parseList(materialStack.settings.materialIds)) {
        const material = project.materials.find((entry) => entry.id === materialId && entry.enabled !== false);
        const shader = material && project.shaders.find((entry) => entry.id === material.shaderId);
        if (!material || !shader) continue;
        const uniforms = { ...(shader.uniforms || {}), ...(material.uniforms || {}) };
        const effectName = (shader.id + ' ' + shader.name).toLowerCase();
        if (effectName.includes('hit') && object.lastDamage && performance.now() - object.lastDamage.at < 140) {
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = clamp(Number(uniforms.intensity == null ? 0.75 : uniforms.intensity), 0, 1);
          ctx.fillStyle = String(uniforms.color || '#ffffff');
          ctx.fillRect(-object.size.width / 2, -object.size.height / 2, object.size.width, object.size.height);
        } else if (effectName.includes('poison') || effectName.includes('frost') || effectName.includes('burn') || effectName.includes('shadow')) {
          ctx.globalCompositeOperation = String(material.blendMode || 'source-atop') === 'add' ? 'lighter' : 'source-atop';
          ctx.globalAlpha = clamp(Number(uniforms.alpha == null ? 0.25 : uniforms.alpha), 0, 1);
          ctx.fillStyle = String(uniforms.color || (effectName.includes('poison') ? '#8bc34a' : effectName.includes('frost') ? '#90caf9' : effectName.includes('burn') ? '#ff7043' : '#7e57c2'));
          ctx.fillRect(-object.size.width / 2, -object.size.height / 2, object.size.width, object.size.height);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawInterfaceObject(object) {
    const panel = element(object, 'ui-panel');
    const text = element(object, 'ui-text');
    const imageElement = element(object, 'ui-image');
    const button = element(object, 'ui-button');
    const progress = element(object, 'ui-progress-bar');
    const settings = panel || text || imageElement || button || progress;
    if (!settings || settings.settings.visible === false) return;
    const position = anchorPosition(object, settings.settings);
    if (panel) {
      ctx.fillStyle = String(panel.settings.backgroundColor || '#10151dcc');
      ctx.fillRect(position.x, position.y, object.size.width, object.size.height);
    }
    if (imageElement) {
      const asset = project.assets.find((entry) => entry.id === imageElement.settings.assetId);
      const frame = asset && asset.frames[0];
      const image = imageFor(asset);
      ctx.globalAlpha = clamp(Number(imageElement.settings.opacity == null ? 1 : imageElement.settings.opacity), 0, 1);
      if (image && image.complete && frame) ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height, position.x, position.y, object.size.width, object.size.height);
      ctx.globalAlpha = 1;
    }
    if (button) {
      ctx.fillStyle = String(button.settings.backgroundColor || '#263545');
      ctx.fillRect(position.x, position.y, object.size.width, object.size.height);
      ctx.fillStyle = String(button.settings.textColor || '#ffffff');
      ctx.font = '600 ' + Number(button.settings.fontSize || 18) + 'px Segoe UI';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(boundText(button.settings.text || object.name), position.x + object.size.width / 2, position.y + object.size.height / 2);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }
    if (progress) {
      const value = Number(resolveBinding(progress.settings.valueSource || 'playerHealth'));
      const maximum = Math.max(1, Number(resolveBinding(progress.settings.maximumSource || 'playerMaximumHealth')));
      const ratio = clamp(value / maximum, 0, 1);
      ctx.fillStyle = String(progress.settings.backgroundColor || '#202a36');
      ctx.fillRect(position.x, position.y, object.size.width, object.size.height);
      ctx.fillStyle = String(progress.settings.fillColor || '#66bb6a');
      ctx.fillRect(position.x, position.y, object.size.width * ratio, object.size.height);
    }
    if (text) {
      ctx.fillStyle = String(text.settings.color || '#ffffff');
      ctx.font = Number(text.settings.fontSize || 22) + 'px Segoe UI';
      ctx.fillText(boundText(text.settings.text || ''), position.x, position.y + Number(text.settings.fontSize || 22));
    }
  }

  function draw() {
    const activeScene = scene();
    ctx.fillStyle = activeScene.backgroundColor || project.settings.defaultBackgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = camera.shakeMs > 0 ? Math.sin(camera.shakePhase * 1.73) * camera.shakeAmount : 0;
    const shakeY = camera.shakeMs > 0 ? Math.cos(camera.shakePhase * 2.17) * camera.shakeAmount : 0;
    ctx.save();
    ctx.translate(canvas.width / 2 - camera.x * camera.zoom + shakeX, canvas.height / 2 - camera.y * camera.zoom + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    const sorted = objects.filter((object) => worldLayerIncluded(object)).sort((left, right) => {
      const leftLayer = Number((layer(left.layerId) || { renderOrder: 0 }).renderOrder || 0);
      const rightLayer = Number((layer(right.layerId) || { renderOrder: 0 }).renderOrder || 0);
      const leftRenderer = element(left, 'sprite-renderer');
      const rightRenderer = element(right, 'sprite-renderer');
      const leftSort = Number(leftRenderer ? leftRenderer.settings.sortingLayer || leftRenderer.settings.renderLayer || 0 : 0) * 100000 + Number(leftRenderer ? leftRenderer.settings.orderInLayer || 0 : 0) * 100 + Number(leftRenderer && leftRenderer.settings.ySort === true ? left.y : leftRenderer ? leftRenderer.settings.zBias || 0 : 0);
      const rightSort = Number(rightRenderer ? rightRenderer.settings.sortingLayer || rightRenderer.settings.renderLayer || 0 : 0) * 100000 + Number(rightRenderer ? rightRenderer.settings.orderInLayer || 0 : 0) * 100 + Number(rightRenderer && rightRenderer.settings.ySort === true ? right.y : rightRenderer ? rightRenderer.settings.zBias || 0 : 0);
      return leftLayer - rightLayer || leftSort - rightSort;
    });
    for (const object of sorted) {
      if (!object.enabled || object.destroyed || object.runtimeVisible === false || controllerOnly(object) || element(object, 'ui-text') || element(object, 'ui-panel') || element(object, 'ui-image') || element(object, 'ui-button') || element(object, 'ui-progress-bar')) continue;
      drawWorldObject(object);
    }
    ctx.restore();
    for (const object of objects) {
      if (!object.enabled || object.destroyed || object.runtimeVisible === false) continue;
      drawInterfaceObject(object);
    }
  }

  function updateSpatialAudio() {
    const player = objects.find((object) => element(object, 'player-input'));
    if (!player) return;
    for (const [objectId, channel] of audioChannels) {
      const object = objects.find((entry) => entry.id === objectId);
      const source = element(object, 'audio-source');
      if (!object || !source || source.settings.spatial !== true) continue;
      const maximumDistance = Math.max(1, Number(source.settings.maximumDistance || 800));
      const distance = Math.hypot(player.x - object.x, player.y - object.y);
      const attenuation = clamp(1 - distance / maximumDistance, 0, 1);
      channel.volume = clamp(Number(source.settings.volume == null ? 1 : source.settings.volume) * audioGroupVolume(String(source.settings.group || 'sfx')) * attenuation, 0, 1);
    }
  }

  function tick(now) {
    const deltaSeconds = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!paused) {
      movePlayers(deltaSeconds);
      updatePhase8(deltaSeconds);
      updateAnimations(deltaSeconds);
      processTriggers();
      processInteraction();
      updateCamera(deltaSeconds);
      updateSpatialAudio();
    }
    draw();
    justPressed.clear();
    requestAnimationFrame(tick);
  }

  addEventListener('keydown', (event) => {
    if (dialogue && ['KeyE', 'Enter', 'Space'].includes(event.code) && !event.repeat) {
      advanceDialogue();
      event.preventDefault();
      return;
    }
    if (!keys.has(event.code)) justPressed.add(event.code);
    keys.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  addEventListener('keyup', (event) => keys.delete(event.code));
  addEventListener('blur', () => { keys.clear(); justPressed.clear(); });
  loadScene(sceneId, '', false);
  fireRules('preview-start', null, null);
  requestAnimationFrame(tick);
})();
</script></body></html>`;
}
export async function buildGamePackage(project: ProjectDocument, projectPath: string | null): Promise<BuildGameResult> {
  const diagnostics = buildDiagnostics(project);
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    const summary = errors.slice(0, 6).map((diagnostic) => `• ${diagnostic.message}`).join("\n");
    const remainder = errors.length > 6 ? `\n• …and ${errors.length - 6} more build-blocking errors` : "";
    throw new Error(`Build validation found ${errors.length} error${errors.length === 1 ? "" : "s"}.\n${summary}${remainder}`);
  }
  const runtimeHtml = createRuntimeHtml(project);
  const executableLabel = project.settings.executableName.trim() || project.metadata.name;
  const safeName = executableLabel.replace(/[<>:"/\\|?*]+/g, "-") || "Untitled Game";
  if (!isRunningInsideTauri() || !projectPath) {
    downloadBuildFile(`${safeName}-ShadowiumPlayer.html`, runtimeHtml, "text/html");
    downloadBuildFile(`${safeName}.game.json`, JSON.stringify(project, null, 2), "application/json");
    return { outputPath: null, files: [`${safeName}-ShadowiumPlayer.html`, `${safeName}.game.json`] };
  }
  return invoke<BuildGameResult>("build_windows_game", {
    projectPath,
    projectName: executableLabel,
    outputDirectory: project.settings.buildOutput,
    projectContents: JSON.stringify(project, null, 2),
    runtimeHtml,
  });
}


export async function runBuiltGame(outputPath: string): Promise<void> {
  if (!isRunningInsideTauri()) throw new Error("Build-and-run requires the desktop editor.");
  await invoke("run_built_game", { outputPath });
}

export async function revealBuildOutput(outputPath: string): Promise<void> {
  if (!isRunningInsideTauri()) return;
  await invoke("reveal_build_output", { outputPath });
}
