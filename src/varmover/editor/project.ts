import { createComponentInstance } from "./catalog";
import { createId } from "./ids";
import { createDefaultEditorThemes, createDefaultGameUiThemes, createDefaultGenreKits, inferGameObjectType } from "./phase10Architecture";
import type {
  EventActionDefinition,
  EventConditionDefinition,
  EventRuleDocument,
  GameObjectDocument,
  InputActionDefinition,
  PrefabDocument,
  ProjectDocument,
  SceneDocument,
  DamageTypeDefinition,
  AbilityDefinition,
  StatusEffectDefinition,
  LootTableDefinition,
  ExperienceCurveDefinition,
  UpgradeTreeDefinition,
  ShaderDefinition,
  MaterialDefinition,
  ScriptDefinition,
  BehaviourRecipeDefinition,
} from "./types";

export { createId } from "./ids";

export function cloneProject(project: ProjectDocument): ProjectDocument {
  if (typeof structuredClone === "function") {
    return structuredClone(project);
  }

  return JSON.parse(JSON.stringify(project)) as ProjectDocument;
}

export function cloneObject(object: GameObjectDocument): GameObjectDocument {
  if (typeof structuredClone === "function") {
    return structuredClone(object);
  }

  return JSON.parse(JSON.stringify(object)) as GameObjectDocument;
}

export function createGameObject(
  name: string,
  x = 0,
  y = 0,
  color = "#78909c",
): GameObjectDocument {
  return {
    id: createId("object"),
    name,
    objectType: "custom",
    parentId: null,
    layerId: "layer-gameplay",
    enabled: true,
    editorVisible: true,
    runtimeVisible: true,
    collisionEnabled: true,
    logicEnabled: true,
    locked: false,
    tags: [],
    transform: {
      position: { x, y },
      rotation: 0,
      scale: { x: 1, y: 1 },
      pivot: { x: 0.5, y: 0.5 },
    },
    size: {
      width: 64,
      height: 64,
    },
    editorColor: color,
    components: [createComponentInstance("sprite-renderer")],
  };
}

export function createScene(name: string): SceneDocument {
  return {
    id: createId("scene"),
    name,
    backgroundColor: "#12161d",
    width: 1280,
    height: 720,
    gravityX: 0,
    gravityY: 1200,
    defaultCameraId: null,
    defaultSpawnId: "default",
    musicAssetId: null,
    resetOnEnter: true,
    tags: [],
    layers: [
      { id: "layer-background", name: "Background", visible: true, locked: false, renderOrder: -100, parallaxX: 0.5, parallaxY: 0.5, editorColor: "#607d8b", runtimeIncluded: true },
      { id: "layer-ground", name: "Ground", visible: true, locked: false, renderOrder: -10, parallaxX: 1, parallaxY: 1, editorColor: "#78909c", runtimeIncluded: true },
      { id: "layer-gameplay", name: "Gameplay", visible: true, locked: false, renderOrder: 0, parallaxX: 1, parallaxY: 1, editorColor: "#5c9ded", runtimeIncluded: true },
      { id: "layer-foreground", name: "Foreground", visible: true, locked: false, renderOrder: 100, parallaxX: 1.1, parallaxY: 1.1, editorColor: "#ab8cf2", runtimeIncluded: true },
      { id: "layer-interface", name: "Interface", visible: true, locked: false, renderOrder: 1000, parallaxX: 0, parallaxY: 0, editorColor: "#66bb6a", runtimeIncluded: true },
    ],
    objects: [],
  };
}

export function createDefaultCollisionMatrix(): Record<string, string[]> {
  return {
    World: ["Player", "Enemy"],
    Player: ["World", "Enemy", "Trigger"],
    Enemy: ["World", "Player", "Trigger"],
    Trigger: ["Player", "Enemy"],
  };
}

export function createDefaultInputActions(): InputActionDefinition[] {
  return [
    { id: "move-up", name: "Move Up", keys: ["KeyW", "ArrowUp"] },
    { id: "move-down", name: "Move Down", keys: ["KeyS", "ArrowDown"] },
    { id: "move-left", name: "Move Left", keys: ["KeyA", "ArrowLeft"] },
    { id: "move-right", name: "Move Right", keys: ["KeyD", "ArrowRight"] },
    { id: "interact", name: "Interact", keys: ["KeyE"] },
    { id: "jump", name: "Jump", keys: ["Space"] },
    { id: "attack", name: "Attack", keys: ["KeyF"] },
    { id: "ability-1", name: "Ability 1", keys: ["Digit1"] },
    { id: "ability-2", name: "Ability 2", keys: ["Digit2"] },
    { id: "ability-3", name: "Ability 3", keys: ["Digit3"] },
    { id: "dash", name: "Dash", keys: ["ShiftLeft", "ShiftRight"] },
    { id: "pause", name: "Pause", keys: ["Escape"] },
  ];
}


export function createDefaultDamageTypes(): DamageTypeDefinition[] {
  return [
    { id: "physical", name: "Physical", color: "#d8c7aa", healing: false, tags: ["weapon"] },
    { id: "fire", name: "Fire", color: "#ff7043", healing: false, tags: ["elemental", "magic"] },
    { id: "ice", name: "Ice", color: "#64b5f6", healing: false, tags: ["elemental", "magic"] },
    { id: "lightning", name: "Lightning", color: "#ffee58", healing: false, tags: ["elemental", "magic"] },
    { id: "poison", name: "Poison", color: "#9ccc65", healing: false, tags: ["damage-over-time"] },
    { id: "light", name: "Light", color: "#fff59d", healing: false, tags: ["magic"] },
    { id: "shadow", name: "Shadow", color: "#7e57c2", healing: false, tags: ["magic"] },
    { id: "arcane", name: "Arcane", color: "#ec407a", healing: false, tags: ["magic"] },
    { id: "healing", name: "Healing", color: "#66bb6a", healing: true, tags: ["restoration"] },
  ];
}

function abilityEffect(id: string, type: AbilityDefinition["effects"][number]["type"], amount = 0, patch: Partial<AbilityDefinition["effects"][number]> = {}): AbilityDefinition["effects"][number] {
  return { id, type, amount, damageTypeId: "physical", statusEffectId: "", prefabId: "", statId: "", durationSeconds: 0, radius: 0, value: null, ...patch };
}

