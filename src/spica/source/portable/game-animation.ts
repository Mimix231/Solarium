/** Frame-accurate cycling for a fixed-duration sprite animation. */
export interface AnimationFrame { frame: number; remainderSeconds: number }

export function advanceAnimationFrame(frame: number, elapsedSeconds: number,
  remainderSeconds: number, frameDurationSeconds: number, frameCount: number): AnimationFrame {
  if (!Number.isInteger(frameCount) || frameCount <= 0 || !Number.isInteger(frame) ||
      frame < 0 || frame >= frameCount ||
      ![elapsedSeconds, remainderSeconds, frameDurationSeconds].every(Number.isFinite) ||
      elapsedSeconds < 0 || remainderSeconds < 0 || frameDurationSeconds <= 0 ||
      remainderSeconds >= frameDurationSeconds) throw Error('Invalid animation parameters');
  const total = elapsedSeconds + remainderSeconds;
  if (!Number.isFinite(total)) throw Error('Animation time overflow');
  const steps = Math.floor(total / frameDurationSeconds);
  return { frame: (frame + steps % frameCount) % frameCount,
    remainderSeconds: total % frameDurationSeconds };
}
