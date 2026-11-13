import { aabbFromPoints, shapesIntersect, type OrientedShape } from '../varmover/editor/spatial';
import type { Vector2 } from '../varmover/editor/types';

export interface GameScene { tiles: string[] }
export const gameDirections = ['up', 'down', 'left', 'right'] as const;
export type GameDirection = typeof gameDirections[number];
const offsets: Record<GameDirection, Vector2> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

function box(center: Vector2, radius: number): OrientedShape {
  const points = [
    { x: center.x - radius, y: center.y - radius }, { x: center.x + radius, y: center.y - radius },
    { x: center.x + radius, y: center.y + radius }, { x: center.x - radius, y: center.y + radius },
  ];
  return { kind: 'polygon', points, center, radius, aabb: aabbFromPoints(points) };
}

const key = ({ x, y }: Vector2) => x + ',' + y;

export function compileGameScene(scene: GameScene) {
  const walls: OrientedShape[] = [];
  let start = { x: 0, y: 0 };
  let goal = { x: 0, y: 0 };
  for (const [y, row] of scene.tiles.entries()) {
    for (const [x, tile] of [...row].entries()) {
      if (tile === '#') walls.push(box({ x, y }, 0.5));
      if (tile === 'P') start = { x, y };
      if (tile === 'G') goal = { x, y };
    }
  }
  return { width: scene.tiles[0]!.length, height: scene.tiles.length, walls, start, goal };
}

export function moveGame(scene: ReturnType<typeof compileGameScene>, position: Vector2, direction: GameDirection): Vector2 {
  const delta = offsets[direction];
  const next = { x: position.x + delta.x, y: position.y + delta.y };
  if (next.x < 0 || next.y < 0 || next.x >= scene.width || next.y >= scene.height) return position;
  const player = box(next, 0.31);
  return scene.walls.some(wall => shapesIntersect(player, wall)) ? position : next;
}

export function findGameRoute(scene: ReturnType<typeof compileGameScene>): GameDirection[] | null {
  const queue: { position: Vector2; route: GameDirection[] }[] = [{ position: scene.start, route: [] }];
  const seen = new Set([key(scene.start)]);
  for (const { position, route } of queue) {
    if (key(position) === key(scene.goal)) return route;
    for (const direction of gameDirections) {
      const next = moveGame(scene, position, direction);
      if (seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push({ position: next, route: [...route, direction] });
    }
  }
  return null;
}

export function validateGameScene(value: unknown): asserts value is GameScene {
  const scene = value as GameScene;
  if (!scene || !Array.isArray(scene.tiles) || scene.tiles.length < 3 || scene.tiles.length > 16) {
    throw Error('A 2D scene needs 3 to 16 tile rows.');
  }
  const width = scene.tiles[0]?.length ?? 0;
  if (width < 3 || width > 16 || scene.tiles.some(row => typeof row !== 'string' || row.length !== width || !/^[.#PG]+$/.test(row))) {
    throw Error('Use a rectangular grid 3 to 16 tiles wide with . floor, # wall, P player, and G goal.');
  }
  const tiles = scene.tiles.join('');
  if ((tiles.match(/P/g)?.length ?? 0) !== 1 || (tiles.match(/G/g)?.length ?? 0) !== 1) throw Error('Place one player and one goal.');
  if (!findGameRoute(compileGameScene(scene))) throw Error('The player must be able to reach the goal.');
}
