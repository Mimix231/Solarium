export type Id = string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type ComponentSettingValue = JsonValue;

export type EditorTool =
  | "select"
  | "move"
  | "rotate"
  | "scale"
  | "resize"
  | "pivot"
  | "pan"
  | "collider"
  | "tile-paint"
  | "tile-erase"
  | "tile-fill"
  | "tile-picker";
export type PlayState = "stopped" | "playing" | "paused";
export type BottomTab =
  | "assets"
  | "world"
  | "events"
  | "animations"
  | "components"
  | "ui"
  | "audio"
  | "build"
  | "diagnostics"
  | "debug";

export type AssetKind = "image" | "sprite-sheet" | "tileset" | "audio" | "script" | "shader" | "material" | "ability" | "status-effect" | "loot-table" | "data";
export type AssetViewMode = "grid" | "list";

export type GameObjectType =
  | "character"
  | "enemy"
  | "environment"
  | "solid-surface"
  | "platform"
  | "interactable"
  | "trigger"
  | "projectile"
  | "camera"
  | "light"
  | "effect"
  | "audio"
  | "ui-screen"
  | "ui-control"
  | "data"
  | "custom";

export type ComponentSlot =
  | "rendering"
  | "physics"
  | "input"
  | "movement"
  | "gameplay"
  | "combat"
  | "ai"
  | "abilities"
  | "camera"
  | "audio"
  | "interface"
  | "effects"
  | "persistence"
  | "scripting"
  | "debugging";

export type ComponentCategory =
  | "rendering"
  | "world"
  | "movement"
  | "animation"
  | "physics"
  | "gameplay"
  | "interaction"
  | "combat"
  | "ai"
  | "abilities"
  | "stats"
  | "progression"
  | "scripting"
  | "camera"
  | "audio"
  | "interface"
  | "materials"
  | "effects"
  | "persistence"
  | "debugging"
  | "behaviour";

export type ComponentType =
  | "sprite-renderer"
  | "tilemap-renderer"
  | "parallax-layer"
  | "player-input"
  | "top-down-movement"
  | "directional-animation"
  | "box-collider"
  | "health"
  | "camera-target"
  | "camera"
  | "camera-zone"
  | "interaction"
  | "dialogue-speaker"
  | "item-pickup"
  | "inventory"
  | "scene-exit"
  | "scene-spawn-point"
  | "audio-source"
  | "ui-panel"
  | "ui-text"
  | "ui-image"
  | "ui-button"
  | "ui-progress-bar"
  | "particle-emitter"
  | "save-state"
  | "patrol"
  | "follow-target"
  | "shape-renderer"
  | "text-renderer"
  | "rigidbody-2d"
  | "circle-collider"
  | "polygon-collider"
  | "platformer-movement"
  | "moving-platform"
  | "one-way-platform"
  | "damage-dealer"
  | "damage-receiver"
  | "projectile"
  | "door"
  | "switch"
  | "checkpoint"
  | "hazard"
  | "teleporter"
  | "timer"
  | "lifetime"
  | "wander"
  | "chase-target"
  | "score"
  | "counter"
  | "ui-slider"
  | "ui-checkbox"
  | "ui-menu-screen"
  | "ui-menu-item"
  | "ui-selection-indicator"
  | "ui-action-guide"
  | "ui-input-glyph"
  | "ui-tooltip"
  | "ui-scroll-list"
  | "ui-confirm-dialog"
  | "ui-style"
  | "screen-transition"
  | "minimap"
  | "capsule-collider"
  | "edge-collider"
  | "chain-collider"
  | "tilemap-collider"
  | "compound-collider"
  | "physics-material"
  | "collision-filter"
  | "sensor"
  | "fixed-joint"
  | "distance-joint"
  | "spring-joint"
  | "revolute-joint"
  | "prismatic-joint"
  | "rope-joint"
  | "team"
  | "shield"
  | "hitbox"
  | "hurtbox"
  | "resistance"
  | "attack"
  | "weapon"
  | "knockback-receiver"
  | "invulnerability"
  | "death-behaviour"
  | "ai-controller"
  | "blackboard"
  | "navigation-agent"
  | "vision-sensor"
  | "hearing-sensor"
  | "proximity-sensor"
  | "damage-sensor"
  | "threat-evaluator"
  | "target-selector"
  | "state-machine"
  | "guard-area"
  | "investigate"
  | "keep-distance"
  | "circle-target"
  | "attack-target"
  | "flee-target"
  | "search-last-position"
  | "return-home"
  | "call-allies"
  | "protect-target"
  | "heal-ally"
  | "use-ability"
  | "take-cover"
  | "resource-pool"
  | "ability-user"
  | "cooldown-controller"
  | "targeting"
  | "cast-controller"
  | "status-receiver"
  | "script"
  | "material-stack"
  | "post-process-volume"
  | "stats"
  | "experience"
  | "level"
  | "currency-wallet"
  | "loot-dropper"
  | "reward-receiver"
  | "skill-unlocker"
  | "upgrade-controller"
  | "progression-state"
  | "camera-follow"
  | "camera-bounds"
  | "camera-look-ahead"
  | "camera-smoothing"
  | "camera-shake"
  | "audio-listener"
  | "point-light-2d"
  | "ambient-light-2d"
  | "light-occluder-2d"
  | "weather-zone"
  | "navigation-region"
  | "patrol-path"
  | "animation-state-machine"
  | "animation-layer"
  | "cutscene-timeline"
  | "dialogue-controller"
  | "quest-tracker"
  | "equipment"
  | "crafting"
  | "shop"
  | "save-manager"
  | "ui-theme-binding"
  | "responsive-layout"
  | "debug-probe"
  | "animated-sprite"
  | "sprite-socket-attachment"
  | "occluder"
  | "fade-when-player-behind"
  | "roof-hider"
  | "visibility-group"
  | "character-visual-controller";