export function createDefaultAbilities(): AbilityDefinition[] {
  return [
    { id: "fireball", name: "Fireball", description: "Launches a fire projectile that damages and burns the first hostile target hit.", iconAssetId: null, activationActionId: "ability-1", castTimeSeconds: 0.25, channelTimeSeconds: 0, cooldownSeconds: 1.2, resourceId: "mana", resourceCost: 10, targetingMode: "direction", range: 640, maximumTargets: 1, effects: [abilityEffect("fireball-projectile", "spawn-prefab", 0, { prefabId: "builtin-fireball-projectile" }), abilityEffect("fireball-damage", "damage", 20, { damageTypeId: "fire" }), abilityEffect("fireball-burn", "apply-status", 0, { statusEffectId: "burning", durationSeconds: 4 })], tags: ["magic", "fire", "projectile"] },
    { id: "ice-nova", name: "Ice Nova", description: "Damages, pushes, and slows hostile targets around the caster.", iconAssetId: null, activationActionId: "ability-2", castTimeSeconds: 0.4, channelTimeSeconds: 0, cooldownSeconds: 4, resourceId: "mana", resourceCost: 25, targetingMode: "area", range: 0, maximumTargets: 32, effects: [abilityEffect("ice-nova-damage", "damage", 18, { damageTypeId: "ice", radius: 140 }), abilityEffect("ice-nova-slow", "apply-status", 0, { statusEffectId: "slowed", durationSeconds: 3, radius: 140 }), abilityEffect("ice-nova-push", "knockback", 180, { radius: 140 })], tags: ["magic", "ice", "area"] },
    { id: "chain-lightning", name: "Chain Lightning", description: "Strikes one target and chains to nearby hostile targets.", iconAssetId: null, activationActionId: "ability-3", castTimeSeconds: 0.3, channelTimeSeconds: 0, cooldownSeconds: 3, resourceId: "mana", resourceCost: 20, targetingMode: "chain", range: 360, maximumTargets: 5, effects: [abilityEffect("chain-lightning-damage", "damage", 16, { damageTypeId: "lightning", radius: 140 })], tags: ["magic", "lightning", "chain"] },
    { id: "blink", name: "Blink", description: "Teleports the caster toward the selected point after a collision-safe distance check.", iconAssetId: null, activationActionId: "dash", castTimeSeconds: 0, channelTimeSeconds: 0, cooldownSeconds: 2, resourceId: "mana", resourceCost: 12, targetingMode: "point", range: 220, maximumTargets: 1, effects: [abilityEffect("blink-teleport", "teleport", 220)], tags: ["magic", "movement"] },
    { id: "healing-wave", name: "Healing Wave", description: "Heals the selected ally and nearby friendly targets.", iconAssetId: null, activationActionId: "ability-3", castTimeSeconds: 0.35, channelTimeSeconds: 0, cooldownSeconds: 5, resourceId: "mana", resourceCost: 22, targetingMode: "chain", range: 320, maximumTargets: 4, effects: [abilityEffect("healing-wave-heal", "heal", 24, { damageTypeId: "healing", radius: 120 })], tags: ["magic", "healing"] },
    { id: "arcane-shield", name: "Arcane Shield", description: "Applies a temporary shield status to the caster.", iconAssetId: null, activationActionId: "ability-2", castTimeSeconds: 0.15, channelTimeSeconds: 0, cooldownSeconds: 8, resourceId: "mana", resourceCost: 18, targetingMode: "self", range: 0, maximumTargets: 1, effects: [abilityEffect("arcane-shield-status", "apply-status", 0, { statusEffectId: "shielded", durationSeconds: 6 })], tags: ["magic", "defence"] },
  ];
}

export function createDefaultStatusEffects(): StatusEffectDefinition[] {
  return [
    { id: "burning", name: "Burning", description: "Deals Fire damage over time.", durationSeconds: 4, tickIntervalSeconds: 1, maximumStacks: 3, stacking: "stack-intensity", damagePerTick: 4, damageTypeId: "fire", speedMultiplier: 1, damageMultiplier: 1, materialId: "material-burning", tags: ["debuff", "fire"] },
    { id: "poisoned", name: "Poisoned", description: "Deals Poison damage over time.", durationSeconds: 8, tickIntervalSeconds: 1, maximumStacks: 5, stacking: "stack-duration", damagePerTick: 2, damageTypeId: "poison", speedMultiplier: 1, damageMultiplier: 1, materialId: "material-poison", tags: ["debuff", "poison"] },
    { id: "slowed", name: "Slowed", description: "Reduces movement speed.", durationSeconds: 3, tickIntervalSeconds: 0, maximumStacks: 1, stacking: "refresh", damagePerTick: 0, damageTypeId: "ice", speedMultiplier: 0.55, damageMultiplier: 1, materialId: "material-frost", tags: ["debuff", "ice"] },
    { id: "stunned", name: "Stunned", description: "Disables movement, AI decisions, and attacks.", durationSeconds: 1.5, tickIntervalSeconds: 0, maximumStacks: 1, stacking: "refresh", damagePerTick: 0, damageTypeId: "lightning", speedMultiplier: 0, damageMultiplier: 1, materialId: "material-lightning", tags: ["debuff", "control"] },
    { id: "shielded", name: "Shielded", description: "Reduces incoming damage while active.", durationSeconds: 6, tickIntervalSeconds: 0, maximumStacks: 1, stacking: "refresh", damagePerTick: 0, damageTypeId: "arcane", speedMultiplier: 1, damageMultiplier: 0.5, materialId: "material-shield", tags: ["buff", "defence"] },
    { id: "regeneration", name: "Regeneration", description: "Restores Health each tick.", durationSeconds: 8, tickIntervalSeconds: 1, maximumStacks: 3, stacking: "stack-intensity", damagePerTick: -4, damageTypeId: "healing", speedMultiplier: 1, damageMultiplier: 1, materialId: "material-healing", tags: ["buff", "healing"] },
  ];
}

