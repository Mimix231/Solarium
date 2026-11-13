import type { ComponentDefinition, ComponentSettingDefinition, ComponentType, GameObjectType } from "./types";

const number = (key: string, label: string, defaultValue: number, minimum?: number, maximum?: number, step = 0.05): ComponentSettingDefinition => ({ key, label, control: "number", defaultValue, minimum, maximum, step });
const text = (key: string, label: string, defaultValue = ""): ComponentSettingDefinition => ({ key, label, control: "text", defaultValue });
const object = (key: string, label: string, defaultValue = ""): ComponentSettingDefinition => ({ key, label, control: "object", defaultValue });
const animation = (key: string, label: string, defaultValue = ""): ComponentSettingDefinition => ({ key, label, control: "animation", defaultValue });
const animationSet = (key: string, label: string, defaultValue = ""): ComponentSettingDefinition => ({ key, label, control: "animation-set", defaultValue });
const bool = (key: string, label: string, defaultValue = false): ComponentSettingDefinition => ({ key, label, control: "boolean", defaultValue });
const select = (key: string, label: string, defaultValue: string, values: string[]): ComponentSettingDefinition => ({ key, label, control: "select", defaultValue, options: values.map((value) => ({ label: value.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase()), value })) });

function component(type: ComponentType, name: string, description: string, category: ComponentDefinition["category"], color: string, supportedObjectTypes: GameObjectType[], settings: ComponentSettingDefinition[], dependencies: ComponentType[] = [], incompatibleWith: ComponentType[] = []): ComponentDefinition {
  return { type, name, description, category, color, dependencies, incompatibleWith, supportedObjectTypes, settings };
}

