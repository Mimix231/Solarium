import type {
  ComponentCategory,
  ComponentSlot,
  ComponentType,
  CustomGameObjectTypeDefinition,
  EditorThemeDefinition,
  GameObjectDocument,
  GameObjectType,
  GameUiThemeDefinition,
  GenreKitDefinition,
  ProjectDocument,
} from "./types";

export interface GameObjectTypeProfile {
  type: GameObjectType;
  label: string;
  description: string;
  slots: ComponentSlot[];
  recommended: ComponentType[];
  required: ComponentType[];
  hiddenCategories: ComponentCategory[];
}

const ALL_SLOTS: ComponentSlot[] = [
  "rendering", "physics", "input", "movement", "gameplay", "combat", "ai", "abilities",
  "camera", "audio", "interface", "effects", "persistence", "scripting", "debugging",
];

export const GAME_OBJECT_TYPE_PROFILES: Record<GameObjectType, GameObjectTypeProfile> = {
  character: {
    type: "character", label: "Character", description: "Player characters, companions, and controllable actors.",
    slots: ["rendering", "physics", "input", "movement", "gameplay", "combat", "abilities", "audio", "persistence", "scripting"],
    recommended: ["sprite-renderer", "animated-sprite", "character-visual-controller", "rigidbody-2d", "capsule-collider", "player-input", "top-down-movement", "health", "damage-receiver", "inventory", "camera-target", "save-state"],
    required: [], hiddenCategories: ["camera", "interface", "world"],
  },
  enemy: {
    type: "enemy", label: "Enemy", description: "AI-controlled hostile or neutral actors.",
    slots: ["rendering", "physics", "movement", "gameplay", "combat", "ai", "abilities", "audio", "persistence", "scripting"],
    recommended: ["sprite-renderer", "animated-sprite", "character-visual-controller", "rigidbody-2d", "capsule-collider", "health", "hurtbox", "team", "ai-controller", "blackboard", "vision-sensor", "navigation-agent", "state-machine", "loot-dropper"],
    required: [], hiddenCategories: ["camera", "interface"],
  },
  environment: {
    type: "environment", label: "Environment", description: "Decorations, scenery, and world presentation objects.",
    slots: ["rendering", "physics", "effects", "audio", "persistence", "scripting"],
    recommended: ["sprite-renderer", "parallax-layer", "box-collider", "material-stack", "fade-when-player-behind"],
    required: [], hiddenCategories: ["ai", "abilities", "interface", "camera"],
  },
  "solid-surface": {
    type: "solid-surface", label: "Solid Surface", description: "Walls, floors, and scalable collision surfaces.",
    slots: ["rendering", "physics", "gameplay", "effects", "audio", "persistence"],
    recommended: ["sprite-renderer", "box-collider", "physics-material", "hazard", "save-state"],
    required: ["box-collider"], hiddenCategories: ["ai", "abilities", "camera", "interface"],
  },
  platform: {
    type: "platform", label: "Platform", description: "Static, one-way, moving, falling, or reactive platforms.",
    slots: ["rendering", "physics", "movement", "gameplay", "effects", "audio", "persistence"],
    recommended: ["sprite-renderer", "box-collider", "one-way-platform", "moving-platform"],
    required: ["box-collider"], hiddenCategories: ["camera", "interface"],
  },
  interactable: {
    type: "interactable", label: "Interactable", description: "Doors, switches, pickups, chests, and usable objects.",
    slots: ["rendering", "physics", "gameplay", "combat", "audio", "effects", "persistence", "scripting"],
    recommended: ["sprite-renderer", "interaction", "box-collider", "audio-source", "save-state"],
    required: [], hiddenCategories: ["camera", "interface"],
  },
  trigger: {
    type: "trigger", label: "Trigger", description: "Invisible areas that run logic when actors enter or leave.",
    slots: ["physics", "gameplay", "camera", "audio", "effects", "scripting"],
    recommended: ["box-collider", "sensor"], required: ["box-collider"], hiddenCategories: ["rendering", "interface"],
  },
  projectile: {
    type: "projectile", label: "Projectile", description: "Bullets, arrows, spells, beams, and moving attacks.",
    slots: ["rendering", "physics", "movement", "combat", "abilities", "effects", "audio", "scripting"],
    recommended: ["sprite-renderer", "circle-collider", "projectile", "damage-dealer", "lifetime"],
    required: ["projectile"], hiddenCategories: ["camera", "interface"],
  },
  camera: {
    type: "camera", label: "Camera", description: "Runtime viewport, tracking, bounds, look-ahead, shake, and post-processing.",
    slots: ["camera", "effects", "audio", "scripting", "debugging"],
    recommended: ["camera", "camera-follow", "camera-bounds", "camera-look-ahead", "camera-smoothing", "camera-shake"],
    required: ["camera"], hiddenCategories: ["movement", "combat", "ai", "abilities", "interface", "progression"],
  },
  light: {
    type: "light", label: "Light", description: "2D light sources and environment illumination.",
    slots: ["rendering", "effects", "scripting"], recommended: ["point-light-2d"], required: [], hiddenCategories: ["ai", "abilities", "camera", "interface"],
  },
  effect: {
    type: "effect", label: "Effect", description: "Particles, trails, shader volumes, and presentation helpers.",
    slots: ["rendering", "effects", "audio", "scripting"], recommended: ["particle-emitter", "material-stack"], required: [], hiddenCategories: ["ai", "progression", "camera"],
  },
  audio: {
    type: "audio", label: "Audio", description: "Music, ambience, spatial sound, and audio zones.",
    slots: ["audio", "physics", "scripting"], recommended: ["audio-source"], required: [], hiddenCategories: ["ai", "abilities", "camera", "interface"],
  },
  "ui-screen": {
    type: "ui-screen", label: "UI Screen", description: "HUD, menus, overlays, pause screens, and interface roots.",
    slots: ["interface", "rendering", "audio", "effects", "scripting"],
    recommended: ["ui-menu-screen", "ui-panel", "ui-style", "screen-transition"], required: [],
    hiddenCategories: ["physics", "movement", "ai", "camera"],
  },
  "ui-control": {
    type: "ui-control", label: "UI Control", description: "Buttons, labels, images, sliders, lists, and other interface widgets.",
    slots: ["interface", "rendering", "audio", "effects", "scripting"],
    recommended: ["ui-text", "ui-image", "ui-button", "ui-menu-item"], required: [], hiddenCategories: ["physics", "movement", "ai", "camera"],
  },
  data: {
    type: "data", label: "Data Object", description: "Scene-local logic and data without a visible world representation.",
    slots: ["gameplay", "abilities", "persistence", "scripting", "debugging"], recommended: ["stats", "progression-state", "script"], required: [], hiddenCategories: ["rendering", "physics", "camera"],
  },
  custom: {
    type: "custom", label: "Custom", description: "Unrestricted Game Object for unusual combinations.",
    slots: ALL_SLOTS, recommended: ["sprite-renderer"], required: [], hiddenCategories: [],
  },
};