export function createDefaultLootTables(): LootTableDefinition[] {
  return [{ id: "slime-loot", name: "Slime Loot", rolls: 1, pityCounterKey: "slimeRarePity", pityThreshold: 30, entries: [
    { id: "slime-gel", kind: "item", referenceId: "slime-gel", weight: 60, minimumAmount: 1, maximumAmount: 3, guaranteed: false, unique: false, conditionVariable: "", conditionValue: null },
    { id: "small-potion", kind: "item", referenceId: "small-potion", weight: 15, minimumAmount: 1, maximumAmount: 1, guaranteed: false, unique: false, conditionVariable: "", conditionValue: null },
    { id: "rare-slime-core", kind: "item", referenceId: "rare-slime-core", weight: 2, minimumAmount: 1, maximumAmount: 1, guaranteed: false, unique: true, conditionVariable: "", conditionValue: null },
    { id: "slime-experience", kind: "experience", referenceId: "experience", weight: 100, minimumAmount: 8, maximumAmount: 12, guaranteed: true, unique: false, conditionVariable: "", conditionValue: null },
  ] }];
}

export function createDefaultExperienceCurves(): ExperienceCurveDefinition[] {
  return [{ id: "default", name: "Default Growth", maximumLevel: 100, baseExperience: 100, growthFactor: 1.35, formula: "exponential" }];
}

export function createDefaultUpgradeTrees(): UpgradeTreeDefinition[] {
  return [{ id: "adventurer", name: "Adventurer", nodes: [
    { id: "health-1", name: "Heart Training", description: "+20 maximum Health.", cost: 1, currencyId: "skill-points", prerequisites: [], mutuallyExclusiveWith: [], unlockAbilityId: "", statModifiers: [{ id: "health-1-mod", source: "Heart Training", statId: "maximum-health", mode: "flat", value: 20, durationSeconds: null, stacking: "stack" }], position: { x: 80, y: 100 } },
    { id: "fireball-node", name: "Fireball", description: "Unlock Fireball.", cost: 1, currencyId: "skill-points", prerequisites: ["health-1"], mutuallyExclusiveWith: [], unlockAbilityId: "fireball", statModifiers: [], position: { x: 260, y: 60 } },
    { id: "ice-node", name: "Ice Nova", description: "Unlock Ice Nova.", cost: 1, currencyId: "skill-points", prerequisites: ["health-1"], mutuallyExclusiveWith: [], unlockAbilityId: "ice-nova", statModifiers: [], position: { x: 260, y: 160 } },
  ] }];
}

export function createDefaultShaders(): ShaderDefinition[] {
  const passthrough = `precision mediump float; varying vec2 vTextureCoord; uniform sampler2D uSampler; void main(){ gl_FragColor = texture2D(uSampler, vTextureCoord); }`;
  return [
    { id: "shader-outline", name: "Outline", vertexSource: "", fragmentSource: passthrough, target: "sprite", uniforms: { color: "#ffffff", thickness: 1 }, builtIn: true },
    { id: "shader-hit-flash", name: "Hit Flash", vertexSource: "", fragmentSource: passthrough, target: "sprite", uniforms: { color: "#ffffff", amount: 1 }, builtIn: true },
    { id: "shader-dissolve", name: "Dissolve", vertexSource: "", fragmentSource: passthrough, target: "sprite", uniforms: { threshold: 0, edgeColor: "#ffb74d" }, builtIn: true },
    { id: "shader-pixelate", name: "Pixelate", vertexSource: "", fragmentSource: passthrough, target: "fullscreen", uniforms: { size: 4 }, builtIn: true },
    { id: "shader-frost", name: "Frost", vertexSource: "", fragmentSource: passthrough, target: "sprite", uniforms: { tint: "#80d8ff", amount: 0.6 }, builtIn: true },
    { id: "shader-poison", name: "Poison", vertexSource: "", fragmentSource: passthrough, target: "sprite", uniforms: { tint: "#9ccc65", amount: 0.55 }, builtIn: true },
    { id: "shader-vignette", name: "Vignette", vertexSource: "", fragmentSource: passthrough, target: "fullscreen", uniforms: { intensity: 0.4 }, builtIn: true },
  ];
}

export function createDefaultMaterials(): MaterialDefinition[] {
  return [
    { id: "material-burning", name: "Burning", shaderId: "shader-hit-flash", blendMode: "normal", uniforms: { color: "#ff5722", amount: 0.35 }, enabled: true },
    { id: "material-frost", name: "Frost", shaderId: "shader-frost", blendMode: "normal", uniforms: { tint: "#80d8ff", amount: 0.6 }, enabled: true },
    { id: "material-poison", name: "Poison", shaderId: "shader-poison", blendMode: "normal", uniforms: { tint: "#8bc34a", amount: 0.55 }, enabled: true },
    { id: "material-lightning", name: "Lightning", shaderId: "shader-outline", blendMode: "add", uniforms: { color: "#fff176", thickness: 2 }, enabled: true },
    { id: "material-shield", name: "Shield", shaderId: "shader-outline", blendMode: "add", uniforms: { color: "#64b5f6", thickness: 3 }, enabled: true },
    { id: "material-healing", name: "Healing", shaderId: "shader-outline", blendMode: "add", uniforms: { color: "#66bb6a", thickness: 2 }, enabled: true },
  ];
}

export function createDefaultScripts(): ScriptDefinition[] {
  return [{
    id: "example-ai-reaction",
    name: "AI Reaction Example",
    source: `fn on_damage() {
  log("Damage received; switching to Flee state");
  ai_set_state("Flee");
  emit("ai-flee-requested", true);
}`,
    executionOrder: 0,
    enabled: true,
    exposedProperties: {},
  }];
}