export const PHASE10_COMPONENTS: ComponentDefinition[] = [
  component("camera-follow", "Camera Follow", "Tracks a Game Object with centred, smoothed, dead-zone, platformer, aim, or multi-target behaviour.", "camera", "#6c8cff", ["camera"], [
    object("targetObjectId", "Follow Target", ""), text("targetName", "Target Name Fallback", "Player"),
    select("mode", "Follow Mode", "centered", ["centered", "smooth", "dead-zone", "platformer", "aim", "multi-target"]),
    bool("followX", "Follow X", true), bool("followY", "Follow Y", true),
    number("offsetX", "Offset X", 0, -10000, 10000, 1), number("offsetY", "Offset Y", 0, -10000, 10000, 1),
    number("maximumSpeed", "Maximum Follow Speed", 0, 0, 100000, 1),
    text("additionalTargets", "Additional Target IDs", ""), number("multiTargetPadding", "Multi-Target Padding", 96, 0, 2048, 1),
  ], ["camera"]),
  component("camera-smoothing", "Camera Smoothing", "Frame-rate-independent camera damping with separate horizontal and vertical response.", "camera", "#708bff", ["camera"], [
    number("horizontal", "Horizontal Smoothing", 0.12, 0, 1, 0.01), number("vertical", "Vertical Smoothing", 0.12, 0, 1, 0.01),
    number("returnSpeed", "Return Speed", 0.1, 0, 1, 0.01), bool("snapOnStart", "Snap On Start", true),
  ], ["camera"]),
  component("camera-look-ahead", "Camera Look Ahead", "Offsets camera framing using movement or aim direction.", "camera", "#5fa8ff", ["camera"], [
    select("source", "Source", "movement", ["movement", "aim", "facing"]), number("horizontal", "Horizontal Distance", 120, 0, 4096, 1),
    number("vertical", "Vertical Distance", 48, 0, 4096, 1), number("influence", "Aim Influence", 0.35, 0, 1, 0.01), number("response", "Response", 0.14, 0, 1, 0.01),
  ], ["camera"]),
  component("camera-bounds", "Camera Bounds", "Clamps camera output to a rectangular world region while respecting zoom and FOV.", "camera", "#55b7ff", ["camera"], [
    bool("enabled", "Clamp To Bounds", true), number("left", "Left", -640, -1000000, 1000000, 1), number("top", "Top", -360, -1000000, 1000000, 1),
    number("right", "Right", 640, -1000000, 1000000, 1), number("bottom", "Bottom", 360, -1000000, 1000000, 1), bool("respectZoom", "Respect Zoom", true),
  ], ["camera"]),
  component("camera-shake", "Camera Shake", "Blends impact, explosion, and environmental shake without changing the follow target.", "camera", "#72c6ff", ["camera"], [
    number("amplitudeX", "Horizontal Amplitude", 8, 0, 1000, 0.5), number("amplitudeY", "Vertical Amplitude", 8, 0, 1000, 0.5),
    number("rotation", "Rotation Amount", 0, 0, 45, 0.1), number("zoom", "Zoom Amount", 0, 0, 2, 0.01), number("frequency", "Frequency", 18, 0.1, 120, 0.1),
  ], ["camera"]),
  component("audio-listener", "Audio Listener", "Marks the camera or actor used for spatial audio attenuation.", "audio", "#42c7b7", ["camera", "character"], [bool("primary", "Primary Listener", true)]),
  component("point-light-2d", "Point Light 2D", "A radial 2D light with colour, intensity, radius, falloff, and optional shadows.", "effects", "#ffd166", ["light", "environment"], [
    { key: "color", label: "Colour", control: "color", defaultValue: "#fff0c2" }, number("intensity", "Intensity", 1, 0, 20), number("radius", "Radius", 260, 1, 10000, 1), number("falloff", "Falloff", 1.5, 0.1, 8), bool("shadows", "Cast Shadows", false),
  ]),
  component("ambient-light-2d", "Ambient Light 2D", "Global scene illumination used as a baseline for 2D lighting.", "effects", "#ffe082", ["light", "data"], [
    { key: "color", label: "Colour", control: "color", defaultValue: "#ffffff" }, number("intensity", "Intensity", 0.45, 0, 4),
  ]),
  component("light-occluder-2d", "Light Occluder 2D", "Defines geometry that blocks shadow-casting 2D lights.", "effects", "#b0bec5", ["environment", "solid-surface", "platform"], [bool("useColliderShape", "Use Collider Shape", true), number("opacity", "Shadow Opacity", 1, 0, 1)]),
  component("weather-zone", "Weather Zone", "Applies rain, snow, fog, wind, tint, and ambient audio inside a region.", "effects", "#90caf9", ["environment", "trigger"], [
    select("weather", "Weather", "rain", ["rain", "snow", "fog", "wind", "storm", "clear"]), number("intensity", "Intensity", 0.7, 0, 1), number("windX", "Wind X", 0, -1000, 1000, 1), number("windY", "Wind Y", 0, -1000, 1000, 1), text("audioAssetId", "Ambient Audio", ""),
  ]),
  component("navigation-region", "Navigation Region", "Marks a traversable region for AI pathfinding and navigation debugging.", "world", "#6bd69b", ["environment", "trigger", "data"], [
    text("layer", "Navigation Layer", "ground"), number("cost", "Travel Cost", 1, 0.01, 100), bool("walkable", "Walkable", true),
  ]),
  component("patrol-path", "Patrol Path", "Stores ordered waypoints that AI Patrol Components can follow.", "ai", "#8bd17c", ["environment", "data", "enemy"], [
    text("points", "Waypoints JSON", "[]"), bool("relativeToStart", "Points Relative To Start", true), number("speed", "Movement Speed", 90, 0, 5000, 1), number("waitTime", "Wait At Point", 0, 0, 60, 0.05), select("mode", "Traversal", "loop", ["loop", "ping-pong", "once"]),
  ]),
  component("animation-state-machine", "Animation State Machine", "Chooses animation clips or directional Animation Sets from typed parameters and transitions.", "animation", "#b388ff", ["character", "enemy", "environment", "effect", "ui-control"], [text("initialState", "Initial State", "Idle"), text("states", "States JSON", "{\"Idle\":{},\"Walk\":{}}"), text("transitions", "Transitions JSON", "[]"), bool("debug", "Debug State", false)]),
  component("animation-layer", "Animation Layer", "Stacks base, upper-body, additive, or equipment animation tracks.", "animation", "#9575cd", ["character", "enemy"], [text("layerName", "Layer Name", "Base"), number("weight", "Weight", 1, 0, 1), select("mode", "Blend Mode", "override", ["override", "additive"]), text("mask", "Property Mask", "all")]),
  component("cutscene-timeline", "Cutscene Timeline", "Coordinates camera, transform, animation, dialogue, audio, UI, shader, event, and time-scale tracks.", "gameplay", "#ff8a80", ["data", "environment", "trigger"], [text("timelineId", "Timeline ID", ""), bool("skippable", "Skippable", true), number("duration", "Duration", 5, 0), bool("playOnStart", "Play On Start", false)]),
  component("dialogue-controller", "Dialogue Controller", "Runs a branching Dialogue Graph and exposes speaker, choice, history, and localization state.", "gameplay", "#ffb74d", ["interactable", "character", "ui-screen", "data"], [text("dialogueId", "Dialogue Graph", ""), bool("startOnInteract", "Start On Interact", true), bool("typewriter", "Typewriter", true), number("charactersPerSecond", "Characters / Second", 40, 1, 500, 1)]),
  component("quest-tracker", "Quest Tracker", "Tracks active objectives, completion, rewards, and follow-up quests.", "progression", "#ffee58", ["character", "data", "ui-control"], [text("startingQuestIds", "Starting Quests", ""), bool("persist", "Persist", true), bool("showObjectiveEvents", "Emit Objective Events", true)]),
  component("equipment", "Equipment", "Adds named equipment slots and applies item-driven stat or ability modifiers.", "gameplay", "#80cbc4", ["character", "enemy"], [text("slots", "Slots", "weapon,armor,accessory"), bool("allowSwap", "Allow Swap", true), bool("applyStats", "Apply Item Stats", true)]),
  component("crafting", "Crafting", "Consumes inventory ingredients and creates items from recipe data.", "gameplay", "#81c784", ["character", "interactable", "data"], [text("recipeTableId", "Recipe Table", ""), bool("requireStation", "Require Station", false), text("stationTag", "Station Tag", "crafting")]),
  component("shop", "Shop", "Buys and sells items using project currencies and inventory rules.", "gameplay", "#ffd54f", ["interactable", "data", "ui-screen"], [text("stock", "Stock IDs", ""), text("currencyId", "Currency", "coins"), number("buyMultiplier", "Buy Multiplier", 1, 0), number("sellMultiplier", "Sell Multiplier", 0.5, 0)]),
  component("save-manager", "Save Manager", "Coordinates slots, autosave metadata, screenshots, checkpoints, and runtime save requests.", "persistence", "#90a4ae", ["data", "ui-screen"], [bool("autosave", "Autosave", true), number("slotCount", "Slots", 3, 1, 99, 1), bool("captureThumbnail", "Capture Thumbnail", true), bool("trackPlaytime", "Track Playtime", true)]),
  component("ui-theme-binding", "UI Theme Binding", "Links a UI hierarchy to a Game UI Theme while allowing local overrides.", "interface", "#ce93d8", ["ui-screen", "ui-control"], [text("themeId", "Theme ID", "modern-dark"), bool("inherit", "Inherit From Parent", true), text("overrideTokens", "Overrides JSON", "{}")]),
  component("responsive-layout", "Responsive Layout", "Applies anchors, safe-area rules, aspect constraints, min/max size, and layout flow.", "interface", "#80deea", ["ui-screen", "ui-control"], [select("layout", "Layout", "free", ["free", "horizontal", "vertical", "grid", "wrap"]), text("anchor", "Anchor", "centre"), number("padding", "Padding", 12, 0), number("gap", "Gap", 8, 0), number("minWidth", "Minimum Width", 0, 0), number("maxWidth", "Maximum Width", 100000, 0)]),
  component("animated-sprite", "Animated Sprite", "Owns the default animation clip or Animation Set for a rendered Game Object and drives runtime playback.", "animation", "#c59aff", ["character", "enemy", "environment", "projectile", "effect", "ui-control"], [
    animation("defaultClipId", "Default Clip", ""), animationSet("animationSetId", "Animation Set", ""), text("defaultState", "Default State", "idle"),
    bool("autoPlay", "Auto Play", true), number("playbackSpeed", "Playback Speed", 1, 0, 8, 0.05), bool("useDirectionalMovement", "Use Movement Direction", true),
  ], ["sprite-renderer"]),
  component("sprite-socket-attachment", "Sprite Socket Attachment", "Attaches this child Game Object to a named socket on the parent's currently displayed sprite frame.", "animation", "#a98bff", ["character", "enemy", "environment", "projectile", "effect", "custom"], [
    text("socketName", "Socket Name", "Hand"), number("offsetX", "Offset X", 0, -4096, 4096, 1), number("offsetY", "Offset Y", 0, -4096, 4096, 1), number("rotationOffset", "Rotation Offset", 0, -360, 360, 1), bool("inheritRotation", "Inherit Rotation", true),
  ]),
  component("occluder", "Occluder", "Marks a world object as top-down occluding geometry for visibility helpers.", "rendering", "#78909c", ["environment", "solid-surface", "platform"], [bool("enabled", "Occludes Characters", true)]),
  component("fade-when-player-behind", "Fade When Player Behind", "Fades this renderer when a tracked character passes behind it in top-down scenes.", "rendering", "#80cbc4", ["environment", "solid-surface"], [
    object("targetObjectId", "Tracked Character", ""), number("fadedOpacity", "Faded Opacity", 0.35, 0, 1, 0.05), number("fadeSpeed", "Fade Speed", 8, 0.1, 40, 0.1), number("horizontalPadding", "Horizontal Padding", 8, 0, 512, 1),
  ]),
  component("roof-hider", "Roof Hider", "Hides or fades a roof when the tracked character enters its reveal region.", "rendering", "#90a4ae", ["environment", "solid-surface"], [
    object("targetObjectId", "Tracked Character", ""), number("hiddenOpacity", "Hidden Opacity", 0.1, 0, 1, 0.05), bool("useOwnBounds", "Use Own Bounds", true),
  ]),
  component("visibility-group", "Visibility Group", "Groups renderers behind a shared runtime visibility key.", "rendering", "#b0bec5", ["environment", "character", "enemy", "effect", "ui-control"], [text("group", "Group", "Default"), text("variable", "Visibility Variable", "")]),
  component("character-visual-controller", "Character Visual Controller", "Connects movement, health, combat state and an Animation Set without requiring manual animation-state wiring.", "animation", "#ba8cff", ["character", "enemy"], [
    animationSet("animationSetId", "Animation Set", ""), text("idleState", "Idle State", "idle"), text("moveState", "Move State", "walk"), text("runState", "Run State", "run"),
    text("hurtState", "Hurt State", "hurt"), text("deadState", "Dead State", "dead"), number("runSpeedThreshold", "Run Speed Threshold", 260, 0, 10000, 1),
  ], ["sprite-renderer"]),

];
