import type { GameObjectDocument } from "./types";

export const RUNTIME_SNAPSHOT_EVENT = "shadowium-runtime-snapshot";
export const RUNTIME_STEP_EVENT = "shadowium-runtime-step";

export type RuntimeLogLevel = "info" | "warning" | "error" | "event";

export interface RuntimePreviewLogEntry {
  id: string;
  time: string;
  level: RuntimeLogLevel;
  message: string;
}

export interface RuntimePreviewStatusSnapshot {
  id: string;
  remainingSeconds: number;
  stacks: number;
}

export interface RuntimePreviewObjectSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  worldPoints: Array<{ x: number; y: number }>;
  colliderPoints: Array<{ x: number; y: number }>;
  color: string;
  kind: "player" | "tilemap" | "camera" | "pickup" | "exit" | "spawn" | "object";
  componentCount: number;
  health: number | null;
  maximumHealth: number | null;
  shield: number;
  maximumShield: number;
  velocityX: number;
  velocityY: number;
  teamId: string;
  aiState: string;
  aiPreviousState: string;
  aiTargetId: string | null;
  resources: Record<string, number>;
  cooldowns: Record<string, number>;
  statuses: RuntimePreviewStatusSnapshot[];
  stats: Record<string, number>;
  experience: number;
  level: number;
  currencies: Record<string, number>;
  activeClipId: string | null;
  animationFrame: number;
  animationFrameCount: number;
  animationState: string;
  spriteStatus: "ready" | "missing-asset" | "missing-frame" | "not-rendered";
}

export interface RuntimeCombatLogEntry {
  id: string;
  at: number;
  sourceName: string;
  targetName: string;
  damageTypeId: string;
  baseAmount: number;
  resistance: number;
  critical: boolean;
  shieldAbsorbed: number;
  finalAmount: number;
  healing: boolean;
}

export interface RuntimeAiTraceEntry {
  id: string;
  at: number;
  objectId: string;
  objectName: string;
  previousState: string;
  nextState: string;
  reason: string;
  targetObjectId: string | null;
  distance: number;
  lineOfSight: boolean;
  healthPercent: number;
}

export interface RuntimeScriptErrorEntry {
  id: string;
  at: number;
  objectId: string;
  scriptId: string;
  callback: string;
  line: number;
  message: string;
}

export interface RuntimeProfilerSnapshot {
  at: number;
  frameMs: number;
  updateMs: number;
  physicsMs: number;
  aiMs: number;
  combatMs: number;
  scriptsMs: number;
  renderMs: number;
  activeObjects: number;
  activeComponents: number;
  drawCalls: number;
  particles: number;
  audioVoices: number;
}

export interface RuntimePreviewSnapshot {
  sessionId: string;
  sessionGeneration: number;
  sessionState: "idle" | "starting" | "running" | "paused" | "stopping" | "disposed" | "crashed";
  sceneId: string | null;
  sceneName: string;
  bootStage: string;
  objectCount: number;
  visibleObjectCount: number;
  tilemapCount: number;
  activeCameraName: string;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  cameraFov: number;
  cameraView: { left: number; right: number; top: number; bottom: number; width: number; height: number };
  worldBounds: { left: number; right: number; top: number; bottom: number; width: number; height: number };
  objects: RuntimePreviewObjectSnapshot[];
  variables: Record<string, string | number | boolean | null>;
  inventory: Record<string, number>;
  logs: RuntimePreviewLogEntry[];
  errors: string[];
  combatLog: RuntimeCombatLogEntry[];
  aiTrace: RuntimeAiTraceEntry[];
  scriptErrors: RuntimeScriptErrorEntry[];
  profiler: RuntimeProfilerSnapshot[];
}


export function isRuntimeControllerOnly(object: GameObjectDocument): boolean {
  const hasWorldRenderer = object.components.some(
    (element) => element.enabled && (element.type === "sprite-renderer" || element.type === "tilemap-renderer" || element.type === "shape-renderer" || element.type === "text-renderer"),
  );
  if (hasWorldRenderer) return false;
  return object.components.some(
    (element) => element.enabled && (element.type === "camera" || element.type === "scene-spawn-point" || element.type === "audio-source" || element.type.startsWith("ui-") || element.type === "screen-transition" || element.type === "minimap" || element.type === "timer" || element.type === "score" || element.type === "counter" || element.type === "ambient-light-2d" || element.type === "navigation-region" || element.type === "patrol-path" || element.type === "save-manager"),
  );
}
