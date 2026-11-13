import type { GameObjectDocument, Vector2 } from "./types";

export interface Aabb {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Compact 2D affine matrix matching Canvas/Pixi semantics. */
export interface Matrix3 {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface WorldTransform2D {
  position: Vector2;
  rotation: number;
  scale: Vector2;
  pivot: Vector2;
  matrix: Matrix3;
  inverseMatrix: Matrix3;
}

export interface WorldGeometry2D {
  points: Vector2[];
  center: Vector2;
  orientedWidth: number;
  orientedHeight: number;
  rotation: number;
  aabb: Aabb;
}

export interface OrientedShape {
  kind: "polygon" | "circle";
  points: Vector2[];
  center: Vector2;
  radius: number;
  aabb: Aabb;
}

export function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

export function identityMatrix(): Matrix3 {
  return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
}

export function multiplyMatrix(left: Matrix3, right: Matrix3): Matrix3 {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    tx: left.a * right.tx + left.c * right.ty + left.tx,
    ty: left.b * right.tx + left.d * right.ty + left.ty,
  };
}

export function invertMatrix(matrix: Matrix3): Matrix3 {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) <= Number.EPSILON) return identityMatrix();
  const inverse = 1 / determinant;
  return {
    a: matrix.d * inverse,
    b: -matrix.b * inverse,
    c: -matrix.c * inverse,
    d: matrix.a * inverse,
    tx: (matrix.c * matrix.ty - matrix.d * matrix.tx) * inverse,
    ty: (matrix.b * matrix.tx - matrix.a * matrix.ty) * inverse,
  };
}

export function transformPoint(matrix: Matrix3, point: Vector2): Vector2 {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.tx,
    y: matrix.b * point.x + matrix.d * point.y + matrix.ty,
  };
}

export function composeTransformMatrix(
  position: Vector2,
  rotationDegrees: number,
  scale: Vector2,
): Matrix3 {
  const radians = degreesToRadians(rotationDegrees);
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    a: cosine * scale.x,
    b: sine * scale.x,
    c: -sine * scale.y,
    d: cosine * scale.y,
    tx: position.x,
    ty: position.y,
  };
}

/**
 * Resolves a Game Object's authoritative world transform. When an object list is
 * provided, parent transforms are composed recursively. Runtime callers may override
 * the object's position without mutating the project document.
 */
export function getWorldTransform(
  object: GameObjectDocument,
  objects?: readonly GameObjectDocument[],
  overridePosition?: Vector2,
  visited = new Set<string>(),
): WorldTransform2D {
  const localPosition = overridePosition ?? object.transform.position;
  const localMatrix = composeTransformMatrix(localPosition, object.transform.rotation, object.transform.scale);
  let matrix = localMatrix;
  let rotation = object.transform.rotation;
  let scale = { ...object.transform.scale };

  if (objects && object.parentId && !visited.has(object.id)) {
    const parent = objects.find((candidate) => candidate.id === object.parentId);
    if (parent) {
      const nextVisited = new Set(visited);
      nextVisited.add(object.id);
      const parentTransform = getWorldTransform(parent, objects, undefined, nextVisited);
      matrix = multiplyMatrix(parentTransform.matrix, localMatrix);
      rotation = parentTransform.rotation + object.transform.rotation;
      scale = {
        x: parentTransform.scale.x * object.transform.scale.x,
        y: parentTransform.scale.y * object.transform.scale.y,
      };
    }
  }

  return {
    position: { x: matrix.tx, y: matrix.ty },
    rotation,
    scale,
    pivot: object.transform.pivot ?? { x: 0.5, y: 0.5 },
    matrix,
    inverseMatrix: invertMatrix(matrix),
  };
}

export function rotatePoint(point: Vector2, center: Vector2, degrees: number): Vector2 {
  if (!degrees) return { ...point };
  const matrix = composeTransformMatrix(center, degrees, { x: 1, y: 1 });
  return transformPoint(matrix, { x: point.x - center.x, y: point.y - center.y });
}

