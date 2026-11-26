/** Sweep the feet of a falling player over one frame to avoid tunnelling through platforms.
 * Coordinates grow downward. Horizontal resolution belongs to a separate collision step. */
import type { Aabb } from './game-aabb-collision';
import type { Vector2 } from './game-vector2';

export interface LandingResult { position: Vector2; grounded: boolean }

export function resolveDownwardLanding(previous: Aabb, next: Aabb, platforms: readonly Aabb[]): LandingResult {
  const validate = (box: Aabb): void => {
    if (![box.position.x, box.position.y, box.width, box.height].every(Number.isFinite) ||
        box.width <= 0 || box.height <= 0) throw Error('Invalid landing box');
  };
  validate(previous);
  validate(next);
  let nearestTop = Infinity;
  const previousBottom = previous.position.y + previous.height;
  const nextBottom = next.position.y + next.height;
  if (!Number.isFinite(previousBottom) || !Number.isFinite(nextBottom)) throw Error('Landing coordinate overflow');
  if (nextBottom < previousBottom) return { position: { ...next.position }, grounded: false };
  for (const platform of platforms) {
    validate(platform);
    const top = platform.position.y;
    if (!Number.isFinite(platform.position.x + platform.width)) throw Error('Landing coordinate overflow');
    const horizontalOverlap = next.position.x < platform.position.x + platform.width &&
      next.position.x + next.width > platform.position.x;
    if (horizontalOverlap && previousBottom <= top && nextBottom >= top && top < nearestTop) nearestTop = top;
  }
  if (!Number.isFinite(nearestTop)) return { position: { ...next.position }, grounded: false };
  return { position: { x: next.position.x, y: nearestTop - next.height }, grounded: true };
}
