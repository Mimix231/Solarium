/** Grounded jump primitive. A caller owns coyote-time, buffer and input-edge semantics. */
import type { MovementBody } from './game-movement';

export interface JumpResult { body: MovementBody; jumped: boolean }

export function tryJump(body: MovementBody, grounded: boolean, pressed: boolean, jumpSpeed: number): JumpResult {
  if (![body.position.x, body.position.y, body.velocity.x, body.velocity.y, jumpSpeed].every(Number.isFinite) ||
      jumpSpeed <= 0) {
    throw Error('Invalid jump parameters');
  }
  if (!grounded || !pressed) return {
    body: { position: { ...body.position }, velocity: { ...body.velocity } },
    jumped: false,
  };
  return {
    body: { position: { ...body.position }, velocity: { x: body.velocity.x, y: -jumpSpeed } },
    jumped: true,
  };
}
