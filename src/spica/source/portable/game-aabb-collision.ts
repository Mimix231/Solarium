/** New portable axis-aligned bounding box collision primitive. */
import type { Vector2 } from './game-vector2';

export interface Aabb { position: Vector2; width: number; height: number }

export function intersectsAabb(a: Aabb, b: Aabb): boolean {
  const values = [a.position.x, a.position.y, b.position.x, b.position.y,
    a.width, a.height, b.width, b.height];
  if (!values.every(Number.isFinite) ||
      a.width < 0 || a.height < 0 || b.width < 0 || b.height < 0) {
    throw Error('Invalid collision box');
  }
  // A zero-area box cannot intersect, even when its origin lies inside a solid box.
  if (a.width === 0 || a.height === 0 || b.width === 0 || b.height === 0) return false;
  return a.position.x < b.position.x + b.width &&
    a.position.x + a.width > b.position.x &&
    a.position.y < b.position.y + b.height &&
    a.position.y + a.height > b.position.y;
}