export function inferGameObjectType(object: Pick<GameObjectDocument, "components" | "tags" | "name">): GameObjectType {
  const types = new Set(object.components.map((component) => component.type));
  if (types.has("camera")) return "camera";
  if ([...types].some((type) => type.startsWith("ui-"))) return types.has("ui-menu-screen") ? "ui-screen" : "ui-control";
  if (types.has("projectile")) return "projectile";
  if (types.has("ai-controller") || types.has("vision-sensor") || object.tags.some((tag) => tag.toLowerCase() === "enemy")) return "enemy";
  if (types.has("player-input") || object.tags.some((tag) => tag.toLowerCase() === "player")) return "character";
  if (types.has("camera-zone") || types.has("sensor")) return "trigger";
  if (types.has("door") || types.has("switch") || types.has("interaction") || types.has("item-pickup")) return "interactable";
  if (types.has("one-way-platform") || types.has("moving-platform")) return "platform";
  if (types.has("box-collider") && (types.has("sprite-renderer") || types.has("shape-renderer"))) return "solid-surface";
  if (types.has("audio-source") && object.components.length <= 2) return "audio";
  if (types.has("particle-emitter") || types.has("material-stack")) return "effect";
  return "custom";
}

export function profileForObject(object: GameObjectDocument, project?: Pick<ProjectDocument, "customGameObjectTypes">): GameObjectTypeProfile {
  if (object.objectType === "custom" && object.customTypeId && project) {
    const custom = project.customGameObjectTypes?.find((candidate) => candidate.id === object.customTypeId);
    if (custom) return { type: "custom", label: custom.name, description: custom.description, slots: custom.slots, recommended: custom.recommended, required: custom.required, hiddenCategories: custom.hiddenCategories };
  }
  return GAME_OBJECT_TYPE_PROFILES[object.objectType ?? inferGameObjectType(object)];
}