export interface Vector2 {
  x: number;
  y: number;
}

export interface Transform2D {
  position: Vector2;
  rotation: number;
  scale: Vector2;
  /** Normalized local origin. 0,0 is top-left and 1,1 is bottom-right. */
  pivot: Vector2;
}

export interface ObjectSize {
  width: number;
  height: number;
}

export interface SpriteSocketDefinition {
  id: Id;
  name: string;
  x: number;
  y: number;
  rotation: number;
}

export interface SpriteFrame {
  id: Id;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  /** Optional attachment points stored in source-frame pixel coordinates. */
  sockets?: SpriteSocketDefinition[];
  /** Optional frame-local collider generated or edited in Sprite Studio. */
  collisionPolygon?: Vector2[];
}

export interface AnimationFrameReference {
  frameId: Id;
  durationMs: number;
  /** Optional root motion applied when this frame boundary is crossed. */
  rootMotionX?: number;
  rootMotionY?: number;
}

export type AnimationEventType =
  | "emit-event"
  | "play-sound"
  | "enable-component"
  | "disable-component"
  | "spawn-prefab"
  | "camera-shake"
  | "set-variable";

export interface AnimationEventDefinition {
  id: Id;
  name: string;
  frameIndex: number;
  type: AnimationEventType;
  targetId: string;
  key: string;
  value: JsonPrimitive;
}

export interface AnimationClip {
  id: Id;
  name: string;
  assetId: Id;
  loop: boolean;
  pingPong: boolean;
  framesPerSecond: number;
  frames: AnimationFrameReference[];
  category: string;
  tags: string[];
  rootMotionMode: "ignore" | "apply-position" | "extract-only";
  events: AnimationEventDefinition[];
}

export interface SpriteScalingRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerMode: "stretch" | "tile" | "solid";
  edgeMode: "stretch" | "tile";
}

export interface AssetDocument {
  id: Id;
  name: string;
  kind: AssetKind;
  relativePath: string;
  mimeType: string;
  width: number;
  height: number;
  importedAt: string;
  frames: SpriteFrame[];
  tileWidth?: number;
  tileHeight?: number;
  margin?: number;
  spacing?: number;
  tags?: string[];
  scalingRegion?: SpriteScalingRegion;
}

export interface ComponentInstance {
  id: Id;
  type: ComponentType;
  enabled: boolean;
  settings: Record<string, ComponentSettingValue>;
}

