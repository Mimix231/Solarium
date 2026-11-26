/** New portable gameplay implementation; delta measured in seconds. */
import type { Vector2 } from './game-vector2';

export interface MovementBody { position: Vector2; velocity: Vector2 }

export function stepMovement(body: MovementBody, seconds: number): MovementBody {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 1) throw Error('Invalid frame step');
  const values = [body.position.x, body.position.y, body.velocity.x, body.velocity.y];
  if (!values.every(Number.isFinite)) throw Error('Non-finite movement state');
  const x = body.position.x + body.velocity.x * seconds;
  const y = body.position.y + body.velocity.y * seconds;
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Movement overflow');
  return { position: { x, y }, velocity: { ...body.velocity } };
}
