/** Stateless collectible overlap detection, leaving persistence to the caller. */
import { intersectsAabb } from './game-aabb-collision';
import type { Aabb } from './game-aabb-collision';

export interface Collectible { id: string; box: Aabb }
export interface CollectibleResult { collectedIds: string[]; remaining: Collectible[] }

export function collectOverlaps(player: Aabb, collectibles: readonly Collectible[]): CollectibleResult {
  if (![player.position.x, player.position.y, player.width, player.height].every(Number.isFinite) ||
      player.width < 0 || player.height < 0) throw Error('Invalid player collision box');
  const ids = new Set<string>();
  const collectedIds: string[] = [];
  const remaining: Collectible[] = [];
  for (const item of collectibles) {
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id)) throw Error('Invalid or duplicate collectible identifier');
    ids.add(item.id);
    if (intersectsAabb(player, item.box)) collectedIds.push(item.id);
    else remaining.push(item);
  }
  return { collectedIds, remaining };
}