function localObjectCorners(object: GameObjectDocument): Vector2[] {
  const pivotX = object.transform.pivot?.x ?? 0.5;
  const pivotY = object.transform.pivot?.y ?? 0.5;
  const left = -object.size.width * pivotX;
  const top = -object.size.height * pivotY;
  return [
    { x: left, y: top },
    { x: left + object.size.width, y: top },
    { x: left + object.size.width, y: top + object.size.height },
    { x: left, y: top + object.size.height },
  ];
}

export function objectWorldCorners(
  object: GameObjectDocument,
  x = object.transform.position.x,
  y = object.transform.position.y,
  objects?: readonly GameObjectDocument[],
): Vector2[] {
  const transform = getWorldTransform(object, objects, { x, y });
  return localObjectCorners(object).map((point) => transformPoint(transform.matrix, point));
}

export function objectWorldGeometry(
  object: GameObjectDocument,
  x = object.transform.position.x,
  y = object.transform.position.y,
  objects?: readonly GameObjectDocument[],
): WorldGeometry2D {
  const transform = getWorldTransform(object, objects, { x, y });
  const points = localObjectCorners(object).map((point) => transformPoint(transform.matrix, point));
  return {
    points,
    center: transformPoint(transform.matrix, { x: 0, y: 0 }),
    orientedWidth: object.size.width * Math.abs(transform.scale.x),
    orientedHeight: object.size.height * Math.abs(transform.scale.y),
    rotation: transform.rotation,
    aabb: aabbFromPoints(points),
  };
}

export function aabbFromPoints(points: Vector2[]): Aabb {
  const first = points[0];
  if (!first) return { left: 0, right: 0, top: 0, bottom: 0 };
  let left = first.x;
  let right = first.x;
  let top = first.y;
  let bottom = first.y;
  for (const point of points.slice(1)) {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }
  return { left, right, top, bottom };
}

export function objectWorldAabb(
  object: GameObjectDocument,
  x = object.transform.position.x,
  y = object.transform.position.y,
  objects?: readonly GameObjectDocument[],
): Aabb {
  return objectWorldGeometry(object, x, y, objects).aabb;
}

export function pointInPolygon(point: Vector2, polygon: Vector2[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / ((previousPoint.y - currentPoint.y) || Number.EPSILON) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInObject(object: GameObjectDocument, point: Vector2): boolean {
  return pointInPolygon(point, objectWorldCorners(object));
}

function projectPolygon(axis: Vector2, points: Vector2[]): { min: number; max: number } {
  const first = points[0]!;
  let min = first.x * axis.x + first.y * axis.y;
  let max = min;
  for (const point of points.slice(1)) {
    const projection = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function polygonAxes(points: Vector2[]): Vector2[] {
  const axes: Vector2[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    const edgeX = next.x - current.x;
    const edgeY = next.y - current.y;
    const length = Math.hypot(edgeX, edgeY) || 1;
    axes.push({ x: -edgeY / length, y: edgeX / length });
  }
  return axes;
}

export function polygonsIntersect(left: Vector2[], right: Vector2[]): boolean {
  if (left.length < 3 || right.length < 3) return false;
  for (const axis of [...polygonAxes(left), ...polygonAxes(right)]) {
    const leftProjection = projectPolygon(axis, left);
    const rightProjection = projectPolygon(axis, right);
    if (leftProjection.max <= rightProjection.min || rightProjection.max <= leftProjection.min) return false;
  }
  return true;
}

function closestPointOnSegment(point: Vector2, start: Vector2, end: Vector2): Vector2 {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared <= Number.EPSILON) return { ...start };
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared));
  return { x: start.x + deltaX * t, y: start.y + deltaY * t };
}

export function circleIntersectsPolygon(center: Vector2, radius: number, polygon: Vector2[]): boolean {
  if (pointInPolygon(center, polygon)) return true;
  for (let index = 0; index < polygon.length; index += 1) {
    const closest = closestPointOnSegment(center, polygon[index]!, polygon[(index + 1) % polygon.length]!);
    if (Math.hypot(center.x - closest.x, center.y - closest.y) < radius) return true;
  }
  return false;
}

export function shapesIntersect(left: OrientedShape, right: OrientedShape): boolean {
  if (left.aabb.left >= right.aabb.right || left.aabb.right <= right.aabb.left || left.aabb.top >= right.aabb.bottom || left.aabb.bottom <= right.aabb.top) return false;
  if (left.kind === "circle" && right.kind === "circle") {
    return Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y) < left.radius + right.radius;
  }
  if (left.kind === "circle") return circleIntersectsPolygon(left.center, left.radius, right.points);
  if (right.kind === "circle") return circleIntersectsPolygon(right.center, right.radius, left.points);
  return polygonsIntersect(left.points, right.points);
}

