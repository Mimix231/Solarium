import { useEffect, useRef, useState } from "react";
import {
  Application,
  Assets,
  Container,
  Graphics,
  NineSliceSprite,
  Rectangle,
  Sprite,
  Text,
  Texture,
  TilingSprite,
} from "pixi.js";
import {
  Crosshair,
  Grid3X3,
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getAssetDataUrl } from "../editor/assets";
import { cameraWorldView, cameraZoomForFov, clampCameraCenter, clampCameraFov } from "../editor/cameraMath";
import { cloneObject, getActiveScene } from "../editor/project";
import { objectsIntersectingArea, hitTestSceneObjects } from "../editor/selection";
import { colliderShapeFor, objectWorldAabb, objectWorldGeometry, shapesIntersect } from "../editor/spatial";
import { isRuntimeControllerOnly, RUNTIME_SNAPSHOT_EVENT, RUNTIME_STEP_EVENT } from "../editor/runtimePreview";
import { advanceAnimation, clipForAnimationSet } from "../editor/animationRuntime";
import { getRuntimeSession, isRuntimeSessionCurrent } from "../editor/runtimeSession";
import {
  applyOrStackStatus,
  buildRuntimeStats,
  calculateDamage,
  chooseAiDecision,
  componentOf,
  experienceRequired,
  parseList,
  parseNumberMap,
  rollLootTable,
  selectAbilityTargets,
  statusSpeedMultiplier,
  teamId,
  teamsAreHostile,
  updateStatuses,
} from "../editor/runtimeSystems";
import type { RuntimeAbilityCast, RuntimeAiDecision, RuntimeStatusInstance } from "../editor/runtimeSystems";
import { compileLeonisScript, runLeonisScript } from "../editor/leonisScript";
import type { CompiledLeonisScript, LeonisScriptCallback } from "../editor/leonisScript";
import { useEditorStore } from "../editor/store";
import { AssetThumbnail } from "./AssetBrowser";
import type {
  AnimationClip,
  AssetDocument,
  EventRuleDocument,
  GameObjectDocument,
  JsonPrimitive,
  PlayState,
  ProjectDocument,
  SpriteFrame,
  Vector2,
  ComponentInstance,
} from "../editor/types";
import type {
  RuntimeAiTraceEntry,
  RuntimeCombatLogEntry,
  RuntimeLogLevel,
  RuntimePreviewLogEntry,
  RuntimePreviewObjectSnapshot,
  RuntimePreviewSnapshot,
  RuntimeProfilerSnapshot,
  RuntimeScriptErrorEntry,
} from "../editor/runtimePreview";

interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

type PointerMode =
  | "none"
  | "pan"
  | "object"
  | "object-rotate"
  | "object-scale"
  | "object-resize"
  | "object-pivot"
  | "collider-move"
  | "collider-resize"
  | "tile-paint"
  | "marquee";

interface PointerInteraction {
  mode: PointerMode;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startCameraX: number;
  startCameraY: number;
  objectId: string | null;
  componentId: string | null;
  startObjectX: number;
  startObjectY: number;
  startColliderWidth: number;
  startColliderHeight: number;
  startColliderOffsetX: number;
  startColliderOffsetY: number;
  startWorldX: number;
  startWorldY: number;
  startSelectionPositions: Record<string, Vector2>;
  handle: string;
  startObjectWidth: number;
  startObjectHeight: number;
  startScaleX: number;
  startScaleY: number;
  startRotation: number;
  startPivotX: number;
  startPivotY: number;
  startAngle: number;
  lastTileKey: string;
}

interface RuntimeObjectState {
  object: GameObjectDocument;
  sourceSceneId: string;
  x: number;
  y: number;
  enabled: boolean;
  destroyed: boolean;
  lastDirection:
    | "down"
    | "up"
    | "left"
    | "right"
    | "up-left"
    | "up-right"
    | "down-left"
    | "down-right";
  forcedClipId: string | null;
  activeClipId: string | null;
  animationFrame: number;
  animationDirection: 1 | -1;
  animationElapsed: number;
  animationMachineState: string;
  health: number | null;
  maximumHealth: number | null;
  shield: number;
  maximumShield: number;
  shieldRegenerationDelay: number;
  healthZeroFired: boolean;
  deathHandled: boolean;
  deathTimer: number;
  velocityX: number;
  velocityY: number;
  originX: number;
  originY: number;
  age: number;
  behaviorElapsed: number;
  behaviorDirectionX: number;
  behaviorDirectionY: number;
  movingForward: boolean;
  waitRemaining: number;
  grounded: boolean;
  coyoteRemaining: number;
  jumpBufferRemaining: number;
  hitCooldowns: Record<string, number>;
  invulnerableUntil: number;
  hitFlashRemaining: number;
  timerCompleted: boolean;
  patrolCompleted: boolean;
  patrolPathIndex: number;
  patrolPathDirection: 1 | -1;
  teamId: string;
  statuses: RuntimeStatusInstance[];
  resources: Record<string, number>;
  resourceMaximums: Record<string, number>;
  resourceRegenerationDelay: Record<string, number>;
  cooldowns: Record<string, number>;
  activeCast: RuntimeAbilityCast | null;
  stats: Record<string, number>;
  aiState: string;
  aiPreviousState: string;
  aiTargetId: string | null;
  blackboard: Record<string, JsonPrimitive>;
  aiDecisionElapsed: number;
  attackCooldownRemaining: number;
  experience: number;
  level: number;
  currencies: Record<string, number>;
  unlockedSkills: string[];
  purchasedUpgrades: string[];
  scriptsStarted: Set<string>;
}

type RuntimeSprite = Sprite | TilingSprite | NineSliceSprite;

interface ObjectVisual {
  group: Container;
  sprite: RuntimeSprite | null;
  label: Text;
}

interface RuntimeDialogueState {
  speaker: string;
  lines: string[];
  index: number;
  textColor: string;
  graphId?: string | null;
  nodeId?: string | null;
  choices?: Array<{ id: string; label: string; nextId: string | null }>;
}

interface RuntimeSavedObjectState {
  enabled: boolean;
  destroyed: boolean;
  x?: number;
  y?: number;
  health?: number | null;
  sourceSceneId?: string;
  object?: GameObjectDocument;
}

interface RuntimeSaveDocument {
  version: 1;
  variables: Record<string, JsonPrimitive>;
  inventory: Record<string, number>;
  objects: Record<string, RuntimeSavedObjectState>;
  sceneId: string | null;
}

interface SelectionMarquee {
  startScreenX: number;
  startScreenY: number;
  endScreenX: number;
  endScreenY: number;
  additive: boolean;
}

interface OverlapMenuState {
  x: number;
  y: number;
  names: string[];
  selectedIndex: number;
}

interface Aabb {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5;
const GRID_EXTENT = 10000;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function hexToNumber(color: string): number {
  const parsed = Number.parseInt(color.replace("#", ""), 16);
  return Number.isFinite(parsed) ? parsed : 0x78909c;
}

function shouldIgnoreKeyboardTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element &&
      (element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.tagName === "SELECT" ||
        element.isContentEditable),
  );
}

function objectBounds(object: GameObjectDocument, x = object.transform.position.x, y = object.transform.position.y): Aabb {
  return objectWorldAabb(object, x, y);
}

function transformHandleAt(object: GameObjectDocument, point: Vector2, zoom: number): string {
  const bounds = objectBounds(object);
  const tolerance = 9 / Math.max(0.1, zoom);
  const points: Array<[string, number, number]> = [
    ["nw", bounds.left, bounds.top], ["n", (bounds.left + bounds.right) / 2, bounds.top], ["ne", bounds.right, bounds.top],
    ["e", bounds.right, (bounds.top + bounds.bottom) / 2], ["se", bounds.right, bounds.bottom], ["s", (bounds.left + bounds.right) / 2, bounds.bottom],
    ["sw", bounds.left, bounds.bottom], ["w", bounds.left, (bounds.top + bounds.bottom) / 2],
  ];
  for (const [handle, x, y] of points) if (Math.hypot(point.x - x, point.y - y) <= tolerance) return handle;
  return "";
}

function colliderFor(object: GameObjectDocument) {
  if (object.collisionEnabled === false) return undefined;
  return object.components.find((component) => ["box-collider", "circle-collider", "polygon-collider", "capsule-collider", "edge-collider", "chain-collider", "sensor"].includes(component.type) && component.enabled);
}

function colliderLayer(object: GameObjectDocument): string {
  return String(colliderFor(object)?.settings.layer ?? "World");
}

function colliderBehavior(object: GameObjectDocument): "static" | "dynamic" | "trigger" {
  const collider = colliderFor(object);
  if (!collider) return "static";
  if (collider.type === "sensor" || collider.settings.sensor === true || collider.settings.behavior === "trigger") return "trigger";
  if (collider.settings.behavior === "dynamic") return "dynamic";
  const rigidbody = componentOf(object, "rigidbody-2d");
  const bodyType = String(rigidbody?.settings.bodyType ?? "static");
  return bodyType === "dynamic" || bodyType.startsWith("kinematic") ? "dynamic" : "static";
}

function layersInteract(project: ProjectDocument, leftLayer: string, rightLayer: string): boolean {
  const matrix = project.settings.collisionMatrix ?? {};
  return Boolean(
    matrix[leftLayer]?.includes(rightLayer) ||
    matrix[rightLayer]?.includes(leftLayer),
  );
}

function colliderBounds(
  object: GameObjectDocument,
  x = object.transform.position.x,
  y = object.transform.position.y,
): Aabb | null {
  return colliderShapeFor(object, x, y)?.aabb ?? null;
}

function collidersIntersect(
  leftObject: GameObjectDocument,
  leftX: number,
  leftY: number,
  rightObject: GameObjectDocument,
  rightX: number,
  rightY: number,
): boolean {
  const left = colliderShapeFor(leftObject, leftX, leftY);
  const right = colliderShapeFor(rightObject, rightX, rightY);
  return Boolean(left && right && shapesIntersect(left, right));
}

function runtimeObjectsOverlap(
  leftObject: GameObjectDocument,
  leftX: number,
  leftY: number,
  rightObject: GameObjectDocument,
  rightX: number,
  rightY: number,
): boolean {
  const leftCollider = colliderShapeFor(leftObject, leftX, leftY);
  const rightCollider = colliderShapeFor(rightObject, rightX, rightY);
  if (leftCollider && rightCollider) return shapesIntersect(leftCollider, rightCollider);
  return intersects(objectBounds(leftObject, leftX, leftY), objectBounds(rightObject, rightX, rightY));
}

function colliderHalfSize(object: GameObjectDocument): { width: number; height: number } {
  const shape = colliderShapeFor(object);
  if (shape) return { width: Math.max(0.0001, (shape.aabb.right - shape.aabb.left) / 2), height: Math.max(0.0001, (shape.aabb.bottom - shape.aabb.top) / 2) };
  return {
    width: object.size.width * Math.max(0.0001, Math.abs(object.transform.scale.x)) / 2,
    height: object.size.height * Math.max(0.0001, Math.abs(object.transform.scale.y)) / 2,
  };
}