export function createDefaultCustomGameObjectTypes(): CustomGameObjectTypeDefinition[] {
  return [];
}

export function slotForCategory(category: ComponentCategory): ComponentSlot {
  if (category === "rendering" || category === "animation" || category === "materials") return "rendering";
  if (category === "physics" || category === "world") return "physics";
  if (category === "movement") return "movement";
  if (category === "combat") return "combat";
  if (category === "ai" || category === "behaviour") return "ai";
  if (category === "abilities" || category === "stats" || category === "progression") return category === "abilities" ? "abilities" : "gameplay";
  if (category === "camera") return "camera";
  if (category === "audio") return "audio";
  if (category === "interface") return "interface";
  if (category === "effects") return "effects";
  if (category === "persistence") return "persistence";
  if (category === "scripting") return "scripting";
  if (category === "debugging") return "debugging";
  return "gameplay";
}

export function createDefaultEditorThemes(): EditorThemeDefinition[] {
  return [
    { id: "shadowium", name: "Shadowium", mode: "dark", accent: "#8c6cff", secondaryAccent: "#55c7ff", background: "#090d14", surface: "#101722", raisedSurface: "#162031", text: "#f4f7ff", mutedText: "#98a5ba", radius: 16, blur: 18, shadow: 0.3, density: "comfortable", motionScale: 1, builtIn: true },
    { id: "graphite", name: "Graphite", mode: "dark", accent: "#a5b4c7", secondaryAccent: "#7dd3fc", background: "#0d0f12", surface: "#15181d", raisedSurface: "#1d2128", text: "#f6f7f9", mutedText: "#9aa2ad", radius: 12, blur: 12, shadow: 0.26, density: "compact", motionScale: 0.9, builtIn: true },
    { id: "midnight-violet", name: "Midnight Violet", mode: "dark", accent: "#a174ff", secondaryAccent: "#3ed8ff", background: "#080817", surface: "#111126", raisedSurface: "#1a1735", text: "#faf7ff", mutedText: "#aaa0c7", radius: 18, blur: 22, shadow: 0.34, density: "comfortable", motionScale: 1, builtIn: true },
    { id: "deep-ocean", name: "Deep Ocean", mode: "dark", accent: "#50baff", secondaryAccent: "#42e8c7", background: "#061018", surface: "#0b1a24", raisedSurface: "#102837", text: "#effcff", mutedText: "#8fb2c3", radius: 16, blur: 18, shadow: 0.28, density: "comfortable", motionScale: 1, builtIn: true },
    { id: "warm-ember", name: "Warm Ember", mode: "dark", accent: "#ff9b67", secondaryAccent: "#ffc45e", background: "#120b0a", surface: "#1d1312", raisedSurface: "#2a1a17", text: "#fff6ef", mutedText: "#c3a59a", radius: 15, blur: 14, shadow: 0.28, density: "comfortable", motionScale: 1, builtIn: true },
    { id: "light", name: "Light", mode: "light", accent: "#6650a4", secondaryAccent: "#00639b", background: "#f7f7fb", surface: "#ffffff", raisedSurface: "#f0f1f8", text: "#1b1b20", mutedText: "#62636b", radius: 16, blur: 16, shadow: 0.18, density: "comfortable", motionScale: 1, builtIn: true },
    { id: "high-contrast", name: "High Contrast", mode: "dark", accent: "#b89cff", secondaryAccent: "#67ddff", background: "#000000", surface: "#0a0a0a", raisedSurface: "#161616", text: "#ffffff", mutedText: "#d0d0d0", radius: 8, blur: 0, shadow: 0, density: "compact", motionScale: 0.5, builtIn: true },
  ];
}