export function createDefaultBehaviourRecipes(): BehaviourRecipeDefinition[] {
  return [
    { id: "recipe-killable-enemy", name: "Make Enemy Killable", description: "Adds Health, Hurtbox, Damage Receiver, Death Behaviour, and status support.", category: "Combat", requiredComponents: ["health", "hurtbox", "damage-receiver", "status-receiver", "death-behaviour"], componentSettings: {}, stateMachineJson: "", eventRuleIds: [], tutorialSteps: ["Select the enemy Game Object.", "Open Add Component.", "Inspect Health and Death Behaviour.", "Test damage in Game Preview."], builtIn: true },
    { id: "recipe-chase-attack", name: "Enemy Chases and Attacks Player", description: "Adds team filtering, sensors, navigation, AI, attack phases, and a state machine.", category: "AI", requiredComponents: ["team", "blackboard", "vision-sensor", "navigation-agent", "target-selector", "ai-controller", "state-machine", "attack", "hitbox", "attack-target"], componentSettings: { team: { teamId: "Enemy", hostileTeams: "Player" }, "vision-sensor": { targetTeams: "Player" }, "state-machine": { initialState: "Idle", states: "{\"Idle\":{},\"Chase\":{},\"Attack\":{},\"Dead\":{}}" } }, stateMachineJson: "{\"Idle\":{\"seen\":\"Chase\"},\"Chase\":{\"inRange\":\"Attack\"},\"Attack\":{\"outOfRange\":\"Chase\"}}", eventRuleIds: [], tutorialSteps: ["Set the Player Team to Player.", "Set the enemy Team to Enemy.", "Tune Vision Range.", "Tune Attack range and cooldown."], builtIn: true },
    { id: "recipe-cowardly-enemy", name: "Enemy Flees at Low Health", description: "Adds flee behaviour and health thresholds to an AI enemy.", category: "AI", requiredComponents: ["health", "blackboard", "ai-controller", "state-machine", "flee-target"], componentSettings: { "flee-target": { healthThreshold: 25, recoverThreshold: 50, speed: 150 } }, stateMachineJson: "{\"Any\":{\"health<=25\":\"Flee\"},\"Flee\":{\"health>=50\":\"Chase\"}}", eventRuleIds: [], tutorialSteps: ["Damage the enemy below 25% Health.", "Watch the AI Debugger enter Flee.", "Raise Health above 50% to resume pursuit."], builtIn: true },
    { id: "recipe-loot-experience", name: "Enemy Drops Loot and Experience", description: "Adds a Loot Dropper and Death Behaviour linked to a Loot Table.", category: "Progression", requiredComponents: ["loot-dropper", "death-behaviour"], componentSettings: { "loot-dropper": { lootTableId: "slime-loot", trigger: "death" }, "death-behaviour": { lootTableId: "slime-loot", experienceAward: 10 } }, stateMachineJson: "", eventRuleIds: [], tutorialSteps: ["Choose a Loot Table.", "Set the experience award.", "Kill the enemy in Game Preview.", "Inspect the Combat and Progression logs."], builtIn: true },
    { id: "recipe-magic-user", name: "Give Player Magic Abilities", description: "Adds Mana, Ability User, Targeting, Cast Controller, Cooldowns, and Status Receiver.", category: "Abilities", requiredComponents: ["resource-pool", "ability-user", "targeting", "cast-controller", "cooldown-controller", "status-receiver"], componentSettings: { "resource-pool": { resourceId: "mana", maximum: 100, starting: 100 }, "ability-user": { abilityIds: "fireball,ice-nova,chain-lightning,blink" } }, stateMachineJson: "", eventRuleIds: [], tutorialSteps: ["Bind Ability input actions.", "Inspect Mana regeneration.", "Select Ability assets.", "Test cooldowns and targeting."], builtIn: true },
  ];
}

export function createCondition(
  type: EventConditionDefinition["type"] = "always",
): EventConditionDefinition {
  return {
    id: createId("condition"),
    type,
    objectId: null,
    key: "",
    value: true,
    operator: "==",
    componentType: null,
  };
}

export function createAction(
  type: EventActionDefinition["type"] = "debug-message",
): EventActionDefinition {
  return {
    id: createId("action"),
    type,
    objectId: null,
    sceneId: null,
    clipId: null,
    componentType: null,
    propertyKey: "",
    key: "",
    value: true,
    x: 0,
    y: 0,
    message: "Event fired",
  };
}

export function createEventRule(name = "New Rule"): EventRuleDocument {
  return {
    id: createId("rule"),
    name,
    enabled: true,
    trigger: {
      type: "interaction",
      sourceObjectId: null,
      targetObjectId: null,
    },
    conditions: [],
    actions: [createAction("debug-message")],
  };
}

