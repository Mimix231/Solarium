/** Gravity step for a y-down coordinate system. Time is measured in seconds. */
import type { MovementBody } from './game-movement';

export function applyGravity(body: MovementBody, acceleration: number, seconds: number, terminalSpeed: number): MovementBody {
  if (![body.position.x, body.position.y, body.velocity.x, body.velocity.y,
      acceleration, seconds, terminalSpeed].every(Number.isFinite) ||
      acceleration < 0 || seconds < 0 || seconds > 1 || terminalSpeed < 0) {
    throw Error('Invalid gravity parameters');
  }
  const updated = Math.min(terminalSpeed, body.velocity.y + acceleration * seconds);
  if (!Number.isFinite(updated)) throw Error('Gravity overflow');
  return { position: { ...body.position }, velocity: { x: body.velocity.x, y: updated } };
}