export function createDefaultGameUiThemes(): GameUiThemeDefinition[] {
  return [
    { id: "modern-dark", name: "Modern Dark", fontFamily: "Inter, system-ui", textColor: "#ffffff", accentColor: "#8c6cff", panelColor: "#151827e8", buttonColor: "#252a3d", selectedColor: "#ffffff", selectedBackground: "#6f56d9", cornerRadius: 18, spacing: 14, transition: "slide-fade", navigationSoundAssetId: "", confirmSoundAssetId: "", builtIn: true },
    { id: "retro-rpg", name: "Retro RPG", fontFamily: "monospace", textColor: "#ffffff", accentColor: "#ffff66", panelColor: "#000000", buttonColor: "#000000", selectedColor: "#ffff66", selectedBackground: "#000000", cornerRadius: 0, spacing: 10, transition: "fade", navigationSoundAssetId: "", confirmSoundAssetId: "", builtIn: true },
    { id: "neon-sci-fi", name: "Neon Sci-Fi", fontFamily: "system-ui", textColor: "#e9fbff", accentColor: "#53e6ff", panelColor: "#07131ed9", buttonColor: "#0e2533", selectedColor: "#ffffff", selectedBackground: "#0e7186", cornerRadius: 12, spacing: 12, transition: "glow-slide", navigationSoundAssetId: "", confirmSoundAssetId: "", builtIn: true },
  ];
}

export function createDefaultGenreKits(): GenreKitDefinition[] {
  const kit = (id: string, name: string, description: string, recipes: string[]): GenreKitDefinition => ({ id, name, description, recipeIds: recipes, inputActionIds: [], uiThemeId: "modern-dark", builtIn: true });
  return [
    kit("top-down-adventure", "Top-Down Adventure", "Characters, camera tracking, interaction, inventory, and scene transitions.", ["top-down-player"]),
    kit("platformer", "Platformer", "Platformer movement, one-way surfaces, camera dead zones, hazards, and checkpoints.", ["platformer-player"]),
    kit("action-rpg", "Action RPG", "Stats, combat, abilities, loot, progression, enemies, and HUD foundations.", ["top-down-player"]),
    kit("turn-rpg", "Turn-Based RPG", "Turn data, party foundations, menus, stats, and ability assets.", []),
    kit("roguelite", "Roguelite", "Combat, procedural-ready rooms, loot, progression, and run-state foundations.", []),
    kit("tower-defence", "Tower Defence", "Pathing-ready enemies, towers, projectiles, waves, and progression.", []),
    kit("farming", "Farming / Life Sim", "Grid movement, interaction, inventory, time-state, dialogue, and save foundations.", []),
    kit("visual-novel", "Visual Novel", "UI screens, dialogue, transitions, audio, and save slots.", []),
    kit("puzzle", "Puzzle", "Triggers, switches, state, scene transitions, and reusable interactables.", []),
    kit("survival", "Survival", "Stats, resources, inventory, crafting-ready data, hazards, and saves.", []),
    kit("metroidvania", "Metroidvania", "Platformer movement, abilities, checkpoints, camera zones, and progression.", ["platformer-player"]),
  ];
}

export function projectWithPhase10Defaults(project: ProjectDocument): ProjectDocument {
  project.customGameObjectTypes ??= createDefaultCustomGameObjectTypes();
  project.editorThemes ??= createDefaultEditorThemes();
  project.activeEditorThemeId ||= "shadowium";
  project.gameUiThemes ??= createDefaultGameUiThemes();
  project.activeGameUiThemeId ||= "modern-dark";
  project.genreKits ??= createDefaultGenreKits();
  project.dialogues ??= [];
  project.quests ??= [];
  project.animationSets ??= [];
  project.packages ??= [];
  for (const scene of project.scenes) for (const object of scene.objects) object.objectType ??= inferGameObjectType(object);
  for (const prefab of project.prefabs) prefab.object.objectType ??= inferGameObjectType(prefab.object);
  return project;
}