function createBuiltInPrefabs(): PrefabDocument[] {
  const staticSprite = createGameObject("Static Sprite", 0, 0, "#78909c");

  const wall = createGameObject("Solid Wall", 0, 0, "#607d8b");
  wall.size = { width: 128, height: 48 };
  wall.components.push(createComponentInstance("box-collider"));
  const wallCollider = wall.components.find((element) => element.type === "box-collider");
  if (wallCollider) {
    wallCollider.settings.width = 128;
    wallCollider.settings.height = 48;
    wallCollider.settings.behavior = "static";
  }

  const trigger = createGameObject("Trigger Area", 0, 0, "#66bb6a");
  trigger.components = [createComponentInstance("box-collider")];
  const triggerCollider = trigger.components[0];
  triggerCollider.settings.behavior = "trigger";
  triggerCollider.settings.layer = "Trigger";
  triggerCollider.settings.width = 96;
  triggerCollider.settings.height = 96;

  const interactive = createGameObject("Interactive Object", 0, 0, "#66bb6a");
  interactive.components.push(createComponentInstance("interaction"));

  const player = createGameObject("Top-Down Player", 0, 0, "#5c9ded");
  player.size = { width: 48, height: 64 };
  player.components = [
    createComponentInstance("sprite-renderer"),
    createComponentInstance("player-input"),
    createComponentInstance("top-down-movement"),
    createComponentInstance("directional-animation"),
    createComponentInstance("box-collider"),
    createComponentInstance("health"),
    createComponentInstance("camera-target"),
    createComponentInstance("inventory"),
    createComponentInstance("save-state"),
  ];
  const playerSave = player.components.find((element) => element.type === "save-state");
  if (playerSave) {
    playerSave.settings.saveKey = "player";
    playerSave.settings.persistAcrossScenes = true;
    playerSave.settings.saveTransform = true;
  }
  const playerCollider = player.components.find((element) => element.type === "box-collider");
  if (playerCollider) {
    playerCollider.settings.behavior = "dynamic";
    playerCollider.settings.width = 34;
    playerCollider.settings.height = 42;
    playerCollider.settings.offsetY = 10;
    playerCollider.settings.layer = "Player";
  }

  const tilemap = createGameObject("Tilemap", 0, 0, "#546e7a");
  tilemap.layerId = "layer-ground";
  tilemap.size = { width: 1024, height: 768 };
  tilemap.components = [createComponentInstance("tilemap-renderer")];

  const camera = createGameObject("Game Camera", 0, 0, "#42a5f5");
  camera.components = [createComponentInstance("camera")];

  const dialogueSpeaker = createGameObject("Dialogue Speaker", 0, 0, "#ce93d8");
  dialogueSpeaker.size = { width: 48, height: 64 };
  dialogueSpeaker.components = [
    createComponentInstance("sprite-renderer"),
    createComponentInstance("interaction"),
    createComponentInstance("dialogue-speaker"),
  ];
  const dialogueInteraction = dialogueSpeaker.components.find((element) => element.type === "interaction");
  if (dialogueInteraction) dialogueInteraction.settings.promptText = "Talk";

  const pickup = createGameObject("Item Pickup", 0, 0, "#ffca5c");
  pickup.size = { width: 32, height: 32 };
  pickup.components = [
    createComponentInstance("sprite-renderer"),
    createComponentInstance("box-collider"),
    createComponentInstance("interaction"),
    createComponentInstance("item-pickup"),
  ];
  const pickupCollider = pickup.components.find((element) => element.type === "box-collider");
  if (pickupCollider) {
    pickupCollider.settings.behavior = "trigger";
    pickupCollider.settings.layer = "Trigger";
  }

  const sceneExit = createGameObject("Scene Exit", 0, 0, "#8d6e63");
  sceneExit.size = { width: 48, height: 96 };
  sceneExit.components = [
    createComponentInstance("sprite-renderer"),
    createComponentInstance("box-collider"),
    createComponentInstance("interaction"),
    createComponentInstance("scene-exit"),
  ];

  const audioSource = createGameObject("Audio Source", 0, 0, "#26a69a");
  audioSource.components = [createComponentInstance("audio-source")];

  const uiText = createGameObject("UI Text", 24, 24, "#ecf3ff");
  uiText.layerId = "layer-interface";
  uiText.size = { width: 240, height: 48 };
  uiText.components = [createComponentInstance("ui-text")];

  const uiPanel = createGameObject("UI Panel", 24, 24, "#7e57c2");
  uiPanel.layerId = "layer-interface";
  uiPanel.size = { width: 320, height: 180 };
  uiPanel.components = [createComponentInstance("ui-panel")];

  const uiButton = createGameObject("UI Button", 24, 96, "#7e57c2");
  uiButton.layerId = "layer-interface";
  uiButton.size = { width: 180, height: 48 };
  uiButton.components = [createComponentInstance("ui-button")];

  const uiProgress = createGameObject("UI Progress Bar", 24, 160, "#66bb6a");
  uiProgress.layerId = "layer-interface";
  uiProgress.size = { width: 240, height: 24 };
  uiProgress.components = [createComponentInstance("ui-progress-bar")];

  const particle = createGameObject("Particle Emitter", 0, 0, "#ab8cf2");
  particle.components = [createComponentInstance("particle-emitter")];

  const spawnPoint = createGameObject("Scene Spawn Point", 0, 0, "#66bb6a");
  spawnPoint.size = { width: 40, height: 40 };
  spawnPoint.components = [createComponentInstance("scene-spawn-point")];

  const definitions: Array<[string, string, GameObjectDocument]> = [
    ["Top-Down Player", "A ready player with input, movement, animation, collision, health, and camera follow.", player],
    ["Static Sprite", "A simple rendered object ready for an imported image.", staticSprite],
    ["Solid Wall", "A static object that blocks moving colliders.", wall],
    ["Trigger Area", "An invisible area that emits enter and exit events.", trigger],
    ["Interactive Object", "A rendered object that displays an interaction prompt.", interactive],
    ["Tilemap", "A multi-layer grid for painting terrain and world collision.", tilemap],
    ["Game Camera", "A configurable runtime camera with follow, zoom, dead-zone, and bounds.", camera],
    ["Dialogue Speaker", "An interactable character with ordered dialogue lines.", dialogueSpeaker],
    ["Item Pickup", "A reusable collectible that disappears after it is collected.", pickup],
    ["Scene Exit", "A doorway or trigger that changes to another scene during play.", sceneExit],
    ["Audio Source", "Plays music, ambience, voice, or sound effects.", audioSource],
    ["UI Text", "Screen-space text for HUDs and menus.", uiText],
    ["UI Panel", "A screen-space panel for menus and HUD groups.", uiPanel],
    ["UI Button", "A clickable button for menus, pause screens, and scene changes.", uiButton],
    ["UI Progress Bar", "A HUD bar bound to health or project variables.", uiProgress],
    ["Particle Emitter", "A preset-based particle effect for dust, rain, sparks, and more.", particle],
    ["Scene Spawn Point", "A named arrival point used by scene exits and carried player objects.", spawnPoint],
  ];

  const recipe = (name: string, description: string, color: string, types: Parameters<typeof createComponentInstance>[0][], width = 64, height = 64): [string, string, GameObjectDocument] => {
    const object = createGameObject(name, 0, 0, color);
    object.size = { width, height };
    object.components = types.map((type) => createComponentInstance(type));
    const box = object.components.find((element) => element.type === "box-collider");
    const circle = object.components.find((element) => element.type === "circle-collider");
    if (box) {
      box.settings.width = width;
      box.settings.height = height;
      if (types.some((type) => ["player-input", "rigidbody-2d", "wander", "chase-target"].includes(type))) box.settings.behavior = "dynamic";
      if (types.some((type) => ["checkpoint", "hazard", "teleporter"].includes(type))) box.settings.behavior = "trigger";
      if (types.includes("player-input")) box.settings.layer = "Player";
      if (types.some((type) => ["wander", "chase-target"].includes(type))) box.settings.layer = "Enemy";
      if (types.some((type) => ["checkpoint", "teleporter"].includes(type))) box.settings.layer = "Trigger";
      if (types.includes("hazard")) box.settings.layer = "Hazard";
    }
    if (circle) {
      circle.settings.radius = Math.max(1, Math.min(width, height) / 2);
      circle.settings.behavior = types.includes("projectile") ? "dynamic" : circle.settings.behavior;
      circle.settings.layer = types.includes("projectile") ? "Projectile" : circle.settings.layer;
    }
    const saveState = object.components.find((element) => element.type === "save-state");
    if (saveState && types.includes("player-input")) {
      saveState.settings.saveKey = "player";
      saveState.settings.persistAcrossScenes = true;
      saveState.settings.saveTransform = true;
    }
    return [name, description, object];
  };

  definitions.push(
    recipe("Platformer Player", "A player with input, rigidbody gravity, platformer acceleration, jump buffering, collision, health, and save state.", "#5c9ded", ["sprite-renderer", "player-input", "rigidbody-2d", "platformer-movement", "box-collider", "health", "damage-receiver", "camera-target", "save-state"], 48, 64),
    recipe("Dynamic Physics Body", "A runtime body affected by scene gravity and collision.", "#f0b767", ["shape-renderer", "rigidbody-2d", "box-collider"], 64, 64),
    recipe("Moving Platform", "A solid platform moving between two configurable points.", "#80cbc4", ["shape-renderer", "box-collider", "moving-platform"], 160, 32),
    recipe("One-Way Platform", "A platform that blocks bodies from above while allowing passage from below.", "#80cbc4", ["shape-renderer", "box-collider", "one-way-platform"], 160, 24),
    recipe("Door", "A reusable locked door with item requirements and collider disabling.", "#8d6e63", ["shape-renderer", "box-collider", "interaction", "door"], 48, 96),
    recipe("Switch", "An interactable switch that changes a project variable.", "#66bb6a", ["shape-renderer", "interaction", "switch"], 40, 40),
    recipe("Checkpoint", "A trigger that stores the current scene and respawn position.", "#66bb6a", ["shape-renderer", "box-collider", "checkpoint"], 48, 64),
    recipe("Hazard", "A trigger hazard that damages or respawns moving bodies.", "#ef5350", ["shape-renderer", "box-collider", "hazard"], 96, 32),
    recipe("Teleporter", "A trigger or interaction that moves objects to another target or scene spawn.", "#ab8cf2", ["shape-renderer", "box-collider", "teleporter"], 64, 64),
    recipe("Wandering Enemy", "An enemy that wanders within a radius and can receive damage.", "#ef5350", ["sprite-renderer", "box-collider", "health", "damage-receiver", "wander"], 48, 48),
    recipe("Chasing Enemy", "An enemy that detects and chases a named target.", "#ef5350", ["sprite-renderer", "box-collider", "health", "damage-receiver", "chase-target"], 48, 48),
    recipe("Projectile", "A moving damage dealer with a finite lifetime.", "#ffca5c", ["shape-renderer", "circle-collider", "damage-dealer", "projectile"], 18, 18),
    recipe("World Text", "Text rendered inside the game world.", "#90caf9", ["text-renderer"], 240, 48),
    recipe("Shape", "A rectangle, ellipse, or line rendered without an imported image.", "#78909c", ["shape-renderer"], 96, 64),
    recipe("UI Slider", "A screen-space slider bound to a numeric variable.", "#7e57c2", ["ui-slider"], 240, 32),
    recipe("UI Checkbox", "A screen-space checkbox bound to a boolean variable.", "#7e57c2", ["ui-checkbox"], 180, 32),
    recipe("Runtime Minimap", "A screen-space minimap showing objects and the active camera.", "#7e57c2", ["minimap"], 220, 140),
    recipe("Menu Screen", "A full-screen menu layer with screen-stack identity, pause behaviour, and animated entrance.", "#e51f35", ["ui-menu-screen", "ui-style", "ui-selection-indicator"], 1280, 720),
    recipe("Menu Item", "A keyboard, pointer, and gamepad navigable menu option.", "#ff7b73", ["ui-menu-item"], 420, 58),
    recipe("Action Guide", "A device-aware footer showing Select, Confirm, and Back controls.", "#e9c43a", ["ui-action-guide"], 720, 64),
    recipe("Input Glyph", "A live keyboard or gamepad input hint for a project action.", "#e9c43a", ["ui-input-glyph"], 180, 42),
    recipe("Tooltip", "A conditionally visible runtime tooltip.", "#80cbc4", ["ui-tooltip"], 360, 48),
    recipe("Scroll List", "A clipped scrollable interface container.", "#7e57c2", ["ui-scroll-list"], 420, 360),
    recipe("Confirmation Dialog", "A reusable modal yes/no confirmation dialog.", "#ffab91", ["ui-confirm-dialog"], 520, 260),
  );

  const tiledSurfaceRecipe = recipe("Tiled Solid Surface", "A resizable solid whose assigned sprite repeats instead of stretching.", "#607d8b", ["sprite-renderer", "box-collider"], 192, 32);
  const tiledRenderer = tiledSurfaceRecipe[2].components.find((element) => element.type === "sprite-renderer");
  if (tiledRenderer) tiledRenderer.settings.resizeMode = "tile";
  const tiledCollider = tiledSurfaceRecipe[2].components.find((element) => element.type === "box-collider");
  if (tiledCollider) tiledCollider.settings.behavior = "static";

  const nineSliceSurfaceRecipe = recipe("Nine-Slice Solid Surface", "A resizable solid that preserves decorative corners and edges.", "#546e7a", ["sprite-renderer", "box-collider"], 240, 72);
  const nineSliceRenderer = nineSliceSurfaceRecipe[2].components.find((element) => element.type === "sprite-renderer");
  if (nineSliceRenderer) nineSliceRenderer.settings.resizeMode = "nine-slice";

  const invisibleWallRecipe = recipe("Invisible Wall", "A collision boundary that remains fully solid while its renderer is hidden at runtime.", "#ef9a9a", ["shape-renderer", "box-collider"], 128, 32);
  invisibleWallRecipe[2].runtimeVisible = false;

  const polygonAreaRecipe = recipe("Polygon Collision Area", "A custom local-point collision boundary that rotates and scales with its object.", "#ffb74d", ["shape-renderer", "polygon-collider"], 96, 72);
  const polygonCollider = polygonAreaRecipe[2].components.find((element) => element.type === "polygon-collider");
  if (polygonCollider) polygonCollider.settings.points = "-48,-36;48,-36;36,36;-36,36";

  const fixedCameraRecipe = recipe("Fixed Room Camera", "A primary camera that stays at its placed position until Logic moves it.", "#42a5f5", ["camera"], 64, 64);
  const fixedCameraElement = fixedCameraRecipe[2].components.find((element) => element.type === "camera");
  if (fixedCameraElement) {
    fixedCameraElement.settings.primary = true;
    fixedCameraElement.settings.followTargetName = "";
    fixedCameraElement.settings.smoothing = 1;
  }

  const pressurePlateRecipe = recipe("Pressure Plate", "A trigger switch that changes a project variable when a moving object enters it.", "#66bb6a", ["shape-renderer", "box-collider", "interaction", "switch"], 64, 16);
  const pressureCollider = pressurePlateRecipe[2].components.find((element) => element.type === "box-collider");
  if (pressureCollider) {
    pressureCollider.settings.behavior = "trigger";
    pressureCollider.settings.layer = "Trigger";
  }

  definitions.push(tiledSurfaceRecipe, nineSliceSurfaceRecipe, invisibleWallRecipe, polygonAreaRecipe, fixedCameraRecipe, pressurePlateRecipe);

  const combatPlayer = recipe("Combat Player", "A player foundation with typed combat, stats, resources, abilities, progression, and debugging.", "#5c9ded", ["sprite-renderer", "player-input", "top-down-movement", "box-collider", "team", "health", "shield", "hurtbox", "damage-receiver", "knockback-receiver", "stats", "resource-pool", "ability-user", "targeting", "cast-controller", "cooldown-controller", "status-receiver", "experience", "level", "currency-wallet", "reward-receiver", "skill-unlocker", "upgrade-controller", "save-state", "debug-probe"], 48, 64);
  const combatPlayerTeam = combatPlayer[2].components.find((component) => component.type === "team");
  if (combatPlayerTeam) { combatPlayerTeam.settings.teamId = "Player"; combatPlayerTeam.settings.hostileTeams = "Enemy"; }
  const combatPlayerAbilities = combatPlayer[2].components.find((component) => component.type === "ability-user");
  if (combatPlayerAbilities) combatPlayerAbilities.settings.abilityIds = "fireball,ice-nova,chain-lightning,blink";

  const meleeEnemy = recipe("Melee Enemy", "A complete enemy that sees, chases, attacks, takes typed damage, dies, and drops loot.", "#ef5350", ["sprite-renderer", "rigidbody-2d", "box-collider", "team", "health", "hurtbox", "damage-receiver", "resistance", "knockback-receiver", "status-receiver", "blackboard", "vision-sensor", "damage-sensor", "threat-evaluator", "target-selector", "navigation-agent", "ai-controller", "state-machine", "attack", "hitbox", "attack-target", "loot-dropper", "death-behaviour", "debug-probe"], 48, 48);
  const enemyTeam = meleeEnemy[2].components.find((component) => component.type === "team");
  if (enemyTeam) { enemyTeam.settings.teamId = "Enemy"; enemyTeam.settings.hostileTeams = "Player"; }
  const enemyVision = meleeEnemy[2].components.find((component) => component.type === "vision-sensor");
  if (enemyVision) enemyVision.settings.targetTeams = "Player";
  const enemyMachine = meleeEnemy[2].components.find((component) => component.type === "state-machine");
  if (enemyMachine) { enemyMachine.settings.initialState = "Idle"; enemyMachine.settings.states = "{\"Idle\":{},\"Chase\":{},\"Attack\":{},\"Dead\":{}}"; }

  const cowardlyEnemy = recipe("Cowardly Enemy", "A complete melee enemy that flees below 25% Health and returns above 50%.", "#ff7043", meleeEnemy[2].components.map((component) => component.type), 48, 48);
  const flee = createComponentInstance("flee-target");
  flee.settings.healthThreshold = 25;
  flee.settings.recoverThreshold = 50;
  cowardlyEnemy[2].components.push(flee);

  const patrolEnemy = recipe("Patrol Combat Enemy", "Patrols, detects the Player, chases, attacks, and returns home.", "#e57373", ["sprite-renderer", "rigidbody-2d", "box-collider", "team", "health", "hurtbox", "damage-receiver", "blackboard", "vision-sensor", "navigation-agent", "ai-controller", "state-machine", "top-down-movement", "patrol", "return-home", "attack", "hitbox", "attack-target", "death-behaviour"], 48, 48);
  const rangedEnemy = recipe("Ranged Enemy", "Maintains distance and uses projectile attacks against hostile targets.", "#ab47bc", ["sprite-renderer", "rigidbody-2d", "box-collider", "team", "health", "hurtbox", "damage-receiver", "blackboard", "vision-sensor", "navigation-agent", "ai-controller", "state-machine", "keep-distance", "weapon", "attack", "attack-target", "death-behaviour"], 48, 48);
  const fireballProjectile = recipe("Fireball Projectile", "A homing-ready Fire projectile with Hitbox, status application, and impact destruction.", "#ff5722", ["shape-renderer", "circle-collider", "team", "hitbox", "damage-dealer", "projectile", "lifetime", "material-stack"], 20, 20);
  fireballProjectile[0] = "Fireball Projectile";
  const fireballHitbox = fireballProjectile[2].components.find((component) => component.type === "hitbox");
  if (fireballHitbox) { fireballHitbox.settings.damage = 20; fireballHitbox.settings.damageTypeId = "fire"; fireballHitbox.settings.targetTeams = "Enemy"; fireballHitbox.settings.destroyOnHit = true; fireballHitbox.settings.startActive = true; }
  const magicCasterEnemy = recipe("Magic Caster Enemy", "An AI enemy that keeps distance and casts editable Ability assets.", "#7e57c2", ["sprite-renderer", "rigidbody-2d", "box-collider", "team", "health", "hurtbox", "damage-receiver", "blackboard", "vision-sensor", "navigation-agent", "ai-controller", "state-machine", "keep-distance", "resource-pool", "ability-user", "targeting", "cast-controller", "cooldown-controller", "use-ability", "death-behaviour"], 48, 56);
  const experiencePickup = recipe("Experience Pickup", "A collectible progression reward that grants experience to a Reward Receiver.", "#ffee58", ["shape-renderer", "circle-collider", "interaction", "item-pickup", "lifetime"], 20, 20);
  const lootChest = recipe("Loot Chest", "An interactable chest that rolls a Loot Table once and persists its opened state.", "#ffb300", ["sprite-renderer", "box-collider", "interaction", "loot-dropper", "save-state"], 56, 44);
  const physicsRope = recipe("Physics Rope", "A chain-collider rope foundation with a fixed anchor and rope length limit.", "#8d6e63", ["shape-renderer", "rigidbody-2d", "chain-collider", "rope-joint", "physics-material"], 16, 180);

  // Stable built-in prefab ID used by the Fireball Ability asset.
  fireballProjectile[2].prefabId = null;
  definitions.push(combatPlayer, meleeEnemy, cowardlyEnemy, patrolEnemy, rangedEnemy, fireballProjectile, magicCasterEnemy, experiencePickup, lootChest, physicsRope);

  function prefabCategory(object: GameObjectDocument): string {
    const types = new Set(object.components.map((element) => element.type));
    if ([...types].some((type) => type.startsWith("ui-") || type === "minimap" || type === "screen-transition")) return "Interface";
    if (types.has("camera") || types.has("camera-zone")) return "Cameras";
    if (types.has("player-input")) return "Characters";
    if (types.has("wander") || types.has("chase-target") || types.has("damage-receiver")) return "Enemies";
    if (types.has("tilemap-renderer") || types.has("moving-platform") || types.has("one-way-platform") || types.has("box-collider") || types.has("polygon-collider")) return "World";
    if (types.has("interaction") || types.has("door") || types.has("switch") || types.has("checkpoint") || types.has("teleporter") || types.has("item-pickup")) return "Gameplay";
    if (types.has("audio-source")) return "Audio";
    if (types.has("particle-emitter")) return "Effects";
    return "Basics";
  }

  return definitions.map(([name, description, object]) => {
    object.objectType = inferGameObjectType(object);
    return ({
    id: name === "Fireball Projectile" ? "builtin-fireball-projectile" : createId("prefab"),
    name,
    description,
    builtIn: true,
    category: prefabCategory(object),
    object,
  });
  });
}