function intersects(left: Aabb, right: Aabb): boolean {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

function getActionKeys(project: ProjectDocument, actionId: string): string[] {
  return project.settings.inputActions.find((action) => action.id === actionId)?.keys ?? [];
}

function actionPressed(project: ProjectDocument, actionId: string, pressed: Set<string>): boolean {
  return getActionKeys(project, actionId).some((key) => pressed.has(key));
}

function frameForAsset(asset: AssetDocument, frameId: string): SpriteFrame | undefined {
  return asset.frames.find((frame) => frame.id === frameId) ?? asset.frames[0];
}

function clipDirectionKey(
  moving: boolean,
  direction: RuntimeObjectState["lastDirection"],
): string {
  const prefix = moving ? "walk" : "idle";
  const suffix = direction
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return `${prefix}${suffix}ClipId`;
}

function cameraElementForState(state: RuntimeObjectState | undefined): ComponentInstance | undefined {
  return state?.object.components.find((element) => element.type === "camera" && element.enabled);
}

function cameraEffectiveZoom(element: ComponentInstance | undefined): number {
  return clampZoom(cameraZoomForFov(Number(element?.settings.zoom ?? 1), Number(element?.settings.fieldOfView ?? 60)));
}

function runtimeObjectSaveKey(state: RuntimeObjectState): string {
  const saveState = state.object.components.find((element) => element.type === "save-state" && element.enabled);
  const explicit = String(saveState?.settings.saveKey ?? "").trim();
  return explicit || `${state.sourceSceneId}/${state.object.id}`;
}

function runtimeObjectKind(object: GameObjectDocument): RuntimePreviewObjectSnapshot["kind"] {
  if (object.components.some((element) => element.type === "player-input" && element.enabled)) return "player";
  if (object.components.some((element) => element.type === "tilemap-renderer" && element.enabled)) return "tilemap";
  if (object.components.some((element) => element.type === "camera" && element.enabled)) return "camera";
  if (object.components.some((element) => element.type === "item-pickup" && element.enabled)) return "pickup";
  if (object.components.some((element) => element.type === "scene-exit" && element.enabled)) return "exit";
  if (object.components.some((element) => element.type === "scene-spawn-point" && element.enabled)) return "spawn";
  return "object";
}

interface SceneViewportProps {
  runtimeMode?: boolean;
  showRuntimeColliders?: boolean;
  restartToken?: number;
  runtimeSessionId?: string;
  onRuntimeReady?: () => void;
  onRuntimeDisposed?: () => void;
}

export function SceneViewport({ runtimeMode = false, showRuntimeColliders = false, restartToken = 0, runtimeSessionId = "", onRuntimeReady, onRuntimeDisposed }: SceneViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeSessionIdRef = useRef(runtimeSessionId);
  const runtimeDisposedCallbackRef = useRef(onRuntimeDisposed);
  const runtimeReadyCallbackRef = useRef(onRuntimeReady);
  const appRef = useRef<Application | null>(null);
  const worldRef = useRef<Container | null>(null);
  const visualRef = useRef(new Map<string, ObjectVisual>());
  const editorAnimationPreviewRef = useRef(new Map<string, { clipId: string; frameIndex: number; direction: 1 | -1; elapsedSeconds: number }>());
  const viewportDisposedRef = useRef(false);
  const rebuildQueueRef = useRef<Promise<void>>(Promise.resolve());
  const requestedRebuildRef = useRef(0);
  const textureRef = useRef(new Map<string, Texture>());
  const cameraRef = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });
  const cameraFovRef = useRef(60);
  const cameraLookAheadRef = useRef<Vector2>({ x: 0, y: 0 });
  const activeCameraZoneRef = useRef<string | null>(null);
  const cameraShakeRef = useRef({ remainingMs: 0, amplitude: 0, phase: 0 });
  const projectRef = useRef(useEditorStore.getState().project);
  const projectPathRef = useRef(useEditorStore.getState().projectPath);
  const playStateRef = useRef<PlayState>(runtimeMode ? useEditorStore.getState().playState : "stopped");
  const runtimeObjectsRef = useRef(new Map<string, RuntimeObjectState>());
  const runtimeVariablesRef = useRef<Record<string, JsonPrimitive>>({});
  const runtimeInventoryRef = useRef<Record<string, number>>({});
  const persistentObjectStateRef = useRef(new Map<string, { enabled: boolean; destroyed: boolean }>());
  const runtimeAudioRef = useRef(new Map<string, HTMLAudioElement>());
  const runtimeAudioGroupRef = useRef<Record<string, { volume: number; muted: boolean }>>({});
  const runtimeSceneIdRef = useRef<string | null>(null);
  const runtimeDialogueRef = useRef<RuntimeDialogueState | null>(null);
  const runtimeBootStageRef = useRef("Stopped");
  const runtimeLogsRef = useRef<RuntimePreviewLogEntry[]>([]);
  const runtimeErrorsRef = useRef<string[]>([]);
  const runtimeCombatLogRef = useRef<RuntimeCombatLogEntry[]>([]);
  const runtimeAiTraceRef = useRef<RuntimeAiTraceEntry[]>([]);
  const runtimeScriptErrorsRef = useRef<RuntimeScriptErrorEntry[]>([]);
  const runtimeProfilerRef = useRef<RuntimeProfilerSnapshot[]>([]);
  const runtimeScriptCacheRef = useRef(new Map<string, CompiledLeonisScript>());
  const runtimeFrameStartedAtRef = useRef(0);
  const runtimeSnapshotAtRef = useRef(0);
  const runtimeStepRequestedRef = useRef(0);
  const runtimeScreenStackRef = useRef<string[]>([]);
  const runtimeMenuSelectionRef = useRef(0);
  const runtimeMenuPausedRef = useRef(false);
  const runtimeInputDeviceRef = useRef<"keyboard" | "gamepad" | "pointer">("keyboard");
  const gamepadNavigationAtRef = useRef(0);
  const gamepadPressedRef = useRef(new Set<number>());
  const overlapCycleRef = useRef({ signature: "", index: -1 });
  const triggerPairsRef = useRef(new Set<string>());
  const pressedKeysRef = useRef(new Set<string>());
  const justPressedRef = useRef(new Set<string>());
  const initializedCameraRef = useRef(false);
  const runtimeCameraNeedsSnapRef = useRef(true);
  const renderGenerationRef = useRef(0);
  const spacePressedRef = useRef(false);
  const pointerRef = useRef<PointerInteraction>({
    mode: "none",
    pointerId: -1,
    startClientX: 0,
    startClientY: 0,
    startCameraX: 0,
    startCameraY: 0,
    objectId: null,
    componentId: null,
    startObjectX: 0,
    startObjectY: 0,
    startColliderWidth: 0,
    startColliderHeight: 0,
    startColliderOffsetX: 0,
    startColliderOffsetY: 0,
    startWorldX: 0,
    startWorldY: 0,
    startSelectionPositions: {},
    handle: "",
    startObjectWidth: 0,
    startObjectHeight: 0,
    startScaleX: 1,
    startScaleY: 1,
    startRotation: 0,
    startPivotX: 0.5,
    startPivotY: 0.5,
    startAngle: 0,
    lastTileKey: "",
  });

  const project = useEditorStore((state) => state.project);
  const projectPath = useEditorStore((state) => state.projectPath);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const selectedObjectIds = useEditorStore((state) => state.selectedObjectIds);
  const activeTool = useEditorStore((state) => state.activeTool);
  const storePlayState = useEditorStore((state) => state.playState);
  const playState: PlayState = runtimeMode ? storePlayState : "stopped";
  const editorShowGrid = useEditorStore((state) => state.showGrid);
  const editorShowColliders = useEditorStore((state) => state.showColliders);
  const showGrid = runtimeMode ? false : editorShowGrid;
  const showColliders = runtimeMode ? showRuntimeColliders : editorShowColliders;
  const snapToGrid = useEditorStore((state) => state.snapToGrid);
  const gridSize = useEditorStore((state) => state.gridSize);
  const [cursorWorld, setCursorWorld] = useState<Vector2>({ x: 0, y: 0 });
  const [interactionPrompt, setInteractionPrompt] = useState<string | null>(null);
  const [runtimeDialogue, setRuntimeDialogue] = useState<RuntimeDialogueState | null>(null);
  const [runtimeUiVersion, setRuntimeUiVersion] = useState(0);
  const [runtimeScreenStack, setRuntimeScreenStack] = useState<string[]>([]);
  const [runtimeMenuSelection, setRuntimeMenuSelection] = useState(0);
  const [runtimeInputDevice, setRuntimeInputDeviceState] = useState<"keyboard" | "gamepad" | "pointer">("keyboard");
  const [selectionMarquee, setSelectionMarquee] = useState<SelectionMarquee | null>(null);
  const [overlapMenu, setOverlapMenu] = useState<OverlapMenuState | null>(null);
  const [ctrlRotateVisible, setCtrlRotateVisible] = useState(false);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  useEffect(() => {
    projectPathRef.current = projectPath;
  }, [projectPath]);
  useEffect(() => {
    playStateRef.current = playState;
  }, [playState]);
  useEffect(() => { runtimeSessionIdRef.current = runtimeSessionId; }, [runtimeSessionId]);
  useEffect(() => { runtimeDisposedCallbackRef.current = onRuntimeDisposed; }, [onRuntimeDisposed]);
  useEffect(() => { runtimeReadyCallbackRef.current = onRuntimeReady; }, [onRuntimeReady]);

  useEffect(() => {
    if (runtimeMode) return;
    let restoring = false;
    async function restoreEditorViewport(): Promise<void> {
      if (restoring) return;
      restoring = true;
      const host = hostRef.current;
      const app = appRef.current;
      const world = worldRef.current;
      if (viewportDisposedRef.current || !host || !app || !app.canvas?.isConnected || !containerIsUsable(world)) {
        restoring = false;
        window.dispatchEvent(new Event("shadowium:hard-reset-editor-viewport"));
        return;
      }
      try {
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        app.renderer.resize(width, height);
        await rebuildWorld();
        applyCamera();
        app.render();
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent("shadowium:editor-viewport-restored", { detail: { width, height, frameRendered: true } }));
          restoring = false;
        }));
      } catch (error) {
        restoring = false;
        useEditorStore.getState().setStatus(`Editor viewport restoration failed: ${error instanceof Error ? error.message : String(error)}`, "error");
        window.dispatchEvent(new Event("shadowium:hard-reset-editor-viewport"));
      }
    }
    window.addEventListener("shadowium:restore-editor-viewport", restoreEditorViewport);
    return () => window.removeEventListener("shadowium:restore-editor-viewport", restoreEditorViewport);
  }, [runtimeMode]);

  useEffect(() => {
    if (runtimeMode) return;
    function handleAnimationPreview(event: Event): void {
      const detail = (event as CustomEvent<{ objectId?: string; clipId?: string; stop?: boolean }>).detail ?? {};
      const objectId = String(detail.objectId ?? "");
      if (!objectId) return;
      if (detail.stop || !detail.clipId) {
        editorAnimationPreviewRef.current.delete(objectId);
        void rebuildWorld();
        return;
      }
      const clipId = String(detail.clipId);
      if (!projectRef.current.animations.some((clip) => clip.id === clipId)) return;
      editorAnimationPreviewRef.current.set(objectId, { clipId, frameIndex: 0, direction: 1, elapsedSeconds: 0 });
      void rebuildWorld();
    }
    window.addEventListener("shadowium:preview-object-animation", handleAnimationPreview);
    return () => window.removeEventListener("shadowium:preview-object-animation", handleAnimationPreview);
  }, [runtimeMode]);

  async function updateEditorAnimationPreviews(deltaSeconds: number): Promise<void> {
    if (runtimeMode || editorAnimationPreviewRef.current.size === 0) return;
    for (const [objectId, cursor] of editorAnimationPreviewRef.current) {
      const clip = projectRef.current.animations.find((candidate) => candidate.id === cursor.clipId);
      const visual = visualRef.current.get(objectId);
      if (!clip || !visual?.sprite) continue;
      const next = advanceAnimation(clip, { clipId: cursor.clipId, frameIndex: cursor.frameIndex, direction: cursor.direction, elapsedSeconds: cursor.elapsedSeconds }, deltaSeconds);
      cursor.frameIndex = next.frameIndex;
      cursor.direction = next.direction;
      cursor.elapsedSeconds = next.elapsedSeconds;
      if (next.changedFrame) {
        const texture = await textureForClipFrame(clip, next.frameIndex);
        const currentVisual = visualRef.current.get(objectId);
        if (texture && currentVisual?.sprite === visual.sprite) visual.sprite.texture = texture;
      }
    }
  }

  function currentViewportScene() {
    const currentProject = projectRef.current;
    return playStateRef.current === "stopped"
      ? getActiveScene(currentProject)
      : currentProject.scenes.find((scene) => scene.id === runtimeSceneIdRef.current) ?? getActiveScene(currentProject);
  }

  function activeRuntimeCameraState(): RuntimeObjectState | undefined {
    const cameras = [...runtimeObjectsRef.current.values()].filter(
      (state) => state.enabled && !state.destroyed && state.object.components.some((element) => element.type === "camera" && element.enabled),
    );
    return cameras.find((state) => cameraElementForState(state)?.settings.primary === true) ?? cameras[0];
  }

  function runtimeLog(message: string, level: RuntimeLogLevel = "info"): void {
    const entry: RuntimePreviewLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      time: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      level,
      message,
    };
    runtimeLogsRef.current = [...runtimeLogsRef.current.slice(-79), entry];
    if (level === "error") runtimeErrorsRef.current = [...runtimeErrorsRef.current.slice(-19), message];
    emitRuntimeSnapshot(true);
  }

  function emitRuntimeSnapshot(force = false): void {
    if (!runtimeMode || typeof window === "undefined") return;
    if (runtimeSessionIdRef.current && !isRuntimeSessionCurrent(runtimeSessionIdRef.current)) return;
    const now = performance.now();
    if (!force && now - runtimeSnapshotAtRef.current < 100) return;
    runtimeSnapshotAtRef.current = now;
    const host = hostRef.current;
    const scene = currentViewportScene();
    const states = [...runtimeObjectsRef.current.values()];
    const visibleStates = states.filter((state) => state.enabled && !state.destroyed);
    const objects: RuntimePreviewObjectSnapshot[] = visibleStates.map((state) => {
      const geometry = objectWorldGeometry(state.object, state.x, state.y);
      const collider = colliderShapeFor(state.object, state.x, state.y);
      const visual = visualRef.current.get(state.object.id);
      const renderer = componentOf(state.object, "sprite-renderer");
      const animation = state.activeClipId ? projectRef.current.animations.find((candidate) => candidate.id === state.activeClipId) : undefined;
      const expectedAssetId = String(renderer?.settings.assetId ?? "").trim();
      const expectedAsset = expectedAssetId ? projectRef.current.assets.find((candidate) => candidate.id === expectedAssetId) : undefined;
      const expectedFrameId = String(renderer?.settings.frameId ?? "").trim();
      const expectedFrame = expectedAsset ? frameForAsset(expectedAsset, expectedFrameId) : undefined;
      const spriteStatus: RuntimePreviewObjectSnapshot["spriteStatus"] = visual?.sprite
        ? "ready"
        : expectedAssetId && !expectedAsset
          ? "missing-asset"
          : expectedAsset && !expectedFrame
            ? "missing-frame"
            : "not-rendered";
      return {
        id: state.object.id,
        name: state.object.name,
        x: geometry.center.x,
        y: geometry.center.y,
        width: Math.max(1, geometry.aabb.right - geometry.aabb.left),
        height: Math.max(1, geometry.aabb.bottom - geometry.aabb.top),
        rotation: geometry.rotation,
        worldPoints: geometry.points.map((point) => ({ ...point })),
        colliderPoints: collider?.kind === "polygon" ? collider.points.map((point) => ({ ...point })) : [],
        color: state.object.editorColor,
        kind: runtimeObjectKind(state.object),
        componentCount: state.object.components.filter((component) => component.enabled).length,
        health: state.health,
        maximumHealth: state.maximumHealth,
        shield: state.shield,
        maximumShield: state.maximumShield,
        velocityX: state.velocityX,
        velocityY: state.velocityY,
        teamId: state.teamId,
        aiState: state.aiState,
        aiPreviousState: state.aiPreviousState,
        aiTargetId: state.aiTargetId,
        resources: { ...state.resources },
        cooldowns: { ...state.cooldowns },
        statuses: state.statuses.map((status) => ({ id: status.id, remainingSeconds: status.remainingSeconds, stacks: status.stacks })),
        stats: { ...state.stats },
        experience: state.experience,
        level: state.level,
        currencies: { ...state.currencies },
        activeClipId: state.activeClipId,
        animationFrame: state.animationFrame,
        animationFrameCount: animation?.frames.length ?? 0,
        animationState: state.animationMachineState,
        spriteStatus,
      };
    });
    const objectBoundsList = objects.map((object) => {
      const points = object.worldPoints.length ? object.worldPoints : [{ x: object.x - object.width / 2, y: object.y - object.height / 2 }, { x: object.x + object.width / 2, y: object.y + object.height / 2 }];
      return {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)),
        bottom: Math.max(...points.map((point) => point.y)),
      };
    });
    const fallbackWidth = projectRef.current.settings.gameWidth;
    const fallbackHeight = projectRef.current.settings.gameHeight;
    const left = objectBoundsList.length ? Math.min(...objectBoundsList.map((bounds) => bounds.left)) : -fallbackWidth / 2;
    const right = objectBoundsList.length ? Math.max(...objectBoundsList.map((bounds) => bounds.right)) : fallbackWidth / 2;
    const top = objectBoundsList.length ? Math.min(...objectBoundsList.map((bounds) => bounds.top)) : -fallbackHeight / 2;
    const bottom = objectBoundsList.length ? Math.max(...objectBoundsList.map((bounds) => bounds.bottom)) : fallbackHeight / 2;
    const cameraView = cameraWorldView(cameraRef.current, host?.clientWidth ?? fallbackWidth, host?.clientHeight ?? fallbackHeight);
    const cameraState = activeRuntimeCameraState();
    const session = getRuntimeSession(runtimeSessionIdRef.current);
    const detail: RuntimePreviewSnapshot = {
      sessionId: session?.id ?? runtimeSessionIdRef.current,
      sessionGeneration: session?.generation ?? 0,
      sessionState: session?.snapshot.state ?? (playStateRef.current === "paused" ? "paused" : "running"),
      sceneId: runtimeSceneIdRef.current,
      sceneName: scene.name,
      bootStage: runtimeBootStageRef.current,
      objectCount: states.length,
      visibleObjectCount: visibleStates.length,
      tilemapCount: visibleStates.filter((state) => state.object.components.some((element) => element.type === "tilemap-renderer" && element.enabled)).length,
      activeCameraName: cameraState?.object.name ?? "Default Camera",
      cameraX: cameraView.centerX,
      cameraY: cameraView.centerY,
      cameraZoom: cameraRef.current.zoom,
      cameraFov: cameraFovRef.current,
      cameraView: { left: cameraView.left, right: cameraView.right, top: cameraView.top, bottom: cameraView.bottom, width: cameraView.width, height: cameraView.height },
      worldBounds: { left, right, top, bottom, width: Math.max(1, right - left), height: Math.max(1, bottom - top) },
      objects,
      variables: { ...runtimeVariablesRef.current },
      inventory: { ...runtimeInventoryRef.current },
      logs: [...runtimeLogsRef.current],
      errors: [...runtimeErrorsRef.current],
      combatLog: [...runtimeCombatLogRef.current],
      aiTrace: [...runtimeAiTraceRef.current],
      scriptErrors: [...runtimeScriptErrorsRef.current],
      profiler: [...runtimeProfilerRef.current],
    };
    window.dispatchEvent(new CustomEvent<RuntimePreviewSnapshot>(RUNTIME_SNAPSHOT_EVENT, { detail }));
  }

  function renderZForObject(object: GameObjectDocument, worldY: number, scene = currentViewportScene()): number {
    const renderer = componentOf(object, "sprite-renderer");
    const sceneOrder = scene.layers.find((layer) => layer.id === object.layerId)?.renderOrder ?? 0;
    const layerOrder: Record<string, number> = { background: 0, ground: 1, "ground decorations": 2, characters: 3, effects: 4, foreground: 5, ui: 6 };
    const sortingLayer = layerOrder[String(renderer?.settings.sortingLayer ?? "characters").toLowerCase()] ?? 3;
    const order = Number(renderer?.settings.orderInLayer ?? renderer?.settings.renderLayer ?? 0);
    const ySort = renderer?.settings.ySort === true ? worldY * 0.001 : 0;
    return sceneOrder * 1_000_000 + sortingLayer * 100_000 + order * 100 + ySort + Number(renderer?.settings.zBias ?? 0);
  }

  function updateVisualTransforms(): void {
    const host = hostRef.current;
    if (!host) return;
    const scene = currentViewportScene();
    const cameraWorldX = (host.clientWidth / 2 - cameraRef.current.x) / cameraRef.current.zoom;
    const cameraWorldY = (host.clientHeight / 2 - cameraRef.current.y) / cameraRef.current.zoom;
    for (const [objectId, visual] of visualRef.current) {
      const runtime = runtimeObjectsRef.current.get(objectId);
      const object = runtime?.object ?? scene.objects.find((candidate) => candidate.id === objectId);
      if (!object) continue;
      const layer = scene.layers.find((candidate) => candidate.id === object.layerId);
      const parallax = object.components.find((element) => element.type === "parallax-layer" && element.enabled);
      const factorX = Number(parallax?.settings.horizontalFactor ?? layer?.parallaxX ?? 1);
      const factorY = Number(parallax?.settings.verticalFactor ?? layer?.parallaxY ?? 1);
      const baseX = runtime?.x ?? object.transform.position.x;
      const baseY = runtime?.y ?? object.transform.position.y;
      visual.group.position.set(baseX + cameraWorldX * (1 - factorX), baseY + cameraWorldY * (1 - factorY));
      visual.group.zIndex = renderZForObject(object, baseY, scene);
    }
  }

  function updateRuntimeVisibilityEffects(deltaSeconds: number): void {
    if (!runtimeMode) return;
    const states = [...runtimeObjectsRef.current.values()].filter((state) => state.enabled && !state.destroyed);
    const defaultPlayer = states.find((state) => componentOf(state.object, "player-input"));
    for (const state of states) {
      const visual = visualRef.current.get(state.object.id);
      if (!visual) continue;
      let targetOpacity = state.hitFlashRemaining > 0 && Math.floor(state.hitFlashRemaining * 60) % 2 === 0 ? 0.45 : 1;
      const visibility = componentOf(state.object, "visibility-group");
      const visibilityVariable = String(visibility?.settings.variable ?? "").trim();
      if (visibilityVariable && runtimeVariablesRef.current[visibilityVariable] === false) targetOpacity = 0;

      const fade = componentOf(state.object, "fade-when-player-behind");
      if (fade) {
        const targetId = String(fade.settings.targetObjectId ?? "");
        const target = runtimeObjectsRef.current.get(targetId) ?? defaultPlayer;
        if (target) {
          const bounds = objectWorldAabb(state.object, state.x, state.y);
          const padding = Math.max(0, Number(fade.settings.horizontalPadding ?? 8));
          const behind = target.x >= bounds.left - padding && target.x <= bounds.right + padding && target.y <= state.y && target.y >= bounds.top - Math.max(32, bounds.bottom - bounds.top);
          if (behind) targetOpacity = Math.min(targetOpacity, Math.max(0, Math.min(1, Number(fade.settings.fadedOpacity ?? 0.35))));
        }
      }
      const roof = componentOf(state.object, "roof-hider");
      if (roof) {
        const targetId = String(roof.settings.targetObjectId ?? "");
        const target = runtimeObjectsRef.current.get(targetId) ?? defaultPlayer;
        if (target) {
          const bounds = objectWorldAabb(state.object, state.x, state.y);
          if (target.x >= bounds.left && target.x <= bounds.right && target.y >= bounds.top && target.y <= bounds.bottom) targetOpacity = Math.min(targetOpacity, Math.max(0, Math.min(1, Number(roof.settings.hiddenOpacity ?? 0.1))));
        }
      }
      const speed = Math.max(1, Number(fade?.settings.fadeSpeed ?? 10));
      const blend = 1 - Math.exp(-speed * deltaSeconds);
      visual.group.alpha += (targetOpacity - visual.group.alpha) * blend;
    }
  }

  function applyCamera(): void {
    const world = worldRef.current;
    if (!world) return;
    const shake = cameraShakeRef.current;
    const shakeX = shake.remainingMs > 0 ? Math.sin(shake.phase * 1.73) * shake.amplitude : 0;
    const shakeY = shake.remainingMs > 0 ? Math.cos(shake.phase * 2.17) * shake.amplitude : 0;
    world.position.set(cameraRef.current.x + shakeX, cameraRef.current.y + shakeY);
    world.scale.set(cameraRef.current.zoom);
    updateVisualTransforms();
    useEditorStore.getState().setViewportZoom(cameraRef.current.zoom);
    emitRuntimeSnapshot();
  }

  function resetCamera(): void {
    const host = hostRef.current;
    if (!host) return;
    cameraRef.current = { x: host.clientWidth / 2, y: host.clientHeight / 2, zoom: 1 };
    cameraFovRef.current = 60;
    applyCamera();
  }

  function frameCamera(): void {
    const host = hostRef.current;
    if (!host) return;
    const scene = getActiveScene(projectRef.current);
    if (scene.objects.length === 0) {
      resetCamera();
      return;
    }
    const bounds = scene.objects.map((object) => objectBounds(object));
    const left = Math.min(...bounds.map((item) => item.left));
    const right = Math.max(...bounds.map((item) => item.right));
    const top = Math.min(...bounds.map((item) => item.top));
    const bottom = Math.max(...bounds.map((item) => item.bottom));
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const zoom = clampZoom(Math.min((host.clientWidth - 120) / width, (host.clientHeight - 120) / height));
    cameraRef.current = {
      zoom,
      x: host.clientWidth / 2 - ((left + right) / 2) * zoom,
      y: host.clientHeight / 2 - ((top + bottom) / 2) * zoom,
    };
    applyCamera();
  }

  function screenToWorld(clientX: number, clientY: number): Vector2 {
    const host = hostRef.current;
    if (!host) return { x: 0, y: 0 };
    const bounds = host.getBoundingClientRect();
    return {
      x: (clientX - bounds.left - cameraRef.current.x) / cameraRef.current.zoom,
      y: (clientY - bounds.top - cameraRef.current.y) / cameraRef.current.zoom,
    };
  }

  function setCameraZoom(nextZoom: number, anchorClientX?: number, anchorClientY?: number): void {
    const host = hostRef.current;
    if (!host) return;
    const bounds = host.getBoundingClientRect();
    const anchorX = anchorClientX === undefined ? host.clientWidth / 2 : anchorClientX - bounds.left;
    const anchorY = anchorClientY === undefined ? host.clientHeight / 2 : anchorClientY - bounds.top;
    const camera = cameraRef.current;
    const worldX = (anchorX - camera.x) / camera.zoom;
    const worldY = (anchorY - camera.y) / camera.zoom;
    const zoom = clampZoom(nextZoom);
    cameraRef.current = {
      x: anchorX - worldX * zoom,
      y: anchorY - worldY * zoom,
      zoom,
    };
    applyCamera();
  }

  async function textureForFrame(asset: AssetDocument, frame: SpriteFrame): Promise<Texture | null> {
    const projectFilePath = projectPathRef.current;
    const key = `${asset.id}:${frame.id}`;
    const cached = textureRef.current.get(key);
    if (cached) return cached;
    const dataUrl = await getAssetDataUrl(projectFilePath, asset);
    if (!dataUrl) return null;
    const base = (await Assets.load(dataUrl)) as Texture;
    const texture = new Texture({
      source: base.source,
      frame: new Rectangle(frame.x, frame.y, frame.width, frame.height),
    });
    textureRef.current.set(key, texture);
    return texture;
  }

  async function textureForClipFrame(clip: AnimationClip, index: number): Promise<Texture | null> {
    const currentProject = projectRef.current;
    const asset = currentProject.assets.find((candidate) => candidate.id === clip.assetId);
    if (!asset || clip.frames.length === 0) return null;
    const reference = clip.frames[index % clip.frames.length];
    const frame = frameForAsset(asset, reference.frameId);
    if (!frame) return null;
    return textureForFrame(asset, frame);
  }

  function refreshRuntimeUi(): void {
    setRuntimeUiVersion((version) => version + 1);
  }

  function activeInventoryElement(): ComponentInstance | undefined {
    const states = [...runtimeObjectsRef.current.values()].filter((state) => state.enabled && !state.destroyed);
    const playerInventory = states
      .filter((state) => state.object.components.some((element) => element.type === "player-input" && element.enabled))
      .map((state) => state.object.components.find((element) => element.type === "inventory" && element.enabled))
      .find(Boolean);
    return playerInventory ?? states
      .map((state) => state.object.components.find((element) => element.type === "inventory" && element.enabled))
      .find(Boolean);
  }

  function runtimeItemMaximumStack(itemId: string): number {
    const definition = projectRef.current.items.find((item) => item.id === itemId);
    return Math.max(1, Math.floor(Number(definition?.maximumStack ?? 9999)));
  }

  function runtimeInventoryUsedSlots(allowStacking: boolean): number {
    const amounts = Object.values(runtimeInventoryRef.current).map((amount) => Math.max(0, Math.floor(Number(amount) || 0)));
    return allowStacking ? amounts.filter((amount) => amount > 0).length : amounts.reduce((total, amount) => total + amount, 0);
  }

  function addRuntimeItem(itemIdValue: string, requestedAmount: number): number {
    const itemId = itemIdValue.trim();
    const requested = Math.max(0, Math.floor(Number(requestedAmount) || 0));
    if (!itemId || requested <= 0) return 0;

    const inventory = activeInventoryElement();
    const capacity = inventory ? Math.max(1, Math.floor(Number(inventory.settings.capacity ?? 20))) : Number.POSITIVE_INFINITY;
    const allowStacking = inventory?.settings.allowStacking !== false;
    const current = Math.max(0, Math.floor(Number(runtimeInventoryRef.current[itemId] ?? 0)));
    const usedSlots = runtimeInventoryUsedSlots(allowStacking);

    let available = requested;
    if (allowStacking) {
      const stackSpace = Math.max(0, runtimeItemMaximumStack(itemId) - current);
      const hasStack = current > 0;
      const hasFreeSlot = usedSlots < capacity;
      available = hasStack || hasFreeSlot ? Math.min(requested, stackSpace) : 0;
    } else {
      available = Math.min(requested, Math.max(0, capacity - usedSlots));
    }

    if (available <= 0) return 0;
    runtimeInventoryRef.current[itemId] = current + available;
    refreshRuntimeUi();
    return available;
  }

  function removeRuntimeItem(itemIdValue: string, requestedAmount: number): number {
    const itemId = itemIdValue.trim();
    const requested = Math.max(0, Math.floor(Number(requestedAmount) || 0));
    if (!itemId || requested <= 0) return 0;
    const current = Math.max(0, Math.floor(Number(runtimeInventoryRef.current[itemId] ?? 0)));
    const removed = Math.min(current, requested);
    const remaining = current - removed;
    if (remaining > 0) runtimeInventoryRef.current[itemId] = remaining;
    else delete runtimeInventoryRef.current[itemId];
    if (removed > 0) refreshRuntimeUi();
    return removed;
  }

  function runtimeAudioGroupVolume(groupId: string): number {
    const master = runtimeAudioGroupRef.current.master ?? { volume: 1, muted: false };
    const group = runtimeAudioGroupRef.current[groupId] ?? { volume: 1, muted: false };
    if (master.muted || group.muted) return 0;
    return Math.max(0, Math.min(1, master.volume * group.volume));
  }

  function updateRuntimeAudioVolumes(): void {
    const player = [...runtimeObjectsRef.current.values()].find((state) => state.enabled && !state.destroyed && state.object.components.some((element) => element.type === "player-input" && element.enabled));
    for (const [objectId, audio] of runtimeAudioRef.current) {
      const state = runtimeObjectsRef.current.get(objectId);
      const source = state?.object.components.find((element) => element.type === "audio-source" && element.enabled);
      if (!state || !source) continue;
      let attenuation = 1;
      if (source.settings.spatial === true && player) {
        const maximumDistance = Math.max(1, Number(source.settings.maximumDistance ?? 800));
        attenuation = Math.max(0, Math.min(1, 1 - Math.hypot(player.x - state.x, player.y - state.y) / maximumDistance));
      }
      audio.volume = Math.max(0, Math.min(1, Number(source.settings.volume ?? 1) * runtimeAudioGroupVolume(String(source.settings.group ?? "sfx")) * attenuation));
    }
  }

  function stopRuntimeAudio(objectId?: string): void {
    if (objectId) {
      const audio = runtimeAudioRef.current.get(objectId);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        runtimeAudioRef.current.delete(objectId);
      }
      return;
    }
    for (const audio of runtimeAudioRef.current.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    runtimeAudioRef.current.clear();
  }

  async function playRuntimeAudio(state: RuntimeObjectState): Promise<void> {
    const source = state.object.components.find((element) => element.type === "audio-source" && element.enabled);
    if (!source) return;
    const assetId = String(source.settings.assetId ?? "");
    const asset = projectRef.current.assets.find((candidate) => candidate.id === assetId && candidate.kind === "audio");
    if (!asset) return;
    const dataUrl = await getAssetDataUrl(projectPathRef.current, asset);
    if (!dataUrl) return;
    stopRuntimeAudio(state.object.id);
    const audio = new Audio(dataUrl);
    const groupId = String(source.settings.group ?? "sfx");
    audio.loop = source.settings.loop === true;
    audio.volume = Math.max(0, Math.min(1, Number(source.settings.volume ?? 1) * runtimeAudioGroupVolume(groupId)));
    audio.playbackRate = Math.max(0.25, Math.min(4, Number(source.settings.pitch ?? 1)));
    audio.addEventListener("ended", () => {
      runtimeAudioRef.current.delete(state.object.id);
      fireRules("audio-finished", state.object.id, null);
    }, { once: true });
    runtimeAudioRef.current.set(state.object.id, audio);
    try {
      await audio.play();
    } catch {
      useEditorStore.getState().setStatus(`Audio for ${state.object.name} is waiting for user interaction`, "warning");
    }
  }

  function startSceneAudio(): void {
    for (const state of runtimeObjectsRef.current.values()) {
      const source = state.object.components.find((element) => element.type === "audio-source" && element.enabled);
      if (source?.settings.playOnStart === true && state.enabled && !state.destroyed) void playRuntimeAudio(state);
    }
  }

  function createRuntimeStateForObject(object: GameObjectDocument, sourceSceneId: string, spawnX = object.transform.position.x, spawnY = object.transform.position.y): RuntimeObjectState {
    const persisted = persistentObjectStateRef.current.get(object.id);
    const clonedObject = cloneObject(object);
    clonedObject.transform.position = { x: spawnX, y: spawnY };
    const statsComponent = componentOf(clonedObject, "stats");
    const stats = buildRuntimeStats(projectRef.current.stats, statsComponent?.settings.values, statsComponent?.settings.formulas);
    const healthComponent = componentOf(clonedObject, "health");
    const maximumHealth = healthComponent ? Math.max(0, Number(stats["maximum-health"] ?? healthComponent.settings.maximumHealth ?? 100)) : null;
    const shieldComponent = componentOf(clonedObject, "shield");
    const maximumShield = Math.max(0, Number(shieldComponent?.settings.maximumShield ?? shieldComponent?.settings.maximum ?? 0));
    const resources: Record<string, number> = {};
    const resourceMaximums: Record<string, number> = {};
    const resourceRegenerationDelay: Record<string, number> = {};
    for (const resource of clonedObject.components.filter((component) => component.enabled && component.type === "resource-pool")) {
      const id = String(resource.settings.resourceId ?? "mana").trim() || "mana";
      const maximum = Math.max(0, Number(resource.settings.maximum ?? 100));
      resourceMaximums[id] = maximum;
      resources[id] = Math.max(0, Math.min(resource.settings.allowOverflow === true ? Number.POSITIVE_INFINITY : maximum, Number(resource.settings.starting ?? maximum)));
      resourceRegenerationDelay[id] = 0;
    }
    const levelComponent = componentOf(clonedObject, "level");
    const experienceComponent = componentOf(clonedObject, "experience");
    const wallet = componentOf(clonedObject, "currency-wallet");
    const aiController = componentOf(clonedObject, "ai-controller");
    const progression = componentOf(clonedObject, "progression-state");
    let progressionValues: Record<string, unknown> = {};
    try { progressionValues = JSON.parse(String(progression?.settings.values ?? "{}")) as Record<string, unknown>; } catch { progressionValues = {}; }
    return {
      object: clonedObject, sourceSceneId, x: spawnX, y: spawnY,
      enabled: persisted?.enabled ?? object.enabled, destroyed: persisted?.destroyed ?? false,
      lastDirection: "down", forcedClipId: null, activeClipId: null, animationFrame: 0, animationDirection: 1, animationElapsed: 0, animationMachineState: "",
      health: maximumHealth === null ? null : Math.max(0, Math.min(maximumHealth, Number(healthComponent?.settings.startingHealth ?? maximumHealth))), maximumHealth,
      shield: Math.max(0, Math.min(maximumShield, Number(shieldComponent?.settings.startingShield ?? maximumShield))), maximumShield, shieldRegenerationDelay: 0,
      healthZeroFired: false, deathHandled: false, deathTimer: 0,
      velocityX: 0, velocityY: 0, originX: spawnX, originY: spawnY, age: 0, behaviorElapsed: 0, behaviorDirectionX: 1, behaviorDirectionY: 0,
      movingForward: true, waitRemaining: 0, grounded: false, coyoteRemaining: 0, jumpBufferRemaining: 0, hitCooldowns: {}, invulnerableUntil: 0,
      hitFlashRemaining: 0, timerCompleted: false, patrolCompleted: false, patrolPathIndex: 0, patrolPathDirection: 1, teamId: teamId(clonedObject), statuses: [], resources, resourceMaximums,
      resourceRegenerationDelay, cooldowns: {}, activeCast: null, stats, aiState: String(aiController?.settings.initialState ?? "Idle"), aiPreviousState: "",
      aiTargetId: null, blackboard: {}, aiDecisionElapsed: 0, attackCooldownRemaining: 0,
      experience: Math.max(0, Number(experienceComponent?.settings.startingExperience ?? 0)), level: Math.max(1, Number(levelComponent?.settings.startingLevel ?? 1)),
      currencies: parseNumberMap(wallet?.settings.currencies), unlockedSkills: parseList(progressionValues.unlockedSkills), purchasedUpgrades: parseList(progressionValues.purchasedUpgrades), scriptsStarted: new Set<string>(),
    };
  }

  function spawnRuntimePrefab(prefabId: string, x: number, y: number): RuntimeObjectState | null {
    const prefab = projectRef.current.prefabs.find((candidate) => candidate.id === prefabId);
    if (!prefab) return null;
    const object = cloneObject(prefab.object);
    object.id = `runtime-${prefabId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    object.name = `${prefab.name} ${runtimeObjectsRef.current.size + 1}`;
    object.prefabId = prefab.id;
    object.parentId = null;
    object.components = object.components.map((component) => ({ ...component, id: `runtime-component-${Math.random().toString(36).slice(2, 9)}` }));
    const state = createRuntimeStateForObject(object, runtimeSceneIdRef.current ?? projectRef.current.activeSceneId, x, y);
    runtimeObjectsRef.current.set(object.id, state);
    runtimeLog(`Spawned ${prefab.name}.`, "event");
    void rebuildWorld();
    return state;
  }

  function initializeRuntimeScene(
    sceneId = projectRef.current.settings.initialSceneId || projectRef.current.activeSceneId,
    preserveRuntimeState = false,
    destinationSpawnId = "",
  ): void {
    const scene = projectRef.current.scenes.find((candidate) => candidate.id === sceneId) ?? getActiveScene(projectRef.current);
    const previousStates = preserveRuntimeState ? [...runtimeObjectsRef.current.values()] : [];
    const carriedStates = previousStates.filter((state) => {
      const saveState = state.object.components.find((element) => element.type === "save-state" && element.enabled);
      return state.object.components.some((element) => element.type === "player-input" && element.enabled) || saveState?.settings.persistAcrossScenes === true;
    });

    runtimeBootStageRef.current = `Loading ${scene.name}`;
    runtimeObjectsRef.current.clear();
    triggerPairsRef.current.clear();
    activeCameraZoneRef.current = null;
    runtimeCameraNeedsSnapRef.current = true;
    if (!preserveRuntimeState) {
      runtimeVariablesRef.current = { ...projectRef.current.variables };
      runtimeInventoryRef.current = {};
      runtimeAudioGroupRef.current = Object.fromEntries(projectRef.current.settings.audioGroups.map((group) => [group.id, { volume: Math.max(0, Math.min(1, Number(group.volume ?? 1))), muted: group.muted === true }]));
      persistentObjectStateRef.current.clear();
      runtimeLogsRef.current = [];
      runtimeErrorsRef.current = [];
      runtimeCombatLogRef.current = [];
      runtimeAiTraceRef.current = [];
      runtimeScriptErrorsRef.current = [];
      runtimeProfilerRef.current = [];
      runtimeScriptCacheRef.current.clear();
    }
    runtimeSceneIdRef.current = scene.id;

    const instantiateObject = (object: GameObjectDocument, sourceSceneId: string): RuntimeObjectState => createRuntimeStateForObject(object, sourceSceneId);

    for (const object of scene.objects) runtimeObjectsRef.current.set(object.id, instantiateObject(object, scene.id));

    if (!preserveRuntimeState) {
      for (const state of runtimeObjectsRef.current.values()) {
        const inventory = state.object.components.find((element) => element.type === "inventory" && element.enabled);
        if (inventory) {
          try {
            const starting = JSON.parse(String(inventory.settings.startingItems ?? "{}")) as Record<string, number>;
            for (const [itemId, amount] of Object.entries(starting)) addRuntimeItem(itemId, Number(amount) || 0);
          } catch {
            runtimeLog(`Inventory on ${state.object.name} has invalid Starting Items JSON.`, "warning");
          }
        }
        for (const element of state.object.components) {
          if (!element.enabled || (element.type !== "score" && element.type !== "counter")) continue;
          const variable = String(element.settings.variable ?? (element.type === "score" ? "score" : "counter")).trim();
          if (variable && runtimeVariablesRef.current[variable] === undefined) runtimeVariablesRef.current[variable] = Number(element.settings.startingValue ?? 0);
        }
      }
      initializeQuestTracking();
    }

    for (const carried of carriedStates) {
      const key = runtimeObjectSaveKey(carried);
      const alreadyPresent = [...runtimeObjectsRef.current.values()].some((state) => runtimeObjectSaveKey(state) === key);
      if (alreadyPresent) continue;
      const next = { ...carried, object: cloneObject(carried.object) };
      if (!scene.layers.some((layer) => layer.id === next.object.layerId)) {
        next.object.layerId = scene.layers.find((layer) => layer.runtimeIncluded !== false)?.id ?? scene.layers[0]?.id ?? next.object.layerId;
      }
      runtimeObjectsRef.current.set(next.object.id, next);
    }

    const spawnStates = [...runtimeObjectsRef.current.values()].filter((state) => state.sourceSceneId === scene.id && state.object.components.some((element) => element.type === "scene-spawn-point" && element.enabled));
    const requestedSpawn = destinationSpawnId.trim();
    const spawnState = spawnStates.find((state) => String(state.object.components.find((element) => element.type === "scene-spawn-point")?.settings.spawnId ?? "default") === requestedSpawn)
      ?? spawnStates.find((state) => state.object.components.find((element) => element.type === "scene-spawn-point")?.settings.defaultSpawn === true)
      ?? spawnStates[0];
    if (spawnState) {
      const spawnElement = spawnState.object.components.find((element) => element.type === "scene-spawn-point");
      for (const state of runtimeObjectsRef.current.values()) {
        if (!state.object.components.some((element) => element.type === "player-input" && element.enabled)) continue;
        state.x = spawnState.x;
        state.y = spawnState.y;
        const facing = String(spawnElement?.settings.facing ?? "down") as RuntimeObjectState["lastDirection"];
        if (["up", "down", "left", "right"].includes(facing)) state.lastDirection = facing;
      }
    }

    const cameraElement = cameraElementForState(activeRuntimeCameraState());
    cameraFovRef.current = clampCameraFov(Number(cameraElement?.settings.fieldOfView ?? 60));
    if (cameraElement) cameraRef.current.zoom = cameraEffectiveZoom(cameraElement);

    runtimeBootStageRef.current = "Scene instantiated";
    for (const objectId of runtimeObjectsRef.current.keys()) fireRules("object-created", objectId, null);
    fireRules("scene-started", null, null);
    if (!preserveRuntimeState) fireRules("preview-start", null, null);
    initializeRuntimeScreens();
    refreshRuntimeUi();
    startSceneAudio();
    runtimeLog(`Loaded ${scene.name}: ${runtimeObjectsRef.current.size} runtime objects, ${spawnStates.length} spawn points.`, "info");
  }

  function conditionPasses(rule: EventRuleDocument): boolean {
    return rule.conditions.every((condition) => {
      if (condition.type === "always") return true;
      if (condition.type === "variable-equals") {
        return runtimeVariablesRef.current[condition.key] === condition.value;
      }
      if (condition.type === "variable-compare") {
        const left = runtimeVariablesRef.current[condition.key];
        const right = condition.value;
        if (condition.operator === "==") return left === right;
        if (condition.operator === "!=") return left !== right;
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false;
        if (condition.operator === ">") return leftNumber > rightNumber;
        if (condition.operator === ">=") return leftNumber >= rightNumber;
        if (condition.operator === "<") return leftNumber < rightNumber;
        return leftNumber <= rightNumber;
      }
      if (condition.type === "object-enabled") {
        const state = condition.objectId ? runtimeObjectsRef.current.get(condition.objectId) : undefined;
        return Boolean(state?.enabled && !state.destroyed) === Boolean(condition.value);
      }
      if (condition.type === "object-has-component" || condition.type === "object-has-element") {
        const state = condition.objectId ? runtimeObjectsRef.current.get(condition.objectId) : undefined;
        return Boolean(condition.componentType && state?.object.components.some((element) => element.type === condition.componentType));
      }
      if (condition.type === "object-has-tag") {
        const state = condition.objectId ? runtimeObjectsRef.current.get(condition.objectId) : undefined;
        return Boolean(condition.key && state?.object.tags.includes(condition.key));
      }
      if (condition.type === "inventory-contains") {
        return (runtimeInventoryRef.current[condition.key] ?? 0) >= Number(condition.value ?? 1);
      }
      if (condition.type === "scene-is-active") {
        return runtimeSceneIdRef.current === String(condition.value ?? condition.key);
      }
      if (condition.type === "random-chance") {
        return Math.random() * 100 < Number(condition.value ?? 50);
      }
      return false;
    });
  }

  function questVariableKey(questId: string, suffix: string): string {
    return `__quest:${questId}:${suffix}`;
  }

  function initializeQuestTracking(): void {
    for (const state of runtimeObjectsRef.current.values()) {
      const tracker = componentOf(state.object, "quest-tracker");
      if (!tracker) continue;
      const ids = String(tracker.settings.startingQuestIds ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      for (const questId of ids) {
        if (!projectRef.current.quests.some((quest) => quest.id === questId)) continue;
        const activeKey = questVariableKey(questId, "active");
        const completedKey = questVariableKey(questId, "completed");
        if (runtimeVariablesRef.current[completedKey] !== true && runtimeVariablesRef.current[activeKey] === undefined) {
          runtimeVariablesRef.current[activeKey] = true;
        }
      }
    }
  }

  function questTargetMatches(targetId: string, state?: RuntimeObjectState, explicitTarget = ""): boolean {
    const expected = targetId.trim().toLowerCase();
    if (!expected) return true;
    if (explicitTarget.trim().toLowerCase() === expected) return true;
    if (!state) return false;
    if (state.object.id.toLowerCase() === expected || state.object.name.toLowerCase() === expected) return true;
    return state.object.tags.some((tag) => tag.toLowerCase() === expected);
  }

  function completeQuestIfReady(questId: string): void {
    const quest = projectRef.current.quests.find((candidate) => candidate.id === questId);
    if (!quest || runtimeVariablesRef.current[questVariableKey(questId, "completed")] === true) return;
    const required = quest.objectives.filter((objective) => !objective.optional);
    const ready = required.every((objective) => Number(runtimeVariablesRef.current[questVariableKey(questId, `objective:${objective.id}`)] ?? 0) >= Math.max(1, Number(objective.amount || 1)));
    if (!ready) return;

    runtimeVariablesRef.current[questVariableKey(questId, "active")] = false;
    runtimeVariablesRef.current[questVariableKey(questId, "completed")] = true;
    const receiver = [...runtimeObjectsRef.current.values()].find((state) => Boolean(componentOf(state.object, "quest-tracker") || componentOf(state.object, "player-input")));
    if (receiver && quest.rewardTableId) grantRuntimeLoot(receiver, quest.rewardTableId);
    for (const followUpId of quest.followUpQuestIds) {
      if (projectRef.current.quests.some((candidate) => candidate.id === followUpId)) runtimeVariablesRef.current[questVariableKey(followUpId, "active")] = true;
    }
    runtimeLog(`Quest completed: ${quest.name}.`, "event");
    fireRules("variable-changed", receiver?.object.id ?? null, null);
    refreshRuntimeUi();
  }

  function recordQuestProgress(kind: ProjectDocument["quests"][number]["objectives"][number]["kind"], target = "", amount = 1, state?: RuntimeObjectState): void {
    for (const quest of projectRef.current.quests) {
      if (runtimeVariablesRef.current[questVariableKey(quest.id, "active")] !== true) continue;
      if (runtimeVariablesRef.current[questVariableKey(quest.id, "completed")] === true) continue;
      let changed = false;
      for (const objective of quest.objectives) {
        if (objective.kind !== kind || !questTargetMatches(objective.targetId, state, target)) continue;
        const key = questVariableKey(quest.id, `objective:${objective.id}`);
        const previous = Number(runtimeVariablesRef.current[key] ?? 0);
        const goal = Math.max(1, Number(objective.amount || 1));
        const next = Math.min(goal, previous + Math.max(0, amount));
        if (next === previous) continue;
        runtimeVariablesRef.current[key] = next;
        changed = true;
        runtimeLog(`Quest ${quest.name}: ${objective.kind} ${next}/${goal}.`, "event");
      }
      if (changed) completeQuestIfReady(quest.id);
    }
  }

  function updateQuestSurvival(deltaSeconds: number): void {
    for (const quest of projectRef.current.quests) {
      if (runtimeVariablesRef.current[questVariableKey(quest.id, "active")] !== true) continue;
      if (runtimeVariablesRef.current[questVariableKey(quest.id, "completed")] === true) continue;
      let changed = false;
      for (const objective of quest.objectives) {
        if (objective.kind !== "survive") continue;
        const key = questVariableKey(quest.id, `objective:${objective.id}`);
        const goal = Math.max(0.01, Number(objective.amount || 1));
        const previous = Number(runtimeVariablesRef.current[key] ?? 0);
        const next = Math.min(goal, previous + Math.max(0, deltaSeconds));
        runtimeVariablesRef.current[key] = next;
        changed = true;
      }
      if (changed) completeQuestIfReady(quest.id);
    }
  }

  function checkHealthState(state: RuntimeObjectState): void {
    if (state.health === null || state.health > 0 || state.healthZeroFired) return;
    state.healthZeroFired = true;
    state.aiPreviousState = state.aiState;
    state.aiState = "Dead";
    fireRules("health-zero", state.object.id, null);
    runRuntimeScripts(state, "on_destroy");

    const death = componentOf(state.object, "death-behaviour");
    const legacyHealth = componentOf(state.object, "health");
    const delay = Math.max(0, Number(death?.settings.removalDelay ?? death?.settings.delay ?? 0));
    state.deathHandled = true;
    state.deathTimer = delay;
    state.velocityX = 0;
    state.velocityY = 0;
    if (death?.settings.disableCollision !== false) state.object.collisionEnabled = false;
    if (death?.settings.disableLogic !== false) state.object.logicEnabled = false;

    const lootDropper = componentOf(state.object, "loot-dropper");
    if (lootDropper && String(lootDropper.settings.trigger ?? "death") === "death") {
      const receiverName = String(lootDropper.settings.receiverName ?? "").trim();
      const receiver = [...runtimeObjectsRef.current.values()].find((candidate) => receiverName ? candidate.object.name === receiverName : Boolean(componentOf(candidate.object, "reward-receiver") || componentOf(candidate.object, "player-input")));
      if (receiver) grantRuntimeLoot(receiver, String(lootDropper.settings.lootTableId ?? ""));
    }
    const experienceReward = Math.max(0, Number(death?.settings.experienceAward ?? death?.settings.experienceReward ?? 0));
    if (experienceReward > 0) {
      const receiver = [...runtimeObjectsRef.current.values()].find((candidate) => candidate !== state && Boolean(componentOf(candidate.object, "experience")));
      if (receiver) awardRuntimeExperience(receiver, experienceReward);
    }
    recordQuestProgress("defeat", state.object.id, 1, state);
    runtimeLog(`${state.object.name} was defeated.`, "event");
    if (delay <= 0 && (death?.settings.destroyObject !== false && death?.settings.destroy !== false || legacyHealth?.settings.destroyOnDeath === true)) {
      state.destroyed = true;
      state.enabled = false;
    }
  }

  function executeRuleActions(rule: EventRuleDocument, actions: EventRuleDocument["actions"]): void {
    for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
      const action = actions[actionIndex];
      if (action.type === "wait") {
        const remainingActions = actions.slice(actionIndex + 1);
        if (remainingActions.length > 0) {
          window.setTimeout(
            () => executeRuleActions(rule, remainingActions),
            Math.max(0, Number(action.durationMs ?? action.value ?? 0)),
          );
        }
        return;
      }

      const state = action.objectId ? runtimeObjectsRef.current.get(action.objectId) : undefined;
      if (action.type === "set-object-enabled" && state) {
        const nextEnabled = Boolean(action.value);
        const changed = state.enabled !== nextEnabled;
        state.enabled = nextEnabled;
        state.object.enabled = nextEnabled;
        persistentObjectStateRef.current.set(state.object.id, { enabled: nextEnabled, destroyed: state.destroyed });
        const visual = visualRef.current.get(state.object.id);
        if (visual) visual.group.visible = nextEnabled && !state.destroyed;
        if (changed) fireRules(nextEnabled ? "object-enabled" : "object-disabled", state.object.id, null);
      } else if (action.type === "set-runtime-visible" && state) {
        state.object.runtimeVisible = Boolean(action.value);
        const visual = visualRef.current.get(state.object.id);
        if (visual) visual.group.visible = state.enabled && !state.destroyed && state.object.runtimeVisible !== false && !isRuntimeControllerOnly(state.object);
      } else if (action.type === "set-collision-enabled" && state) {
        state.object.collisionEnabled = Boolean(action.value);
      } else if (action.type === "set-logic-enabled" && state) {
        state.object.logicEnabled = Boolean(action.value);
      } else if ((action.type === "set-component-property" || action.type === "set-element-property") && state && action.componentType && action.propertyKey) {
        const component = state.object.components.find((candidate) => candidate.type === action.componentType);
        if (component) component.settings[action.propertyKey] = action.value;
      } else if (action.type === "set-health" && state && state.health !== null) {
        state.health = Number(action.value ?? 0);
        checkHealthState(state);
      } else if (action.type === "change-health" && state && state.health !== null) {
        state.health += Number(action.value ?? 0);
        checkHealthState(state);
      } else if (action.type === "destroy-object" && state) {
        state.destroyed = true;
        state.object.enabled = false;
        persistentObjectStateRef.current.set(state.object.id, { enabled: false, destroyed: true });
        const visual = visualRef.current.get(state.object.id);
        if (visual) visual.group.visible = false;
      } else if (action.type === "move-object" && state) {
        state.x += action.x;
        state.y += action.y;
      } else if (action.type === "set-object-position" && state) {
        state.x = action.x;
        state.y = action.y;
      } else if (action.type === "set-variable") {
        runtimeVariablesRef.current[action.key] = action.value;
        refreshRuntimeUi();
        fireRules("variable-changed", null, null);
      } else if (action.type === "play-animation" && state) {
        state.forcedClipId = action.clipId;
        state.activeClipId = null;
        state.animationFrame = 0;
        state.animationDirection = 1;
        state.animationElapsed = 0;
      } else if (action.type === "stop-animation" && state) {
        state.forcedClipId = null;
        state.activeClipId = null;
        state.animationFrame = 0;
        state.animationDirection = 1;
        state.animationElapsed = 0;
      } else if (action.type === "change-scene" && action.sceneId) {
        const shouldAutoSave = projectRef.current.settings.autoSaveOnSceneChange;
        if (shouldAutoSave) saveRuntimeState();
        fireRules("scene-ended", null, null);
        stopRuntimeAudio();
        initializeRuntimeScene(action.sceneId, true, action.key);
        if (shouldAutoSave) saveRuntimeState();
        runtimeLog(`Event “${rule.name}” changed scene.`, "event");
        void rebuildWorld();
        return;
      } else if (action.type === "give-item") {
        const requested = Math.max(1, Number(action.value ?? 1));
        const added = addRuntimeItem(action.key, requested);
        if (added < requested) runtimeLog(`Inventory accepted ${added} of ${requested} × ${action.key}.`, "warning");
      } else if (action.type === "remove-item") {
        removeRuntimeItem(action.key, Math.max(1, Number(action.value ?? 1)));
      } else if (action.type === "play-sound" && state) {
        void playRuntimeAudio(state);
      } else if (action.type === "stop-sound") {
        stopRuntimeAudio(action.objectId ?? undefined);
      } else if (action.type === "set-camera-zoom") {
        const cameraElement = cameraElementForState(activeRuntimeCameraState());
        if (cameraElement) cameraElement.settings.zoom = Number(action.value ?? 1);
        cameraRef.current.zoom = cameraEffectiveZoom(cameraElement);
        applyCamera();
      } else if (action.type === "set-camera-fov") {
        const cameraElement = cameraElementForState(activeRuntimeCameraState());
        cameraFovRef.current = clampCameraFov(Number(action.value ?? 60));
        if (cameraElement) cameraElement.settings.fieldOfView = cameraFovRef.current;
        cameraRef.current.zoom = cameraEffectiveZoom(cameraElement);
        applyCamera();
      } else if (action.type === "shake-camera") {
        cameraShakeRef.current = {
          remainingMs: Math.max(0, Number(action.durationMs ?? 450)),
          amplitude: Math.max(0, Number(action.value ?? 8)),
          phase: 0,
        };
      } else if (action.type === "show-ui" && state) {
        state.enabled = true;
        state.object.enabled = true;
        refreshRuntimeUi();
      } else if (action.type === "hide-ui" && state) {
        state.enabled = false;
        state.object.enabled = false;
        refreshRuntimeUi();
      } else if (action.type === "set-text" && state) {
        const textElement = state.object.components.find((element) => element.type === "ui-text");
        if (textElement) textElement.settings.text = action.value;
        refreshRuntimeUi();
      } else if (action.type === "save-game") {
        saveRuntimeState();
      } else if (action.type === "load-game") {
        if (loadRuntimeState()) return;
      } else if (action.type === "deal-damage" && state) {
        applyRuntimeDamage(state, Math.max(0, Number(action.value ?? 0)), action.key || action.objectId || state.object.id, action.message || "physical", action.key === "ignore-team");
      } else if (action.type === "heal" && state) {
        applyRuntimeDamage(state, Math.max(0, Number(action.value ?? 0)), action.objectId || state.object.id, "healing", true);
      } else if (action.type === "apply-status" && state) {
        applyRuntimeStatus(state, action.key || String(action.value ?? ""), action.objectId || state.object.id, Number(action.durationMs ?? 0) / 1000 || undefined);
      } else if (action.type === "remove-status" && state) {
        state.statuses = state.statuses.filter((status) => status.id !== (action.key || String(action.value ?? "")));
      } else if (action.type === "cast-ability" && state) {
        const target = action.key ? runtimeObjectsRef.current.get(action.key) ?? null : null;
        void requestRuntimeAbility(state, String(action.value ?? action.message ?? ""), target);
      } else if (action.type === "set-ai-state" && state) {
        setRuntimeAiState(state, String(action.value ?? action.message ?? "Idle"), `Event rule ${rule.name}`);
      } else if (action.type === "award-experience" && state) {
        awardRuntimeExperience(state, Math.max(0, Number(action.value ?? 0)));
      } else if (action.type === "add-currency" && state) {
        const currencyId = action.key || "coins";
        state.currencies[currencyId] = Math.max(0, (state.currencies[currencyId] ?? 0) + Number(action.value ?? 0));
      } else if (action.type === "roll-loot-table" && state) {
        grantRuntimeLoot(state, action.key || String(action.value ?? ""));
      } else if (action.type === "spawn-prefab") {
        spawnRuntimePrefab(action.key || String(action.value ?? ""), action.x, action.y);
      } else if (action.type === "emit-script-event" && state) {
        runRuntimeScripts(state, "on_event", { name: action.key || action.message, value: action.value });
      } else if (action.type === "debug-message") {
        const message = action.message || rule.name;
        useEditorStore.getState().setStatus(message, "runtime");
        runtimeLog(message, "event");
      }
    }
  }

  function fireRules(type: EventRuleDocument["trigger"]["type"], sourceId: string | null, targetId: string | null): void {
    const currentProject = projectRef.current;
    for (const rule of currentProject.eventRules) {
      if (!rule.enabled || rule.trigger.type !== type) continue;
      if (rule.trigger.sourceObjectId && rule.trigger.sourceObjectId !== sourceId) continue;
      if (rule.trigger.targetObjectId && rule.trigger.targetObjectId !== targetId) continue;
      if (!conditionPasses(rule)) continue;

      runtimeLog(`Rule fired: ${rule.name}`, "event");
      executeRuleActions(rule, rule.actions);
    }
  }

  function intersectsSolidTilemap(bounds: Aabb): boolean {
    const palette = new Map<string, ProjectDocument["tilePalette"][number]>(projectRef.current.tilePalette.map((tile) => [tile.id, tile]));
    for (const tilemapState of runtimeObjectsRef.current.values()) {
      if (!tilemapState.enabled || tilemapState.destroyed) continue;
      const tilemap = tilemapState.object.components.find((element) => element.type === "tilemap-renderer" && element.enabled);
      if (!tilemap || tilemap.settings.collisionEnabled === false) continue;
      const tileWidth = Math.max(1, Number(tilemap.settings.tileWidth ?? 32));
      const tileHeight = Math.max(1, Number(tilemap.settings.tileHeight ?? 32));
      const mapWidth = Math.max(1, Number(tilemap.settings.mapWidth ?? 24));
      const mapHeight = Math.max(1, Number(tilemap.settings.mapHeight ?? 14));
      const originX = tilemapState.x - mapWidth * tileWidth / 2;
      const originY = tilemapState.y - mapHeight * tileHeight / 2;
      let cells: Record<string, string> = {};
      try {
        cells = JSON.parse(String(tilemap.settings.cells ?? "{}")) as Record<string, string>;
      } catch {
        continue;
      }
      const firstColumn = Math.max(0, Math.floor((bounds.left - originX) / tileWidth));
      const lastColumn = Math.min(mapWidth - 1, Math.floor((bounds.right - originX - 0.001) / tileWidth));
      const firstRow = Math.max(0, Math.floor((bounds.top - originY) / tileHeight));
      const lastRow = Math.min(mapHeight - 1, Math.floor((bounds.bottom - originY - 0.001) / tileHeight));
      for (let row = firstRow; row <= lastRow; row += 1) {
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          const tile = palette.get(cells[`${column},${row}`]);
          if (tile?.collision !== "solid") continue;
          const tileBounds: Aabb = {
            left: originX + column * tileWidth,
            right: originX + (column + 1) * tileWidth,
            top: originY + row * tileHeight,
            bottom: originY + (row + 1) * tileHeight,
          };
          if (intersects(bounds, tileBounds)) return true;
        }
      }
    }
    return false;
  }

  function approachValue(current: number, target: number, maximumDelta: number): number {
    if (current < target) return Math.min(target, current + maximumDelta);
    if (current > target) return Math.max(target, current - maximumDelta);
    return target;
  }

  function isDynamicRuntimeState(state: RuntimeObjectState): boolean {
    return colliderBehavior(state.object) === "dynamic" || state.object.components.some((element) => element.enabled && ["player-input", "rigidbody-2d", "projectile", "wander", "chase-target", "follow-target", "patrol"].includes(element.type));
  }

  function stateIsGrounded(state: RuntimeObjectState): boolean {
    const bounds = colliderBounds(state.object, state.x, state.y + 2);
    if (!bounds) return false;
    if (intersectsSolidTilemap(bounds)) return true;
    return [...runtimeObjectsRef.current.values()].some((candidate) => {
      if (candidate === state || !candidate.enabled || candidate.destroyed) return false;
      const collider = colliderFor(candidate.object);
      if (!collider || colliderBehavior(candidate.object) !== "static") return false;
      if (!layersInteract(projectRef.current, colliderLayer(state.object), colliderLayer(candidate.object))) return false;
      const obstacle = colliderBounds(candidate.object, candidate.x, candidate.y);
      return Boolean(obstacle && intersects(bounds, obstacle));
    });
  }

  function recordCombatCalculation(calculation: ReturnType<typeof calculateDamage>, sourceName: string, targetName: string): void {
    runtimeCombatLogRef.current = [...runtimeCombatLogRef.current.slice(-199), {
      id: `combat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: performance.now(),
      sourceName,
      targetName,
      damageTypeId: calculation.damageTypeId,
      baseAmount: calculation.baseAmount,
      resistance: calculation.resistance,
      critical: calculation.critical,
      shieldAbsorbed: calculation.shieldAbsorbed,
      finalAmount: calculation.finalAmount,
      healing: calculation.healing,
    }];
  }

  function scriptHostFor(state: RuntimeObjectState, callback: LeonisScriptCallback | string) {
    return {
      getVariable: (key: string): JsonPrimitive => runtimeVariablesRef.current[key] ?? null,
      setVariable: (key: string, value: JsonPrimitive): void => { runtimeVariablesRef.current[key] = value; fireRules("variable-changed", state.object.id, null); },
      getHealthPercent: (): number => state.health === null || !state.maximumHealth ? 100 : state.health / state.maximumHealth * 100,
      damage: (amount: number, damageTypeId = "physical"): void => applyRuntimeDamage(state, amount, state.object.id, damageTypeId, true),
      heal: (amount: number): void => applyRuntimeDamage(state, amount, state.object.id, "healing", true),
      setAiState: (nextState: string): void => setRuntimeAiState(state, nextState, `Shadowium Script ${callback}`),
      castAbility: (abilityId: string): void => { void requestRuntimeAbility(state, abilityId, null); },
      addCurrency: (currencyId: string, amount: number): void => { state.currencies[currencyId] = Math.max(0, (state.currencies[currencyId] ?? 0) + amount); },
      awardExperience: (amount: number): void => awardRuntimeExperience(state, amount),
      emit: (eventName: string, value?: JsonPrimitive): void => { runtimeVariablesRef.current.__scriptEvent = eventName; runtimeVariablesRef.current.__scriptValue = value ?? null; fireRules("script-event", state.object.id, null); },
      log: (message: string): void => runtimeLog(`[${state.object.name}] ${message}`, "event"),
    };
  }

  function runRuntimeScripts(state: RuntimeObjectState, callback: LeonisScriptCallback | string, args: Record<string, JsonPrimitive> = {}): void {
    if (projectRef.current.settings.scriptingEnabled === false || state.object.logicEnabled === false) return;
    const scriptComponents = state.object.components.filter((component) => component.enabled && component.type === "script")
      .sort((left, right) => Number(left.settings.executionOrder ?? 0) - Number(right.settings.executionOrder ?? 0));
    for (const component of scriptComponents) {
      const scriptId = String(component.settings.scriptId ?? "").trim();
      const script = projectRef.current.scripts.find((candidate) => candidate.id === scriptId && candidate.enabled);
      if (!script) continue;
      let compiled = runtimeScriptCacheRef.current.get(script.id);
      if (!compiled) {
        compiled = compileLeonisScript(script);
        runtimeScriptCacheRef.current.set(script.id, compiled);
      }
      const result = runLeonisScript(compiled, { callback, arguments: args, operationLimit: Number(component.settings.operationLimit ?? 10000) }, scriptHostFor(state, callback));
      for (const error of result.errors) {
        const entry: RuntimeScriptErrorEntry = {
          id: `script-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: performance.now(),
          objectId: state.object.id,
          scriptId,
          callback,
          line: error.line,
          message: error.message,
        };
        runtimeScriptErrorsRef.current = [...runtimeScriptErrorsRef.current.slice(-99), entry];
        runtimeLog(`Script ${script.name}, line ${error.line}: ${error.message}`, "error");
      }
    }
  }

  function applyRuntimeStatus(target: RuntimeObjectState, statusEffectId: string, sourceObjectId: string, duration?: number): void {
    const definition = projectRef.current.statusEffects.find((candidate) => candidate.id === statusEffectId);
    if (!definition || !componentOf(target.object, "status-receiver")) return;
    const receiver = componentOf(target.object, "status-receiver");
    if (parseList(receiver?.settings.immunities).includes(statusEffectId)) return;
    target.statuses = applyOrStackStatus(target.statuses, definition, sourceObjectId, duration === undefined ? undefined : duration * Number(receiver?.settings.durationMultiplier ?? 1));
    fireRules("status-applied", sourceObjectId, target.object.id);
    runtimeLog(`${definition.name} applied to ${target.object.name}.`, "event");
  }

  function applyRuntimeDamage(target: RuntimeObjectState, amount: number, sourceId: string, damageTypeId = "physical", ignoreTeam = false): void {
    if (target.health === null || amount <= 0 || target.destroyed) return;
    const source = runtimeObjectsRef.current.get(sourceId) ?? target;
    const healing = projectRef.current.damageTypes.find((candidate) => candidate.id === damageTypeId)?.healing === true || damageTypeId === "healing";
    if (!healing && !ignoreTeam && source !== target && !teamsAreHostile(source.object, target.object)) return;
    const now = performance.now() / 1000;
    if (!healing && now < target.invulnerableUntil) return;
    const cooldownUntil = target.hitCooldowns[sourceId] ?? 0;
    if (!healing && now < cooldownUntil) return;
    const dealer = componentOf(source.object, "damage-dealer") ?? componentOf(source.object, "hitbox") ?? componentOf(source.object, "attack");
    const healthComponent = componentOf(target.object, "health");
    target.hitCooldowns[sourceId] = now + Math.max(0, Number(dealer?.settings.cooldown ?? dealer?.settings.hitCooldown ?? 0.25));
    const invulnerability = componentOf(target.object, "invulnerability");
    target.invulnerableUntil = now + Math.max(0, Number(invulnerability?.settings.duration ?? healthComponent?.settings.invulnerabilityTime ?? 0));
    const calculation = calculateDamage({
      project: projectRef.current,
      source: source.object,
      target: target.object,
      baseAmount: amount,
      damageTypeId,
      targetStatuses: target.statuses,
      sourceStats: source.stats,
      targetShield: target.shield,
    });
    if (calculation.healing) {
      target.health = Math.min(target.maximumHealth ?? Number.POSITIVE_INFINITY, target.health + calculation.finalAmount);
    } else {
      target.shield = Math.max(0, target.shield - calculation.shieldAbsorbed);
      target.shieldRegenerationDelay = Math.max(target.shieldRegenerationDelay, Number(componentOf(target.object, "shield")?.settings.regenerationDelay ?? 0));
      target.health = Math.max(0, target.health - calculation.finalAmount);
    }
    const receiver = componentOf(target.object, "damage-receiver");
    if (!calculation.healing && receiver?.settings.flashOnHit !== false) target.hitFlashRemaining = 0.14;
    const knockback = Math.max(0, Number(dealer?.settings.knockback ?? dealer?.settings.knockbackForce ?? 0));
    if (!calculation.healing && source && knockback > 0) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.hypot(dx, dy) || 1;
      target.velocityX += dx / length * knockback;
      target.velocityY += dy / length * knockback;
    }
    recordCombatCalculation(calculation, source.object.name, target.object.name);
    if (calculation.healing) runtimeLog(`${source.object.name} healed ${target.object.name} for ${Math.round(calculation.finalAmount)}.`, "event");
    else runtimeLog(`${source.object.name} dealt ${Math.round(calculation.finalAmount)} ${damageTypeId} damage to ${target.object.name}${calculation.critical ? " (critical)" : ""}.`, "event");
    fireRules(calculation.healing ? "damage-received" : "damage-dealt", source.object.id, target.object.id);
    if (!calculation.healing) {
      fireRules("damage-received", target.object.id, source.object.id);
      runRuntimeScripts(target, "on_damage", { amount: calculation.finalAmount, damage_type: damageTypeId, source_id: source.object.id });
    }
    checkHealthState(target);
    refreshRuntimeUi();
  }

  function awardRuntimeExperience(state: RuntimeObjectState, amount: number): void {
    if (amount <= 0 || !componentOf(state.object, "experience")) return;
    state.experience += amount;
    const experienceComponent = componentOf(state.object, "experience");
    const levelComponent = componentOf(state.object, "level");
    const curve = projectRef.current.experienceCurves.find((candidate) => candidate.id === String(experienceComponent?.settings.curveId ?? "default")) ?? projectRef.current.experienceCurves[0];
    const maxLevel = Math.max(1, Number(levelComponent?.settings.maximumLevel ?? curve?.maximumLevel ?? 100));
    while (state.level < maxLevel) {
      const required = experienceRequired(curve, state.level);
      if (state.experience < required) break;
      state.experience -= required;
      state.level += 1;
      fireRules("level-up", state.object.id, null);
      runtimeLog(`${state.object.name} reached level ${state.level}.`, "event");
      for (const entry of parseList(levelComponent?.settings.growthStats)) {
        const [statId, amountText] = entry.split(":");
        if (statId?.trim()) state.stats[statId.trim()] = Number(state.stats[statId.trim()] ?? 0) + Number(amountText ?? 0);
      }
      if (levelComponent?.settings.restoreResourcesOnLevel !== false) {
        if (state.maximumHealth !== null) state.health = state.maximumHealth;
        for (const [resourceId, maximum] of Object.entries(state.resourceMaximums)) state.resources[resourceId] = maximum;
      }
    }
  }

  function grantRuntimeLoot(receiver: RuntimeObjectState, tableId: string): void {
    const table = projectRef.current.lootTables.find((candidate) => candidate.id === tableId);
    if (!table) return;
    const results = rollLootTable(projectRef.current, table, runtimeVariablesRef.current);
    for (const result of results) {
      if (result.kind === "item") addRuntimeItem(result.referenceId, result.amount);
      else if (result.kind === "currency") receiver.currencies[result.referenceId] = Math.max(0, (receiver.currencies[result.referenceId] ?? 0) + result.amount);
      else if (result.kind === "experience") awardRuntimeExperience(receiver, result.amount);
      else if (result.kind === "prefab") runtimeLog(`Loot requested Game Object recipe ${result.referenceId} ×${result.amount}.`, "event");
      fireRules("loot-dropped", receiver.object.id, null);
      runtimeLog(`Loot: ${result.referenceId} ×${result.amount}.`, "event");
    }
  }

  function setRuntimeAiState(state: RuntimeObjectState, nextState: string, reason: string, decision?: RuntimeAiDecision): void {
    if (!nextState || nextState === state.aiState) return;
    const previousState = state.aiState;
    state.aiPreviousState = previousState;
    state.aiState = nextState;
    fireRules("ai-state-exited", state.object.id, null);
    fireRules("ai-state-entered", state.object.id, null);
    runtimeAiTraceRef.current = [...runtimeAiTraceRef.current.slice(-199), {
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: performance.now(),
      objectId: state.object.id,
      objectName: state.object.name,
      previousState,
      nextState,
      reason,
      targetObjectId: decision?.targetObjectId ?? state.aiTargetId,
      distance: decision?.distance ?? Number.POSITIVE_INFINITY,
      lineOfSight: decision?.lineOfSight ?? false,
      healthPercent: decision?.healthPercent ?? (state.health === null || !state.maximumHealth ? 100 : state.health / state.maximumHealth * 100),
    }];
  }

  async function requestRuntimeAbility(caster: RuntimeObjectState, abilityId: string, explicitTarget: RuntimeObjectState | null): Promise<boolean> {
    const ability = projectRef.current.abilities.find((candidate) => candidate.id === abilityId);
    if (!ability || !componentOf(caster.object, "ability-user") || caster.activeCast) return false;
    if ((caster.cooldowns[ability.id] ?? 0) > 0) return false;
    const resource = caster.resources[ability.resourceId] ?? 0;
    if (ability.resourceCost > resource) return false;
    caster.resources[ability.resourceId] = resource - ability.resourceCost;
    caster.activeCast = {
      abilityId: ability.id,
      phase: "casting",
      remainingSeconds: Math.max(0, ability.castTimeSeconds),
      targetObjectId: explicitTarget?.object.id ?? caster.aiTargetId,
      targetX: explicitTarget?.x ?? caster.x,
      targetY: explicitTarget?.y ?? caster.y,
    };
    fireRules("ability-cast", caster.object.id, explicitTarget?.object.id ?? null);
    runtimeLog(`${caster.object.name} started casting ${ability.name}.`, "event");
    if (caster.activeCast.remainingSeconds <= 0) executeRuntimeAbility(caster);
    return true;
  }

  function executeRuntimeAbility(caster: RuntimeObjectState): void {
    const cast = caster.activeCast;
    if (!cast) return;
    const ability = projectRef.current.abilities.find((candidate) => candidate.id === cast.abilityId);
    if (!ability) { caster.activeCast = null; return; }
    const explicitTarget = cast.targetObjectId ? runtimeObjectsRef.current.get(cast.targetObjectId) ?? null : null;
    const targets = selectAbilityTargets(ability, caster, [...runtimeObjectsRef.current.values()], explicitTarget, cast.targetX, cast.targetY);
    for (const effect of ability.effects) {
      const effectTargets = ability.targetingMode === "self" ? [caster] : targets;
      for (const target of effectTargets) {
        if (effect.type === "damage") applyRuntimeDamage(target, effect.amount, caster.object.id, effect.damageTypeId || "arcane");
        else if (effect.type === "heal") applyRuntimeDamage(target, effect.amount, caster.object.id, "healing", true);
        else if (effect.type === "apply-status") applyRuntimeStatus(target, effect.statusEffectId, caster.object.id, effect.durationSeconds);
        else if (effect.type === "remove-status") target.statuses = target.statuses.filter((status) => status.id !== effect.statusEffectId);
        else if (effect.type === "knockback" || effect.type === "pull") {
          const direction = effect.type === "pull" ? -1 : 1;
          const dx = target.x - caster.x, dy = target.y - caster.y, length = Math.hypot(dx, dy) || 1;
          target.velocityX += dx / length * effect.amount * direction;
          target.velocityY += dy / length * effect.amount * direction;
        } else if (effect.type === "teleport") {
          caster.x = cast.targetX;
          caster.y = cast.targetY;
        } else if (effect.type === "dash") {
          const dx = cast.targetX - caster.x;
          const dy = cast.targetY - caster.y;
          const length = Math.hypot(dx, dy) || 1;
          caster.velocityX += dx / length * Math.max(1, effect.amount || 260);
          caster.velocityY += dy / length * Math.max(1, effect.amount || 260);
        } else if (effect.type === "spawn-prefab" || effect.type === "summon") {
          const spawnX = effect.type === "summon" ? cast.targetX : caster.x;
          const spawnY = effect.type === "summon" ? cast.targetY : caster.y;
          const spawned = spawnRuntimePrefab(effect.prefabId, spawnX, spawnY);
          if (spawned && componentOf(spawned.object, "projectile")) {
            const dx = cast.targetX - caster.x;
            const dy = cast.targetY - caster.y;
            const length = Math.hypot(dx, dy) || 1;
            const projectile = componentOf(spawned.object, "projectile");
            const speed = Math.max(1, Number(projectile?.settings.speed ?? effect.amount ?? 320));
            spawned.velocityX = dx / length * speed;
            spawned.velocityY = dy / length * speed;
          }
        } else if (effect.type === "modify-stat" && effect.statId) {
          target.stats[effect.statId] = Number(target.stats[effect.statId] ?? 0) + effect.amount;
        } else if (effect.type === "set-variable") runtimeVariablesRef.current[effect.statId || ability.id] = effect.value;
        else if (effect.type === "screen-effect") cameraShakeRef.current = { remainingMs: Math.max(150, effect.durationSeconds * 1000), amplitude: Math.max(1, effect.amount || 6), phase: 0 };
      }
    }
    caster.cooldowns[ability.id] = Math.max(0, ability.cooldownSeconds);
    caster.activeCast = null;
    fireRules("ability-finished", caster.object.id, explicitTarget?.object.id ?? null);
    runtimeLog(`${caster.object.name} completed ${ability.name}.`, "event");
  }

  function updatePhase8State(state: RuntimeObjectState, deltaSeconds: number): void {
    if (state.deathHandled && !state.destroyed) {
      state.deathTimer = Math.max(0, state.deathTimer - deltaSeconds);
      if (state.deathTimer <= 0) {
        const death = componentOf(state.object, "death-behaviour");
        if (death?.settings.respawn === true) {
          respawnRuntimeState(state);
          state.deathHandled = false;
          state.object.collisionEnabled = true;
          state.object.logicEnabled = true;
          state.aiState = String(componentOf(state.object, "ai-controller")?.settings.initialState ?? "Idle");
        } else if (death?.settings.destroyObject !== false && death?.settings.destroy !== false || componentOf(state.object, "health")?.settings.destroyOnDeath === true) {
          state.destroyed = true;
          state.enabled = false;
        }
      }
      return;
    }
    for (const key of Object.keys(state.cooldowns)) state.cooldowns[key] = Math.max(0, state.cooldowns[key] - deltaSeconds);
    state.attackCooldownRemaining = Math.max(0, state.attackCooldownRemaining - deltaSeconds);
    state.shieldRegenerationDelay = Math.max(0, state.shieldRegenerationDelay - deltaSeconds);
    const shieldComponent = componentOf(state.object, "shield");
    if (shieldComponent && state.shieldRegenerationDelay <= 0 && state.shield < state.maximumShield) state.shield = Math.min(state.maximumShield, state.shield + Math.max(0, Number(shieldComponent.settings.regenerationPerSecond ?? 0)) * deltaSeconds);
    if (state.health !== null && state.maximumHealth !== null && state.health > 0 && state.health < state.maximumHealth) {
      const healthRegeneration = Math.max(0, Number(state.stats["health-regeneration"] ?? state.stats.healthRegeneration ?? 0));
      if (healthRegeneration > 0) state.health = Math.min(state.maximumHealth, state.health + healthRegeneration * deltaSeconds);
    }
    const resourceComponents = state.object.components.filter((component) => component.enabled && component.type === "resource-pool");
    for (const resource of resourceComponents) {
      const id = String(resource.settings.resourceId ?? "mana").trim() || "mana";
      state.resourceRegenerationDelay[id] = Math.max(0, Number(state.resourceRegenerationDelay[id] ?? 0) - deltaSeconds);
      if ((state.resourceRegenerationDelay[id] ?? 0) <= 0) {
        const maximum = state.resourceMaximums[id] ?? Number(resource.settings.maximum ?? 100);
        const overflowMaximum = resource.settings.allowOverflow === true ? Number.POSITIVE_INFINITY : maximum;
        state.resources[id] = Math.min(overflowMaximum, (state.resources[id] ?? 0) + Number(resource.settings.regenerationPerSecond ?? 0) * deltaSeconds);
      }
    }
    const statusUpdate = updateStatuses(state.statuses, projectRef.current.statusEffects, deltaSeconds);
    state.statuses = statusUpdate.statuses;
    for (const tick of statusUpdate.ticks) if (tick.status.damagePerTick > 0) applyRuntimeDamage(state, tick.status.damagePerTick * tick.stacks, tick.sourceObjectId, tick.status.damageTypeId, true);
    if (state.activeCast) {
      state.activeCast.remainingSeconds -= deltaSeconds;
      if (state.activeCast.remainingSeconds <= 0) executeRuntimeAbility(state);
    }
    const abilityUser = componentOf(state.object, "ability-user");
    if (abilityUser && componentOf(state.object, "player-input")) {
      const abilityIds = parseList(abilityUser.settings.abilityIds);
      for (const abilityId of abilityIds) {
        const ability = projectRef.current.abilities.find((candidate) => candidate.id === abilityId);
        if (ability && getActionKeys(projectRef.current, ability.activationActionId).some((key) => justPressedRef.current.has(key))) {
          const target = [...runtimeObjectsRef.current.values()].filter((candidate) => candidate !== state && candidate.enabled && !candidate.destroyed && teamsAreHostile(state.object, candidate.object)).sort((left, right) => Math.hypot(left.x - state.x, left.y - state.y) - Math.hypot(right.x - state.x, right.y - state.y))[0] ?? null;
          void requestRuntimeAbility(state, abilityId, target);
        }
      }
    }
    const scripts = state.object.components.filter((component) => component.enabled && component.type === "script");
    for (const scriptComponent of scripts) {
      const scriptId = String(scriptComponent.settings.scriptId ?? "");
      if (!state.scriptsStarted.has(scriptId)) {
        state.scriptsStarted.add(scriptId);
        runRuntimeScripts(state, "on_start");
      }
    }
    if (scripts.length) runRuntimeScripts(state, "on_update", { delta: deltaSeconds });
  }

  function processPhase8Ai(deltaSeconds: number): void {
    const states = [...runtimeObjectsRef.current.values()].filter((state) => state.enabled && !state.destroyed && componentOf(state.object, "ai-controller"));
    for (const state of states) {
      state.aiDecisionElapsed += deltaSeconds;
      const vision = componentOf(state.object, "vision-sensor");
      const proximity = componentOf(state.object, "proximity-sensor");
      const detectionRange = Math.max(Number(vision?.settings.range ?? 0), Number(proximity?.settings.radius ?? 0), 64);
      const candidates = [...runtimeObjectsRef.current.values()].filter((candidate) => candidate !== state && candidate.enabled && !candidate.destroyed && teamsAreHostile(state.object, candidate.object));
      const target = candidates.map((candidate) => ({ candidate, distance: Math.hypot(candidate.x - state.x, candidate.y - state.y) })).filter((entry) => entry.distance <= detectionRange).sort((left, right) => left.distance - right.distance)[0]?.candidate ?? (state.aiTargetId ? runtimeObjectsRef.current.get(state.aiTargetId) ?? null : null);
      state.aiTargetId = target?.object.id ?? null;
      const lineOfSight = Boolean(target && (!vision || Math.hypot(target.x - state.x, target.y - state.y) <= Number(vision.settings.range ?? 320)));
      if (state.aiDecisionElapsed >= Math.max(0.05, Number(componentOf(state.object, "ai-controller")?.settings.decisionInterval ?? 0.15))) {
        state.aiDecisionElapsed = 0;
        const decision = chooseAiDecision({ object: state.object, currentState: state.aiState, health: state.health, maximumHealth: state.maximumHealth ?? 100, target, x: state.x, y: state.y, lineOfSight });
        state.blackboard.targetId = decision.targetObjectId;
        state.blackboard.distance = Number.isFinite(decision.distance) ? decision.distance : -1;
        state.blackboard.lineOfSight = decision.lineOfSight;
        state.blackboard.healthPercent = decision.healthPercent;
        setRuntimeAiState(state, decision.nextState, decision.reason, decision);
      }
      if (!target) continue;
      const dx = target.x - state.x, dy = target.y - state.y, distance = Math.hypot(dx, dy) || 1;
      const speedMultiplier = statusSpeedMultiplier(state.statuses, projectRef.current.statusEffects);
      if (state.aiState === "Chase") {
        const speed = Number(componentOf(state.object, "chase-target")?.settings.speed ?? componentOf(state.object, "navigation-agent")?.settings.speed ?? 100) * speedMultiplier;
        resolveMovement(state, dx / distance * speed * deltaSeconds, dy / distance * speed * deltaSeconds);
      } else if (state.aiState === "Flee") {
        const speed = Number(componentOf(state.object, "flee-target")?.settings.speed ?? 140) * speedMultiplier;
        resolveMovement(state, -dx / distance * speed * deltaSeconds, -dy / distance * speed * deltaSeconds);
      } else if (state.aiState === "Attack" && state.attackCooldownRemaining <= 0) {
        const attack = componentOf(state.object, "attack-target") ?? componentOf(state.object, "attack");
        const abilityId = String(attack?.settings.abilityId ?? "").trim();
        if (abilityId && componentOf(state.object, "ability-user")) void requestRuntimeAbility(state, abilityId, target);
        else applyRuntimeDamage(target, Number(attack?.settings.damage ?? componentOf(state.object, "damage-dealer")?.settings.damage ?? 10), state.object.id, String(attack?.settings.damageTypeId ?? "physical"));
        state.attackCooldownRemaining = Math.max(0.05, Number(attack?.settings.cooldown ?? 1));
      }
    }
  }

  function processRuntimeJoints(deltaSeconds: number): void {
    for (const state of runtimeObjectsRef.current.values()) {
      for (const joint of state.object.components.filter((component) => component.enabled && ["fixed-joint", "distance-joint", "spring-joint", "rope-joint", "prismatic-joint", "revolute-joint"].includes(component.type))) {
        const connectedName = String(joint.settings.connectedObjectName ?? "").trim();
        const connected = [...runtimeObjectsRef.current.values()].find((candidate) => candidate.object.name === connectedName);
        if (!connected) continue;
        const dx = state.x - connected.x, dy = state.y - connected.y, distance = Math.hypot(dx, dy) || 1;
        if (joint.type === "fixed-joint") {
          state.x = connected.x + Number(joint.settings.offsetX ?? state.originX - connected.originX);
          state.y = connected.y + Number(joint.settings.offsetY ?? state.originY - connected.originY);
        } else if (joint.type === "rope-joint") {
          const maximum = Math.max(0, Number(joint.settings.maximumLength ?? 160));
          if (distance > maximum) { state.x = connected.x + dx / distance * maximum; state.y = connected.y + dy / distance * maximum; }
        } else if (joint.type === "distance-joint" || joint.type === "spring-joint") {
          const desired = Math.max(0, Number(joint.settings.distance ?? joint.settings.restLength ?? 96));
          const stiffness = Math.max(0, Number(joint.settings.stiffness ?? 8));
          const correction = (distance - desired) * Math.min(1, stiffness * deltaSeconds);
          state.x -= dx / distance * correction;
          state.y -= dy / distance * correction;
        } else if (joint.type === "prismatic-joint") {
          const axisX = Number(joint.settings.axisX ?? 1), axisY = Number(joint.settings.axisY ?? 0), axisLength = Math.hypot(axisX, axisY) || 1;
          const normalizedX = axisX / axisLength, normalizedY = axisY / axisLength;
          const projection = Math.max(Number(joint.settings.minimum ?? -64), Math.min(Number(joint.settings.maximum ?? 64), dx * normalizedX + dy * normalizedY));
          state.x = connected.x + normalizedX * projection;
          state.y = connected.y + normalizedY * projection;
        }
      }
    }
  }


  function respawnRuntimeState(state: RuntimeObjectState): void {
    const checkpointScene = String(runtimeVariablesRef.current.__checkpointScene ?? runtimeSceneIdRef.current ?? "");
    if (checkpointScene && checkpointScene !== runtimeSceneIdRef.current && projectRef.current.scenes.some((scene) => scene.id === checkpointScene)) {
      initializeRuntimeScene(checkpointScene, true, String(runtimeVariablesRef.current.__checkpointId ?? ""));
      void rebuildWorld();
      return;
    }
    const checkpointX = Number(runtimeVariablesRef.current.__checkpointX);
    const checkpointY = Number(runtimeVariablesRef.current.__checkpointY);
    state.x = Number.isFinite(checkpointX) ? checkpointX : state.originX;
    state.y = Number.isFinite(checkpointY) ? checkpointY : state.originY;
    state.velocityX = 0;
    state.velocityY = 0;
    state.invulnerableUntil = 0;
    state.hitFlashRemaining = 0;
    const health = state.object.components.find((element) => element.type === "health" && element.enabled);
    if (health) {
      state.maximumHealth = Math.max(0, Number(state.stats["maximum-health"] ?? health.settings.maximumHealth ?? 100));
      state.health = Math.min(state.maximumHealth, Number(health.settings.startingHealth ?? state.maximumHealth));
      state.healthZeroFired = false;
    }
    state.shield = state.maximumShield;
    state.statuses = [];
    state.deathHandled = false;
    state.deathTimer = 0;
    state.object.collisionEnabled = true;
    state.object.logicEnabled = true;
    state.aiState = String(componentOf(state.object, "ai-controller")?.settings.initialState ?? "Idle");
    for (const [resourceId, maximum] of Object.entries(state.resourceMaximums)) state.resources[resourceId] = maximum;
    runtimeCameraNeedsSnapRef.current = true;
    refreshRuntimeUi();
  }

  function currentSpriteFrameForState(state: RuntimeObjectState): SpriteFrame | null {
    if (state.activeClipId) {
      const clip = projectRef.current.animations.find((candidate) => candidate.id === state.activeClipId);
      const reference = clip?.frames[state.animationFrame];
      const asset = clip ? projectRef.current.assets.find((candidate) => candidate.id === clip.assetId) : undefined;
      const frame = reference ? asset?.frames.find((candidate) => candidate.id === reference.frameId) : undefined;
      if (frame) return frame;
    }
    const renderer = componentOf(state.object, "sprite-renderer");
    const assetId = String(renderer?.settings.assetId ?? "");
    const asset = projectRef.current.assets.find((candidate) => candidate.id === assetId);
    return asset ? frameForAsset(asset, String(renderer?.settings.frameId ?? "")) ?? null : null;
  }

  function applySpriteSocketAttachment(state: RuntimeObjectState, parent: RuntimeObjectState): boolean {
    const attachment = componentOf(state.object, "sprite-socket-attachment");
    if (!attachment) return false;
    const socketName = String(attachment.settings.socketName ?? "").trim();
    if (!socketName) return false;
    const frame = currentSpriteFrameForState(parent);
    const socket = frame?.sockets?.find((candidate) => candidate.name === socketName);
    if (!frame || !socket) return false;

    const framePivotX = Number(frame.pivotX ?? 0.5);
    const framePivotY = Number(frame.pivotY ?? 0.5);
    const sourceLocalX = socket.x - frame.width * framePivotX;
    const sourceLocalY = socket.y - frame.height * framePivotY;
    const visualScaleX = parent.object.size.width / Math.max(1, frame.width);
    const visualScaleY = parent.object.size.height / Math.max(1, frame.height);
    const scaledX = sourceLocalX * visualScaleX * parent.object.transform.scale.x;
    const scaledY = sourceLocalY * visualScaleY * parent.object.transform.scale.y;
    const radians = parent.object.transform.rotation * Math.PI / 180;
    const rotatedX = scaledX * Math.cos(radians) - scaledY * Math.sin(radians);
    const rotatedY = scaledX * Math.sin(radians) + scaledY * Math.cos(radians);
    const offsetX = Number(attachment.settings.offsetX ?? 0);
    const offsetY = Number(attachment.settings.offsetY ?? 0);
    state.x = parent.x + rotatedX + offsetX;
    state.y = parent.y + rotatedY + offsetY;

    const visual = visualRef.current.get(state.object.id);
    if (visual && attachment.settings.inheritRotation !== false) {
      visual.group.rotation = (parent.object.transform.rotation + socket.rotation + Number(attachment.settings.rotationOffset ?? 0)) * Math.PI / 180;
    }
    return true;
  }

  function applyRuntimeHierarchy(frameStart: Map<string, { x: number; y: number }>): void {
    const states = [...runtimeObjectsRef.current.values()];
    const byId = runtimeObjectsRef.current;
    const depthOf = (state: RuntimeObjectState): number => {
      let depth = 0;
      let parentId = state.object.parentId;
      const visited = new Set<string>();
      while (parentId && !visited.has(parentId) && depth < 64) {
        visited.add(parentId);
        const parent = byId.get(parentId);
        if (!parent) break;
        depth += 1;
        parentId = parent.object.parentId;
      }
      return depth;
    };
    states.sort((left, right) => depthOf(left) - depthOf(right));
    for (const state of states) {
      const parentId = state.object.parentId;
      if (!parentId) continue;
      const parent = byId.get(parentId);
      const parentStart = frameStart.get(parentId);
      if (!parent || !parentStart || !parent.enabled || parent.destroyed) continue;
      if (applySpriteSocketAttachment(state, parent)) continue;
      state.x += parent.x - parentStart.x;
      state.y += parent.y - parentStart.y;
    }
  }

  function updateBuiltInRuntime(state: RuntimeObjectState, deltaSeconds: number, pressed: Set<string>): boolean {
    if (state.object.logicEnabled === false) return false;
    state.age += deltaSeconds;
    state.behaviorElapsed += deltaSeconds;
    state.hitFlashRemaining = Math.max(0, state.hitFlashRemaining - deltaSeconds);
    let moving = false;

    for (const counter of state.object.components.filter((element) => element.type === "counter" && element.enabled)) {
      const variable = String(counter.settings.variable ?? "counter").trim();
      if (!variable) continue;
      const minimum = Number(counter.settings.minimum ?? 0);
      const maximum = Math.max(minimum, Number(counter.settings.maximum ?? 100));
      const current = Number(runtimeVariablesRef.current[variable] ?? counter.settings.startingValue ?? minimum);
      runtimeVariablesRef.current[variable] = Math.max(minimum, Math.min(maximum, Number.isFinite(current) ? current : minimum));
    }

    const lifetime = state.object.components.find((element) => element.type === "lifetime" && element.enabled);
    const projectile = state.object.components.find((element) => element.type === "projectile" && element.enabled);
    const lifeDuration = Number(projectile?.settings.lifetime ?? lifetime?.settings.duration ?? Number.POSITIVE_INFINITY);
    if (state.age >= lifeDuration) {
      if (projectile || lifetime?.settings.destroy !== false) state.destroyed = true;
      else state.enabled = false;
      return false;
    }

    const timer = state.object.components.find((element) => element.type === "timer" && element.enabled);
    if (timer && timer.settings.startOnScene !== false) {
      const duration = Math.max(0.01, Number(timer.settings.duration ?? 1));
      const remaining = Math.max(0, duration - (state.behaviorElapsed % duration));
      const variable = String(timer.settings.variable ?? "").trim();
      if (variable) runtimeVariablesRef.current[variable] = remaining;
      if (!state.timerCompleted && state.behaviorElapsed >= duration) {
        state.timerCompleted = true;
        fireRules("timer-completed", state.object.id, null);
        runtimeLog(`Timer completed: ${state.object.name}.`, "event");
        if (timer.settings.loop === true) {
          state.behaviorElapsed = 0;
          state.timerCompleted = false;
        }
      }
    }

    const movingPlatform = state.object.components.find((element) => element.type === "moving-platform" && element.enabled);
    if (movingPlatform) {
      const offsetX = Number(movingPlatform.settings.offsetX ?? 160);
      const offsetY = Number(movingPlatform.settings.offsetY ?? 0);
      const distance = Math.max(1, Math.hypot(offsetX, offsetY));
      const speed = Math.max(0, Number(movingPlatform.settings.speed ?? 80));
      const travelDuration = speed <= 0 ? Number.POSITIVE_INFINITY : distance / speed;
      const waitTime = Math.max(0, Number(movingPlatform.settings.waitTime ?? 0.25));
      const pingPong = movingPlatform.settings.pingPong !== false;
      let phase = 0;
      if (Number.isFinite(travelDuration)) {
        if (pingPong) {
          const cycleDuration = travelDuration * 2 + waitTime * 2;
          const time = state.age % Math.max(0.001, cycleDuration);
          if (time < travelDuration) phase = time / travelDuration;
          else if (time < travelDuration + waitTime) phase = 1;
          else if (time < travelDuration * 2 + waitTime) phase = 1 - (time - travelDuration - waitTime) / travelDuration;
          else phase = 0;
        } else {
          phase = Math.min(1, state.age / Math.max(0.001, travelDuration));
        }
      }
      const previousX = state.x;
      const previousY = state.y;
      const previousBounds = colliderBounds(state.object, previousX, previousY);
      state.x = state.originX + offsetX * phase;
      state.y = state.originY + offsetY * phase;
      const platformDeltaX = state.x - previousX;
      const platformDeltaY = state.y - previousY;
      moving = Math.abs(platformDeltaX) + Math.abs(platformDeltaY) > 0.001;
      if (moving && previousBounds && movingPlatform.settings.carryBodies !== false) {
        const margin = Math.max(2, Math.abs(platformDeltaY) + 3);
        for (const passenger of runtimeObjectsRef.current.values()) {
          if (passenger === state || !passenger.enabled || passenger.destroyed || !isDynamicRuntimeState(passenger)) continue;
          const passengerBounds = colliderBounds(passenger.object, passenger.x, passenger.y);
          if (!passengerBounds) continue;
          const horizontallySupported = passengerBounds.right > previousBounds.left + 1 && passengerBounds.left < previousBounds.right - 1;
          const standingOnPlatform = horizontallySupported && Math.abs(passengerBounds.bottom - previousBounds.top) <= margin;
          if (standingOnPlatform) {
            passenger.x += platformDeltaX;
            passenger.y += platformDeltaY;
          }
        }
      }
    }

    if (projectile) {
      let directionX = Number(projectile.settings.directionX ?? 1);
      let directionY = Number(projectile.settings.directionY ?? 0);
      const length = Math.hypot(directionX, directionY) || 1;
      directionX /= length;
      directionY /= length;
      const speed = Number(projectile.settings.speed ?? 480);
      const previousX = state.x;
      const previousY = state.y;
      resolveMovement(state, directionX * speed * deltaSeconds, directionY * speed * deltaSeconds);
      moving = true;
      if (Math.abs(state.x - previousX) < 0.001 && Math.abs(state.y - previousY) < 0.001) state.destroyed = true;
    }

    const platformer = state.object.components.find((element) => element.type === "platformer-movement" && element.enabled);
    const rigidbody = state.object.components.find((element) => element.type === "rigidbody-2d" && element.enabled);
    const input = state.object.components.find((element) => element.type === "player-input" && element.enabled && element.settings.acceptInput !== false);
    if (platformer && rigidbody && rigidbody.settings.bodyType !== "static") {
      let horizontal = 0;
      if (input && !runtimeDialogueRef.current) {
        if (actionPressed(projectRef.current, String(input.settings.moveLeftAction ?? "move-left"), pressed)) horizontal -= 1;
        if (actionPressed(projectRef.current, String(input.settings.moveRightAction ?? "move-right"), pressed)) horizontal += 1;
        if (actionPressed(projectRef.current, "jump", justPressedRef.current)) state.jumpBufferRemaining = Number(platformer.settings.jumpBuffer ?? 0.12);
      }
      state.grounded = stateIsGrounded(state);
      state.coyoteRemaining = state.grounded ? Number(platformer.settings.coyoteTime ?? 0.12) : Math.max(0, state.coyoteRemaining - deltaSeconds);
      state.jumpBufferRemaining = Math.max(0, state.jumpBufferRemaining - deltaSeconds);
      if (state.jumpBufferRemaining > 0 && state.coyoteRemaining > 0) {
        state.velocityY = -Math.abs(Number(platformer.settings.jumpVelocity ?? 520));
        state.jumpBufferRemaining = 0;
        state.coyoteRemaining = 0;
        state.grounded = false;
      }
      const maximumSpeed = Number(platformer.settings.speed ?? 260);
      const acceleration = Number(horizontal === 0 ? platformer.settings.deceleration ?? 2400 : platformer.settings.acceleration ?? 1800) * (state.grounded ? 1 : Number(platformer.settings.airControl ?? 0.7));
      state.velocityX = approachValue(state.velocityX, horizontal * maximumSpeed, acceleration * deltaSeconds);
      const scene = currentViewportScene();
      state.velocityX += scene.gravityX * Number(rigidbody.settings.gravityScale ?? 1) * deltaSeconds;
      state.velocityY = Math.min(Number(platformer.settings.maxFallSpeed ?? 900), state.velocityY + scene.gravityY * Number(rigidbody.settings.gravityScale ?? 1) * deltaSeconds);
      if (rigidbody.settings.freezeX === true) state.velocityX = 0;
      if (rigidbody.settings.freezeY === true) state.velocityY = 0;
      const previousX = state.x;
      const previousY = state.y;
      resolveMovement(state, state.velocityX * deltaSeconds, state.velocityY * deltaSeconds);
      if (Math.abs(state.x - previousX) < Math.abs(state.velocityX * deltaSeconds) * 0.5) state.velocityX = 0;
      if (Math.abs(state.y - previousY) < Math.abs(state.velocityY * deltaSeconds) * 0.5) state.velocityY = 0;
      moving = Math.abs(state.velocityX) > 1 || Math.abs(state.velocityY) > 1;
      if (horizontal < 0) state.lastDirection = "left";
      if (horizontal > 0) state.lastDirection = "right";
    } else if (rigidbody && rigidbody.settings.bodyType === "dynamic" && !projectile) {
      const scene = currentViewportScene();
      const gravityScale = Number(rigidbody.settings.gravityScale ?? 1);
      state.velocityX += scene.gravityX * gravityScale * deltaSeconds;
      state.velocityY += scene.gravityY * gravityScale * deltaSeconds;
      const drag = Math.max(0, Number(rigidbody.settings.linearDrag ?? 0));
      const dragFactor = Math.max(0, 1 - drag * deltaSeconds);
      state.velocityX *= dragFactor;
      state.velocityY *= dragFactor;
      if (rigidbody.settings.freezeX === true) state.velocityX = 0;
      if (rigidbody.settings.freezeY === true) state.velocityY = 0;
      const previousX = state.x;
      const previousY = state.y;
      resolveMovement(state, state.velocityX * deltaSeconds, state.velocityY * deltaSeconds);
      if (Math.abs(state.x - previousX) < Math.abs(state.velocityX * deltaSeconds) * 0.5) state.velocityX = 0;
      if (Math.abs(state.y - previousY) < Math.abs(state.velocityY * deltaSeconds) * 0.5) state.velocityY = 0;
      moving = moving || Math.abs(state.velocityX) + Math.abs(state.velocityY) > 1;
    }

    const phase8Ai = Boolean(componentOf(state.object, "ai-controller"));
    const chase = state.object.components.find((element) => element.type === "chase-target" && element.enabled)
      ?? state.object.components.find((element) => element.type === "follow-target" && element.enabled);
    if (chase && !platformer && !phase8Ai) {
      const targetName = String(chase.settings.targetName ?? "Player");
      const target = [...runtimeObjectsRef.current.values()].find((candidate) => candidate.enabled && !candidate.destroyed && candidate.object.name === targetName)
        ?? [...runtimeObjectsRef.current.values()].find((candidate) => candidate.object.components.some((element) => element.type === "player-input" && element.enabled));
      if (target) {
        const dx = target.x - state.x;
        const dy = target.y - state.y;
        const distance = Math.hypot(dx, dy);
        const detectionRange = Number(chase.settings.detectionRange ?? Number.POSITIVE_INFINITY);
        const stopDistance = Number(chase.settings.stopDistance ?? chase.settings.minimumDistance ?? 32);
        if (distance > stopDistance && distance <= detectionRange) {
          const speed = Number(chase.settings.speed ?? state.object.components.find((element) => element.type === "top-down-movement")?.settings.speed ?? 110);
          resolveMovement(state, dx / distance * speed * deltaSeconds, dy / distance * speed * deltaSeconds);
          moving = true;
        }
      }
    }

    const wander = state.object.components.find((element) => element.type === "wander" && element.enabled);
    if (wander && !platformer && !phase8Ai) {
      const interval = Math.max(0.1, Number(wander.settings.changeInterval ?? 1.5));
      const step = Math.floor(state.age / interval);
      const seed = [...state.object.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const angle = ((seed * 0.61803398875 + step * 2.39996323) % (Math.PI * 2));
      state.behaviorDirectionX = Math.cos(angle);
      state.behaviorDirectionY = Math.sin(angle);
      const radius = Number(wander.settings.radius ?? 180);
      const homeDistance = Math.hypot(state.x - state.originX, state.y - state.originY);
      if (homeDistance > radius) {
        state.behaviorDirectionX = (state.originX - state.x) / Math.max(1, homeDistance);
        state.behaviorDirectionY = (state.originY - state.y) / Math.max(1, homeDistance);
      }
      const speed = Number(wander.settings.speed ?? 70);
      resolveMovement(state, state.behaviorDirectionX * speed * deltaSeconds, state.behaviorDirectionY * speed * deltaSeconds);
      moving = speed > 0;
    }

    const patrolPath = state.object.components.find((element) => element.type === "patrol-path" && element.enabled);
    if (patrolPath && !platformer && !wander && (!phase8Ai || state.aiState === "Patrol")) {
      let points: { x: number; y: number }[] = [];
      try {
        const parsed = JSON.parse(String(patrolPath.settings.points ?? "[]"));
        if (Array.isArray(parsed)) points = parsed.filter((point) => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))).map((point) => ({ x: Number(point.x), y: Number(point.y) }));
      } catch {
        points = [];
      }
      if (points.length > 0) {
        state.patrolPathIndex = Math.max(0, Math.min(points.length - 1, state.patrolPathIndex));
        const point = points[state.patrolPathIndex];
        const absolute = patrolPath.settings.relativeToStart !== false;
        const targetX = absolute ? state.originX + point.x : point.x;
        const targetY = absolute ? state.originY + point.y : point.y;
        const dx = targetX - state.x;
        const dy = targetY - state.y;
        const remaining = Math.hypot(dx, dy);
        const speed = Math.max(0, Number(patrolPath.settings.speed ?? 90));
        if (state.waitRemaining > 0) state.waitRemaining = Math.max(0, state.waitRemaining - deltaSeconds);
        else if (remaining <= Math.max(2, speed * deltaSeconds)) {
          state.x = targetX; state.y = targetY;
          const mode = String(patrolPath.settings.mode ?? "loop");
          if (mode === "ping-pong") {
            if (state.patrolPathDirection > 0 && state.patrolPathIndex >= points.length - 1) state.patrolPathDirection = -1;
            else if (state.patrolPathDirection < 0 && state.patrolPathIndex <= 0) state.patrolPathDirection = 1;
            state.patrolPathIndex = Math.max(0, Math.min(points.length - 1, state.patrolPathIndex + state.patrolPathDirection));
          } else if (mode === "once") {
            if (state.patrolPathIndex >= points.length - 1) state.patrolCompleted = true;
            else state.patrolPathIndex += 1;
          } else state.patrolPathIndex = (state.patrolPathIndex + 1) % points.length;
          state.waitRemaining = Math.max(0, Number(patrolPath.settings.waitTime ?? 0));
        } else if (speed > 0) {
          resolveMovement(state, dx / Math.max(0.001, remaining) * speed * deltaSeconds, dy / Math.max(0.001, remaining) * speed * deltaSeconds);
          state.lastDirection = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
          moving = true;
        }
      }
    }

    const patrol = state.object.components.find((element) => element.type === "patrol" && element.enabled);
    if (patrol && !platformer && !wander && (!chase || phase8Ai) && (!phase8Ai || state.aiState === "Patrol") && !state.patrolCompleted) {
      const movement = state.object.components.find((element) => element.type === "top-down-movement" && element.enabled);
      const speed = Math.max(0, Number(patrol.settings.speed ?? movement?.settings.speed ?? 80));
      const distance = Math.max(0, Number(patrol.settings.distance ?? 128));
      const axis = String(patrol.settings.axis ?? "horizontal");
      const targetX = state.originX + (axis === "horizontal" && state.movingForward ? distance : 0);
      const targetY = state.originY + (axis === "vertical" && state.movingForward ? distance : 0);
      if (state.waitRemaining > 0) {
        state.waitRemaining = Math.max(0, state.waitRemaining - deltaSeconds);
      } else {
        const dx = targetX - state.x;
        const dy = targetY - state.y;
        const remaining = Math.hypot(dx, dy);
        if (remaining <= Math.max(1, speed * deltaSeconds)) {
          state.x = targetX;
          state.y = targetY;
          if (state.movingForward && patrol.settings.loop === false) state.patrolCompleted = true;
          else state.movingForward = !state.movingForward;
          state.waitRemaining = Math.max(0, Number(patrol.settings.waitTime ?? 1));
        } else if (speed > 0) {
          resolveMovement(state, dx / remaining * speed * deltaSeconds, dy / remaining * speed * deltaSeconds);
          if (Math.abs(dx) >= Math.abs(dy)) state.lastDirection = dx < 0 ? "left" : "right";
          else state.lastDirection = dy < 0 ? "up" : "down";
          moving = true;
        }
      }
    }

    return moving;
  }

  function resolveMovement(state: RuntimeObjectState, deltaX: number, deltaY: number): void {
    const moverCollider = colliderFor(state.object);
    const movementElement = state.object.components.find((element) => element.type === "top-down-movement");
    const collisionEnabled = movementElement?.settings.collisionEnabled !== false;
    if (!moverCollider || !collisionEnabled) {
      state.x += deltaX;
      state.y += deltaY;
      return;
    }

    const staticStates = [...runtimeObjectsRef.current.values()].filter((candidate) => {
      if (candidate === state || candidate.destroyed || !candidate.enabled) return false;
      const collider = colliderFor(candidate.object);
      return (
        collider !== undefined && colliderBehavior(candidate.object) === "static" &&
        layersInteract(
          projectRef.current,
          colliderLayer(state.object),
          colliderLayer(candidate.object),
        )
      );
    });

    let nextX = state.x + deltaX;
    for (const obstacle of staticStates) {
      const movingBounds = colliderBounds(state.object, nextX, state.y);
      const obstacleBounds = colliderBounds(obstacle.object, obstacle.x, obstacle.y);
      if (!movingBounds || !obstacleBounds || !collidersIntersect(state.object, nextX, state.y, obstacle.object, obstacle.x, obstacle.y)) continue;
      const oneWay = obstacle.object.components.find((element) => element.type === "one-way-platform" && element.enabled);
      if (oneWay) {
        const direction = String(oneWay.settings.direction ?? "top");
        const previousBounds = colliderBounds(state.object, state.x, state.y);
        const margin = Number(oneWay.settings.margin ?? 6);
        const blocksFromLeft = direction === "left" && deltaX > 0 && Boolean(previousBounds && previousBounds.right <= obstacleBounds.left + margin);
        const blocksFromRight = direction === "right" && deltaX < 0 && Boolean(previousBounds && previousBounds.left >= obstacleBounds.right - margin);
        if (!blocksFromLeft && !blocksFromRight) continue;
      }
      const offsetX = Number(moverCollider.settings.offsetX ?? 0) * state.object.transform.scale.x;
      const halfWidth = colliderHalfSize(state.object).width;
      if (deltaX > 0) nextX = obstacleBounds.left - halfWidth - offsetX;
      if (deltaX < 0) nextX = obstacleBounds.right + halfWidth - offsetX;
    }
    const horizontalBounds = colliderBounds(state.object, nextX, state.y);
    if (horizontalBounds && intersectsSolidTilemap(horizontalBounds)) nextX = state.x;
    state.x = nextX;

    let nextY = state.y + deltaY;
    for (const obstacle of staticStates) {
      const movingBounds = colliderBounds(state.object, state.x, nextY);
      const obstacleBounds = colliderBounds(obstacle.object, obstacle.x, obstacle.y);
      if (!movingBounds || !obstacleBounds || !collidersIntersect(state.object, state.x, nextY, obstacle.object, obstacle.x, obstacle.y)) continue;
      const oneWay = obstacle.object.components.find((element) => element.type === "one-way-platform" && element.enabled);
      if (oneWay) {
        const direction = String(oneWay.settings.direction ?? "top");
        const previousBounds = colliderBounds(state.object, state.x, state.y);
        const margin = Number(oneWay.settings.margin ?? 6);
        const blocksFromTop = direction === "top" && deltaY > 0 && Boolean(previousBounds && previousBounds.bottom <= obstacleBounds.top + margin);
        const blocksFromBottom = direction === "bottom" && deltaY < 0 && Boolean(previousBounds && previousBounds.top >= obstacleBounds.bottom - margin);
        if (!blocksFromTop && !blocksFromBottom) continue;
      }
      const offsetY = Number(moverCollider.settings.offsetY ?? 0) * state.object.transform.scale.y;
      const halfHeight = colliderHalfSize(state.object).height;
      if (deltaY > 0) nextY = obstacleBounds.top - halfHeight - offsetY;
      if (deltaY < 0) nextY = obstacleBounds.bottom + halfHeight - offsetY;
    }
    const verticalBounds = colliderBounds(state.object, state.x, nextY);
    if (verticalBounds && intersectsSolidTilemap(verticalBounds)) nextY = state.y;
    state.y = nextY;
  }

  function setDialogue(next: RuntimeDialogueState | null): void {
    runtimeDialogueRef.current = next;
    setRuntimeDialogue(next);
    if (next) setInteractionPrompt(null);
  }

  function setDialogueGraphNode(graphId: string, nodeId: string | null): void {
    const graph = projectRef.current.dialogues.find((candidate) => candidate.id === graphId);
    const node = graph?.nodes.find((candidate) => candidate.id === nodeId);
    if (!graph || !node) { setDialogue(null); return; }
    const visibleChoices = node.choices.filter((choice) => !choice.conditionKey || Boolean(runtimeVariablesRef.current[choice.conditionKey]));
    setDialogue({
      speaker: node.speaker || graph.name,
      lines: [runtimeText(node.text)],
      index: 0,
      textColor: "#ffffff",
      graphId: graph.id,
      nodeId: node.id,
      choices: visibleChoices.map((choice) => ({ id: choice.id, label: runtimeText(choice.label), nextId: choice.nextId })),
    });
  }

  function chooseDialogue(choiceId: string): void {
    const current = runtimeDialogueRef.current;
    if (!current?.graphId || !current.nodeId) return;
    const graph = projectRef.current.dialogues.find((candidate) => candidate.id === current.graphId);
    const node = graph?.nodes.find((candidate) => candidate.id === current.nodeId);
    const choice = node?.choices.find((candidate) => candidate.id === choiceId);
    if (!choice) return;
    setDialogueGraphNode(current.graphId, choice.nextId);
  }

  function advanceDialogue(): void {
    const current = runtimeDialogueRef.current;
    if (!current) return;
    if (current.choices?.length) return;
    if (current.graphId && current.nodeId) {
      const graph = projectRef.current.dialogues.find((candidate) => candidate.id === current.graphId);
      const node = graph?.nodes.find((candidate) => candidate.id === current.nodeId);
      setDialogueGraphNode(current.graphId, node?.nextId ?? null);
      return;
    }
    if (current.index + 1 >= current.lines.length) {
      setDialogue(null);
      return;
    }
    setDialogue({ ...current, index: current.index + 1 });
  }

  function saveRuntimeState(): void {
    const currentProject = projectRef.current;
    const saveKey = `shadowium-save:${currentProject.metadata.id}`;
    let previousObjects: Record<string, RuntimeSavedObjectState> = {};
    try {
      const previousRaw = localStorage.getItem(saveKey);
      if (previousRaw) {
        const previous = JSON.parse(previousRaw) as Partial<RuntimeSaveDocument> & { objects?: Record<string, RuntimeSavedObjectState> | Array<[string, RuntimeSavedObjectState]> };
        previousObjects = Array.isArray(previous.objects) ? Object.fromEntries(previous.objects) : { ...(previous.objects ?? {}) };
      }
    } catch {
      previousObjects = {};
    }
    const objects: Record<string, RuntimeSavedObjectState> = { ...previousObjects };
    for (const state of runtimeObjectsRef.current.values()) {
      const saveState = state.object.components.find((element) => element.type === "save-state" && element.enabled);
      const pickup = state.object.components.find((element) => element.type === "item-pickup" && element.enabled);
      const shouldSave = Boolean(saveState || pickup?.settings.persistent === true || state.object.components.some((element) => element.type === "player-input" && element.enabled));
      if (!shouldSave) continue;
      const saveEnabledState = saveState?.settings.saveEnabled !== false || pickup?.settings.persistent === true;
      objects[runtimeObjectSaveKey(state)] = {
        enabled: saveEnabledState ? state.enabled : state.object.enabled,
        destroyed: saveEnabledState ? state.destroyed : false,
        x: saveState?.settings.saveTransform === true ? state.x : undefined,
        y: saveState?.settings.saveTransform === true ? state.y : undefined,
        health: saveState?.settings.saveHealth !== false ? state.health : undefined,
        sourceSceneId: state.sourceSceneId,
        object: saveState?.settings.persistAcrossScenes === true || state.object.components.some((element) => element.type === "player-input" && element.enabled) ? cloneObject(state.object) : undefined,
      };
    }
    const document: RuntimeSaveDocument = {
      version: 1,
      variables: { ...runtimeVariablesRef.current },
      inventory: { ...runtimeInventoryRef.current },
      objects,
      sceneId: runtimeSceneIdRef.current,
    };
    localStorage.setItem(saveKey, JSON.stringify(document));
    useEditorStore.getState().setStatus("Runtime save written", "runtime");
    runtimeLog(`Saved ${Object.keys(objects).length} persistent objects.`, "event");
  }

  function loadRuntimeState(): boolean {
    const currentProject = projectRef.current;
    const saveKey = `shadowium-save:${currentProject.metadata.id}`;
    const raw = localStorage.getItem(saveKey);
    if (!raw) {
      runtimeLog("No runtime save exists for this project.", "warning");
      return false;
    }
    try {
      const parsed = JSON.parse(raw) as RuntimeSaveDocument | { variables?: Record<string, JsonPrimitive>; inventory?: Record<string, number>; objects?: Array<[string, { enabled: boolean; destroyed: boolean }]>; sceneId?: string };
      const sceneId = String(parsed.sceneId || currentProject.settings.initialSceneId);
      stopRuntimeAudio();
      runtimeObjectsRef.current.clear();
      initializeRuntimeScene(sceneId, false);
      runtimeVariablesRef.current = { ...currentProject.variables, ...(parsed.variables ?? {}) };
      runtimeInventoryRef.current = { ...(parsed.inventory ?? {}) };
      const savedObjects: Record<string, RuntimeSavedObjectState> = Array.isArray(parsed.objects)
        ? Object.fromEntries(parsed.objects)
        : (parsed.objects ?? {});
      for (const [key, saved] of Object.entries(savedObjects)) {
        let state = [...runtimeObjectsRef.current.values()].find((candidate) => runtimeObjectSaveKey(candidate) === key);
        if (!state && saved.object) {
          const object = cloneObject(saved.object);
          const restoredState = createRuntimeStateForObject(object, saved.sourceSceneId ?? sceneId);
          if (saved.health !== undefined) restoredState.health = saved.health;
          runtimeObjectsRef.current.set(object.id, restoredState);
          state = restoredState;
        }
        if (!state) continue;
        state.enabled = saved.enabled;
        state.destroyed = saved.destroyed;
        if (saved.x !== undefined) state.x = saved.x;
        if (saved.y !== undefined) state.y = saved.y;
        if (saved.health !== undefined) state.health = saved.health;
        persistentObjectStateRef.current.set(state.object.id, { enabled: saved.enabled, destroyed: saved.destroyed });
      }
      stopRuntimeAudio();
      startSceneAudio();
      refreshRuntimeUi();
      runtimeCameraNeedsSnapRef.current = true;
      runtimeLog(`Loaded runtime save in ${currentViewportScene().name}.`, "event");
      void rebuildWorld();
      return true;
    } catch (error) {
      const message = `Runtime save is invalid: ${error instanceof Error ? error.message : String(error)}`;
      useEditorStore.getState().setStatus(message, "warning");
      runtimeLog(message, "error");
      return false;
    }
  }

  function activateBuiltInGameplay(player: RuntimeObjectState, target: RuntimeObjectState): void {
    const dialogueController = target.object.components.find((element) => element.type === "dialogue-controller" && element.enabled);
    if (dialogueController && dialogueController.settings.startOnInteract !== false) {
      const graphId = String(dialogueController.settings.dialogueId ?? "").trim();
      const graph = projectRef.current.dialogues.find((candidate) => candidate.id === graphId);
      if (graph?.startNodeId) { recordQuestProgress("speak", target.object.id, 1, target); setDialogueGraphNode(graph.id, graph.startNodeId); return; }
    }
    const dialogue = target.object.components.find((element) => element.type === "dialogue-speaker" && element.enabled);
    if (dialogue) {
      const lines = String(dialogue.settings.dialogueText ?? "")
        .split(/\r?\n|\|/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length > 0) {
        recordQuestProgress("speak", target.object.id, 1, target);
        setDialogue({
          speaker: String(dialogue.settings.displayName ?? target.object.name),
          lines,
          index: 0,
          textColor: String(dialogue.settings.textColor ?? "#ffffff"),
        });
      }
      return;
    }

    const runtimeDoor = target.object.components.find((element) => element.type === "door" && element.enabled);
    if (runtimeDoor) {
      const openKey = `__doorOpen:${target.object.id}`;
      if (runtimeVariablesRef.current[openKey] !== true) {
        const requiredItemId = String(runtimeDoor.settings.requiredItemId ?? "").trim();
        const startsLocked = runtimeDoor.settings.startsLocked === true || requiredItemId.length > 0;
        if (startsLocked && requiredItemId && (runtimeInventoryRef.current[requiredItemId] ?? 0) <= 0) {
          const message = String(runtimeDoor.settings.lockedText ?? "Locked");
          useEditorStore.getState().setStatus(message, "runtime");
          runtimeLog(`${target.object.name}: ${message}`, "warning");
          return;
        }
        if (requiredItemId && runtimeDoor.settings.consumeItem === true) removeRuntimeItem(requiredItemId, 1);
        runtimeVariablesRef.current[openKey] = true;
        const openVariable = String(runtimeDoor.settings.openVariable ?? "").trim();
        if (openVariable) runtimeVariablesRef.current[openVariable] = true;
        if (runtimeDoor.settings.disableCollider !== false) {
          const collider = colliderFor(target.object);
          if (collider) collider.enabled = false;
        }
        const visual = visualRef.current.get(target.object.id);
        if (visual) visual.group.alpha = 0.42;
        refreshRuntimeUi();
        const openText = String(runtimeDoor.settings.openText ?? "Opened").trim();
        if (openText) useEditorStore.getState().setStatus(openText, "runtime");
        runtimeLog(`Opened door ${target.object.name}${openText ? `: ${openText}` : ""}.`, "event");
      }
    }

    const runtimeSwitch = target.object.components.find((element) => element.type === "switch" && element.enabled);
    if (runtimeSwitch) {
      const usedKey = `__switchUsed:${target.object.id}`;
      if (runtimeSwitch.settings.singleUse !== true || runtimeVariablesRef.current[usedKey] !== true) {
        const variable = String(runtimeSwitch.settings.variable ?? "switchOn").trim();
        const nextValue = runtimeSwitch.settings.toggle === false ? Boolean(runtimeSwitch.settings.value) : !Boolean(runtimeVariablesRef.current[variable]);
        runtimeVariablesRef.current[variable] = nextValue;
        runtimeVariablesRef.current[usedKey] = true;
        fireRules("variable-changed", target.object.id, null);
        refreshRuntimeUi();
        runtimeLog(`${target.object.name} set ${variable} to ${nextValue}.`, "event");
      }
    }

    const teleporter = target.object.components.find((element) => element.type === "teleporter" && element.enabled);
    if (teleporter && String(teleporter.settings.activation ?? "trigger-enter") === "interaction") {
      const sceneId = String(teleporter.settings.destinationSceneId ?? "").trim();
      const objectName = String(teleporter.settings.destinationObjectName ?? "").trim();
      if (sceneId && projectRef.current.scenes.some((scene) => scene.id === sceneId)) {
        initializeRuntimeScene(sceneId, true, String(teleporter.settings.destinationSpawnId ?? "default"));
        runtimeLog(`Teleported to ${currentViewportScene().name}.`, "event");
        void rebuildWorld();
        return;
      }
      const destination = [...runtimeObjectsRef.current.values()].find((state) => state.enabled && !state.destroyed && state.object.name === objectName);
      if (destination) {
        player.x = destination.x;
        player.y = destination.y;
        player.velocityX = 0;
        player.velocityY = 0;
        runtimeCameraNeedsSnapRef.current = true;
        runtimeLog(`Teleported ${player.object.name} to ${destination.object.name}.`, "event");
        return;
      }
    }

    const pickup = target.object.components.find((element) => element.type === "item-pickup" && element.enabled);
    if (pickup && !target.destroyed) {
      const itemId = String(pickup.settings.itemId ?? "item").trim();
      const amount = Math.max(1, Math.floor(Number(pickup.settings.amount ?? 1)));
      const added = addRuntimeItem(itemId, amount);
      if (added <= 0) {
        useEditorStore.getState().setStatus(`Inventory is full; ${target.object.name} was not collected`, "warning");
        runtimeLog(`Could not collect ${target.object.name}: no inventory capacity for ${itemId}.`, "warning");
        return;
      }
      const remainder = amount - added;
      if (remainder > 0) pickup.settings.amount = remainder;
      if (pickup.settings.destroyOnCollect !== false && remainder === 0) {
        target.destroyed = true;
        target.enabled = false;
        target.object.enabled = false;
        persistentObjectStateRef.current.set(target.object.id, { enabled: false, destroyed: true });
        const visual = visualRef.current.get(target.object.id);
        if (visual) visual.group.visible = false;
      }
      fireRules("item-collected", player.object.id, target.object.id);
      recordQuestProgress("collect", itemId, added, target);
      useEditorStore.getState().setStatus(`Collected ${added} × ${itemId}`, "runtime");
      runtimeLog(`Collected ${added} × ${itemId}${remainder > 0 ? `; ${remainder} could not fit` : ""}.`, remainder > 0 ? "warning" : "event");
    }

    const exit = target.object.components.find((element) => element.type === "scene-exit" && element.enabled);
    if (!exit) return;
    const requiredVariable = String(exit.settings.requiredVariable ?? "").trim();
    if (requiredVariable) {
      const expected = String(exit.settings.requiredValue ?? "true");
      if (String(runtimeVariablesRef.current[requiredVariable]) !== expected) {
        useEditorStore.getState().setStatus(`Scene exit requires ${requiredVariable} = ${expected}`, "runtime");
        return;
      }
    }
    const destinationSceneId = String(exit.settings.destinationSceneId ?? "");
    if (!projectRef.current.scenes.some((scene) => scene.id === destinationSceneId)) return;
    const shouldAutoSave = exit.settings.autoSave !== false && projectRef.current.settings.autoSaveOnSceneChange;
    if (shouldAutoSave) saveRuntimeState();
    fireRules("scene-ended", null, null);
    stopRuntimeAudio();
    const destinationSpawnId = String(exit.settings.destinationSpawnId ?? "");
    initializeRuntimeScene(destinationSceneId, true, destinationSpawnId);
    if (shouldAutoSave) saveRuntimeState();
    runtimeLog(`Exit ${target.object.name} loaded ${currentViewportScene().name}${destinationSpawnId ? ` at ${destinationSpawnId}` : ""}.`, "event");
    void rebuildWorld();
  }

  function processTriggers(): void {
    const states = [...runtimeObjectsRef.current.values()].filter((state) => state.enabled && !state.destroyed);
    const dynamic = states.filter(isDynamicRuntimeState);
    const triggers = states.filter((state) => {
      if (state.object.logicEnabled === false) return false;
      const collider = colliderFor(state.object);
      return collider?.type === "sensor" || collider?.settings.behavior === "trigger" || collider?.settings.sensor === true;
    });
    const currentPairs = new Set<string>();

    for (const source of dynamic) {
      const sourceBounds = colliderBounds(source.object, source.x, source.y);
      if (!sourceBounds) continue;
      for (const target of triggers) {
        if (!layersInteract(projectRef.current, colliderLayer(source.object), colliderLayer(target.object))) {
          continue;
        }
        const targetBounds = colliderBounds(target.object, target.x, target.y);
        if (!targetBounds || !runtimeObjectsOverlap(source.object, source.x, source.y, target.object, target.x, target.y)) continue;
        const key = `${source.object.id}|${target.object.id}`;
        currentPairs.add(key);
        if (!triggerPairsRef.current.has(key)) {
          fireRules("trigger-enter", source.object.id, target.object.id);
          recordQuestProgress("reach", target.object.id, 1, target);
          const cameraZone = target.object.components.find((element) => element.type === "camera-zone" && element.enabled);
          if (cameraZone) {
            activeCameraZoneRef.current = target.object.id;
            cameraFovRef.current = clampCameraFov(Number(cameraZone.settings.fieldOfView ?? 60));
            cameraRef.current.zoom = clampZoom(cameraZoomForFov(Number(cameraZone.settings.zoom ?? 1), cameraFovRef.current));
            runtimeLog(`Entered camera zone ${target.object.name}.`, "event");
            applyCamera();
          }
          const exit = target.object.components.find((element) => element.type === "scene-exit" && element.enabled);
          if (exit?.settings.activation === "trigger-enter") activateBuiltInGameplay(source, target);
          const pickup = target.object.components.find((element) => element.type === "item-pickup" && element.enabled);
          if (pickup?.settings.collectAutomatically === true) activateBuiltInGameplay(source, target);
          const checkpoint = target.object.components.find((element) => element.type === "checkpoint" && element.enabled);
          if (checkpoint) {
            runtimeVariablesRef.current.__checkpointScene = runtimeSceneIdRef.current ?? "";
            runtimeVariablesRef.current.__checkpointId = String(checkpoint.settings.checkpointId ?? target.object.id);
            runtimeVariablesRef.current.__checkpointX = target.x;
            runtimeVariablesRef.current.__checkpointY = target.y;
            if (checkpoint.settings.autoSave !== false) saveRuntimeState();
            runtimeLog(`Checkpoint activated: ${target.object.name}.`, "event");
          }
          const hazard = target.object.components.find((element) => element.type === "hazard" && element.enabled);
          if (hazard) {
            applyRuntimeDamage(source, Number(hazard.settings.damage ?? 25), target.object.id);
            if (hazard.settings.respawnOnHit === true || (source.health !== null && source.health <= 0)) respawnRuntimeState(source);
          }
          const teleporter = target.object.components.find((element) => element.type === "teleporter" && element.enabled);
          if (teleporter && String(teleporter.settings.activation ?? "trigger-enter") === "trigger-enter") {
            const destinationSceneId = String(teleporter.settings.destinationSceneId ?? "").trim();
            const destinationObjectName = String(teleporter.settings.destinationObjectName ?? "").trim();
            if (destinationSceneId && projectRef.current.scenes.some((candidate) => candidate.id === destinationSceneId)) {
              initializeRuntimeScene(destinationSceneId, true, String(teleporter.settings.destinationSpawnId ?? "default"));
              runtimeLog(`Teleported to ${currentViewportScene().name}.`, "event");
              void rebuildWorld();
              return;
            }
            const destination = states.find((candidate) => candidate.enabled && !candidate.destroyed && candidate.object.name === destinationObjectName);
            if (destination) {
              source.x = destination.x;
              source.y = destination.y;
              source.velocityX = 0;
              source.velocityY = 0;
              runtimeCameraNeedsSnapRef.current = true;
              runtimeLog(`Teleported ${source.object.name} to ${destination.object.name}.`, "event");
            }
          }
        }
      }
    }

    for (const key of triggerPairsRef.current) {
      if (!currentPairs.has(key)) {
        const [sourceId, targetId] = key.split("|");
        fireRules("trigger-exit", sourceId, targetId);
        const zoneState = runtimeObjectsRef.current.get(targetId);
        if (zoneState?.object.components.some((element) => element.type === "camera-zone" && element.enabled)) {
          activeCameraZoneRef.current = null;
          const cameraElement = cameraElementForState(activeRuntimeCameraState());
          cameraFovRef.current = clampCameraFov(Number(cameraElement?.settings.fieldOfView ?? 60));
          cameraRef.current.zoom = cameraEffectiveZoom(cameraElement);
          runtimeLog(`Exited camera zone ${zoneState.object.name}.`, "event");
          applyCamera();
        }
      }
    }
    triggerPairsRef.current = currentPairs;
  }

  function processDamageAndGameplay(): void {
    const states = [...runtimeObjectsRef.current.values()].filter((state) => state.enabled && !state.destroyed);
    const receivers = states.filter((state) => state.object.logicEnabled !== false && state.health !== null && Boolean(componentOf(state.object, "damage-receiver") || componentOf(state.object, "hurtbox") || componentOf(state.object, "health")));
    for (const dealerState of states) {
      if (dealerState.object.logicEnabled === false) continue;
      const hitbox = componentOf(dealerState.object, "hitbox");
      const legacyDealer = componentOf(dealerState.object, "damage-dealer");
      const attack = componentOf(dealerState.object, "attack");
      const inputActive = Boolean(attack && componentOf(dealerState.object, "player-input") && getActionKeys(projectRef.current, String(attack.settings.inputAction ?? "attack")).some((key) => justPressedRef.current.has(key)));
      const hitboxActive = Boolean(hitbox && (hitbox.settings.startActive === true || dealerState.aiState === "Attack" || inputActive));
      if (!legacyDealer && !hitboxActive) continue;
      const sourceComponent = hitboxActive ? hitbox : legacyDealer;
      const baseDamage = Number(sourceComponent?.settings.damage ?? attack?.settings.damage ?? 10);
      const damageTypeId = String(sourceComponent?.settings.damageTypeId ?? attack?.settings.damageTypeId ?? "physical");
      const targetTeams = parseList(sourceComponent?.settings.targetTeams);
      for (const receiver of receivers) {
        if (receiver === dealerState) continue;
        const targetTag = String(sourceComponent?.settings.targetTag ?? "").trim();
        if (targetTag && !receiver.object.tags.includes(targetTag)) continue;
        if (targetTeams.length && !targetTeams.includes(receiver.teamId) && !targetTeams.includes("*")) continue;
        if (colliderFor(dealerState.object) && colliderFor(receiver.object) && !layersInteract(projectRef.current, colliderLayer(dealerState.object), colliderLayer(receiver.object))) continue;
        if (!runtimeObjectsOverlap(dealerState.object, dealerState.x, dealerState.y, receiver.object, receiver.x, receiver.y)) continue;
        const hurtbox = componentOf(receiver.object, "hurtbox");
        const allowedDamageTypes = parseList(hurtbox?.settings.allowedDamageTypes);
        if (allowedDamageTypes.length && !allowedDamageTypes.includes(damageTypeId)) continue;
        const multiplier = Math.max(0, Number(hurtbox?.settings.damageMultiplier ?? 1));
        applyRuntimeDamage(receiver, baseDamage * multiplier, dealerState.object.id, damageTypeId);
        const statusEffectId = String(sourceComponent?.settings.statusEffectId ?? "").trim();
        if (statusEffectId) applyRuntimeStatus(receiver, statusEffectId, dealerState.object.id);
        if (sourceComponent?.settings.destroyOnHit === true || dealerState.object.components.some((component) => component.type === "projectile" && component.enabled)) {
          dealerState.destroyed = true;
          dealerState.enabled = false;
          const visual = visualRef.current.get(dealerState.object.id);
          if (visual) visual.group.visible = false;
          break;
        }
      }
    }

    const continuousHazards = states.filter((state) => state.object.logicEnabled !== false && state.object.components.some((component) => component.type === "hazard" && component.enabled && component.settings.continuous === true));
    for (const hazardState of continuousHazards) {
      const hazard = componentOf(hazardState.object, "hazard");
      for (const receiver of receivers) {
        if (receiver === hazardState) continue;
        if (!runtimeObjectsOverlap(hazardState.object, hazardState.x, hazardState.y, receiver.object, receiver.x, receiver.y)) continue;
        applyRuntimeDamage(receiver, Number(hazard?.settings.damage ?? 25), hazardState.object.id, String(hazard?.settings.damageTypeId ?? "physical"), true);
        if (hazard?.settings.respawnOnHit === true || (receiver.health !== null && receiver.health <= 0)) respawnRuntimeState(receiver);
      }
    }
  }

  function processInteraction(): void {
    if (runtimeDialogueRef.current) {
      setInteractionPrompt(null);
      return;
    }
    const currentProject = projectRef.current;
    const players = [...runtimeObjectsRef.current.values()].filter(
      (state) => state.enabled && !state.destroyed && state.object.components.some((element) => element.type === "player-input" && element.enabled),
    );
    const interactables = [...runtimeObjectsRef.current.values()].filter(
      (state) => state.enabled && !state.destroyed && state.object.logicEnabled !== false && state.object.components.some((element) => element.type === "interaction" && element.enabled),
    );

    let nearest: { player: RuntimeObjectState; target: RuntimeObjectState; distance: number; prompt: string; actionId: string } | null = null;
    for (const player of players) {
      const input = player.object.components.find((element) => element.type === "player-input");
      const interactionAction = String(input?.settings.interactionAction ?? "interact");
      for (const target of interactables) {
        const interaction = target.object.components.find((element) => element.type === "interaction");
        const range = Number(interaction?.settings.interactionRange ?? 72);
        const distance = Math.hypot(player.x - target.x, player.y - target.y);
        if (distance <= range && (!nearest || distance < nearest.distance)) {
          nearest = {
            player,
            target,
            distance,
            prompt: String(interaction?.settings.promptText ?? "Interact"),
            actionId: String(interaction?.settings.interactionAction ?? interactionAction),
          };
        }
      }
    }

    setInteractionPrompt(nearest ? `[${getActionKeys(currentProject, nearest.actionId).map((key) => key.replace("Key", "")).join(" / ")}] ${nearest.prompt}` : null);
    if (nearest && getActionKeys(currentProject, nearest.actionId).some((key) => justPressedRef.current.has(key))) {
      fireRules("interaction", nearest.player.object.id, nearest.target.object.id);
      if (runtimeObjectsRef.current.get(nearest.target.object.id) === nearest.target) {
        activateBuiltInGameplay(nearest.player, nearest.target);
        const interaction = nearest.target.object.components.find((element) => element.type === "interaction" && element.enabled);
        if (interaction?.settings.singleUse === true) {
          interaction.enabled = false;
          runtimeLog(`Interaction on ${nearest.target.object.name} was consumed.`, "event");
        }
      }
    }
  }

  function animationMachineClip(state: RuntimeObjectState, moving: boolean): string | null {
    const machine = state.object.components.find((component) => component.type === "animation-state-machine" && component.enabled);
    if (!machine) return null;
    let states: Record<string, Record<string, unknown>> = {};
    let transitions: Array<Record<string, unknown>> = [];
    try {
      const parsed = JSON.parse(String(machine.settings.states ?? "{}"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) states = parsed as Record<string, Record<string, unknown>>;
    } catch { /* Invalid state JSON is surfaced by Diagnostics; runtime keeps the previous state. */ }
    try {
      const parsed = JSON.parse(String(machine.settings.transitions ?? "[]"));
      if (Array.isArray(parsed)) transitions = parsed as Array<Record<string, unknown>>;
    } catch { /* Invalid transition JSON is surfaced by Diagnostics. */ }
    if (!state.animationMachineState) state.animationMachineState = String(machine.settings.initialState ?? Object.keys(states)[0] ?? "Idle");
    const current = state.animationMachineState;
    const speed = Math.hypot(state.velocityX, state.velocityY);
    const healthPercent = state.health === null || state.maximumHealth === null || state.maximumHealth <= 0 ? 100 : state.health / state.maximumHealth * 100;
    const conditionPasses = (transition: Record<string, unknown>): boolean => {
      const when = String(transition.when ?? transition.condition ?? "").toLowerCase();
      const value = transition.value;
      if (!when || when === "always") return true;
      if (when === "moving") return moving;
      if (when === "not-moving" || when === "idle") return !moving;
      if (when === "grounded") return state.grounded;
      if (when === "airborne") return !state.grounded;
      if (when === "health-zero" || when === "dead") return (state.health ?? 1) <= 0;
      if (when === "health-below") return healthPercent <= Number(value ?? 25);
      if (when === "health-above") return healthPercent >= Number(value ?? 50);
      if (when === "speed-greater") return speed > Number(value ?? 0);
      if (when === "speed-less") return speed < Number(value ?? 0);
      if (when === "ai-state") return state.aiState === String(value ?? "");
      if (when.startsWith("variable:")) return Boolean(runtimeVariablesRef.current[when.slice("variable:".length)]) === (value === undefined ? true : Boolean(value));
      return false;
    };
    const transition = transitions.find((candidate) => {
      const from = String(candidate.from ?? "*");
      return (from === "*" || from === current) && conditionPasses(candidate);
    });
    if (transition?.to && String(transition.to) !== current) {
      state.animationMachineState = String(transition.to);
      state.activeClipId = null;
      state.animationFrame = 0;
      state.animationElapsed = 0;
      if (machine.settings.debug === true) runtimeLog(`${state.object.name} animation: ${current} → ${state.animationMachineState}`, "event");
    }
    const config = states[state.animationMachineState] ?? {};
    const directClip = String(config.clipId ?? config.animationId ?? "").trim();
    if (directClip) return directClip;
    const setId = String(config.animationSetId ?? "").trim();
    const set = setId ? projectRef.current.animationSets.find((candidate) => candidate.id === setId) : undefined;
    if (set) {
      return clipForAnimationSet(set, state.animationMachineState || String(set.defaultState ?? "idle"), state.lastDirection);
    }
    return null;
  }

  function defaultAnimationClipForObject(object: GameObjectDocument, direction = "down", moving = false): string | null {
    const animated = componentOf(object, "animated-sprite");
    const visualController = componentOf(object, "character-visual-controller");
    const directional = componentOf(object, "directional-animation");

    const animationSetId = String(visualController?.settings.animationSetId ?? animated?.settings.animationSetId ?? "").trim();
    const animationSet = animationSetId ? projectRef.current.animationSets.find((candidate) => candidate.id === animationSetId) : undefined;
    if (animationSet) {
      const speed = moving ? 1 : 0;
      const stateName = speed > 0
        ? String(visualController?.settings.moveState ?? animated?.settings.defaultState ?? animationSet.defaultState ?? "walk")
        : String(visualController?.settings.idleState ?? animated?.settings.defaultState ?? animationSet.defaultState ?? "idle");
      const clipId = clipForAnimationSet(animationSet, stateName, direction);
      if (clipId) return clipId;
    }

    const defaultClip = String(animated?.settings.defaultClipId ?? "").trim();
    if (defaultClip) return defaultClip;

    if (directional) {
      const direct = String(directional.settings[clipDirectionKey(moving, direction as RuntimeObjectState["lastDirection"])] ?? "").trim();
      if (direct) return direct;
      if (moving) return String(directional.settings.walkDown ?? directional.settings.moveDown ?? "").trim() || null;
      return String(directional.settings.idleDown ?? "").trim() || null;
    }
    return null;
  }

  function runtimeAnimationClipId(state: RuntimeObjectState, moving: boolean): { clipId: string | null; mirroredFromLeft: boolean } {
    const animated = componentOf(state.object, "animated-sprite");
    const visualController = componentOf(state.object, "character-visual-controller");
    let clipId = state.forcedClipId ?? animationMachineClip(state, moving);
    let mirroredFromLeft = false;

    const setId = String(visualController?.settings.animationSetId ?? animated?.settings.animationSetId ?? "").trim();
    const set = setId ? projectRef.current.animationSets.find((candidate) => candidate.id === setId) : undefined;
    if (!clipId && set) {
      const speed = Math.hypot(state.velocityX, state.velocityY);
      let stateName = moving ? String(visualController?.settings.moveState ?? animated?.settings.defaultState ?? set.defaultState ?? "walk") : String(visualController?.settings.idleState ?? animated?.settings.defaultState ?? set.defaultState ?? "idle");
      const runThreshold = Number(visualController?.settings.runSpeedThreshold ?? Number.POSITIVE_INFINITY);
      if (moving && speed >= runThreshold) stateName = String(visualController?.settings.runState ?? "run");
      if (state.health !== null && state.health <= 0) stateName = String(visualController?.settings.deadState ?? "dead");
      clipId = clipForAnimationSet(set, stateName, state.lastDirection);
    }

    const directional = componentOf(state.object, "directional-animation");
    if (!clipId && directional) {
      const directKey = clipDirectionKey(moving, state.lastDirection);
      clipId = String(directional.settings[directKey] ?? "") || null;
      if (!clipId && directional.settings.mirrorHorizontal !== false) {
        const fallbackDirection = state.lastDirection === "right" ? "left" : state.lastDirection === "up-right" ? "up-left" : state.lastDirection === "down-right" ? "down-left" : null;
        if (fallbackDirection) {
          clipId = String(directional.settings[clipDirectionKey(moving, fallbackDirection)] ?? "") || null;
          mirroredFromLeft = Boolean(clipId);
        }
      }
    }

    if (!clipId) clipId = defaultAnimationClipForObject(state.object, state.lastDirection, moving);
    return { clipId, mirroredFromLeft };
  }

  async function playAnimationEventAudio(assetId: string): Promise<void> {
    const asset = projectRef.current.assets.find((candidate) => candidate.id === assetId && candidate.kind === "audio");
    if (!asset) return;
    const dataUrl = await getAssetDataUrl(projectPathRef.current, asset);
    if (!dataUrl) return;
    const audio = new Audio(dataUrl);
    audio.volume = runtimeAudioGroupVolume("sfx");
    try { await audio.play(); } catch { /* Browser autoplay rules may defer the sound until input. */ }
  }

  function executeAnimationEvents(state: RuntimeObjectState, events: AnimationClip["events"]): void {
    for (const event of events) {
      const target = (event.targetId ? runtimeObjectsRef.current.get(event.targetId) : undefined) ?? state;
      if (event.type === "emit-event") {
        runtimeVariablesRef.current.__animationEvent = event.name;
        runtimeVariablesRef.current.__animationEventSource = state.object.id;
        fireRules("script-event", state.object.id, target.object.id);
        runRuntimeScripts(state, "on_event", { name: event.name, value: event.value });
      } else if (event.type === "play-sound") {
        if (event.targetId && projectRef.current.assets.some((asset) => asset.id === event.targetId && asset.kind === "audio")) void playAnimationEventAudio(event.targetId);
        else void playRuntimeAudio(target);
      } else if (event.type === "enable-component" || event.type === "disable-component") {
        const component = target.object.components.find((candidate) => candidate.id === event.key || candidate.type === event.key);
        if (component) component.enabled = event.type === "enable-component";
      } else if (event.type === "spawn-prefab") {
        const prefabId = event.targetId || event.key;
        if (prefabId) spawnRuntimePrefab(prefabId, state.x, state.y);
      } else if (event.type === "camera-shake") {
        cameraShakeRef.current = { remainingMs: Math.max(80, Number(event.value ?? 250)), amplitude: Math.max(1, Number(event.key || 6)), phase: 0 };
      } else if (event.type === "set-variable" && event.key) {
        runtimeVariablesRef.current[event.key] = event.value;
        fireRules("variable-changed", state.object.id, null);
        refreshRuntimeUi();
      }
      runtimeLog(`Animation event: ${state.object.name} › ${event.name}`, "event");
    }
  }

  async function updateRuntimeAnimation(state: RuntimeObjectState, deltaSeconds: number, moving: boolean): Promise<void> {
    const visual = visualRef.current.get(state.object.id);
    if (!visual?.sprite) return;

    const { clipId, mirroredFromLeft } = runtimeAnimationClipId(state, moving);
    const renderer = componentOf(state.object, "sprite-renderer");
    const baseFlipX = renderer?.settings.flipX === true;
    visual.sprite.scale.x = Math.abs(visual.sprite.scale.x) * (baseFlipX !== mirroredFromLeft ? -1 : 1);

    if (!clipId) {
      state.activeClipId = null;
      return;
    }
    const clip = projectRef.current.animations.find((candidate) => candidate.id === clipId);
    if (!clip || clip.frames.length === 0) {
      runtimeLog(`${state.object.name} references a missing or empty Animation Clip (${clipId}).`, "error");
      state.activeClipId = null;
      return;
    }

    const playbackSpeed = Math.max(0, Number(componentOf(state.object, "animated-sprite")?.settings.playbackSpeed ?? 1));
    const next = advanceAnimation(clip, {
      clipId: state.activeClipId,
      frameIndex: state.animationFrame,
      direction: state.animationDirection,
      elapsedSeconds: state.animationElapsed,
    }, deltaSeconds * playbackSpeed);

    const clipChanged = state.activeClipId !== clip.id;
    state.activeClipId = clip.id;
    state.animationFrame = next.frameIndex;
    state.animationDirection = next.direction;
    state.animationElapsed = next.elapsedSeconds;

    if (clipChanged || next.changedFrame) {
      const texture = await textureForClipFrame(clip, state.animationFrame);
      if (texture && visualRef.current.get(state.object.id)?.sprite === visual.sprite) visual.sprite.texture = texture;
    }

    if (next.rootMotionX || next.rootMotionY) {
      const mode = clip.rootMotionMode ?? "ignore";
      if (mode === "apply-position") {
        const radians = state.object.transform.rotation * Math.PI / 180;
        const worldX = next.rootMotionX * Math.cos(radians) - next.rootMotionY * Math.sin(radians);
        const worldY = next.rootMotionX * Math.sin(radians) + next.rootMotionY * Math.cos(radians);
        resolveMovement(state, worldX, worldY);
      }
    }
    if (next.crossedEvents.length) executeAnimationEvents(state, next.crossedEvents);
    if (next.finished && !clip.loop) state.forcedClipId = null;
  }

  async function createVisual(object: GameObjectDocument, runtime?: RuntimeObjectState): Promise<ObjectVisual> {
    if (viewportDisposedRef.current) throw new Error("The Scene viewport was disposed during visual creation.");
    const group = new Container();
    group.position.set(runtime?.x ?? object.transform.position.x, runtime?.y ?? object.transform.position.y);
    group.rotation = (object.transform.rotation * Math.PI) / 180;
    group.scale.set(object.transform.scale.x, object.transform.scale.y);
    const pivotX = object.transform.pivot?.x ?? 0.5;
    const pivotY = object.transform.pivot?.y ?? 0.5;
    const contentOffsetX = (0.5 - pivotX) * object.size.width;
    const contentOffsetY = (0.5 - pivotY) * object.size.height;
    const localLeft = -pivotX * object.size.width;
    const localTop = -pivotY * object.size.height;

    const tilemap = object.components.find((element) => element.type === "tilemap-renderer" && element.enabled);
    if (tilemap && tilemap.settings.visibleInPreview !== false) {
      const tileWidth = Math.max(1, Number(tilemap.settings.tileWidth ?? 32));
      const tileHeight = Math.max(1, Number(tilemap.settings.tileHeight ?? 32));
      const mapWidth = Math.max(1, Number(tilemap.settings.mapWidth ?? 32));
      const mapHeight = Math.max(1, Number(tilemap.settings.mapHeight ?? 24));
      const opacity = Math.max(0, Math.min(1, Number(tilemap.settings.opacity ?? 1)));
      let cells: Record<string, string> = {};
      try { cells = JSON.parse(String(tilemap.settings.cells ?? "{}")) as Record<string, string>; } catch { cells = {}; }

      const tileContainer = new Container();
      const tileGraphics = new Graphics();
      const originX = -(mapWidth * tileWidth) / 2 + contentOffsetX;
      const originY = -(mapHeight * tileHeight) / 2 + contentOffsetY;
      const paletteById = new Map<string, ProjectDocument["tilePalette"][number]>(projectRef.current.tilePalette.map((entry) => [entry.id, entry]));
      const textureByTileId = new Map<string, Texture | null>();

      for (const tileId of new Set(Object.values(cells))) {
        const palette = paletteById.get(tileId);
        const asset = palette ? projectRef.current.assets.find((candidate) => candidate.id === palette.assetId) : null;
        const frame = asset && palette ? asset.frames.find((candidate) => candidate.id === palette.frameId) : null;
        textureByTileId.set(tileId, asset && frame ? await textureForFrame(asset, frame) : null);
      }

      for (const [key, tileId] of Object.entries(cells)) {
        const [column, row] = key.split(",").map(Number);
        if (!Number.isFinite(column) || !Number.isFinite(row)) continue;
        const x = originX + column * tileWidth;
        const y = originY + row * tileHeight;
        const palette = paletteById.get(tileId);
        const texture = textureByTileId.get(tileId);
        if (texture) {
          const tileSprite = new Sprite(texture);
          tileSprite.anchor.set(0, 0);
          tileSprite.position.set(x, y);
          tileSprite.width = tileWidth;
          tileSprite.height = tileHeight;
          tileSprite.alpha = opacity;
          tileContainer.addChild(tileSprite);
        } else {
          tileGraphics.rect(x, y, tileWidth, tileHeight)
            .fill({ color: hexToNumber(palette?.color ?? "#78909c"), alpha: opacity });
        }
        if (!runtimeMode) {
          tileGraphics.rect(x, y, tileWidth, tileHeight)
            .stroke({ color: 0x111820, width: 0.5, alpha: 0.3 });
        }
        if (showColliders && palette?.collision === "solid") {
          tileGraphics.rect(x, y, tileWidth, tileHeight)
            .fill({ color: 0xffb74d, alpha: 0.08 })
            .stroke({ color: 0xffb74d, width: 1, alpha: 0.75 });
        }
      }
      if (!runtimeMode) {
        tileGraphics.rect(originX, originY, mapWidth * tileWidth, mapHeight * tileHeight)
          .stroke({ color: selectedObjectIds.includes(object.id) ? 0xffb74d : 0x4f9da6, width: selectedObjectIds.includes(object.id) ? 2 : 1, alpha: 0.75 });
      }
      group.addChild(tileContainer, tileGraphics);
    }

    const cameraElement = object.components.find((element) => element.type === "camera" && element.enabled);
    const spawnElement = object.components.find((element) => element.type === "scene-spawn-point" && element.enabled);
    if (!runtimeMode && cameraElement) {
      const effectiveZoom = cameraEffectiveZoom(cameraElement);
      const viewWidth = projectRef.current.settings.gameWidth / effectiveZoom;
      const viewHeight = projectRef.current.settings.gameHeight / effectiveZoom;
      const cameraGizmo = new Graphics();
      cameraGizmo.rect(-viewWidth / 2, -viewHeight / 2, viewWidth, viewHeight)
        .fill({ color: 0x42a5f5, alpha: 0.025 })
        .stroke({ color: 0x42a5f5, width: selectedObjectIds.includes(object.id) ? 2 : 1, alpha: 0.8 });
      cameraGizmo.moveTo(-14, 0).lineTo(14, 0).stroke({ color: 0x90caf9, width: 1 });
      cameraGizmo.moveTo(0, -14).lineTo(0, 14).stroke({ color: 0x90caf9, width: 1 });
      cameraGizmo.circle(0, 0, 5).fill({ color: 0x42a5f5, alpha: 0.9 });

      if (selectedObjectIds.includes(object.id)) {
        const follow = object.components.find((component) => component.type === "camera-follow" && component.enabled);
        const lookAhead = object.components.find((component) => component.type === "camera-look-ahead" && component.enabled);
        const bounds = object.components.find((component) => component.type === "camera-bounds" && component.enabled);
        const targetId = String(follow?.settings.targetObjectId ?? "").trim();
        const targetName = String(follow?.settings.targetName ?? cameraElement.settings.followTargetName ?? "").trim();
        const scene = getActiveScene(projectRef.current);
        const target = scene.objects.find((candidate) => candidate.id === targetId) ?? scene.objects.find((candidate) => targetName && candidate.name === targetName);
        if (target) {
          const localTargetX = target.transform.position.x - object.transform.position.x;
          const localTargetY = target.transform.position.y - object.transform.position.y;
          cameraGizmo.moveTo(0, 0).lineTo(localTargetX, localTargetY).stroke({ color: 0x80deea, width: 1.5, alpha: 0.9 });
          cameraGizmo.circle(localTargetX, localTargetY, 7).fill({ color: 0x80deea, alpha: 0.14 }).stroke({ color: 0x80deea, width: 1.5, alpha: 0.9 });
        }
        const followMode = String(follow?.settings.mode ?? "smooth");
        if (followMode === "dead-zone" || followMode === "platformer") {
          const deadWidth = Math.max(0, Number(cameraElement.settings.deadZoneWidth ?? 72));
          const deadHeight = Math.max(0, Number(cameraElement.settings.deadZoneHeight ?? 96));
          cameraGizmo.rect(-deadWidth / 2, -deadHeight / 2, deadWidth, deadHeight).fill({ color: 0xab7cff, alpha: 0.035 }).stroke({ color: 0xab7cff, width: 1, alpha: 0.8 });
        }
        if (lookAhead) {
          const lookX = Number(lookAhead.settings.horizontal ?? 0);
          const lookY = Number(lookAhead.settings.vertical ?? 0);
          cameraGizmo.moveTo(0, 0).lineTo(lookX, lookY).stroke({ color: 0xffd166, width: 1, alpha: 0.75 });
          cameraGizmo.circle(lookX, lookY, 5).fill({ color: 0xffd166, alpha: 0.9 });
        }
        if (bounds?.settings.enabled === true) {
          const left = Number(bounds.settings.left ?? -640) - object.transform.position.x;
          const top = Number(bounds.settings.top ?? -360) - object.transform.position.y;
          const right = Number(bounds.settings.right ?? 640) - object.transform.position.x;
          const bottom = Number(bounds.settings.bottom ?? 360) - object.transform.position.y;
          cameraGizmo.rect(left, top, Math.max(1, right - left), Math.max(1, bottom - top)).stroke({ color: 0x66bb6a, width: 1.5, alpha: 0.65 });
        }
      }

      cameraGizmo.position.set(contentOffsetX, contentOffsetY);
      group.addChild(cameraGizmo);
    }
    if (!runtimeMode && spawnElement) {
      const spawnGizmo = new Graphics();
      spawnGizmo.circle(0, 0, 18).fill({ color: 0x66bb6a, alpha: 0.12 }).stroke({ color: 0x66bb6a, width: 2, alpha: 0.9 });
      spawnGizmo.moveTo(-10, 0).lineTo(10, 0).stroke({ color: 0xa5d6a7, width: 2 });
      spawnGizmo.moveTo(0, -10).lineTo(0, 10).stroke({ color: 0xa5d6a7, width: 2 });
      spawnGizmo.position.set(contentOffsetX, contentOffsetY);
      group.addChild(spawnGizmo);
    }

    const pointLight = object.components.find((element) => element.type === "point-light-2d" && element.enabled);
    if (pointLight) {
      const radius = Math.max(1, Number(pointLight.settings.radius ?? 260));
      const intensity = Math.max(0, Number(pointLight.settings.intensity ?? 1));
      const color = hexToNumber(String(pointLight.settings.color ?? "#fff0c2"));
      const light = new Graphics();
      for (let ring = 7; ring >= 1; ring -= 1) {
        const factor = ring / 7;
        light.circle(contentOffsetX, contentOffsetY, radius * factor).fill({ color, alpha: Math.min(0.14, intensity * 0.018 * (1 - factor + 0.2)) });
      }
      light.blendMode = "add";
      light.label = "shadowium-point-light";
      group.addChild(light);
      if (!runtimeMode && selectedObjectIds.includes(object.id)) {
        const outline = new Graphics();
        outline.circle(contentOffsetX, contentOffsetY, radius).stroke({ color, width: 1.5, alpha: 0.8 });
        outline.moveTo(contentOffsetX - 8, contentOffsetY).lineTo(contentOffsetX + 8, contentOffsetY).stroke({ color, width: 1 });
        outline.moveTo(contentOffsetX, contentOffsetY - 8).lineTo(contentOffsetX, contentOffsetY + 8).stroke({ color, width: 1 });
        group.addChild(outline);
      }
    }

    const renderer = object.components.find((element) => element.type === "sprite-renderer" && element.enabled && element.settings.visible !== false);
    let sprite: RuntimeSprite | null = null;
    const assetId = String(renderer?.settings.assetId ?? "");
    const asset = projectRef.current.assets.find((candidate) => candidate.id === assetId);
    if (renderer && asset) {
      const frameId = String(renderer.settings.frameId ?? "");
      const frame = frameForAsset(asset, frameId);
      if (frame) {
        const texture = await textureForFrame(asset, frame);
        if (texture) {
          const resizeMode = String(renderer.settings.resizeMode ?? "stretch");
          if (resizeMode === "tile") {
            sprite = new TilingSprite({
              texture,
              width: Math.max(1, object.size.width),
              height: Math.max(1, object.size.height),
            });
          } else if (resizeMode === "nine-slice" || resizeMode === "protected-region") {
            const region = resizeMode === "protected-region" ? asset.scalingRegion : undefined;
            sprite = new NineSliceSprite({
              texture,
              leftWidth: Math.max(0, Number(region?.left ?? renderer.settings.nineSliceLeft ?? 8)),
              topHeight: Math.max(0, Number(region?.top ?? renderer.settings.nineSliceTop ?? 8)),
              rightWidth: Math.max(0, Number(region?.right ?? renderer.settings.nineSliceRight ?? 8)),
              bottomHeight: Math.max(0, Number(region?.bottom ?? renderer.settings.nineSliceBottom ?? 8)),
            });
            sprite.width = Math.max(1, object.size.width);
            sprite.height = Math.max(1, object.size.height);
          } else {
            sprite = new Sprite(texture);
            if (resizeMode === "scale") {
              const sourceWidth = Math.max(1, texture.width);
              const sourceHeight = Math.max(1, texture.height);
              const fit = Math.min(object.size.width / sourceWidth, object.size.height / sourceHeight);
              sprite.width = sourceWidth * fit;
              sprite.height = sourceHeight * fit;
            } else {
              sprite.width = Math.max(1, object.size.width);
              sprite.height = Math.max(1, object.size.height);
            }
          }
          sprite.anchor.set(Number(renderer.settings.anchorX ?? 0.5), Number(renderer.settings.anchorY ?? 0.5));
          sprite.position.set(contentOffsetX, contentOffsetY);
          sprite.tint = hexToNumber(String(renderer.settings.tint ?? "#ffffff"));
          sprite.alpha = Number(renderer.settings.opacity ?? 1);
          sprite.roundPixels = renderer.settings.pixelPerfect !== false;
          if (renderer.settings.flipX === true) sprite.scale.x *= -1;
          if (renderer.settings.flipY === true) sprite.scale.y *= -1;
          const materialStack = componentOf(object, "material-stack");
          const materialIds = parseList(materialStack?.settings.materialIds);
          const materialIntensity = Math.max(0, Number(materialStack?.settings.intensity ?? 1));
          for (const materialId of materialIds) {
            const material = projectRef.current.materials.find((candidate) => candidate.id === materialId && candidate.enabled);
            const shader = material ? projectRef.current.shaders.find((candidate) => candidate.id === material.shaderId) : null;
            if (!material || !shader) continue;
            const shaderKey = `${shader.id} ${shader.name}`.toLowerCase();
            if (shaderKey.includes("grayscale")) sprite.tint = 0xbfc5ca;
            else if (shaderKey.includes("frost")) sprite.tint = 0x9ddfff;
            else if (shaderKey.includes("poison")) sprite.tint = 0x8bd450;
            else if (shaderKey.includes("shadow")) sprite.tint = 0x76639b;
            else if (shaderKey.includes("hit") && runtime?.hitFlashRemaining) sprite.tint = 0xffffff;
            const opacity = Number(material.uniforms.opacity ?? material.uniforms.alpha ?? 1);
            if (Number.isFinite(opacity)) sprite.alpha *= Math.max(0, Math.min(1, opacity * materialIntensity));
          }
          group.addChild(sprite);
        }
      }
    }

    const animatedSprite = componentOf(object, "animated-sprite");
    if (!sprite && animatedSprite) {
      const initialClipId = runtime
        ? runtimeAnimationClipId(runtime, false).clipId
        : defaultAnimationClipForObject(object, "down", false);
      const initialClip = initialClipId ? projectRef.current.animations.find((candidate) => candidate.id === initialClipId) : undefined;
      if (initialClip?.frames.length) {
        const texture = await textureForClipFrame(initialClip, runtime?.animationFrame ?? 0);
        if (texture) {
          sprite = new Sprite(texture);
          sprite.anchor.set(Number(renderer?.settings.anchorX ?? 0.5), Number(renderer?.settings.anchorY ?? 0.5));
          sprite.position.set(contentOffsetX, contentOffsetY);
          sprite.width = Math.max(1, object.size.width);
          sprite.height = Math.max(1, object.size.height);
          sprite.tint = hexToNumber(String(renderer?.settings.tint ?? "#ffffff"));
          sprite.alpha = Number(renderer?.settings.opacity ?? 1);
          sprite.roundPixels = renderer?.settings.pixelPerfect !== false;
          group.addChild(sprite);
          if (runtime) runtime.activeClipId = initialClip.id;
        }
      }
    }

    const shapeRenderer = object.components.find((element) => element.type === "shape-renderer" && element.enabled);
    if (shapeRenderer) {
      const shape = new Graphics();
      const width = object.size.width;
      const height = object.size.height;
      const fill = hexToNumber(String(shapeRenderer.settings.fillColor ?? object.editorColor));
      const stroke = hexToNumber(String(shapeRenderer.settings.strokeColor ?? "#ffffff"));
      const strokeWidth = Math.max(0, Number(shapeRenderer.settings.strokeWidth ?? 0));
      const alpha = Math.max(0, Math.min(1, Number(shapeRenderer.settings.opacity ?? 1)));
      if (shapeRenderer.settings.shape === "ellipse") shape.ellipse(contentOffsetX, contentOffsetY, width / 2, height / 2);
      else if (shapeRenderer.settings.shape === "line") shape.moveTo(localLeft, contentOffsetY).lineTo(localLeft + width, contentOffsetY);
      else shape.rect(localLeft, localTop, width, height);
      if (shapeRenderer.settings.shape !== "line") shape.fill({ color: fill, alpha });
      if (strokeWidth > 0 || shapeRenderer.settings.shape === "line") shape.stroke({ color: stroke, width: Math.max(1, strokeWidth), alpha });
      group.addChild(shape);
    }

    const worldText = object.components.find((element) => element.type === "text-renderer" && element.enabled);
    if (worldText) {
      const textObject = new Text({
        text: String(worldText.settings.text ?? object.name),
        style: { fill: String(worldText.settings.color ?? "#ffffff"), fontSize: Number(worldText.settings.fontSize ?? 24), align: String(worldText.settings.align ?? "center") as "left" | "center" | "right" },
      });
      const alignment = String(worldText.settings.align ?? "center");
      textObject.anchor.set(alignment === "left" ? 0 : alignment === "right" ? 1 : 0.5, 0.5);
      textObject.position.set(contentOffsetX, contentOffsetY);
      group.addChild(textObject);
    }

    const particleEmitter = object.components.find((element) => element.type === "particle-emitter" && element.enabled);
    if (particleEmitter) {
      const particleLayer = new Container();
      particleLayer.label = "shadowium-particles";
      const count = Math.max(1, Math.min(64, Math.round(Number(particleEmitter.settings.emissionRate ?? 12))));
      const preset = String(particleEmitter.settings.preset ?? "dust");
      for (let index = 0; index < count; index += 1) {
        const particle = new Graphics();
        const radius = preset === "rain" ? 1 : 1.5 + index % 3;
        if (preset === "rain") particle.rect(-1, -8, 2, 16).fill({ color: 0x90caf9, alpha: 0.6 });
        else particle.circle(0, 0, radius).fill({ color: preset === "fire" ? 0xffb74d : preset === "snow" ? 0xffffff : preset === "sparkles" ? 0xfff59d : 0xcfd8dc, alpha: 0.65 });
        particle.position.set(contentOffsetX + ((index * 37) % Math.max(8, object.size.width)) - object.size.width / 2, contentOffsetY + ((index * 53) % Math.max(8, object.size.height)) - object.size.height / 2);
        particleLayer.addChild(particle);
      }
      group.addChild(particleLayer);
    }

    const runtimeControllerOnly = runtimeMode && isRuntimeControllerOnly(object);
    const expectsSprite = Boolean(renderer || animatedSprite);
    if (!sprite && expectsSprite && !runtimeControllerOnly && projectRef.current.settings.missingSpriteBehavior !== "hide") {
      const checker = new Graphics();
      const halfWidth = object.size.width / 2;
      const halfHeight = object.size.height / 2;
      checker.rect(localLeft, localTop, halfWidth, halfHeight).fill({ color: 0xff2d8b, alpha: 0.95 });
      checker.rect(localLeft + halfWidth, localTop, halfWidth, halfHeight).fill({ color: 0x35122a, alpha: 0.95 });
      checker.rect(localLeft, localTop + halfHeight, halfWidth, halfHeight).fill({ color: 0x35122a, alpha: 0.95 });
      checker.rect(localLeft + halfWidth, localTop + halfHeight, halfWidth, halfHeight).fill({ color: 0xff2d8b, alpha: 0.95 });
      checker.rect(localLeft, localTop, object.size.width, object.size.height).stroke({ color: 0xff8fc4, width: 2, alpha: 1 });
      group.addChild(checker);
      if (runtimeMode && runtime) runtimeLog(`${object.name} has a Sprite/Animated Sprite Component but no resolvable texture.`, "error");
    } else if (!sprite && !expectsSprite && !tilemap && !cameraElement && !spawnElement && !shapeRenderer && !worldText && !particleEmitter && !pointLight && !runtimeControllerOnly) {
      const body = new Graphics();
      body.roundRect(localLeft, localTop, object.size.width, object.size.height, 6)
        .fill({ color: hexToNumber(object.editorColor), alpha: object.enabled ? 0.88 : 0.35 })
        .stroke({ color: selectedObjectIds.includes(object.id) ? 0xffb74d : 0x8291a3, width: selectedObjectIds.includes(object.id) ? 2 : 1, alpha: 0.9 });
      group.addChild(body);
    }

    const label = new Text({
      text: object.name,
      style: {
        fill: "#e8edf4",
        fontFamily: "Inter, Segoe UI, Arial, sans-serif",
        fontSize: 11,
        fontWeight: "600",
        stroke: { color: "#0a0d11", width: 3 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(contentOffsetX, localTop - 8);
    label.visible = !runtimeMode;
    group.addChild(label);

    if (selectedObjectIds.includes(object.id) && playStateRef.current === "stopped") {
      const selection = new Graphics();
      const localRight = localLeft + object.size.width;
      const localBottom = localTop + object.size.height;
      const centreX = (localLeft + localRight) / 2;
      const centreY = (localTop + localBottom) / 2;
      selection.rect(localLeft, localTop, object.size.width, object.size.height).stroke({ color: 0xffb74d, width: 1.5 });
      if (activeTool === "scale" || activeTool === "resize") {
        const handleColor = activeTool === "resize" ? 0x66bb6a : 0xffb74d;
        for (const [x, y] of [[localLeft, localTop], [localRight, localTop], [localRight, localBottom], [localLeft, localBottom]]) {
          selection.rect(x - 4, y - 4, 8, 8).fill({ color: handleColor }).stroke({ color: 0x101319, width: 1 });
        }
        selection.moveTo(centreX, centreY).lineTo(localRight + 22, centreY).moveTo(centreX, centreY).lineTo(localLeft - 22, centreY).moveTo(centreX, centreY).lineTo(centreX, localTop - 22).moveTo(centreX, centreY).lineTo(centreX, localBottom + 22).stroke({ color: handleColor, width: 2 });
        selection.poly([localRight + 22, centreY, localRight + 14, centreY - 5, localRight + 14, centreY + 5]).fill({ color: handleColor });
        selection.poly([localLeft - 22, centreY, localLeft - 14, centreY - 5, localLeft - 14, centreY + 5]).fill({ color: handleColor });
        selection.poly([centreX, localTop - 22, centreX - 5, localTop - 14, centreX + 5, localTop - 14]).fill({ color: handleColor });
        selection.poly([centreX, localBottom + 22, centreX - 5, localBottom + 14, centreX + 5, localBottom + 14]).fill({ color: handleColor });
        for (const [x, y] of [[centreX, localTop], [localRight, centreY], [centreX, localBottom], [localLeft, centreY]]) selection.circle(x, y, 4).fill({ color: handleColor }).stroke({ color: 0x101319, width: 1 });
      } else if (activeTool === "rotate" || ctrlRotateVisible) {
        const radius = Math.hypot(object.size.width, object.size.height) / 2 + 22;
        selection.circle(0, 0, radius).stroke({ color: ctrlRotateVisible ? 0x42a5f5 : 0xffb74d, width: 1.5, alpha: 0.95 });
        selection.moveTo(0, -radius).lineTo(0, -radius - 16).stroke({ color: ctrlRotateVisible ? 0x42a5f5 : 0xffb74d, width: 1.5 });
        selection.circle(0, -radius - 20, 6).fill({ color: ctrlRotateVisible ? 0x42a5f5 : 0xffb74d }).stroke({ color: 0x101319, width: 1 });
      } else if (activeTool === "pivot") {
        selection.circle(0, 0, 7).fill({ color: 0x42a5f5, alpha: 0.9 }).stroke({ color: 0xffffff, width: 1 });
        selection.moveTo(-12, 0).lineTo(12, 0).moveTo(0, -12).lineTo(0, 12).stroke({ color: 0x90caf9, width: 1 });
      } else {
        selection.moveTo(0, 0).lineTo(34, 0).stroke({ color: 0xef5350, width: 2 });
        selection.moveTo(0, 0).lineTo(0, -34).stroke({ color: 0x66bb6a, width: 2 });
        selection.circle(0, 0, 4).fill({ color: 0xffb74d });
      }
      group.addChild(selection);
    }

    if (showColliders) {
      const collider = colliderFor(object);
      if (collider) {
        const radius = Math.max(1, Number(collider.settings.radius ?? Math.min(object.size.width, object.size.height) / 2));
        const width = collider.type === "circle-collider" ? radius * 2 : Math.max(1, Number(collider.settings.width ?? object.size.width));
        const height = collider.type === "circle-collider" ? radius * 2 : Math.max(1, Number(collider.settings.height ?? object.size.height));
        const offsetX = Number(collider.settings.offsetX ?? 0);
        const offsetY = Number(collider.settings.offsetY ?? 0);
        const localRotation = Number(collider.settings.localRotation ?? 0) * Math.PI / 180;
        const isTrigger = colliderBehavior(object) === "trigger";
        const selected = selectedObjectIds.includes(object.id);
        const color = isTrigger ? 0x66bb6a : 0xffb74d;
        const colliderGroup = new Container();
        colliderGroup.position.set(offsetX, offsetY);
        colliderGroup.rotation = localRotation;
        colliderGroup.label = "shadowium-collider-debug";
        const overlay = new Graphics();

        if (collider.type === "polygon-collider") {
          const points = String(collider.settings.points ?? "-32,-32;32,-32;32,32;-32,32")
            .split(";")
            .map((pair) => pair.split(",").map((value) => Number(value.trim())))
            .filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
            .flatMap(([pointX, pointY]) => [pointX, pointY]);
          if (points.length >= 6) overlay.poly(points).fill({ color, alpha: 0.055 }).stroke({ color, width: selected ? 2 : 1, alpha: selected ? 0.95 : 0.55 });
        } else if (collider.type === "circle-collider") {
          overlay.circle(0, 0, radius).fill({ color, alpha: 0.055 }).stroke({ color, width: selected ? 2 : 1, alpha: selected ? 0.95 : 0.55 });
        } else if (collider.type === "capsule-collider") {
          const capsuleRadius = Math.max(1, Math.min(width, height) / 2);
          if (height >= width) overlay.roundRect(-width / 2, -height / 2, width, height, capsuleRadius).fill({ color, alpha: 0.055 }).stroke({ color, width: selected ? 2 : 1, alpha: selected ? 0.95 : 0.55 });
          else overlay.roundRect(-width / 2, -height / 2, width, height, capsuleRadius).fill({ color, alpha: 0.055 }).stroke({ color, width: selected ? 2 : 1, alpha: selected ? 0.95 : 0.55 });
        } else if (collider.type === "edge-collider") {
          overlay.moveTo(Number(collider.settings.startX ?? -32), Number(collider.settings.startY ?? 0)).lineTo(Number(collider.settings.endX ?? 32), Number(collider.settings.endY ?? 0)).stroke({ color, width: selected ? 3 : 2, alpha: selected ? 0.95 : 0.65 });
        } else if (collider.type === "chain-collider") {
          const points = String(collider.settings.points ?? "-64,0;0,-16;64,0")
            .split(";")
            .map((pair) => pair.split(",").map((value) => Number(value.trim())))
            .filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
          if (points.length >= 2) {
            overlay.moveTo(points[0][0], points[0][1]);
            for (const point of points.slice(1)) overlay.lineTo(point[0], point[1]);
            if (collider.settings.loop === true) overlay.lineTo(points[0][0], points[0][1]);
            overlay.stroke({ color, width: selected ? 3 : 2, alpha: selected ? 0.95 : 0.65 });
          }
        } else {
          overlay.rect(-width / 2, -height / 2, width, height).fill({ color, alpha: 0.055 }).stroke({ color, width: selected ? 2 : 1, alpha: selected ? 0.95 : 0.55 });
        }

        if (selected && activeTool === "collider" && !["polygon-collider", "edge-collider", "chain-collider"].includes(collider.type)) {
          overlay.circle(width / 2, height / 2, 5).fill({ color: 0xffb74d }).stroke({ color: 0x101319, width: 1 });
          overlay.circle(0, 0, 4).fill({ color: 0x80deea }).stroke({ color: 0x101319, width: 1 });
        }
        colliderGroup.addChild(overlay);
        group.addChild(colliderGroup);
      }
    }

    group.visible = runtime ? runtime.enabled && !runtime.destroyed && object.runtimeVisible !== false && !runtimeControllerOnly : object.enabled && object.editorVisible !== false;
    return { group, sprite, label };
  }

  function containerIsUsable(container: Container | null | undefined): container is Container {
    if (!container) return false;
    const candidate = container as Container & { destroyed?: boolean; children?: unknown[] };
    return candidate.destroyed !== true && Array.isArray(candidate.children);
  }

  function destroyContainerSafely(container: Container | null | undefined): void {
    if (!containerIsUsable(container)) return;
    try {
      container.removeFromParent();
    } catch {
      // The parent may already be shutting down.
    }
    try {
      container.destroy({ children: true, texture: false, textureSource: false });
    } catch {
      // Cleanup must never take the complete workbench down.
    }
  }

  function rebuildWorld(): Promise<void> {
    const requestId = ++requestedRebuildRef.current;
    const queued = rebuildQueueRef.current
      .catch(() => undefined)
      .then(async () => performWorldRebuild(requestId));
    rebuildQueueRef.current = queued;
    return queued;
  }

  async function performWorldRebuild(requestId: number): Promise<void> {
    if (viewportDisposedRef.current) return;
    const app = appRef.current;
    if (!app || !app.canvas?.isConnected) return;

    const currentProject = projectRef.current;
    const scene = playStateRef.current === "stopped"
      ? getActiveScene(currentProject)
      : currentProject.scenes.find((candidate) => candidate.id === runtimeSceneIdRef.current) ?? getActiveScene(currentProject);
    const generation = ++renderGenerationRef.current;
    const nextWorld = new Container();
    const nextVisuals = new Map<string, ObjectVisual>();

    try {
      app.renderer.background.color = hexToNumber(scene.backgroundColor || currentProject.settings.defaultBackgroundColor);
      if (runtimeMode) runtimeBootStageRef.current = "Building render tree";

      const grid = new Graphics();
      if (showGrid) {
        const safeGridSize = Math.max(1, Number(gridSize) || 32);
        for (let position = -GRID_EXTENT; position <= GRID_EXTENT; position += safeGridSize) {
          const major = position % (safeGridSize * 4) === 0;
          grid.moveTo(position, -GRID_EXTENT).lineTo(position, GRID_EXTENT).stroke({ color: major ? 0x2b3440 : 0x202832, width: 1, alpha: major ? 0.7 : 0.55 });
          grid.moveTo(-GRID_EXTENT, position).lineTo(GRID_EXTENT, position).stroke({ color: major ? 0x2b3440 : 0x202832, width: 1, alpha: major ? 0.7 : 0.55 });
        }
      }
      nextWorld.addChild(grid);

      if (!runtimeMode) {
        const axes = new Graphics();
        axes.moveTo(-GRID_EXTENT, 0).lineTo(GRID_EXTENT, 0).stroke({ color: 0x78474d, width: 1, alpha: 0.85 });
        axes.moveTo(0, -GRID_EXTENT).lineTo(0, GRID_EXTENT).stroke({ color: 0x3e6589, width: 1, alpha: 0.85 });
        nextWorld.addChild(axes);
      }

      const objects = (playStateRef.current === "stopped"
        ? scene.objects
        : [...runtimeObjectsRef.current.values()].map((state) => state.object))
        .filter((object) => {
          const layer = scene.layers.find((candidate) => candidate.id === object.layerId);
          if (playStateRef.current !== "stopped" && object.components.some((component) => component.enabled && component.type.startsWith("ui-"))) return false;
          return playStateRef.current === "stopped" ? layer?.visible !== false : layer?.runtimeIncluded !== false;
        });

      const sortingLayerOrder = new Map(["background", "ground", "ground decorations", "characters", "effects", "foreground", "ui"].map((name, index) => [name, index]));
      const sorted = [...objects].sort((left, right) => {
        const leftSceneLayer = scene.layers.find((layer) => layer.id === left.layerId)?.renderOrder ?? 0;
        const rightSceneLayer = scene.layers.find((layer) => layer.id === right.layerId)?.renderOrder ?? 0;
        if (leftSceneLayer !== rightSceneLayer) return leftSceneLayer - rightSceneLayer;
        const leftRenderer = componentOf(left, "sprite-renderer");
        const rightRenderer = componentOf(right, "sprite-renderer");
        const leftSortingLayer = sortingLayerOrder.get(String(leftRenderer?.settings.sortingLayer ?? "characters").toLowerCase()) ?? 3;
        const rightSortingLayer = sortingLayerOrder.get(String(rightRenderer?.settings.sortingLayer ?? "characters").toLowerCase()) ?? 3;
        if (leftSortingLayer !== rightSortingLayer) return leftSortingLayer - rightSortingLayer;
        const leftOrder = Number(leftRenderer?.settings.orderInLayer ?? leftRenderer?.settings.renderLayer ?? 0);
        const rightOrder = Number(rightRenderer?.settings.orderInLayer ?? rightRenderer?.settings.renderLayer ?? 0);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        const leftRuntimeY = runtimeObjectsRef.current.get(left.id)?.y ?? left.transform.position.y;
        const rightRuntimeY = runtimeObjectsRef.current.get(right.id)?.y ?? right.transform.position.y;
        const leftY = leftRenderer?.settings.ySort === true ? leftRuntimeY : 0;
        const rightY = rightRenderer?.settings.ySort === true ? rightRuntimeY : 0;
        if (leftY !== rightY) return leftY - rightY;
        return Number(leftRenderer?.settings.zBias ?? 0) - Number(rightRenderer?.settings.zBias ?? 0);
      });

      for (const object of sorted) {
        if (viewportDisposedRef.current || requestId !== requestedRebuildRef.current || generation !== renderGenerationRef.current) {
          destroyContainerSafely(nextWorld);
          return;
        }
        try {
          const runtime = playStateRef.current === "stopped" ? undefined : runtimeObjectsRef.current.get(object.id);
          const visual = await createVisual(object, runtime);
          if (viewportDisposedRef.current || requestId !== requestedRebuildRef.current || generation !== renderGenerationRef.current || appRef.current !== app || !app.canvas?.isConnected) {
            destroyContainerSafely(visual.group);
            destroyContainerSafely(nextWorld);
            return;
          }
          nextVisuals.set(object.id, visual);
          nextWorld.addChild(visual.group);
        } catch (error) {
          const message = `Could not render ${object.name}: ${error instanceof Error ? error.message : String(error)}`;
          if (runtimeMode) runtimeLog(message, "error");
          else useEditorStore.getState().setStatus(message, "error");
        }
      }

      if (viewportDisposedRef.current || requestId !== requestedRebuildRef.current || generation !== renderGenerationRef.current || appRef.current !== app || !app.canvas?.isConnected) {
        destroyContainerSafely(nextWorld);
        return;
      }

      const previousWorld = worldRef.current;
      app.stage.addChild(nextWorld);
      worldRef.current = nextWorld;
      visualRef.current = nextVisuals;
      applyCamera();
      app.render();
      destroyContainerSafely(previousWorld);

      if (runtimeMode) {
        runtimeBootStageRef.current = "Running";
        runtimeLog(`Render tree ready: ${nextVisuals.size} visuals.`, "info");
      }
      emitRuntimeSnapshot(true);
      if (runtimeMode) {
        getRuntimeSession(runtimeSessionIdRef.current)?.markRunning();
        runtimeReadyCallbackRef.current?.();
      }
    } catch (error) {
      destroyContainerSafely(nextWorld);
      const message = `Scene rebuild failed: ${error instanceof Error ? error.message : String(error)}`;
      if (runtimeMode) runtimeLog(message, "error");
      else useEditorStore.getState().setStatus(message, "error");
      throw error;
    }
  }

  useEffect(() => {
    const mountElement = hostRef.current;
    if (mountElement === null) return;
    let disposed = false;
    let mountedApp: Application | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let contextLostHandler: ((event: Event) => void) | null = null;
    let contextRestoredHandler: (() => void) | null = null;

    async function initialize(host: HTMLElement): Promise<void> {
      const app = new Application();
      await app.init({
        resizeTo: host,
        background: "#11161d",
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      if (disposed) {
        app.destroy(true, { children: true, texture: false, textureSource: false });
        return;
      }
      mountedApp = app;
      app.canvas.className = "scene-canvas";
      app.canvas.tabIndex = 0;
      host.appendChild(app.canvas);
      contextLostHandler = (event: Event): void => {
        event.preventDefault();
        if (!runtimeMode) useEditorStore.getState().setStatus("The Scene renderer lost its graphics context. ShadowiumUI will restore it automatically.", "warning");
      };
      contextRestoredHandler = (): void => {
        if (runtimeMode) return;
        void rebuildWorld().then(() => {
          applyCamera();
          app.render();
          window.dispatchEvent(new Event("shadowium:editor-viewport-restored"));
        });
      };
      app.canvas.addEventListener("webglcontextlost", contextLostHandler);
      app.canvas.addEventListener("webglcontextrestored", contextRestoredHandler);
      resizeObserver = new ResizeObserver(() => {
        if (disposed || !host.isConnected || host.clientWidth <= 0 || host.clientHeight <= 0) return;
        app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
        applyCamera();
        app.render();
      });
      resizeObserver.observe(host);
      const world = new Container();
      world.sortableChildren = true;
      app.stage.addChild(world);
      appRef.current = app;
      worldRef.current = world;
      viewportDisposedRef.current = false;
      runtimeBootStageRef.current = "Renderer ready";
      if (!initializedCameraRef.current) {
        initializedCameraRef.current = true;
        resetCamera();
      }
      if (runtimeMode && playStateRef.current !== "stopped" && runtimeObjectsRef.current.size === 0) {
        initializeRuntimeScene();
      }
      await rebuildWorld();
      if (!runtimeMode) {
        window.requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("shadowium:editor-viewport-restored", { detail: { width: host.clientWidth, height: host.clientHeight, frameRendered: true } })));
      }

      app.ticker.add((ticker) => {
        if (runtimeMode && runtimeSessionIdRef.current && !isRuntimeSessionCurrent(runtimeSessionIdRef.current)) return;
        const frameStartedAt = performance.now();
        runtimeFrameStartedAtRef.current = frameStartedAt;
        const stepping = playStateRef.current === "paused" && runtimeStepRequestedRef.current > 0;
        const deltaSeconds = stepping ? 1 / 60 : Math.min(ticker.deltaMS / 1000, 0.05);
        if (playStateRef.current === "stopped") {
          void updateEditorAnimationPreviews(deltaSeconds);
          return;
        }
        if (playStateRef.current !== "playing" && !stepping) return;
        if (stepping) runtimeStepRequestedRef.current -= 1;
        const currentProject = projectRef.current;
        updateQuestSurvival(deltaSeconds);
        const pressed = pressedKeysRef.current;
        if (runtimeMenuPausedRef.current && !stepping) {
          emitRuntimeSnapshot();
          justPressedRef.current.clear();
          return;
        }
        if (cameraShakeRef.current.remainingMs > 0) {
          cameraShakeRef.current.remainingMs = Math.max(0, cameraShakeRef.current.remainingMs - ticker.deltaMS);
          cameraShakeRef.current.phase += ticker.deltaMS / 16.667;
          applyCamera();
        }

        const frameStartPositions = new Map([...runtimeObjectsRef.current.entries()].map(([id, state]) => [id, { x: state.x, y: state.y }]));
        const updateStartedAt = performance.now();
        for (const state of runtimeObjectsRef.current.values()) {
          if (!state.enabled || state.destroyed) continue;
          updatePhase8State(state, deltaSeconds);
          if (state.destroyed) continue;
          const input = state.object.components.find((element) => element.type === "player-input" && element.enabled);
          const movement = state.object.components.find((element) => element.type === "top-down-movement" && element.enabled);
          let moving = updateBuiltInRuntime(state, deltaSeconds, pressed);
          const platformer = state.object.components.find((element) => element.type === "platformer-movement" && element.enabled);
          if (input && movement && !platformer && input.settings.acceptInput !== false && !runtimeDialogueRef.current) {
            let horizontal = 0;
            let vertical = 0;
            if (actionPressed(currentProject, String(input.settings.moveLeftAction ?? "move-left"), pressed)) horizontal -= 1;
            if (actionPressed(currentProject, String(input.settings.moveRightAction ?? "move-right"), pressed)) horizontal += 1;
            if (actionPressed(currentProject, String(input.settings.moveUpAction ?? "move-up"), pressed)) vertical -= 1;
            if (actionPressed(currentProject, String(input.settings.moveDownAction ?? "move-down"), pressed)) vertical += 1;
            if (movement.settings.allowDiagonal === false && horizontal !== 0 && vertical !== 0) vertical = 0;
            if (movement.settings.normalizeDiagonal !== false && horizontal !== 0 && vertical !== 0) {
              horizontal /= Math.sqrt(2);
              vertical /= Math.sqrt(2);
            }
            moving = horizontal !== 0 || vertical !== 0;
            const directional = state.object.components.find(
              (element) => element.type === "directional-animation" && element.enabled,
            );
            const directionCount = Number(directional?.settings.directions ?? 4);

            if (directionCount >= 8 && horizontal !== 0 && vertical !== 0) {
              if (vertical < 0) state.lastDirection = horizontal < 0 ? "up-left" : "up-right";
              else state.lastDirection = horizontal < 0 ? "down-left" : "down-right";
            } else if (directionCount === 2) {
              if (horizontal !== 0) state.lastDirection = horizontal < 0 ? "left" : "right";
            } else if (Math.abs(horizontal) > Math.abs(vertical) && horizontal !== 0) {
              state.lastDirection = horizontal < 0 ? "left" : "right";
            } else if (vertical !== 0) {
              state.lastDirection = vertical < 0 ? "up" : "down";
            }

            const speed = Number(movement.settings.speed ?? 180);
            const acceleration = Math.max(0, Number(movement.settings.acceleration ?? 1800));
            const deceleration = Math.max(0, Number(movement.settings.deceleration ?? 2400));
            state.velocityX = approachValue(state.velocityX, horizontal * speed, (horizontal === 0 ? deceleration : acceleration) * deltaSeconds);
            state.velocityY = approachValue(state.velocityY, vertical * speed, (vertical === 0 ? deceleration : acceleration) * deltaSeconds);
            resolveMovement(state, state.velocityX * deltaSeconds, state.velocityY * deltaSeconds);
          }

          const visual = visualRef.current.get(state.object.id);
          if (visual) {
            const controllerOnly = isRuntimeControllerOnly(state.object);
            visual.group.visible = state.enabled && !state.destroyed && state.object.runtimeVisible !== false && !controllerOnly;
            visual.group.position.set(state.x, state.y);
            const particleLayer = visual.group.children.find((child) => child.label === "shadowium-particles") as Container | undefined;
            if (particleLayer) {
              const emitter = state.object.components.find((element) => element.type === "particle-emitter" && element.enabled);
              const lifetime = Math.max(0.05, Number(emitter?.settings.lifetime ?? 1));
              particleLayer.children.forEach((particle, index) => {
                const phase = (state.age / lifetime + index / Math.max(1, particleLayer.children.length)) % 1;
                particle.alpha = Math.sin(phase * Math.PI);
                particle.y -= deltaSeconds * (emitter?.settings.preset === "rain" ? -240 : emitter?.settings.preset === "snow" ? -24 : 36);
                if (Math.abs(particle.y) > Math.max(64, state.object.size.height)) particle.y = -state.object.size.height / 2;
              });
            }
          }
          void updateRuntimeAnimation(state, deltaSeconds, moving);
        }

        const updateMs = performance.now() - updateStartedAt;
        const aiStartedAt = performance.now();
        processPhase8Ai(deltaSeconds);
        const aiMs = performance.now() - aiStartedAt;
        const physicsStartedAt = performance.now();
        processRuntimeJoints(deltaSeconds);
        applyRuntimeHierarchy(frameStartPositions);
        processTriggers();
        const physicsMs = performance.now() - physicsStartedAt;
        const combatStartedAt = performance.now();
        processDamageAndGameplay();
        processInteraction();
        const combatMs = performance.now() - combatStartedAt;
        updateVisualTransforms();
        updateRuntimeVisibilityEffects(deltaSeconds);
        updateRuntimeAudioVolumes();

        const cameraState = activeRuntimeCameraState();
        const cameraElement = cameraElementForState(cameraState);
        const followComponent = cameraState?.object.components.find((component) => component.type === "camera-follow" && component.enabled);
        const smoothingComponent = cameraState?.object.components.find((component) => component.type === "camera-smoothing" && component.enabled);
        const lookAheadComponent = cameraState?.object.components.find((component) => component.type === "camera-look-ahead" && component.enabled);
        const boundsComponent = cameraState?.object.components.find((component) => component.type === "camera-bounds" && component.enabled);
        const followId = String(followComponent?.settings.targetObjectId ?? "").trim();
        const followName = String(followComponent?.settings.targetName ?? cameraElement?.settings.followTargetName ?? "").trim();
        const followMode = String(followComponent?.settings.mode ?? (cameraElement ? "smooth" : "centered"));
        const runtimeStates = [...runtimeObjectsRef.current.values()].filter((state) => state.enabled && !state.destroyed);
        const target = runtimeStates.find((state) => followId && state.object.id === followId)
          ?? runtimeStates.find((state) => followName && state.object.name === followName)
          ?? runtimeStates.find((state) => !cameraElement && state.object.components.some((component) => component.type === "camera-target" && component.enabled && component.settings.followEnabled !== false))
          ?? runtimeStates.find((state) => state.object.components.some((component) => component.type === "player-input" && component.enabled));
        const viewport = hostRef.current;
        if (target && viewport) {
          const legacyCamera = target.object.components.find((component) => component.type === "camera-target");
          const zoneState = activeCameraZoneRef.current ? runtimeObjectsRef.current.get(activeCameraZoneRef.current) : undefined;
          const zoneElement = zoneState?.object.components.find((component) => component.type === "camera-zone" && component.enabled);
          const legacySmoothing = Number(zoneElement?.settings.smoothing ?? cameraElement?.settings.smoothing ?? legacyCamera?.settings.smoothing ?? 0.15);
          const smoothingX = followMode === "centered" ? 1 : Number(smoothingComponent?.settings.horizontal ?? legacySmoothing);
          const smoothingY = followMode === "centered" ? 1 : Number(smoothingComponent?.settings.vertical ?? legacySmoothing);
          const desiredFov = clampCameraFov(Number(zoneElement?.settings.fieldOfView ?? cameraElement?.settings.fieldOfView ?? 60));
          let desiredBaseZoom = Number(zoneElement?.settings.zoom ?? cameraElement?.settings.zoom ?? 1);
          const currentView = cameraWorldView(cameraRef.current, viewport.clientWidth, viewport.clientHeight);

          const additionalTargetIds = String(followComponent?.settings.additionalTargets ?? "").split(",").map((value) => value.trim()).filter(Boolean);
          const followedStates = followMode === "multi-target"
            ? [target, ...runtimeStates.filter((state) => additionalTargetIds.includes(state.object.id) || additionalTargetIds.includes(state.object.name))].filter((state, index, array) => array.findIndex((candidate) => candidate.object.id === state.object.id) === index)
            : [target];
          let focusX = followedStates.reduce((sum, state) => sum + state.x, 0) / followedStates.length;
          let focusY = followedStates.reduce((sum, state) => sum + state.y, 0) / followedStates.length;
          if (followMode === "multi-target" && followedStates.length > 1) {
            const padding = Math.max(0, Number(followComponent?.settings.multiTargetPadding ?? 96));
            const left = Math.min(...followedStates.map((state) => state.x - state.object.size.width / 2));
            const right = Math.max(...followedStates.map((state) => state.x + state.object.size.width / 2));
            const top = Math.min(...followedStates.map((state) => state.y - state.object.size.height / 2));
            const bottom = Math.max(...followedStates.map((state) => state.y + state.object.size.height / 2));
            const fitZoom = Math.min(viewport.clientWidth / Math.max(1, right - left + padding * 2), viewport.clientHeight / Math.max(1, bottom - top + padding * 2));
            desiredBaseZoom = Math.min(desiredBaseZoom, fitZoom);
            focusX = (left + right) / 2;
            focusY = (top + bottom) / 2;
          }

          const desiredZoom = clampZoom(cameraZoomForFov(desiredBaseZoom, desiredFov));
          const zoomInterpolation = runtimeCameraNeedsSnapRef.current ? 1 : 1 - Math.pow(1 - Math.min(1, Math.max(0.01, Math.max(smoothingX, smoothingY))), ticker.deltaMS / 16.667);
          cameraFovRef.current += (desiredFov - cameraFovRef.current) * zoomInterpolation;
          cameraRef.current.zoom += (desiredZoom - cameraRef.current.zoom) * zoomInterpolation;

          const velocityLength = Math.hypot(target.velocityX, target.velocityY);
          const velocityDirectionX = velocityLength > 0.001 ? target.velocityX / velocityLength : target.lastDirection.includes("left") ? -1 : target.lastDirection.includes("right") ? 1 : 0;
          const velocityDirectionY = velocityLength > 0.001 ? target.velocityY / velocityLength : target.lastDirection.includes("up") ? -1 : target.lastDirection.includes("down") ? 1 : 0;
          const legacyLookAhead = Number(cameraElement?.settings.lookAhead ?? 0);
          const lookAheadX = Number(lookAheadComponent?.settings.horizontal ?? legacyLookAhead);
          const lookAheadY = Number(lookAheadComponent?.settings.vertical ?? legacyLookAhead);
          const lookAheadResponse = Math.max(0.001, Math.min(1, Number(lookAheadComponent?.settings.response ?? 0.14)));
          const lookAheadInterpolation = runtimeCameraNeedsSnapRef.current ? 1 : 1 - Math.pow(1 - lookAheadResponse, ticker.deltaMS / 16.667);
          const requestedLookAheadX = velocityDirectionX * lookAheadX;
          const requestedLookAheadY = velocityDirectionY * lookAheadY;
          cameraLookAheadRef.current.x += (requestedLookAheadX - cameraLookAheadRef.current.x) * lookAheadInterpolation;
          cameraLookAheadRef.current.y += (requestedLookAheadY - cameraLookAheadRef.current.y) * lookAheadInterpolation;
          focusX += Number(followComponent?.settings.offsetX ?? legacyCamera?.settings.offsetX ?? 0) + cameraLookAheadRef.current.x;
          focusY += Number(followComponent?.settings.offsetY ?? legacyCamera?.settings.offsetY ?? 0) + cameraLookAheadRef.current.y;

          const deadZoneWidth = followMode === "dead-zone" || followMode === "platformer" ? Math.max(0, Number(cameraElement?.settings.deadZoneWidth ?? 64)) : 0;
          const deadZoneHeight = followMode === "dead-zone" || followMode === "platformer" ? Math.max(0, Number(cameraElement?.settings.deadZoneHeight ?? (followMode === "platformer" ? 96 : 48))) : 0;
          const deltaX = focusX - currentView.centerX;
          const deltaY = focusY - currentView.centerY;
          let desiredCenterX = deadZoneWidth > 0 && Math.abs(deltaX) <= deadZoneWidth / 2 ? currentView.centerX : focusX - (deadZoneWidth > 0 ? Math.sign(deltaX) * deadZoneWidth / 2 : 0);
          let desiredCenterY = deadZoneHeight > 0 && Math.abs(deltaY) <= deadZoneHeight / 2 ? currentView.centerY : focusY - (deadZoneHeight > 0 ? Math.sign(deltaY) * deadZoneHeight / 2 : 0);
          if (followComponent?.settings.followX === false || zoneElement?.settings.lockX === true) desiredCenterX = currentView.centerX;
          if (followComponent?.settings.followY === false || zoneElement?.settings.lockY === true) desiredCenterY = currentView.centerY;

          const shouldClamp = boundsComponent?.settings.enabled === true || cameraElement?.settings.clampToBounds === true;
          if (shouldClamp) {
            const clamped = clampCameraCenter(desiredCenterX, desiredCenterY, currentView.width, currentView.height, {
              left: Number(boundsComponent?.settings.left ?? cameraElement?.settings.boundsLeft ?? -640),
              top: Number(boundsComponent?.settings.top ?? cameraElement?.settings.boundsTop ?? -360),
              right: Number(boundsComponent?.settings.right ?? cameraElement?.settings.boundsRight ?? 640),
              bottom: Number(boundsComponent?.settings.bottom ?? cameraElement?.settings.boundsBottom ?? 360),
            });
            desiredCenterX = clamped.x;
            desiredCenterY = clamped.y;
          }

          const maximumFollowSpeed = Math.max(0, Number(followComponent?.settings.maximumSpeed ?? 0));
          if (maximumFollowSpeed > 0 && !runtimeCameraNeedsSnapRef.current) {
            const centerDeltaX = desiredCenterX - currentView.centerX;
            const centerDeltaY = desiredCenterY - currentView.centerY;
            const centerDistance = Math.hypot(centerDeltaX, centerDeltaY);
            const maximumDistance = maximumFollowSpeed * deltaSeconds;
            if (centerDistance > maximumDistance && centerDistance > 0.0001) {
              desiredCenterX = currentView.centerX + centerDeltaX / centerDistance * maximumDistance;
              desiredCenterY = currentView.centerY + centerDeltaY / centerDistance * maximumDistance;
            }
          }

          const desiredX = viewport.clientWidth / 2 - desiredCenterX * cameraRef.current.zoom;
          const desiredY = viewport.clientHeight / 2 - desiredCenterY * cameraRef.current.zoom;
          const interpolationX = runtimeCameraNeedsSnapRef.current ? 1 : 1 - Math.pow(1 - Math.min(1, Math.max(0.01, smoothingX)), ticker.deltaMS / 16.667);
          const interpolationY = runtimeCameraNeedsSnapRef.current ? 1 : 1 - Math.pow(1 - Math.min(1, Math.max(0.01, smoothingY)), ticker.deltaMS / 16.667);
          cameraRef.current.x += (desiredX - cameraRef.current.x) * interpolationX;
          cameraRef.current.y += (desiredY - cameraRef.current.y) * interpolationY;
          runtimeCameraNeedsSnapRef.current = false;
          applyCamera();
        } else {
          emitRuntimeSnapshot();
        }

        const frameMs = performance.now() - frameStartedAt;
        const activeStates = [...runtimeObjectsRef.current.values()].filter((state) => state.enabled && !state.destroyed);
        const profilerFrame: RuntimeProfilerSnapshot = {
          at: performance.now(),
          frameMs,
          updateMs,
          physicsMs,
          aiMs,
          combatMs,
          scriptsMs: 0,
          renderMs: Math.max(0, frameMs - updateMs - physicsMs - aiMs - combatMs),
          activeObjects: activeStates.length,
          activeComponents: activeStates.reduce((sum, state) => sum + state.object.components.filter((component) => component.enabled).length, 0),
          drawCalls: visualRef.current.size,
          particles: activeStates.reduce((sum, state) => sum + (componentOf(state.object, "particle-emitter") ? Math.max(1, Number(componentOf(state.object, "particle-emitter")?.settings.emissionRate ?? 0)) : 0), 0),
          audioVoices: runtimeAudioRef.current.size,
        };
        runtimeProfilerRef.current = [...runtimeProfilerRef.current.slice(-239), profilerFrame];
        justPressedRef.current.clear();
      });
    }

    void initialize(mountElement).catch((error: unknown) => {
      const message = `Scene viewport failed: ${error instanceof Error ? error.message : String(error)}`;
      useEditorStore.getState().setStatus(message, "error");
      runtimeLog(message, "error");
    });

    return () => {
      disposed = true;
      viewportDisposedRef.current = true;
      requestedRebuildRef.current += 1;
      renderGenerationRef.current += 1;
      resizeObserver?.disconnect();
      if (mountedApp?.canvas && contextLostHandler) mountedApp.canvas.removeEventListener("webglcontextlost", contextLostHandler);
      if (mountedApp?.canvas && contextRestoredHandler) mountedApp.canvas.removeEventListener("webglcontextrestored", contextRestoredHandler);
      stopRuntimeAudio();
      runtimeObjectsRef.current.clear();
      const activeWorld = worldRef.current;
      worldRef.current = null;
      appRef.current = null;
      visualRef.current.clear();
      destroyContainerSafely(activeWorld);
      if (mountedApp) {
        try {
          mountedApp.destroy(true, { children: true, texture: false, textureSource: false });
        } catch (error) {
          console.warn("Scene viewport cleanup warning:", error);
        }
      }
      if (runtimeMode) runtimeDisposedCallbackRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!worldRef.current) return;
    if (playState !== "stopped" && runtimeObjectsRef.current.size === 0) {
      initializeRuntimeScene();
    }
    if (playState === "stopped") {
      stopRuntimeAudio();
      runtimeObjectsRef.current.clear();
      runtimeSceneIdRef.current = null;
      runtimeBootStageRef.current = "Stopped";
      updateRuntimeScreenStack([]);
      setInteractionPrompt(null);
      setDialogue(null);
      refreshRuntimeUi();
    }
    void rebuildWorld();
  }, [project, projectPath, selectedObjectId, selectedObjectIds, showGrid, showColliders, gridSize, playState, activeTool, ctrlRotateVisible, restartToken]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Control" && !runtimeMode && playStateRef.current === "stopped") setCtrlRotateVisible(true);
      if (shouldIgnoreKeyboardTarget(event.target)) return;
      if (runtimeMode && playStateRef.current !== "stopped") {
        setRuntimeInputDevice("keyboard");
        const hasScreen = runtimeScreenStackRef.current.length > 0;
        if (!hasScreen && event.code === "Escape" && screenRootForId("pause-menu")) {
          updateRuntimeScreenStack(["pause-menu"]);
          event.preventDefault();
          return;
        }
        if (hasScreen && ["ArrowUp", "KeyW", "ArrowLeft", "KeyA"].includes(event.code)) {
          if (!event.repeat) moveRuntimeMenuSelection(-1);
          event.preventDefault();
          return;
        }
        if (hasScreen && ["ArrowDown", "KeyS", "ArrowRight", "KeyD"].includes(event.code)) {
          if (!event.repeat) moveRuntimeMenuSelection(1);
          event.preventDefault();
          return;
        }
        if (hasScreen && ["Enter", "Space", "KeyE"].includes(event.code)) {
          if (!event.repeat) activateSelectedRuntimeMenuItem();
          event.preventDefault();
          return;
        }
        if (hasScreen && ["Escape", "Backspace"].includes(event.code)) {
          if (!event.repeat) {
            const top = runtimeScreenStackRef.current[runtimeScreenStackRef.current.length - 1];
            const root = screenRootForId(top);
            const screen = root?.object.components.find((element) => element.type === "ui-menu-screen" && element.enabled);
            if (runtimeScreenStackRef.current.length > 1 || screen?.settings.startVisible !== true) closeRuntimeScreen();
          }
          event.preventDefault();
          return;
        }
      }
      if (runtimeMode && runtimeDialogueRef.current && ["KeyE", "Enter", "Space"].includes(event.code)) {
        if (!event.repeat) advanceDialogue();
        event.preventDefault();
        return;
      }
      if (event.code === "Space") {
        spacePressedRef.current = true;
        event.preventDefault();
      }
      if (!pressedKeysRef.current.has(event.code)) justPressedRef.current.add(event.code);
      pressedKeysRef.current.add(event.code);
      if (playStateRef.current !== "stopped" && ["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
      }
    }
    function handleKeyUp(event: KeyboardEvent): void {
      if (event.key === "Control") setCtrlRotateVisible(false);
      if (event.code === "Space") spacePressedRef.current = false;
      pressedKeysRef.current.delete(event.code);
      justPressedRef.current.delete(event.code);
    }
    function clear(): void {
      pressedKeysRef.current.clear();
      justPressedRef.current.clear();
      spacePressedRef.current = false;
      setCtrlRotateVisible(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clear);
    };
  }, []);

  useEffect(() => {
    if (!runtimeMode) return;
    let frame = 0;
    function pollGamepads(time: number): void {
      const gamepad = navigator.getGamepads?.().find((candidate) => candidate?.connected) ?? null;
      if (gamepad && playStateRef.current !== "stopped") {
        const pressed = new Set<number>();
        gamepad.buttons.forEach((button, index) => { if (button.pressed) pressed.add(index); });
        const newlyPressed = (index: number) => pressed.has(index) && !gamepadPressedRef.current.has(index);
        const axisY = gamepad.axes[1] ?? 0;
        const axisX = gamepad.axes[0] ?? 0;
        const directional = Math.abs(axisY) > 0.6 || Math.abs(axisX) > 0.6 || pressed.has(12) || pressed.has(13) || pressed.has(14) || pressed.has(15);
        if (pressed.size || directional) setRuntimeInputDevice("gamepad");
        if (runtimeScreenStackRef.current.length) {
          if (directional && time - gamepadNavigationAtRef.current > 180) {
            const delta = pressed.has(12) || pressed.has(14) || axisY < -0.6 || axisX < -0.6 ? -1 : 1;
            moveRuntimeMenuSelection(delta);
            gamepadNavigationAtRef.current = time;
          }
          if (newlyPressed(0)) activateSelectedRuntimeMenuItem();
          if (newlyPressed(1)) closeRuntimeScreen();
        } else if (newlyPressed(9) && screenRootForId("pause-menu")) {
          updateRuntimeScreenStack(["pause-menu"]);
        }
        gamepadPressedRef.current = pressed;
      } else {
        gamepadPressedRef.current.clear();
      }
      frame = window.requestAnimationFrame(pollGamepads);
    }
    frame = window.requestAnimationFrame(pollGamepads);
    return () => window.cancelAnimationFrame(frame);
  }, [runtimeMode]);

  useEffect(() => {
    if (!runtimeMode) return;
    function requestStep(): void {
      runtimeStepRequestedRef.current += 1;
      runtimeLog("Advanced one paused frame.", "event");
    }
    window.addEventListener(RUNTIME_STEP_EVENT, requestStep);
    return () => window.removeEventListener(RUNTIME_STEP_EVENT, requestStep);
  }, [runtimeMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function handleWheel(event: WheelEvent): void {
      if (runtimeMode) return;
      event.preventDefault();
      setCameraZoom(cameraRef.current.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY);
    }
    host.addEventListener("wheel", handleWheel, { passive: false });
    return () => host.removeEventListener("wheel", handleWheel);
  }, [runtimeMode]);

  function tilemapCellAtPoint(object: GameObjectDocument, point: Vector2): { column: number; row: number; key: string } | null {
    const tilemap = object.components.find((element) => element.type === "tilemap-renderer" && element.enabled);
    if (!tilemap) return null;
    const tileWidth = Math.max(1, Number(tilemap.settings.tileWidth ?? 32));
    const tileHeight = Math.max(1, Number(tilemap.settings.tileHeight ?? 32));
    const mapWidth = Math.max(1, Number(tilemap.settings.mapWidth ?? 32));
    const mapHeight = Math.max(1, Number(tilemap.settings.mapHeight ?? 24));
    const left = object.transform.position.x - (mapWidth * tileWidth) / 2;
    const top = object.transform.position.y - (mapHeight * tileHeight) / 2;
    const column = Math.floor((point.x - left) / tileWidth);
    const row = Math.floor((point.y - top) / tileHeight);
    if (column < 0 || row < 0 || column >= mapWidth || row >= mapHeight) return null;
    return { column, row, key: `${column},${row}` };
  }

  function applyTileTool(object: GameObjectDocument, point: Vector2): string | null {
    const cell = tilemapCellAtPoint(object, point);
    if (!cell) return null;
    const store = useEditorStore.getState();
    const tilemap = object.components.find((element) => element.type === "tilemap-renderer");
    if (!tilemap) return null;
    if (activeTool === "tile-fill") {
      store.fillTilemap(object.id, store.selectedTileId);
    } else if (activeTool === "tile-picker") {
      let cells: Record<string, string> = {};
      try { cells = JSON.parse(String(tilemap.settings.cells ?? "{}")) as Record<string, string>; } catch { cells = {}; }
      const picked = cells[cell.key];
      if (picked) store.setSelectedTile(picked);
    } else {
      store.paintTileBrush(object.id, cell.column, cell.row, activeTool === "tile-erase");
    }
    return cell.key;
  }

  function startPointer(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 && event.button !== 1) return;
    event.currentTarget.focus();
    const shouldPan = event.button === 1 || spacePressedRef.current || activeTool === "pan";
    if (shouldPan) {
      pointerRef.current = {
        ...pointerRef.current,
        mode: "pan",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startCameraX: cameraRef.current.x,
        startCameraY: cameraRef.current.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (playState !== "stopped") return;

    const point = screenToWorld(event.clientX, event.clientY);
    const scene = getActiveScene(project);
    const selected = scene.objects.find((object) => object.id === selectedObjectId);
    if (["tile-paint", "tile-erase", "tile-fill", "tile-picker"].includes(activeTool) && selected?.components.some((element) => element.type === "tilemap-renderer")) {
      const lastTileKey = applyTileTool(selected, point);
      if (lastTileKey && (activeTool === "tile-paint" || activeTool === "tile-erase")) {
        pointerRef.current = { ...pointerRef.current, mode: "tile-paint", pointerId: event.pointerId, objectId: selected.id, lastTileKey };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      return;
    }
    if (activeTool === "collider" && selected) {
      const collider = colliderFor(selected);
      const bounds = colliderBounds(selected);
      if (collider && bounds) {
        const nearResize = Math.hypot(point.x - bounds.right, point.y - bounds.bottom) <= 12 / cameraRef.current.zoom;
        const inside = point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
        if (nearResize || inside) {
          useEditorStore.getState().beginInteraction();
          pointerRef.current = {
            ...pointerRef.current,
            mode: nearResize ? "collider-resize" : "collider-move",
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startCameraX: cameraRef.current.x,
            startCameraY: cameraRef.current.y,
            objectId: selected.id,
            componentId: collider.id,
            startObjectX: selected.transform.position.x,
            startObjectY: selected.transform.position.y,
            startColliderWidth: Number(collider.settings.width ?? selected.size.width),
            startColliderHeight: Number(collider.settings.height ?? selected.size.height),
            startColliderOffsetX: Number(collider.settings.offsetX ?? 0),
            startColliderOffsetY: Number(collider.settings.offsetY ?? 0),
            startWorldX: point.x,
            startWorldY: point.y,
            lastTileKey: "",
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
          return;
        }
      }
    }

    const candidates = hitTestSceneObjects(scene, point, { width: project.settings.gameWidth, height: project.settings.gameHeight });
    let object = candidates[0]?.object ?? null;
    if (event.altKey && candidates.length > 0) {
      const signature = candidates.map((candidate) => candidate.object.id).join("|");
      const index = overlapCycleRef.current.signature === signature
        ? (overlapCycleRef.current.index + 1) % candidates.length
        : 0;
      overlapCycleRef.current = { signature, index };
      object = candidates[index].object;
      const hostBounds = event.currentTarget.getBoundingClientRect();
      setOverlapMenu({
        x: event.clientX - hostBounds.left,
        y: event.clientY - hostBounds.top,
        names: candidates.map((candidate) => candidate.object.name),
        selectedIndex: index,
      });
      window.setTimeout(() => setOverlapMenu(null), 1800);
    } else {
      overlapCycleRef.current = { signature: "", index: -1 };
      setOverlapMenu(null);
    }

    const forceRotate = event.ctrlKey && !event.metaKey;
    const additive = event.shiftKey || event.metaKey;
    if (!object) {
      if (activeTool !== "select") return;
      if (!additive) useEditorStore.getState().setSelectedObjects([]);
      const hostBounds = event.currentTarget.getBoundingClientRect();
      setSelectionMarquee({
        startScreenX: event.clientX - hostBounds.left,
        startScreenY: event.clientY - hostBounds.top,
        endScreenX: event.clientX - hostBounds.left,
        endScreenY: event.clientY - hostBounds.top,
        additive,
      });
      pointerRef.current = {
        ...pointerRef.current,
        mode: "marquee",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startWorldX: point.x,
        startWorldY: point.y,
        objectId: null,
        componentId: null,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }

    const store = useEditorStore.getState();
    if (additive) store.selectObject(object.id, true);
    else if (!store.selectedObjectIds.includes(object.id)) store.selectObject(object.id, false);
    const selectedAfterClick = useEditorStore.getState().selectedObjectIds;
    if (!selectedAfterClick.includes(object.id)) return;

    const transformTool = forceRotate || ["select", "move", "rotate", "scale", "resize", "pivot"].includes(activeTool);
    if (!transformTool) return;
    const startSelectionPositions = Object.fromEntries(
      scene.objects
        .filter((candidate) => selectedAfterClick.includes(candidate.id))
        .map((candidate) => [candidate.id, { ...candidate.transform.position }]),
    );
    const handle = transformHandleAt(object, point, cameraRef.current.zoom);
    if ((activeTool === "scale" || activeTool === "resize") && !handle) return;

    useEditorStore.getState().beginInteraction();
    pointerRef.current = {
      ...pointerRef.current,
      mode: forceRotate || activeTool === "rotate" ? "object-rotate" : activeTool === "scale" ? "object-scale" : activeTool === "resize" ? "object-resize" : activeTool === "pivot" ? "object-pivot" : "object",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      objectId: object.id,
      componentId: null,
      startObjectX: object.transform.position.x,
      startObjectY: object.transform.position.y,
      startObjectWidth: object.size.width,
      startObjectHeight: object.size.height,
      startScaleX: object.transform.scale.x,
      startScaleY: object.transform.scale.y,
      startRotation: object.transform.rotation,
      startPivotX: object.transform.pivot?.x ?? 0.5,
      startPivotY: object.transform.pivot?.y ?? 0.5,
      startWorldX: point.x,
      startWorldY: point.y,
      startAngle: Math.atan2(point.y - object.transform.position.y, point.x - object.transform.position.x),
      startSelectionPositions,
      handle,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function movePointer(event: React.PointerEvent<HTMLDivElement>): void {
    const point = screenToWorld(event.clientX, event.clientY);
    setCursorWorld({ x: Math.round(point.x), y: Math.round(point.y) });
    const interaction = pointerRef.current;
    if (interaction.mode === "none" || interaction.pointerId !== event.pointerId) return;

    if (interaction.mode === "pan") {
      cameraRef.current.x = interaction.startCameraX + event.clientX - interaction.startClientX;
      cameraRef.current.y = interaction.startCameraY + event.clientY - interaction.startClientY;
      applyCamera();
      return;
    }

    if (interaction.mode === "marquee") {
      const hostBounds = event.currentTarget.getBoundingClientRect();
      setSelectionMarquee((current) => current ? { ...current, endScreenX: event.clientX - hostBounds.left, endScreenY: event.clientY - hostBounds.top } : current);
      return;
    }

    if (interaction.mode === "tile-paint" && interaction.objectId) {
      const object = getActiveScene(projectRef.current).objects.find((candidate) => candidate.id === interaction.objectId);
      const cell = object ? tilemapCellAtPoint(object, point) : null;
      if (object && cell && cell.key !== interaction.lastTileKey) {
        applyTileTool(object, point);
        interaction.lastTileKey = cell.key;
      }
      return;
    }

    const deltaX = (event.clientX - interaction.startClientX) / cameraRef.current.zoom;
    const deltaY = (event.clientY - interaction.startClientY) / cameraRef.current.zoom;
    if (interaction.mode === "object" && interaction.objectId) {
      for (const [objectId, start] of Object.entries(interaction.startSelectionPositions)) {
        let x = start.x + deltaX;
        let y = start.y + deltaY;
        if (snapToGrid) {
          x = Math.round(x / gridSize) * gridSize;
          y = Math.round(y / gridSize) * gridSize;
        }
        useEditorStore.getState().previewObjectPosition(objectId, x, y);
      }
    } else if (interaction.mode === "object-rotate" && interaction.objectId) {
      const angle = Math.atan2(point.y - interaction.startObjectY, point.x - interaction.startObjectX);
      let rotation = interaction.startRotation + (angle - interaction.startAngle) * 180 / Math.PI;
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
      useEditorStore.getState().previewObjectGeometry(interaction.objectId, { rotation });
    } else if (interaction.mode === "object-scale" && interaction.objectId) {
      const pivotX = interaction.startPivotX;
      const pivotY = interaction.startPivotY;
      const startWorldWidth = interaction.startObjectWidth * Math.abs(interaction.startScaleX);
      const startWorldHeight = interaction.startObjectHeight * Math.abs(interaction.startScaleY);
      const startLeft = interaction.startObjectX - startWorldWidth * pivotX;
      const startRight = startLeft + startWorldWidth;
      const startTop = interaction.startObjectY - startWorldHeight * pivotY;
      const startBottom = startTop + startWorldHeight;
      let nextLeft = startLeft;
      let nextRight = startRight;
      let nextTop = startTop;
      let nextBottom = startBottom;
      let scaleSignX = Math.sign(interaction.startScaleX || 1);
      let scaleSignY = Math.sign(interaction.startScaleY || 1);

      if (interaction.handle.includes("e")) {
        const dragged = startRight + deltaX;
        const signedExtent = dragged - startLeft;
        scaleSignX *= Math.sign(signedExtent || 1);
        nextLeft = Math.min(startLeft, dragged);
        nextRight = Math.max(startLeft, dragged);
        if (event.altKey) {
          const half = Math.max(0.5, Math.abs(dragged - interaction.startObjectX));
          nextLeft = interaction.startObjectX - half;
          nextRight = interaction.startObjectX + half;
          scaleSignX = Math.sign(interaction.startScaleX || 1);
        }
      } else if (interaction.handle.includes("w")) {
        const dragged = startLeft + deltaX;
        const signedExtent = startRight - dragged;
        scaleSignX *= Math.sign(signedExtent || 1);
        nextLeft = Math.min(startRight, dragged);
        nextRight = Math.max(startRight, dragged);
        if (event.altKey) {
          const half = Math.max(0.5, Math.abs(dragged - interaction.startObjectX));
          nextLeft = interaction.startObjectX - half;
          nextRight = interaction.startObjectX + half;
          scaleSignX = Math.sign(interaction.startScaleX || 1);
        }
      }
      if (interaction.handle.includes("s")) {
        const dragged = startBottom + deltaY;
        const signedExtent = dragged - startTop;
        scaleSignY *= Math.sign(signedExtent || 1);
        nextTop = Math.min(startTop, dragged);
        nextBottom = Math.max(startTop, dragged);
        if (event.altKey) {
          const half = Math.max(0.5, Math.abs(dragged - interaction.startObjectY));
          nextTop = interaction.startObjectY - half;
          nextBottom = interaction.startObjectY + half;
          scaleSignY = Math.sign(interaction.startScaleY || 1);
        }
      } else if (interaction.handle.includes("n")) {
        const dragged = startTop + deltaY;
        const signedExtent = startBottom - dragged;
        scaleSignY *= Math.sign(signedExtent || 1);
        nextTop = Math.min(startBottom, dragged);
        nextBottom = Math.max(startBottom, dragged);
        if (event.altKey) {
          const half = Math.max(0.5, Math.abs(dragged - interaction.startObjectY));
          nextTop = interaction.startObjectY - half;
          nextBottom = interaction.startObjectY + half;
          scaleSignY = Math.sign(interaction.startScaleY || 1);
        }
      }

      let worldWidth = Math.max(1, nextRight - nextLeft);
      let worldHeight = Math.max(1, nextBottom - nextTop);
      if (event.shiftKey && interaction.handle.length === 2) {
        const ratio = startWorldWidth / Math.max(1, startWorldHeight);
        if (Math.abs(worldWidth - startWorldWidth) >= Math.abs(worldHeight - startWorldHeight)) worldHeight = worldWidth / ratio;
        else worldWidth = worldHeight * ratio;
        if (interaction.handle.includes("w")) nextLeft = nextRight - worldWidth; else nextRight = nextLeft + worldWidth;
        if (interaction.handle.includes("n")) nextTop = nextBottom - worldHeight; else nextBottom = nextTop + worldHeight;
      }
      const scaleX = scaleSignX * worldWidth / Math.max(1, interaction.startObjectWidth);
      const scaleY = scaleSignY * worldHeight / Math.max(1, interaction.startObjectHeight);
      const x = nextLeft + worldWidth * pivotX;
      const y = nextTop + worldHeight * pivotY;
      useEditorStore.getState().previewObjectGeometry(interaction.objectId, { x, y, scaleX, scaleY });
    } else if (interaction.mode === "object-resize" && interaction.objectId) {
      const pivotX = interaction.startPivotX;
      const pivotY = interaction.startPivotY;
      const scaleAbsX = Math.max(0.001, Math.abs(interaction.startScaleX));
      const scaleAbsY = Math.max(0.001, Math.abs(interaction.startScaleY));
      const startWorldWidth = interaction.startObjectWidth * scaleAbsX;
      const startWorldHeight = interaction.startObjectHeight * scaleAbsY;
      let left = interaction.startObjectX - startWorldWidth * pivotX;
      let right = left + startWorldWidth;
      let top = interaction.startObjectY - startWorldHeight * pivotY;
      let bottom = top + startWorldHeight;

      if (interaction.handle.includes("e")) {
        right = Math.max(left + scaleAbsX, right + deltaX);
        if (event.altKey) left = interaction.startObjectX - (right - interaction.startObjectX);
      }
      if (interaction.handle.includes("w")) {
        left = Math.min(right - scaleAbsX, left + deltaX);
        if (event.altKey) right = interaction.startObjectX + (interaction.startObjectX - left);
      }
      if (interaction.handle.includes("s")) {
        bottom = Math.max(top + scaleAbsY, bottom + deltaY);
        if (event.altKey) top = interaction.startObjectY - (bottom - interaction.startObjectY);
      }
      if (interaction.handle.includes("n")) {
        top = Math.min(bottom - scaleAbsY, top + deltaY);
        if (event.altKey) bottom = interaction.startObjectY + (interaction.startObjectY - top);
      }

      let worldWidth = Math.max(scaleAbsX, right - left);
      let worldHeight = Math.max(scaleAbsY, bottom - top);
      if (event.shiftKey && interaction.handle.length === 2) {
        const ratio = interaction.startObjectWidth / Math.max(1, interaction.startObjectHeight);
        const candidateWidth = worldWidth / scaleAbsX;
        const candidateHeight = worldHeight / scaleAbsY;
        if (Math.abs(candidateWidth - interaction.startObjectWidth) >= Math.abs(candidateHeight - interaction.startObjectHeight)) {
          worldHeight = candidateWidth / ratio * scaleAbsY;
        } else {
          worldWidth = candidateHeight * ratio * scaleAbsX;
        }
        if (interaction.handle.includes("w")) left = right - worldWidth; else right = left + worldWidth;
        if (interaction.handle.includes("n")) top = bottom - worldHeight; else bottom = top + worldHeight;
      }
      let width = worldWidth / scaleAbsX;
      let height = worldHeight / scaleAbsY;
      if (snapToGrid) {
        width = Math.max(1, Math.round(width / gridSize) * gridSize);
        height = Math.max(1, Math.round(height / gridSize) * gridSize);
        worldWidth = width * scaleAbsX;
        worldHeight = height * scaleAbsY;
        if (interaction.handle.includes("w")) left = right - worldWidth; else right = left + worldWidth;
        if (interaction.handle.includes("n")) top = bottom - worldHeight; else bottom = top + worldHeight;
      }
      const x = left + worldWidth * pivotX;
      const y = top + worldHeight * pivotY;
      useEditorStore.getState().previewObjectGeometry(interaction.objectId, { x, y, width, height });
    } else if (interaction.mode === "object-pivot" && interaction.objectId) {
      const worldWidth = interaction.startObjectWidth * Math.abs(interaction.startScaleX);
      const worldHeight = interaction.startObjectHeight * Math.abs(interaction.startScaleY);
      const left = interaction.startObjectX - worldWidth * interaction.startPivotX;
      const top = interaction.startObjectY - worldHeight * interaction.startPivotY;
      const pivotX = Math.min(1, Math.max(0, (point.x - left) / Math.max(1, worldWidth)));
      const pivotY = Math.min(1, Math.max(0, (point.y - top) / Math.max(1, worldHeight)));
      useEditorStore.getState().previewObjectGeometry(interaction.objectId, { x: left + worldWidth * pivotX, y: top + worldHeight * pivotY, pivotX, pivotY });
    } else if (interaction.objectId && interaction.componentId && interaction.mode === "collider-move") {
      useEditorStore.getState().previewCollider(interaction.objectId, interaction.componentId, {
        offsetX: interaction.startColliderOffsetX + deltaX,
        offsetY: interaction.startColliderOffsetY + deltaY,
      });
    } else if (interaction.objectId && interaction.componentId && interaction.mode === "collider-resize") {
      useEditorStore.getState().previewCollider(interaction.objectId, interaction.componentId, {
        width: Math.max(1, interaction.startColliderWidth + deltaX * 2),
        height: Math.max(1, interaction.startColliderHeight + deltaY * 2),
      });
    }
  }

  function finishPointer(event: React.PointerEvent<HTMLDivElement>): void {
    const interaction = pointerRef.current;
    if (interaction.pointerId !== event.pointerId) return;
    if (interaction.mode === "object") useEditorStore.getState().commitInteraction("Moved selected objects");
    if (interaction.mode === "object-rotate") useEditorStore.getState().commitInteraction("Rotated object");
    if (interaction.mode === "object-scale") useEditorStore.getState().commitInteraction("Scaled object");
    if (interaction.mode === "object-resize") useEditorStore.getState().commitInteraction("Resized object");
    if (interaction.mode === "object-pivot") useEditorStore.getState().commitInteraction("Moved object pivot");
    if (interaction.mode === "collider-move" || interaction.mode === "collider-resize") {
      useEditorStore.getState().commitInteraction("Edited collider");
    }
    if (interaction.mode === "marquee") {
      const end = screenToWorld(event.clientX, event.clientY);
      const left = Math.min(interaction.startWorldX, end.x);
      const right = Math.max(interaction.startWorldX, end.x);
      const top = Math.min(interaction.startWorldY, end.y);
      const bottom = Math.max(interaction.startWorldY, end.y);
      const moved = Math.hypot(event.clientX - interaction.startClientX, event.clientY - interaction.startClientY) >= 4;
      if (moved) {
        const matches = objectsIntersectingArea(getActiveScene(projectRef.current), { left, right, top, bottom }).map((object) => object.id);
        const existing = selectionMarquee?.additive ? useEditorStore.getState().selectedObjectIds : [];
        useEditorStore.getState().setSelectedObjects([...existing, ...matches], matches[matches.length - 1] ?? existing[existing.length - 1] ?? null);
      }
      setSelectionMarquee(null);
    }
    pointerRef.current = {
      ...pointerRef.current,
      mode: "none",
      pointerId: -1,
      objectId: null,
      componentId: null,
      startSelectionPositions: {},
      handle: "",
      lastTileKey: "",
    };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const assetId = event.dataTransfer.getData("application/x-shadowium-asset-id");
    const prefabId = event.dataTransfer.getData("application/x-shadowium-template-id");
    const point = screenToWorld(event.clientX, event.clientY);
    if (assetId) useEditorStore.getState().addObjectFromAsset(assetId, point.x, point.y);
    if (prefabId) useEditorStore.getState().addObjectFromPrefab(prefabId, point.x, point.y);
  }

  function runtimeUiValue(source: string): number | string {
    const key = source.trim();
    if (key === "playerHealth" || key === "playerMaximumHealth") {
      const player = [...runtimeObjectsRef.current.values()].find((state) => state.object.components.some((element) => element.type === "player-input" && element.enabled));
      if (!player) return 0;
      if (key === "playerHealth") return player.health ?? 0;
      const health = player.object.components.find((element) => element.type === "health" && element.enabled);
      return Number(health?.settings.maximumHealth ?? 100);
    }
    if (key.startsWith("inventory.")) return runtimeInventoryRef.current[key.slice("inventory.".length)] ?? 0;
    if (key in runtimeInventoryRef.current) return runtimeInventoryRef.current[key] ?? 0;
    const value = runtimeVariablesRef.current[key];
    return typeof value === "boolean" ? String(value) : value ?? 0;
  }

  function runtimeText(template: string): string {
    return template.replace(/\{([^}]+)\}/g, (_match, key: string) => String(runtimeUiValue(key)));
  }

  function screenIdForObject(object: GameObjectDocument): string | null {
    let current: GameObjectDocument | undefined = object;
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const screen = current.components.find((element) => element.type === "ui-menu-screen" && element.enabled);
      if (screen) return String(screen.settings.screenId ?? current.name);
      current = current.parentId ? runtimeObjectsRef.current.get(current.parentId)?.object : undefined;
    }
    return null;
  }

  function screenRootForId(screenId: string): RuntimeObjectState | undefined {
    return [...runtimeObjectsRef.current.values()].find((state) => {
      const screen = state.object.components.find((element) => element.type === "ui-menu-screen" && element.enabled);
      return screen && String(screen.settings.screenId ?? state.object.name) === screenId;
    });
  }

  function updateRuntimeScreenStack(next: string[]): void {
    const unique = [...new Set(next.filter(Boolean))];
    runtimeScreenStackRef.current = unique;
    setRuntimeScreenStack(unique);
    runtimeMenuSelectionRef.current = 0;
    setRuntimeMenuSelection(0);
    const top = unique[unique.length - 1];
    const screen = top ? screenRootForId(top)?.object.components.find((element) => element.type === "ui-menu-screen" && element.enabled) : undefined;
    runtimeMenuPausedRef.current = screen?.settings.pauseGameplay === true;
    refreshRuntimeUi();
  }

  function initializeRuntimeScreens(): void {
    const startScreens = [...runtimeObjectsRef.current.values()]
      .filter((state) => state.enabled && !state.destroyed)
      .flatMap((state) => state.object.components.filter((element) => element.type === "ui-menu-screen" && element.enabled && element.settings.startVisible === true).map((element) => String(element.settings.screenId ?? state.object.name)));
    updateRuntimeScreenStack(startScreens);
    if (startScreens.length) runtimeLog(`Opened UI screens: ${startScreens.join(", ")}.`, "info");
  }

  function runtimeUiObjectVisible(object: GameObjectDocument): boolean {
    const screenId = screenIdForObject(object);
    if (!screenId) return true;
    return runtimeScreenStackRef.current.includes(screenId);
  }

  function runtimeMenuItems(screenId = runtimeScreenStackRef.current[runtimeScreenStackRef.current.length - 1] ?? ""): RuntimeObjectState[] {
    if (!screenId) return [];
    return [...runtimeObjectsRef.current.values()]
      .filter((state) => {
        if (!state.enabled || state.destroyed || screenIdForObject(state.object) !== screenId) return false;
        const item = state.object.components.find((element) => element.type === "ui-menu-item" && element.enabled);
        if (!item) return false;
        const visibleVariable = String(item.settings.visibleVariable ?? "").trim();
        return !visibleVariable || Boolean(runtimeVariablesRef.current[visibleVariable]);
      })
      .sort((left, right) => {
        const leftItem = left.object.components.find((element) => element.type === "ui-menu-item")!;
        const rightItem = right.object.components.find((element) => element.type === "ui-menu-item")!;
        return Number(leftItem.settings.order ?? 0) - Number(rightItem.settings.order ?? 0) || left.object.name.localeCompare(right.object.name);
      });
  }

  function setRuntimeInputDevice(device: "keyboard" | "gamepad" | "pointer"): void {
    if (runtimeInputDeviceRef.current === device) return;
    runtimeInputDeviceRef.current = device;
    setRuntimeInputDeviceState(device);
  }

  function moveRuntimeMenuSelection(delta: number): void {
    const items = runtimeMenuItems();
    if (!items.length) return;
    const topId = runtimeScreenStackRef.current[runtimeScreenStackRef.current.length - 1] ?? "";
    const screen = screenRootForId(topId)?.object.components.find((element) => element.type === "ui-menu-screen" && element.enabled);
    const wrap = screen?.settings.wrapNavigation !== false;
    let next = runtimeMenuSelectionRef.current + delta;
    if (wrap) next = (next + items.length) % items.length;
    else next = Math.max(0, Math.min(items.length - 1, next));
    runtimeMenuSelectionRef.current = next;
    setRuntimeMenuSelection(next);
    const selectedItem = items[next]?.object.components.find((element) => element.type === "ui-menu-item" && element.enabled);
    if (selectedItem) void playInterfaceSound(String(selectedItem.settings.navigationSoundAssetId ?? ""));
    refreshRuntimeUi();
  }

  function parseRuntimeMenuValue(value: unknown): JsonPrimitive {
    const text = String(value ?? "");
    if (text === "true") return true;
    if (text === "false") return false;
    if (text === "null") return null;
    const numeric = Number(text);
    return text.trim() !== "" && Number.isFinite(numeric) ? numeric : text;
  }

  async function playInterfaceSound(assetId: string): Promise<void> {
    if (!assetId) return;
    const asset = projectRef.current.assets.find((candidate) => candidate.id === assetId && candidate.kind === "audio");
    if (!asset) return;
    const dataUrl = await getAssetDataUrl(projectPathRef.current, asset);
    if (!dataUrl) return;
    const audio = new Audio(dataUrl);
    audio.volume = runtimeAudioGroupVolume("interface");
    try { await audio.play(); } catch { /* User gesture policies may block programmatic preview audio. */ }
  }

  function closeRuntimeScreen(screenId?: string): void {
    const stack = [...runtimeScreenStackRef.current];
    if (screenId) updateRuntimeScreenStack(stack.filter((candidate) => candidate !== screenId));
    else updateRuntimeScreenStack(stack.slice(0, -1));
  }

  function activateRuntimeMenuItem(objectId: string): void {
    const state = runtimeObjectsRef.current.get(objectId);
    const item = state?.object.components.find((element) => element.type === "ui-menu-item" && element.enabled);
    if (!state || !item) return;
    const enabledVariable = String(item.settings.enabledVariable ?? "").trim();
    if (item.settings.enabled === false || (enabledVariable && !Boolean(runtimeVariablesRef.current[enabledVariable]))) return;
    void playInterfaceSound(String(item.settings.confirmSoundAssetId ?? ""));
    fireRules("button-clicked", state.object.id, null);
    const action = String(item.settings.action ?? "none");
    const targetScreenId = String(item.settings.targetScreenId ?? "").trim();
    if (action === "resume" || action === "close-screen") {
      closeRuntimeScreen(targetScreenId || undefined);
    } else if (action === "open-screen") {
      if (targetScreenId && screenRootForId(targetScreenId)) updateRuntimeScreenStack([...runtimeScreenStackRef.current, targetScreenId]);
    } else if (action === "replace-screen") {
      if (targetScreenId && screenRootForId(targetScreenId)) updateRuntimeScreenStack([targetScreenId]);
    } else if (action === "toggle-screen") {
      if (!targetScreenId) return;
      updateRuntimeScreenStack(runtimeScreenStackRef.current.includes(targetScreenId)
        ? runtimeScreenStackRef.current.filter((candidate) => candidate !== targetScreenId)
        : [...runtimeScreenStackRef.current, targetScreenId]);
    } else if (action === "restart") {
      stopRuntimeAudio();
      initializeRuntimeScene(runtimeSceneIdRef.current ?? projectRef.current.settings.initialSceneId, false);
      void rebuildWorld();
    } else if (action === "quit") {
      window.dispatchEvent(new Event("shadowium:runtime-quit"));
    } else if (action === "change-scene") {
      const sceneId = String(item.settings.destinationSceneId ?? "");
      if (projectRef.current.scenes.some((scene) => scene.id === sceneId)) {
        stopRuntimeAudio();
        initializeRuntimeScene(sceneId, true, String(item.settings.destinationSpawnId ?? "default"));
        void rebuildWorld();
      }
    } else if (action === "set-variable") {
      const variable = String(item.settings.variable ?? "").trim();
      if (variable) {
        runtimeVariablesRef.current[variable] = parseRuntimeMenuValue(item.settings.value);
        fireRules("variable-changed", state.object.id, null);
      }
    } else if (action === "save-game") {
      saveRuntimeState();
    } else if (action === "load-game") {
      if (loadRuntimeState()) void rebuildWorld();
    }
    refreshRuntimeUi();
  }

  function activateSelectedRuntimeMenuItem(): void {
    const items = runtimeMenuItems();
    const state = items[Math.max(0, Math.min(items.length - 1, runtimeMenuSelectionRef.current))];
    if (state) activateRuntimeMenuItem(state.object.id);
  }

  function activateRuntimeButton(objectId: string): void {
    const state = runtimeObjectsRef.current.get(objectId);
    const button = state?.object.components.find((element) => element.type === "ui-button" && element.enabled);
    if (!state || !button) return;
    fireRules("button-clicked", state.object.id, null);
    const action = String(button.settings.action ?? "none");
    if (action === "resume") useEditorStore.getState().setPlayState("playing");
    if (action === "quit") useEditorStore.getState().setPlayState("stopped");
    if (action === "restart") {
      stopRuntimeAudio();
      initializeRuntimeScene(runtimeSceneIdRef.current ?? projectRef.current.settings.initialSceneId, false);
      void rebuildWorld();
    }
    if (action === "change-scene") {
      const sceneId = String(button.settings.destinationSceneId ?? "");
      if (projectRef.current.scenes.some((scene) => scene.id === sceneId)) {
        stopRuntimeAudio();
        initializeRuntimeScene(sceneId, true);
        void rebuildWorld();
      }
    }
  }

  const runtimeUiObjects = runtimeMode
    ? [...runtimeObjectsRef.current.values()].filter((state) => state.enabled && !state.destroyed && runtimeUiObjectVisible(state.object) && state.object.components.some((element) => element.enabled && (element.type.startsWith("ui-") || element.type === "minimap" || element.type === "screen-transition")))
    : [];
  const activeGameUiTheme = project.gameUiThemes?.find((theme) => theme.id === project.activeGameUiThemeId) ?? project.gameUiThemes?.[0];
  const runtimeUiThemeForObject = (object: GameObjectDocument) => {
    let current: GameObjectDocument | undefined = object;
    for (let depth = 0; current && depth < 12; depth += 1) {
      const binding = current.components.find((component) => component.type === "ui-theme-binding" && component.enabled);
      const themeId = String(binding?.settings.themeId ?? "").trim();
      if (themeId) {
        const theme = project.gameUiThemes?.find((candidate) => candidate.id === themeId);
        if (theme) return theme;
      }
      if (binding?.settings.inherit === false || !current.parentId) break;
      current = runtimeObjectsRef.current.get(current.parentId)?.object ?? getActiveScene(project).objects.find((candidate) => candidate.id === current?.parentId);
    }
    return activeGameUiTheme;
  };
  void runtimeUiVersion;
  void runtimeScreenStack;
  void runtimeMenuSelection;
  void runtimeInputDevice;

  return (
    <div
      ref={hostRef}
      className={`scene-viewport ${runtimeMode ? "scene-viewport-preview runtime-game-canvas" : ""}`}
      tabIndex={0}
      onPointerDown={startPointer}
      onPointerMove={movePointer}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
      onDrop={handleDrop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="viewport-hud top-left">
        <span className="scene-name-badge">{runtimeSceneIdRef.current && playState !== "stopped" ? project.scenes.find((scene) => scene.id === runtimeSceneIdRef.current)?.name : getActiveScene(project).name}</span>
        {runtimeMode && <span className={`runtime-badge ${playState}`}>{playState === "playing" ? "Game Running" : "Game Paused"}</span>}
      </div>

      <div className="viewport-hud top-right interactive">
        <button type="button" title="Zoom out" onPointerDown={(event) => event.stopPropagation()} onClick={() => setCameraZoom(cameraRef.current.zoom / 1.15)}><ZoomOut size={15} /></button>
        <span>{Math.round(cameraRef.current.zoom * 100)}%</span>
        <button type="button" title="Zoom in" onPointerDown={(event) => event.stopPropagation()} onClick={() => setCameraZoom(cameraRef.current.zoom * 1.15)}><ZoomIn size={15} /></button>
        <button type="button" title="Reset camera" onPointerDown={(event) => event.stopPropagation()} onClick={resetCamera}><RotateCcw size={15} /></button>
        <button type="button" title="Frame all objects" onPointerDown={(event) => event.stopPropagation()} onClick={frameCamera}><Maximize2 size={15} /></button>
      </div>

      <div className="viewport-hud bottom-left">
        <span><Crosshair size={13} /> X {cursorWorld.x} · Y {cursorWorld.y}</span>
        <span><Grid3X3 size={13} /> {gridSize}px</span>
      </div>

      {!runtimeMode && selectionMarquee && (
        <div
          className="viewport-selection-marquee"
          style={{
            left: Math.min(selectionMarquee.startScreenX, selectionMarquee.endScreenX),
            top: Math.min(selectionMarquee.startScreenY, selectionMarquee.endScreenY),
            width: Math.abs(selectionMarquee.endScreenX - selectionMarquee.startScreenX),
            height: Math.abs(selectionMarquee.endScreenY - selectionMarquee.startScreenY),
          }}
        />
      )}
      {!runtimeMode && overlapMenu && (
        <div className="viewport-overlap-menu" style={{ left: overlapMenu.x + 12, top: overlapMenu.y + 12 }}>
          <strong>Alt-click selection</strong>
          {overlapMenu.names.map((name, index) => <span key={`${name}-${index}`} className={index === overlapMenu.selectedIndex ? "active" : ""}>{name}</span>)}
        </div>
      )}

      {runtimeMode && (
        <div className="runtime-ui-layer" onPointerDown={(event) => event.stopPropagation()} style={activeGameUiTheme ? {
          "--game-ui-font": activeGameUiTheme.fontFamily,
          "--game-ui-text": activeGameUiTheme.textColor,
          "--game-ui-accent": activeGameUiTheme.accentColor,
          "--game-ui-panel": activeGameUiTheme.panelColor,
          "--game-ui-button": activeGameUiTheme.buttonColor,
          "--game-ui-selected": activeGameUiTheme.selectedColor,
          "--game-ui-selected-bg": activeGameUiTheme.selectedBackground,
          "--game-ui-radius": `${activeGameUiTheme.cornerRadius}px`,
          "--game-ui-spacing": `${activeGameUiTheme.spacing}px`,
        } as React.CSSProperties : undefined}>
          {runtimeUiObjects.map((state) => {
            const object = state.object;
            const resolvedUiTheme = runtimeUiThemeForObject(object);
            const responsive = object.components.find((element) => element.type === "responsive-layout" && element.enabled);
            const panel = object.components.find((element) => element.type === "ui-panel" && element.enabled && element.settings.visible !== false);
            const text = object.components.find((element) => element.type === "ui-text" && element.enabled && element.settings.visible !== false);
            const image = object.components.find((element) => element.type === "ui-image" && element.enabled && element.settings.visible !== false);
            const button = object.components.find((element) => element.type === "ui-button" && element.enabled);
            const progress = object.components.find((element) => element.type === "ui-progress-bar" && element.enabled);
            const slider = object.components.find((element) => element.type === "ui-slider" && element.enabled);
            const checkbox = object.components.find((element) => element.type === "ui-checkbox" && element.enabled);
            const menuScreen = object.components.find((element) => element.type === "ui-menu-screen" && element.enabled);
            const menuItem = object.components.find((element) => element.type === "ui-menu-item" && element.enabled);
            const selectionIndicator = object.components.find((element) => element.type === "ui-selection-indicator" && element.enabled);
            const actionGuide = object.components.find((element) => element.type === "ui-action-guide" && element.enabled);
            const inputGlyph = object.components.find((element) => element.type === "ui-input-glyph" && element.enabled);
            const tooltip = object.components.find((element) => element.type === "ui-tooltip" && element.enabled);
            const scrollList = object.components.find((element) => element.type === "ui-scroll-list" && element.enabled);
            const confirmDialog = object.components.find((element) => element.type === "ui-confirm-dialog" && element.enabled);
            const uiStyle = object.components.find((element) => element.type === "ui-style" && element.enabled);
            const minimap = object.components.find((element) => element.type === "minimap" && element.enabled);
            const transition = object.components.find((element) => element.type === "screen-transition" && element.enabled);
            const element = panel ?? text ?? image ?? button ?? progress ?? slider ?? checkbox ?? menuScreen ?? menuItem ?? actionGuide ?? inputGlyph ?? tooltip ?? scrollList ?? confirmDialog ?? minimap ?? transition ?? selectionIndicator ?? uiStyle;
            if (!element) return null;
            const anchor = String(element.settings.anchor ?? "top-left");
            const style = {
              "--ui-x": `${object.transform.position.x}px`,
              "--ui-y": `${object.transform.position.y}px`,
              "--ui-width": `${Math.max(1, object.size.width)}px`,
              "--ui-height": `${Math.max(1, object.size.height)}px`,
              minWidth: responsive ? `${Math.max(0, Number(responsive.settings.minWidth ?? 0))}px` : undefined,
              maxWidth: responsive ? `${Math.max(0, Number(responsive.settings.maxWidth ?? 100000))}px` : undefined,
              fontFamily: resolvedUiTheme?.fontFamily,
              borderRadius: resolvedUiTheme ? `${resolvedUiTheme.cornerRadius}px` : undefined,
            } as React.CSSProperties;
            if (uiStyle || selectionIndicator) return null;
            if (menuScreen) {
              const screenId = String(menuScreen.settings.screenId ?? object.name);
              const stackIndex = runtimeScreenStackRef.current.indexOf(screenId);
              if (stackIndex < 0) return null;
              const asset = project.assets.find((candidate) => candidate.id === String(menuScreen.settings.backgroundAssetId ?? ""));
              return (
                <section
                  key={object.id}
                  className={`runtime-menu-screen entrance-${String(menuScreen.settings.entrance ?? "fade")} layout-${String(menuScreen.settings.layout ?? "vertical-left")}`}
                  style={{
                    zIndex: 100 + stackIndex * 20,
                    background: String(menuScreen.settings.backgroundColor ?? "#e51f35"),
                    opacity: Number(menuScreen.settings.backgroundOpacity ?? 1),
                    backdropFilter: `blur(${Math.max(0, Number(menuScreen.settings.blurGameplay ?? 0))}px)`,
                  }}
                  data-screen-id={screenId}
                >
                  {asset && <div className="runtime-menu-background-image"><AssetThumbnail asset={asset} /></div>}
                </section>
              );
            }
            if (menuItem) {
              const screenId = screenIdForObject(object) ?? "";
              const items = runtimeMenuItems(screenId);
              const itemIndex = items.findIndex((candidate) => candidate.object.id === object.id);
              const activeScreen = runtimeScreenStackRef.current[runtimeScreenStackRef.current.length - 1] === screenId;
              const selected = activeScreen && itemIndex === runtimeMenuSelectionRef.current;
              const enabledVariable = String(menuItem.settings.enabledVariable ?? "").trim();
              const enabled = menuItem.settings.enabled !== false && (!enabledVariable || Boolean(runtimeVariablesRef.current[enabledVariable]));
              const root = screenRootForId(screenId);
              const children = root ? [...runtimeObjectsRef.current.values()].filter((candidate) => candidate.object.parentId === root.object.id) : [];
              const styleElement = children.flatMap((candidate) => candidate.object.components).find((candidate) => candidate.type === "ui-style" && candidate.enabled);
              const indicator = children.flatMap((candidate) => candidate.object.components).find((candidate) => candidate.type === "ui-selection-indicator" && candidate.enabled);
              const stackIndex = runtimeScreenStackRef.current.indexOf(screenId);
              const itemStyle = {
                ...style,
                zIndex: 110 + Math.max(0, stackIndex) * 20,
                "--menu-font": String(styleElement?.settings.fontFamily ?? resolvedUiTheme?.fontFamily ?? "Inter, system-ui, sans-serif"),
                "--menu-font-size": `${Number(styleElement?.settings.fontSize ?? 34)}px`,
                "--menu-normal-color": String(styleElement?.settings.normalColor ?? resolvedUiTheme?.textColor ?? "#ffffff"),
                "--menu-selected-color": String(indicator?.settings.textColor ?? styleElement?.settings.selectedColor ?? resolvedUiTheme?.selectedColor ?? "#292929"),
                "--menu-selection-color": String(indicator?.settings.color ?? styleElement?.settings.selectionColor ?? resolvedUiTheme?.selectedBackground ?? "#ffffff"),
                "--menu-accent-color": String(indicator?.settings.accentColor ?? styleElement?.settings.accentColor ?? resolvedUiTheme?.accentColor ?? "#e51f35"),
                "--menu-duration": `${Number(indicator?.settings.duration ?? 0.18)}s`,
                "--menu-selected-scale": Number(indicator?.settings.selectedScale ?? 1.045),
              } as React.CSSProperties;
              return (
                <button
                  key={object.id}
                  type="button"
                  className={`runtime-ui-control ui-${anchor} runtime-menu-item indicator-${String(indicator?.settings.style ?? "bar")} ${selected ? "selected" : ""}`}
                  style={itemStyle}
                  disabled={!enabled}
                  tabIndex={selected ? 0 : -1}
                  onPointerEnter={() => {
                    setRuntimeInputDevice("pointer");
                    if (itemIndex >= 0 && runtimeMenuSelectionRef.current !== itemIndex) {
                      runtimeMenuSelectionRef.current = itemIndex;
                      setRuntimeMenuSelection(itemIndex);
                      void playInterfaceSound(String(menuItem.settings.navigationSoundAssetId ?? ""));
                    }
                  }}
                  onClick={() => activateRuntimeMenuItem(object.id)}
                >
                  <span className="runtime-menu-selection-mark" />
                  {String(menuItem.settings.icon ?? "") && <em>{String(menuItem.settings.icon)}</em>}
                  <strong>{runtimeText(String(menuItem.settings.text ?? object.name))}</strong>
                </button>
              );
            }
            if (actionGuide) {
              const keyboard = runtimeInputDeviceRef.current !== "gamepad";
              const selectGlyph = keyboard ? "↑↓" : "L";
              const confirmGlyph = keyboard ? "Enter" : "A";
              const backGlyph = keyboard ? "Esc" : "B";
              const stackIndex = Math.max(0, runtimeScreenStackRef.current.length - 1);
              return (
                <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-action-guide`} style={{ ...style, zIndex: 119 + stackIndex * 20, background: String(actionGuide.settings.backgroundColor ?? "#ffffff"), color: String(actionGuide.settings.textColor ?? "#a98900") }}>
                  {actionGuide.settings.showSelect !== false && <span><kbd>{selectGlyph}</kbd>{String(actionGuide.settings.selectText ?? "Select")}</span>}
                  {actionGuide.settings.showConfirm !== false && <span><kbd>{confirmGlyph}</kbd>{String(actionGuide.settings.confirmText ?? "Confirm")}</span>}
                  {actionGuide.settings.showBack === true && <span><kbd>{backGlyph}</kbd>{String(actionGuide.settings.backText ?? "Back")}</span>}
                </div>
              );
            }
            if (inputGlyph) {
              const actionId = String(inputGlyph.settings.actionId ?? "interact");
              const action = project.settings.inputActions.find((candidate) => candidate.id === actionId);
              const key = action?.keys[0] ?? actionId;
              const glyph = runtimeInputDeviceRef.current === "gamepad" ? (actionId === "pause" ? "☰" : actionId === "jump" ? "A" : actionId === "attack" ? "X" : "A") : key.replace(/^Key/, "").replace(/^Arrow/, "");
              return <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-input-glyph`} style={style}><kbd>{glyph}</kbd><span>{String(inputGlyph.settings.label ?? action?.name ?? actionId)}</span></div>;
            }
            if (tooltip) {
              const visibleVariable = String(tooltip.settings.visibleVariable ?? "").trim();
              if (visibleVariable && !Boolean(runtimeVariablesRef.current[visibleVariable])) return null;
              return <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-tooltip`} style={style}>{runtimeText(String(tooltip.settings.text ?? object.name))}</div>;
            }
            if (scrollList) {
              return <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-scroll-list direction-${String(scrollList.settings.direction ?? "vertical")}`} style={{ ...style, gap: `${Number(scrollList.settings.gap ?? 10)}px` }} />;
            }
            if (confirmDialog) {
              const visibleVariable = String(confirmDialog.settings.visibleVariable ?? "showConfirm");
              if (!Boolean(runtimeVariablesRef.current[visibleVariable])) return null;
              const resultVariable = String(confirmDialog.settings.resultVariable ?? "confirmed");
              return <div key={object.id} className="runtime-confirm-dialog"><section><h3>{String(confirmDialog.settings.title ?? "Are you sure?")}</h3><p>{String(confirmDialog.settings.message ?? "")}</p><div><button type="button" onClick={() => { runtimeVariablesRef.current[resultVariable] = false; runtimeVariablesRef.current[visibleVariable] = false; refreshRuntimeUi(); }}>{String(confirmDialog.settings.cancelText ?? "Cancel")}</button><button type="button" className="confirm" onClick={() => { runtimeVariablesRef.current[resultVariable] = true; runtimeVariablesRef.current[visibleVariable] = false; fireRules("variable-changed", object.id, null); refreshRuntimeUi(); }}>{String(confirmDialog.settings.confirmText ?? "Confirm")}</button></div></section></div>;
            }
            if (panel) {
              return <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-ui-panel`} style={{ ...style, background: String(panel.settings.backgroundColor ?? resolvedUiTheme?.panelColor ?? "#10151dcc") }} />;
            }
            if (text) {
              return <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-ui-text`} style={{ ...style, color: String(text.settings.color ?? resolvedUiTheme?.textColor ?? "#fff"), fontSize: `${Number(text.settings.fontSize ?? 22)}px` }}>{runtimeText(String(text.settings.text ?? object.name))}</div>;
            }
            if (image) {
              const asset = project.assets.find((candidate) => candidate.id === String(image.settings.assetId ?? ""));
              return <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-ui-image`} style={{ ...style, opacity: Number(image.settings.opacity ?? 1) }}>{asset ? <AssetThumbnail asset={asset} /> : null}</div>;
            }
            if (button) {
              return <button key={object.id} type="button" className={`runtime-ui-control ui-${anchor} runtime-ui-button`} style={{ ...style, color: resolvedUiTheme?.textColor, background: resolvedUiTheme?.buttonColor }} onClick={() => activateRuntimeButton(object.id)}>{String(button.settings.text ?? object.name)}</button>;
            }
            if (slider) {
              const bindingType = String(slider.settings.bindingType ?? "variable");
              const variable = String(slider.settings.variable ?? "volume");
              const audioGroupId = String(slider.settings.audioGroupId ?? "master");
              const minimum = Number(slider.settings.minimum ?? 0);
              const maximum = Number(slider.settings.maximum ?? 1);
              const value = bindingType === "audio-group"
                ? Number(runtimeAudioGroupRef.current[audioGroupId]?.volume ?? minimum)
                : Number(runtimeVariablesRef.current[variable] ?? minimum);
              return <label key={object.id} className={`runtime-ui-control ui-${anchor} runtime-ui-slider`} style={style}><span>{object.name}</span><input type="range" min={minimum} max={maximum} step={Number(slider.settings.step ?? 0.05)} value={value} onChange={(event) => {
                const nextValue = Number(event.target.value);
                if (bindingType === "audio-group") {
                  const group = runtimeAudioGroupRef.current[audioGroupId] ?? { volume: 1, muted: false };
                  runtimeAudioGroupRef.current[audioGroupId] = { ...group, volume: nextValue };
                  updateRuntimeAudioVolumes();
                } else {
                  runtimeVariablesRef.current[variable] = nextValue;
                  fireRules("variable-changed", object.id, null);
                }
                refreshRuntimeUi();
              }} /><output>{value.toFixed(2)}</output></label>;
            }
            if (checkbox) {
              const variable = String(checkbox.settings.variable ?? "enabled");
              const checked = Boolean(runtimeVariablesRef.current[variable]);
              return <label key={object.id} className={`runtime-ui-control ui-${anchor} runtime-ui-checkbox`} style={style}><input type="checkbox" checked={checked} onChange={(event) => { runtimeVariablesRef.current[variable] = event.target.checked; fireRules("variable-changed", object.id, null); refreshRuntimeUi(); }} /><span>{String(checkbox.settings.label ?? object.name)}</span></label>;
            }
            if (minimap) {
              const worldWidth = Math.max(1, Number(minimap.settings.worldWidth ?? currentViewportScene().width));
              const worldHeight = Math.max(1, Number(minimap.settings.worldHeight ?? currentViewportScene().height));
              const objects = [...runtimeObjectsRef.current.values()].filter((candidate) => candidate.enabled && !candidate.destroyed && !isRuntimeControllerOnly(candidate.object));
              const host = hostRef.current;
              const cameraView = cameraWorldView(
                cameraRef.current,
                host?.clientWidth ?? projectRef.current.settings.gameWidth,
                host?.clientHeight ?? projectRef.current.settings.gameHeight,
              );
              const mapX = (value: number) => (value / worldWidth + 0.5) * 100;
              const mapY = (value: number) => (value / worldHeight + 0.5) * 100;
              return (
                <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-element-minimap`} style={style}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Runtime minimap geometry">
                    {objects.map((candidate) => {
                      const geometry = objectWorldGeometry(candidate.object, candidate.x, candidate.y);
                      return <polygon key={candidate.object.id} points={geometry.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(" ")} fill={candidate.object.editorColor} opacity={candidate.object.components.some((component) => component.type === "player-input" && component.enabled) ? 1 : 0.7}><title>{candidate.object.name}</title></polygon>;
                    })}
                    {minimap.settings.showCamera !== false && (
                      <rect
                        className="runtime-element-minimap-camera"
                        x={mapX(cameraView.left)}
                        y={mapY(cameraView.top)}
                        width={Math.max(0.5, (cameraView.width / worldWidth) * 100)}
                        height={Math.max(0.5, (cameraView.height / worldHeight) * 100)}
                        aria-label="Active camera view"
                      >
                        <title>Active camera view</title>
                      </rect>
                    )}
                  </svg>
                </div>
              );
            }
            if (transition) {
              if (transition.settings.startVisible !== true) return null;
              return <div key={object.id} className="runtime-screen-transition" style={{ background: String(transition.settings.color ?? "#000000"), animationDuration: `${Math.max(0, Number(transition.settings.duration ?? 0.35))}s` }} />;
            }
            const value = Number(runtimeUiValue(String(progress?.settings.valueSource ?? "playerHealth")));
            const maximum = Math.max(1, Number(runtimeUiValue(String(progress?.settings.maximumSource ?? "playerMaximumHealth"))));
            const percent = Math.max(0, Math.min(100, value / maximum * 100));
            return (
              <div key={object.id} className={`runtime-ui-control ui-${anchor} runtime-ui-progress`} style={{ ...style, background: String(progress?.settings.backgroundColor ?? "#202832") }}>
                <span style={{ width: `${percent}%`, background: String(progress?.settings.fillColor ?? "#66bb6a") }} />
              </div>
            );
          })}
        </div>
      )}
      {runtimeMode && interactionPrompt && playState === "playing" && !runtimeDialogue && <div className="interaction-prompt">{interactionPrompt}</div>}
      {runtimeMode && runtimeDialogue && playState !== "stopped" && (
        <div className="runtime-dialogue" role="dialog" onPointerDown={(event) => event.stopPropagation()} onClick={() => { if (!runtimeDialogue.choices?.length) advanceDialogue(); }}>
          <strong>{runtimeDialogue.speaker}</strong>
          <span style={{ color: runtimeDialogue.textColor }}>{runtimeDialogue.lines[runtimeDialogue.index]}</span>
          {runtimeDialogue.choices?.length ? <div className="runtime-dialogue-choices">{runtimeDialogue.choices.map((choice) => <button key={choice.id} type="button" onClick={(event) => { event.stopPropagation(); chooseDialogue(choice.id); }}>{choice.label}</button>)}</div> : <small>{runtimeDialogue.graphId ? "E / Enter / click to continue" : runtimeDialogue.index + 1 < runtimeDialogue.lines.length ? "E / Enter / click to continue" : "E / Enter / click to close"}</small>}
        </div>
      )}
    </div>
  );
}