function localColliderMatrix(object: GameObjectDocument, collider: GameObjectDocument["components"][number], x: number, y: number): Matrix3 {
  const objectMatrix = composeTransformMatrix({ x, y }, object.transform.rotation, object.transform.scale);
  const offsetMatrix = composeTransformMatrix(
    { x: Number(collider.settings.offsetX ?? 0), y: Number(collider.settings.offsetY ?? 0) },
    Number(collider.settings.localRotation ?? 0),
    { x: 1, y: 1 },
  );
  return multiplyMatrix(objectMatrix, offsetMatrix);
}

function polygonShape(points: Vector2[], center: Vector2): OrientedShape {
  return { kind: "polygon", points, center, radius: 0, aabb: aabbFromPoints(points) };
}

export function colliderShapeFor(
  object: GameObjectDocument,
  x = object.transform.position.x,
  y = object.transform.position.y,
): OrientedShape | null {
  if (object.collisionEnabled === false) return null;
  const collider = object.components.find((component) => component.enabled && ["box-collider", "circle-collider", "polygon-collider", "capsule-collider", "edge-collider", "chain-collider", "sensor"].includes(component.type));
  if (!collider) return null;

  const matrix = localColliderMatrix(object, collider, x, y);
  const center = transformPoint(matrix, { x: 0, y: 0 });
  const absScaleX = Math.abs(object.transform.scale.x);
  const absScaleY = Math.abs(object.transform.scale.y);

  if (collider.type === "sensor") {
    const shape = String(collider.settings.shape ?? "box");
    if (shape === "circle" && Math.abs(absScaleX - absScaleY) <= 0.001) {
      const radius = Math.max(1, Number(collider.settings.radius ?? 48)) * absScaleX;
      return { kind: "circle", points: [], center, radius, aabb: { left: center.x - radius, right: center.x + radius, top: center.y - radius, bottom: center.y + radius } };
    }
    if (shape === "circle") {
      const radius = Math.max(1, Number(collider.settings.radius ?? 48));
      const points = Array.from({ length: 24 }, (_, index) => {
        const angle = index / 24 * Math.PI * 2;
        return transformPoint(matrix, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      });
      return polygonShape(points, center);
    }
    if (shape === "capsule") {
      return capsuleShape(matrix, center, Math.max(1, Number(collider.settings.width ?? 48)), Math.max(1, Number(collider.settings.height ?? 96)));
    }
    return boxShape(matrix, center, Math.max(1, Number(collider.settings.width ?? 96)), Math.max(1, Number(collider.settings.height ?? 96)));
  }

  if (collider.type === "circle-collider") {
    const sourceRadius = Math.max(1, Number(collider.settings.radius ?? Math.min(object.size.width, object.size.height) / 2));
    if (Math.abs(absScaleX - absScaleY) <= 0.001) {
      const radius = sourceRadius * absScaleX;
      return { kind: "circle", points: [], center, radius, aabb: { left: center.x - radius, right: center.x + radius, top: center.y - radius, bottom: center.y + radius } };
    }
    const points = Array.from({ length: 32 }, (_, index) => {
      const angle = index / 32 * Math.PI * 2;
      return transformPoint(matrix, { x: Math.cos(angle) * sourceRadius, y: Math.sin(angle) * sourceRadius });
    });
    return polygonShape(points, center);
  }

  if (collider.type === "capsule-collider") {
    return capsuleShape(matrix, center, Math.max(1, Number(collider.settings.width ?? object.size.width)), Math.max(1, Number(collider.settings.height ?? object.size.height)));
  }

  if (collider.type === "edge-collider") {
    const start = { x: Number(collider.settings.startX ?? -32), y: Number(collider.settings.startY ?? 0) };
    const end = { x: Number(collider.settings.endX ?? 32), y: Number(collider.settings.endY ?? 0) };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const thickness = Math.max(1, Number(collider.settings.thickness ?? 2));
    const normal = { x: -dy / length * thickness / 2, y: dx / length * thickness / 2 };
    const points = [
      { x: start.x + normal.x, y: start.y + normal.y },
      { x: end.x + normal.x, y: end.y + normal.y },
      { x: end.x - normal.x, y: end.y - normal.y },
      { x: start.x - normal.x, y: start.y - normal.y },
    ].map((point) => transformPoint(matrix, point));
    return polygonShape(points, center);
  }

  if (collider.type === "chain-collider") {
    const raw = String(collider.settings.points ?? "-64,0;0,-16;64,0");
    const localPoints = parsePointList(raw);
    if (localPoints.length < 2) return null;
    const transformed = localPoints.map((point) => transformPoint(matrix, point));
    const thickness = Math.max(1, Number(collider.settings.thickness ?? 3));
    const outline: Vector2[] = [];
    for (let index = 0; index < transformed.length - 1; index += 1) {
      const start = transformed[index]!;
      const end = transformed[index + 1]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length * thickness / 2;
      const ny = dx / length * thickness / 2;
      outline.push({ x: start.x + nx, y: start.y + ny }, { x: end.x + nx, y: end.y + ny });
    }
    for (let index = transformed.length - 2; index >= 0; index -= 1) {
      const start = transformed[index]!;
      const end = transformed[index + 1]!;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length * thickness / 2;
      const ny = dx / length * thickness / 2;
      outline.push({ x: end.x - nx, y: end.y - ny }, { x: start.x - nx, y: start.y - ny });
    }
    return polygonShape(outline, center);
  }

  if (collider.type === "polygon-collider") {
    const points = parsePointList(String(collider.settings.points ?? "-32,-32;32,-32;32,32;-32,32"));
    if (points.length < 3) return null;
    return polygonShape(points.map((point) => transformPoint(matrix, point)), center);
  }

  return boxShape(
    matrix,
    center,
    Math.max(1, Number(collider.settings.width ?? object.size.width)),
    Math.max(1, Number(collider.settings.height ?? object.size.height)),
  );
}

function parsePointList(raw: string): Vector2[] {
  return raw
    .split(";")
    .map((pair) => pair.split(",").map((value) => Number(value.trim())))
    .filter((pair): pair is [number, number, ...number[]] => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map(([x, y]) => ({ x, y }));
}

function boxShape(matrix: Matrix3, center: Vector2, width: number, height: number): OrientedShape {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const points = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((point) => transformPoint(matrix, point));
  return polygonShape(points, center);
}

function capsuleShape(matrix: Matrix3, center: Vector2, width: number, height: number): OrientedShape {
  const vertical = height >= width;
  const radius = Math.min(width, height) / 2;
  const straight = Math.max(0, (vertical ? height : width) - radius * 2);
  const localPoints: Vector2[] = [];
  const segments = 14;
  for (let index = 0; index <= segments; index += 1) {
    const angle = vertical ? Math.PI + index / segments * Math.PI : Math.PI / 2 + index / segments * Math.PI;
    const centerX = vertical ? 0 : straight / 2;
    const centerY = vertical ? straight / 2 : 0;
    localPoints.push({ x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
  }
  for (let index = 0; index <= segments; index += 1) {
    const angle = vertical ? index / segments * Math.PI : -Math.PI / 2 + index / segments * Math.PI;
    const centerX = vertical ? 0 : -straight / 2;
    const centerY = vertical ? -straight / 2 : 0;
    localPoints.push({ x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
  }
  return polygonShape(localPoints.map((point) => transformPoint(matrix, point)), center);
}
