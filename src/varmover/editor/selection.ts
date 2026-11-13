import { objectWorldAabb, pointInObject } from "./spatial.ts";
import type { GameObjectDocument, SceneDocument, Vector2 } from "./types";

export interface ViewportHitCandidate {
  object: GameObjectDocument;
  selectionPriority: number;
  sceneLayerOrder: number;
  objectRenderOrder: number;
  area: number;
  sourceIndex: number;
}

function objectArea(object: GameObjectDocument): number {
  return Math.max(1, object.size.width * Math.abs(object.transform.scale.x)) *
    Math.max(1, object.size.height * Math.abs(object.transform.scale.y));
}

function containsPoint(
  object: GameObjectDocument,
  point: Vector2,
  gameViewport?: { width: number; height: number },
): boolean {
  if (pointInObject(object, point)) return true;

  const camera = object.components.find((element) => element.enabled && element.type === "camera");
  if (!camera || !gameViewport) return false;
  const baseZoom = Math.max(0.05, Number(camera.settings.zoom ?? 1));
  const fov = Math.min(160, Math.max(20, Number(camera.settings.fieldOfView ?? 60)));
  const effectiveZoom = baseZoom * (60 / fov);
  const viewWidth = Math.max(1, gameViewport.width) / effectiveZoom;
  const viewHeight = Math.max(1, gameViewport.height) / effectiveZoom;
  const cameraLeft = object.transform.position.x - viewWidth / 2;
  const cameraRight = object.transform.position.x + viewWidth / 2;
  const cameraTop = object.transform.position.y - viewHeight / 2;
  const cameraBottom = object.transform.position.y + viewHeight / 2;
  const threshold = Math.max(6, Math.min(16, Math.min(viewWidth, viewHeight) * 0.02));
  const inHorizontalRange = point.x >= cameraLeft - threshold && point.x <= cameraRight + threshold;
  const inVerticalRange = point.y >= cameraTop - threshold && point.y <= cameraBottom + threshold;
  const nearVerticalEdge = Math.abs(point.x - cameraLeft) <= threshold || Math.abs(point.x - cameraRight) <= threshold;
  const nearHorizontalEdge = Math.abs(point.y - cameraTop) <= threshold || Math.abs(point.y - cameraBottom) <= threshold;
  return (inVerticalRange && nearVerticalEdge) || (inHorizontalRange && nearHorizontalEdge);
}

function selectionPriority(object: GameObjectDocument): number {
  if (object.components.some((element) => element.enabled && element.type.startsWith("ui-"))) return -10000;
  if (object.components.some((element) => element.enabled && element.type === "camera")) return 3000;
  if (object.components.some((element) => element.enabled && element.type === "scene-spawn-point")) return 1600;
  if (object.components.some((element) => element.enabled && element.type === "sprite-renderer")) return 1400;
  if (object.components.some((element) => element.enabled && element.type === "shape-renderer")) return 1200;
  if (object.components.some((element) => element.enabled && element.type === "tilemap-renderer")) return 100;
  return 900;
}

export function hitTestSceneObjects(
  scene: SceneDocument,
  point: Vector2,
  gameViewport?: { width: number; height: number },
): ViewportHitCandidate[] {
  const layerById = new Map(scene.layers.map((layer) => [layer.id, layer]));
  return scene.objects
    .map((object, sourceIndex): ViewportHitCandidate | null => {
      const layer = layerById.get(object.layerId);
      if (!object.enabled || object.editorVisible === false || object.locked || layer?.visible === false || layer?.locked === true || !containsPoint(object, point, gameViewport)) return null;
      const priority = selectionPriority(object);
      if (priority < 0) return null;
      return {
        object,
        selectionPriority: priority,
        sceneLayerOrder: layer?.renderOrder ?? 0,
        objectRenderOrder: Number(object.components.find((element) => element.type === "sprite-renderer")?.settings.renderLayer ?? 0),
        area: objectArea(object),
        sourceIndex,
      };
    })
    .filter((candidate): candidate is ViewportHitCandidate => candidate !== null)
    .sort((left, right) =>
      right.selectionPriority - left.selectionPriority ||
      right.sceneLayerOrder - left.sceneLayerOrder ||
      right.objectRenderOrder - left.objectRenderOrder ||
      left.area - right.area ||
      right.sourceIndex - left.sourceIndex,
    );
}

export function objectsIntersectingArea(
  scene: SceneDocument,
  bounds: { left: number; right: number; top: number; bottom: number },
): GameObjectDocument[] {
  const layerById = new Map(scene.layers.map((layer) => [layer.id, layer]));
  return scene.objects.filter((object) => {
    const layer = layerById.get(object.layerId);
    if (!object.enabled || object.editorVisible === false || object.locked || layer?.visible === false || layer?.locked === true || selectionPriority(object) < 0) return false;
    const objectBounds = objectWorldAabb(object);
    return objectBounds.left < bounds.right && objectBounds.right > bounds.left && objectBounds.top < bounds.bottom && objectBounds.bottom > bounds.top;
  });
}