export interface GameObjectDocument {
  id: Id;
  name: string;
  /** Typed identity used to scope compatible Components and editor tools. */
  objectType: GameObjectType;
  customTypeId?: Id | null;
  parentId: Id | null;
  layerId: Id;
  /** Master runtime activation. Disabled objects do not update, render, or collide. */
  enabled: boolean;
  /** Editor-only hierarchy and viewport visibility. */
  editorVisible: boolean;
  /** Renderer visibility during Game Preview and exported builds. */
  runtimeVisible: boolean;
  /** Physics and trigger participation, independent from rendering. */
  collisionEnabled: boolean;
  /** Events and behaviour updates, independent from rendering and collision. */
  logicEnabled: boolean;
  locked: boolean;
  tags: string[];
  transform: Transform2D;
  size: ObjectSize;
  editorColor: string;
  components: ComponentInstance[];
  prefabId?: Id | null;
  prefabOverrides?: string[];
}

export interface SceneLayerDocument {
  id: Id;
  name: string;
  visible: boolean;
  locked: boolean;
  renderOrder: number;
  parallaxX: number;
  parallaxY: number;
  editorColor: string;
  runtimeIncluded: boolean;
}

export interface SceneDocument {
  id: Id;
  name: string;
  backgroundColor: string;
  width: number;
  height: number;
  gravityX: number;
  gravityY: number;
  defaultCameraId: Id | null;
  defaultSpawnId: string;
  musicAssetId: Id | null;
  resetOnEnter: boolean;
  tags: string[];
  layers: SceneLayerDocument[];
  objects: GameObjectDocument[];
}

export interface TilePaletteEntry {
  id: string;
  name: string;
  color: string;
  assetId: string;
  frameId: string;
  collision: "none" | "solid" | "trigger";
  tags: string[];
  terrainType?: string;
  terrainMask?: number | null;
}

export interface InputActionDefinition {
  id: Id;
  name: string;
  keys: string[];
}

export type EventTriggerType =
  | "preview-start"
  | "scene-started"
  | "scene-ended"
  | "object-created"
  | "object-enabled"
  | "object-disabled"
  | "trigger-enter"
  | "trigger-exit"
  | "interaction"
  | "health-zero"
  | "item-collected"
  | "button-clicked"
  | "timer-completed"
  | "variable-changed"
  | "animation-finished"
  | "audio-finished"
  | "damage-received"
  | "damage-dealt"
  | "attack-started"
  | "attack-finished"
  | "ability-cast"
  | "ability-finished"
  | "status-applied"
  | "status-removed"
  | "ai-state-entered"
  | "ai-state-exited"
  | "level-up"
  | "loot-dropped"
  | "script-event";

export interface EventTriggerDefinition {
  type: EventTriggerType;
  sourceObjectId: Id | null;
  targetObjectId: Id | null;
}

export type EventConditionType =
  | "always"
  | "variable-equals"
  | "variable-compare"
  | "object-enabled"
  | "object-has-component"
  | "object-has-element"
  | "object-has-tag"
  | "inventory-contains"
  | "scene-is-active"
  | "random-chance";

export interface EventConditionDefinition {
  id: Id;
  type: EventConditionType;
  objectId: Id | null;
  key: string;
  value: JsonPrimitive;
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  componentType: ComponentType | null;
}

export type EventActionType =
  | "set-object-enabled"
  | "set-runtime-visible"
  | "set-collision-enabled"
  | "set-logic-enabled"
  | "set-component-property"
  | "set-element-property"
  | "set-health"
  | "change-health"
  | "destroy-object"
  | "move-object"
  | "set-object-position"
  | "set-variable"
  | "play-animation"
  | "stop-animation"
  | "change-scene"
  | "wait"
  | "play-sound"
  | "stop-sound"
  | "set-camera-zoom"
  | "set-camera-fov"
  | "shake-camera"
  | "show-ui"
  | "hide-ui"
  | "set-text"
  | "give-item"
  | "remove-item"
  | "save-game"
  | "load-game"
  | "deal-damage"
  | "heal"
  | "apply-status"
  | "remove-status"
  | "cast-ability"
  | "set-ai-state"
  | "award-experience"
  | "add-currency"
  | "roll-loot-table"
  | "spawn-prefab"
  | "emit-script-event"
  | "debug-message";

