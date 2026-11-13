import { createComponentInstance } from "./catalog";
import { createId } from "./ids";
import type { ComponentInstance, ComponentType, GameObjectDocument, GameObjectType, PrefabDocument } from "./types";
import { inferGameObjectType } from "./phase10Architecture";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function normalizeComponentInstances(value: unknown): ComponentInstance[] {
  if (!Array.isArray(value)) return [];
  const components: ComponentInstance[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.type !== "string" || !candidate.type.trim()) continue;
    components.push({
      id: stringValue(candidate.id, createId("component")),
      type: candidate.type as ComponentType,
      enabled: candidate.enabled !== false,
      settings: isRecord(candidate.settings) ? clone(candidate.settings) as ComponentInstance["settings"] : {},
    });
  }
  return components;
}

export function normalizeGameObjectDocument(value: unknown, fallbackLayerId = "layer-gameplay"): GameObjectDocument | null {
  if (!isRecord(value)) return null;
  const transform = isRecord(value.transform) ? value.transform : {};
  const position = isRecord(transform.position) ? transform.position : {};
  const scale = isRecord(transform.scale) ? transform.scale : {};
  const pivot = isRecord(transform.pivot) ? transform.pivot : {};
  const size = isRecord(value.size) ? value.size : {};
  const rawComponents = Array.isArray(value.components) ? value.components : Array.isArray(value.elements) ? value.elements : [];
  const components = normalizeComponentInstances(rawComponents);

  const normalized: GameObjectDocument = {
    id: stringValue(value.id, createId("object")),
    name: stringValue(value.name, "Game Object"),
    objectType: (typeof value.objectType === "string" ? value.objectType : "custom") as GameObjectType,
    parentId: typeof value.parentId === "string" ? value.parentId : null,
    layerId: stringValue(value.layerId, fallbackLayerId),
    enabled: value.enabled !== false,
    editorVisible: value.editorVisible !== false,
    runtimeVisible: value.runtimeVisible !== false,
    collisionEnabled: value.collisionEnabled !== false,
    logicEnabled: value.logicEnabled !== false,
    locked: value.locked === true,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [],
    transform: {
      position: { x: finiteNumber(position.x, 0), y: finiteNumber(position.y, 0) },
      rotation: finiteNumber(transform.rotation, 0),
      scale: { x: finiteNumber(scale.x, 1), y: finiteNumber(scale.y, 1) },
      pivot: { x: finiteNumber(pivot.x, 0.5), y: finiteNumber(pivot.y, 0.5) },
    },
    size: { width: Math.max(1, finiteNumber(size.width, 64)), height: Math.max(1, finiteNumber(size.height, 64)) },
    editorColor: stringValue(value.editorColor, "#78909c"),
    components: components.length > 0 ? components : [createComponentInstance("sprite-renderer")],
    prefabId: typeof value.prefabId === "string" ? value.prefabId : null,
    prefabOverrides: Array.isArray(value.prefabOverrides) ? value.prefabOverrides.filter((entry): entry is string => typeof entry === "string") : [],
  };
  if (!normalized.objectType || normalized.objectType === "custom") normalized.objectType = inferGameObjectType(normalized);
  return normalized;
}

export function normalizePrefabDocuments(value: unknown, fallbackPrefabs: PrefabDocument[]): PrefabDocument[] {
  const source = Array.isArray(value) ? value : [];
  const normalized: PrefabDocument[] = [];
  const ids = new Set<string>();

  for (const candidate of source) {
    if (!isRecord(candidate)) continue;
    const object = normalizeGameObjectDocument(candidate.object);
    if (!object) continue;
    const id = stringValue(candidate.id, createId("prefab"));
    if (ids.has(id)) continue;
    ids.add(id);
    normalized.push({
      id,
      parentPrefabId: typeof candidate.parentPrefabId === "string" ? candidate.parentPrefabId : null,
      variantOf: typeof candidate.variantOf === "string" ? candidate.variantOf : null,
      name: stringValue(candidate.name, object.name),
      description: typeof candidate.description === "string" ? candidate.description : "Reusable Game Object recipe.",
      builtIn: candidate.builtIn === true,
      category: typeof candidate.category === "string" && candidate.category.trim() ? candidate.category : undefined,
      object,
      children: Array.isArray(candidate.children) ? candidate.children.map((child) => normalizeGameObjectDocument(child)).filter((child): child is GameObjectDocument => Boolean(child)) : [],
    });
  }

  // A damaged legacy collection must not erase the built-in Game Object library.
  for (const fallback of fallbackPrefabs) {
    if (normalized.some((prefab) => prefab.id === fallback.id || (prefab.builtIn && prefab.name === fallback.name))) continue;
    normalized.push(clone(fallback));
  }

  return normalized;
}
