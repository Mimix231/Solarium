/** Center a scrolling camera on the target without leaving the level bounds. */
import type { Vector2 } from './game-vector2';

export function followCamera(target: Vector2, viewport: Vector2, world: Vector2): Vector2 {
  const values = [target.x, target.y, viewport.x, viewport.y, world.x, world.y];
  if (!values.every(Number.isFinite) || viewport.x <= 0 || viewport.y <= 0 ||
      world.x < 0 || world.y < 0) throw Error('Invalid camera dimensions');
  const maxX = Math.max(0, world.x - viewport.x);
  const maxY = Math.max(0, world.y - viewport.y);
  return {
    x: Math.max(0, Math.min(maxX, target.x - viewport.x / 2)),
    y: Math.max(0, Math.min(maxY, target.y - viewport.y / 2)),
  };
}