export interface EventActionDefinition {
  id: Id;
  type: EventActionType;
  objectId: Id | null;
  sceneId: Id | null;
  clipId: Id | null;
  componentType: ComponentType | null;
  propertyKey: string;
  key: string;
  value: JsonPrimitive;
  x: number;
  y: number;
  durationMs?: number;
  message: string;
}

export interface EventRuleDocument {
  id: Id;
  name: string;
  enabled: boolean;
  scope?: "object" | "scene" | "project";
  group?: string;
  trigger: EventTriggerDefinition;
  conditions: EventConditionDefinition[];
  actions: EventActionDefinition[];
}

export interface PrefabDocument {
  id: Id;
  parentPrefabId?: Id | null;
  variantOf?: Id | null;
  name: string;
  description: string;
  builtIn: boolean;
  category?: string;
  object: GameObjectDocument;
  /** Nested child hierarchy captured with this Prefab. Legacy Prefabs omit it. */
  children?: GameObjectDocument[];
}

export interface ItemDefinition {
  id: Id;
  name: string;
  description: string;
  iconAssetId: Id | null;
  maximumStack: number;
  tags: string[];
}

export interface AudioGroupDefinition {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  parentId: string | null;
}


export type DamageTypeId = string;

export interface DamageTypeDefinition {
  id: DamageTypeId;
  name: string;
  color: string;
  healing: boolean;
  tags: string[];
}

export interface StatModifierDefinition {
  id: Id;
  source: string;
  statId: string;
  mode: "flat" | "additive-percent" | "multiplicative";
  value: number;
  durationSeconds: number | null;
  stacking: "stack" | "replace" | "highest";
}

export interface StatDefinition {
  id: Id;
  name: string;
  baseValue: number;
  minimum: number;
  maximum: number;
  regenerationPerSecond: number;
  persistent: boolean;
  formula: string;
}

export type AbilityTargetingMode = "self" | "direction" | "point" | "object" | "area" | "cone" | "line" | "chain" | "nearest" | "all-in-range";
export type AbilityEffectType = "damage" | "heal" | "apply-status" | "remove-status" | "spawn-prefab" | "teleport" | "knockback" | "pull" | "dash" | "summon" | "modify-stat" | "set-variable" | "screen-effect";

export interface AbilityEffectDefinition {
  id: Id;
  type: AbilityEffectType;
  amount: number;
  damageTypeId: string;
  statusEffectId: string;
  prefabId: string;
  statId: string;
  durationSeconds: number;
  radius: number;
  value: JsonPrimitive;
}

export interface AbilityDefinition {
  id: Id;
  name: string;
  description: string;
  iconAssetId: Id | null;
  activationActionId: string;
  castTimeSeconds: number;
  channelTimeSeconds: number;
  cooldownSeconds: number;
  resourceId: string;
  resourceCost: number;
  targetingMode: AbilityTargetingMode;
  range: number;
  maximumTargets: number;
  effects: AbilityEffectDefinition[];
  tags: string[];
}

export interface StatusEffectDefinition {
  id: Id;
  name: string;
  description: string;
  durationSeconds: number;
  tickIntervalSeconds: number;
  maximumStacks: number;
  stacking: "refresh" | "stack-duration" | "stack-intensity" | "ignore";
  damagePerTick: number;
  damageTypeId: string;
  speedMultiplier: number;
  damageMultiplier: number;
  materialId: string;
  tags: string[];
}

export interface LootEntryDefinition {
  id: Id;
  kind: "item" | "currency" | "experience" | "prefab" | "loot-table";
  referenceId: string;
  weight: number;
  minimumAmount: number;
  maximumAmount: number;
  guaranteed: boolean;
  unique: boolean;
  conditionVariable: string;
  conditionValue: JsonPrimitive;
}

export interface LootTableDefinition {
  id: Id;
  name: string;
  rolls: number;
  entries: LootEntryDefinition[];
  pityCounterKey: string;
  pityThreshold: number;
}

export interface ExperienceCurveDefinition {
  id: Id;
  name: string;
  maximumLevel: number;
  baseExperience: number;
  growthFactor: number;
  formula: "linear" | "quadratic" | "exponential";
}