export function createEmptyProject(projectName = "Untitled Game"): ProjectDocument {
  const now = new Date().toISOString();
  const scene = createScene("Scene 1");

  return {
    version: 11,
    metadata: {
      id: createId("project"),
      name: projectName,
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      gameWidth: 1280,
      gameHeight: 720,
      pixelPerfect: true,
      defaultBackgroundColor: "#12161d",
      initialSceneId: scene.id,
      fullscreen: false,
      resizable: true,
      vsync: true,
      buildOutput: "Builds/Windows",
      companyName: "",
      versionName: "0.1.0",
      saveSlots: 3,
      autoSaveOnSceneChange: true,
      buildProfile: "development",
      scalingMode: "fit",
      executableName: projectName,
      inputActions: createDefaultInputActions(),
      collisionLayers: ["World", "Player", "Enemy", "Trigger", "Projectile", "Hazard"],
      collisionMatrix: {
        ...createDefaultCollisionMatrix(),
        Projectile: ["World", "Enemy"],
        Hazard: ["Player", "Enemy"],
      },
      audioGroups: [
        { id: "master", name: "Master", volume: 1, muted: false, parentId: null },
        { id: "music", name: "Music", volume: 0.85, muted: false, parentId: "master" },
        { id: "sfx", name: "Sound Effects", volume: 1, muted: false, parentId: "master" },
        { id: "interface", name: "Interface", volume: 1, muted: false, parentId: "master" },
        { id: "ambient", name: "Ambient", volume: 0.8, muted: false, parentId: "master" },
        { id: "voice", name: "Voice", volume: 1, muted: false, parentId: "master" },
      ],
      runtimeDebug: { showProfiler: true, showCombatLog: true, showAiDebugger: true, showScriptDebugger: true, captureFrameTimeline: false },
      scriptingEnabled: true,
      physicsBackend: "rapier-compatible",
      missingSpriteBehavior: "checker",
    },
    activeSceneId: scene.id,
    scenes: [scene],
    assets: [],
    animations: [],
    eventRules: [],
    prefabs: createBuiltInPrefabs(),
    variables: {},
    items: [],
    tilePalette: [],
    damageTypes: createDefaultDamageTypes(),
    stats: [
      { id: "maximum-health", name: "Maximum Health", baseValue: 100, minimum: 1, maximum: 1000000, regenerationPerSecond: 0, persistent: true, formula: "" },
      { id: "attack-power", name: "Attack Power", baseValue: 10, minimum: 0, maximum: 1000000, regenerationPerSecond: 0, persistent: true, formula: "" },
      { id: "movement-speed", name: "Movement Speed", baseValue: 180, minimum: 0, maximum: 10000, regenerationPerSecond: 0, persistent: true, formula: "" },
      { id: "critical-chance", name: "Critical Chance", baseValue: 0.1, minimum: 0, maximum: 1, regenerationPerSecond: 0, persistent: true, formula: "" },
    ],
    abilities: createDefaultAbilities(),
    statusEffects: createDefaultStatusEffects(),
    lootTables: createDefaultLootTables(),
    experienceCurves: createDefaultExperienceCurves(),
    upgradeTrees: createDefaultUpgradeTrees(),
    shaders: createDefaultShaders(),
    materials: createDefaultMaterials(),
    scripts: createDefaultScripts(),
    behaviourRecipes: createDefaultBehaviourRecipes(),
    customGameObjectTypes: [],
    editorThemes: createDefaultEditorThemes(),
    activeEditorThemeId: "shadowium",
    gameUiThemes: createDefaultGameUiThemes(),
    activeGameUiThemeId: "modern-dark",
    animationSets: [],
    dialogues: [],
    quests: [],
    genreKits: createDefaultGenreKits(),
    packages: [],
  };
}