export interface UpgradeNodeDefinition {
  id: Id;
  name: string;
  description: string;
  cost: number;
  currencyId: string;
  prerequisites: string[];
  mutuallyExclusiveWith: string[];
  unlockAbilityId: string;
  statModifiers: StatModifierDefinition[];
  position: Vector2;
}

export interface UpgradeTreeDefinition {
  id: Id;
  name: string;
  nodes: UpgradeNodeDefinition[];
}

export interface ShaderDefinition {
  id: Id;
  name: string;
  vertexSource: string;
  fragmentSource: string;
  target: "sprite" | "tilemap" | "particle" | "ui" | "fullscreen";
  uniforms: Record<string, JsonValue>;
  builtIn: boolean;
}

export interface MaterialDefinition {
  id: Id;
  name: string;
  shaderId: Id;
  blendMode: string;
  uniforms: Record<string, JsonValue>;
  enabled: boolean;
}

export interface ScriptDefinition {
  id: Id;
  name: string;
  source: string;
  executionOrder: number;
  enabled: boolean;
  exposedProperties: Record<string, JsonPrimitive>;
}

export interface BehaviourRecipeDefinition {
  id: Id;
  name: string;
  description: string;
  category: string;
  requiredComponents: ComponentType[];
  componentSettings: Partial<Record<ComponentType, Record<string, ComponentSettingValue>>>;
  stateMachineJson: string;
  eventRuleIds: string[];
  tutorialSteps: string[];
  builtIn: boolean;
}

export interface RuntimeDebugSettings {
  showProfiler: boolean;
  showCombatLog: boolean;
  showAiDebugger: boolean;
  showScriptDebugger: boolean;
  captureFrameTimeline: boolean;
}

export interface CustomGameObjectTypeDefinition {
  id: Id;
  name: string;
  description: string;
  slots: ComponentSlot[];
  recommended: ComponentType[];
  required: ComponentType[];
  hiddenCategories: ComponentCategory[];
}

export interface EditorThemeDefinition {
  id: Id; name: string; mode: "dark" | "light"; accent: string; secondaryAccent: string; background: string; surface: string; raisedSurface: string; text: string; mutedText: string; radius: number; blur: number; shadow: number; density: "comfortable" | "compact" | "touch"; motionScale: number; builtIn: boolean;
}

export interface GameUiThemeDefinition {
  id: Id; name: string; fontFamily: string; textColor: string; accentColor: string; panelColor: string; buttonColor: string; selectedColor: string; selectedBackground: string; cornerRadius: number; spacing: number; transition: string; navigationSoundAssetId: Id; confirmSoundAssetId: Id; builtIn: boolean;
}

export interface AnimationSetDefinition {
  id: Id;
  name: string;
  assetId: Id;
  /** Legacy/default directional mapping. */
  directions: Record<string, Id>;
  /** Named movement/combat states, each with directional clip mappings. */
  states?: Record<string, Record<string, Id>>;
  defaultState?: string;
  builtIn: boolean;
}

export interface DialogueNodeDefinition { id: Id; speaker: string; text: string; nextId: Id | null; choices: { id: Id; label: string; nextId: Id | null; conditionKey: string }[]; }
export interface DialogueGraphDefinition { id: Id; name: string; nodes: DialogueNodeDefinition[]; startNodeId: Id | null; }
export interface QuestObjectiveDefinition { id: Id; kind: "reach" | "defeat" | "collect" | "speak" | "interact" | "survive" | "event"; targetId: string; amount: number; optional: boolean; }
export interface QuestDefinition { id: Id; name: string; description: string; objectives: QuestObjectiveDefinition[]; rewardTableId: string; followUpQuestIds: Id[]; }
export interface GenreKitDefinition { id: Id; name: string; description: string; recipeIds: Id[]; inputActionIds: Id[]; uiThemeId: Id; builtIn: boolean; }
export interface PackageManifestDefinition { id: Id; name: string; version: string; description: string; enabled: boolean; dependencies: string[]; componentTypes: ComponentType[]; recipeIds: Id[]; themeIds: Id[]; }

export interface ProjectMetadata {
  id: Id;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  gameWidth: number;
  gameHeight: number;
  pixelPerfect: boolean;
  defaultBackgroundColor: string;
  initialSceneId: Id;
  fullscreen: boolean;
  resizable: boolean;
  vsync: boolean;
  buildOutput: string;
  companyName: string;
  versionName: string;
  saveSlots: number;
  autoSaveOnSceneChange: boolean;
  buildProfile: "development" | "release" | "distribution";
  scalingMode: "fit" | "integer" | "stretch";
  executableName: string;
  inputActions: InputActionDefinition[];
  collisionLayers: string[];
  collisionMatrix: Record<string, string[]>;
  audioGroups: AudioGroupDefinition[];
  runtimeDebug: RuntimeDebugSettings;
  scriptingEnabled: boolean;
  physicsBackend: "shadowium" | "rapier-compatible";
  missingSpriteBehavior: "checker" | "hide" | "stop-play";
}

export interface ProjectDocument {
  version: 11;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
  activeSceneId: Id;
  scenes: SceneDocument[];
  assets: AssetDocument[];
  animations: AnimationClip[];
  eventRules: EventRuleDocument[];
  prefabs: PrefabDocument[];
  variables: Record<string, JsonPrimitive>;
  items: ItemDefinition[];
  tilePalette: TilePaletteEntry[];
  damageTypes: DamageTypeDefinition[];
  stats: StatDefinition[];
  abilities: AbilityDefinition[];
  statusEffects: StatusEffectDefinition[];
  lootTables: LootTableDefinition[];
  experienceCurves: ExperienceCurveDefinition[];
  upgradeTrees: UpgradeTreeDefinition[];
  shaders: ShaderDefinition[];
  materials: MaterialDefinition[];
  scripts: ScriptDefinition[];
  behaviourRecipes: BehaviourRecipeDefinition[];
  customGameObjectTypes: CustomGameObjectTypeDefinition[];
  editorThemes: EditorThemeDefinition[];
  activeEditorThemeId: Id;
  gameUiThemes: GameUiThemeDefinition[];
  activeGameUiThemeId: Id;
  animationSets: AnimationSetDefinition[];
  dialogues: DialogueGraphDefinition[];
  quests: QuestDefinition[];
  genreKits: GenreKitDefinition[];
  packages: PackageManifestDefinition[];
}

export interface SelectOption {
  label: string;
  value: string | number;
}

export type ComponentControlType =
  | "number"
  | "text"
  | "boolean"
  | "select"
  | "asset"
  | "animation"
  | "animation-set"
  | "object"
  | "input-action"
  | "collision-layer"
  | "color";

export interface ComponentSettingDefinition {
  key: string;
  label: string;
  description?: string;
  control: ComponentControlType;
  defaultValue: ComponentSettingValue;
  minimum?: number;
  maximum?: number;
  step?: number;
  options?: SelectOption[];
  suffix?: string;
}

export type ComponentImplementationStatus = "ready" | "experimental" | "editor-only" | "runtime-pending" | "deprecated";

export interface ComponentDefinition {
  type: ComponentType;
  name: string;
  description: string;
  category: ComponentCategory;
  color: string;
  dependencies: ComponentType[];
  /** Phase 10 typed authoring metadata. Omitted means unrestricted/custom. */
  supportedObjectTypes?: GameObjectType[];
  slot?: ComponentSlot;
  incompatibleWith?: ComponentType[];
  allowMultiple?: boolean;
  version?: number;
  implementationStatus?: ComponentImplementationStatus;
  documentation?: string;
  settings: ComponentSettingDefinition[];
}

export interface ActivityEntry {
  id: Id;
  time: string;
  level: "info" | "warning" | "error" | "runtime";
  message: string;
}

export interface PanelSizes {
  left: number;
  right: number;
  bottom: number;
}

export interface ImportedAssetFile {
  sourcePath: string;
  relativePath: string;
  fileName: string;
  mimeType: string;
}

export interface ProjectLocation {
  projectPath: string;
  rootPath: string;
}

export interface DiagnosticEntry {
  id: Id;
  severity: "error" | "warning" | "info";
  message: string;
  sceneId: Id | null;
  objectId: Id | null;
  componentId: Id | null;
}