/** Kept as the migration/default entry point. New projects are deliberately empty. */
export function createStarterProject(projectName = "Untitled Game"): ProjectDocument {
  return createEmptyProject(projectName);
}

export function getActiveScene(project: ProjectDocument): SceneDocument {
  return (
    project.scenes.find((scene) => scene.id === project.activeSceneId) ??
    project.scenes[0]
  );
}

export function createUniqueObjectName(
  scene: SceneDocument,
  baseName: string,
): string {
  const names = new Set(scene.objects.map((object) => object.name.toLowerCase()));

  if (!names.has(baseName.toLowerCase())) {
    return baseName;
  }

  let index = 2;
  while (names.has(`${baseName} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${baseName} ${index}`;
}

export function createUniqueSceneName(
  project: ProjectDocument,
  baseName: string,
): string {
  const names = new Set(project.scenes.map((scene) => scene.name.toLowerCase()));

  if (!names.has(baseName.toLowerCase())) {
    return baseName;
  }

  let index = 2;
  while (names.has(`${baseName} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${baseName} ${index}`;
}

export function createUniqueAnimationName(
  project: ProjectDocument,
  baseName: string,
): string {
  const names = new Set(project.animations.map((clip) => clip.name.toLowerCase()));

  if (!names.has(baseName.toLowerCase())) {
    return baseName;
  }

  let index = 2;
  while (names.has(`${baseName} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${baseName} ${index}`;
}
