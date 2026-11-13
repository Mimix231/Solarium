import type {
  AnimationClip,
  AnimationEventDefinition,
  AnimationSetDefinition,
  ProjectDocument,
  SpriteFrame,
} from "./types";

export interface AnimationPlaybackCursor {
  clipId: string | null;
  frameIndex: number;
  direction: 1 | -1;
  elapsedSeconds: number;
}

export interface AnimationAdvanceResult extends AnimationPlaybackCursor {
  changedFrame: boolean;
  finished: boolean;
  crossedEvents: AnimationEventDefinition[];
  rootMotionX: number;
  rootMotionY: number;
}

export function animationDirectionKey(direction: string): string {
  const normalized = direction.trim().toLowerCase();
  if (normalized.includes("up-left")) return "up-left";
  if (normalized.includes("up-right")) return "up-right";
  if (normalized.includes("down-left")) return "down-left";
  if (normalized.includes("down-right")) return "down-right";
  if (normalized.includes("left")) return "left";
  if (normalized.includes("right")) return "right";
  if (normalized.includes("up")) return "up";
  return "down";
}

export function clipForAnimationSet(
  set: AnimationSetDefinition | undefined,
  stateName: string,
  direction: string,
): string | null {
  if (!set) return null;
  const key = animationDirectionKey(direction);
  const state = set.states?.[stateName] ?? set.states?.[stateName.toLowerCase()] ?? null;
  if (state) {
    return state[key]
      ?? (key.endsWith("-left") ? state.left : undefined)
      ?? (key.endsWith("-right") ? state.right : undefined)
      ?? (key.startsWith("up") ? state.up : undefined)
      ?? (key.startsWith("down") ? state.down : undefined)
      ?? state.down
      ?? Object.values(state)[0]
      ?? null;
  }
  return set.directions[key]
    ?? (key.endsWith("-left") ? set.directions.left : undefined)
    ?? (key.endsWith("-right") ? set.directions.right : undefined)
    ?? (key.startsWith("up") ? set.directions.up : undefined)
    ?? (key.startsWith("down") ? set.directions.down : undefined)
    ?? set.directions.down
    ?? Object.values(set.directions)[0]
    ?? null;
}

export function clipFrame(
  project: ProjectDocument,
  clip: AnimationClip | undefined,
  frameIndex: number,
): { frame: SpriteFrame; durationSeconds: number } | null {
  if (!clip || clip.frames.length === 0) return null;
  const reference = clip.frames[Math.max(0, Math.min(clip.frames.length - 1, frameIndex))];
  const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
  const frame = asset?.frames.find((candidate) => candidate.id === reference.frameId);
  if (!frame) return null;
  const durationSeconds = Math.max(0.016, (reference.durationMs || 1000 / Math.max(1, clip.framesPerSecond)) / 1000);
  return { frame, durationSeconds };
}

export function validateAnimationClip(project: ProjectDocument, clip: AnimationClip): string[] {
  const problems: string[] = [];
  const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
  if (!asset) {
    problems.push("Source asset is missing.");
    return problems;
  }
  if (clip.frames.length === 0) problems.push("Animation contains no frames.");
  clip.frames.forEach((reference, index) => {
    if (!asset.frames.some((frame) => frame.id === reference.frameId)) problems.push(`Frame ${index + 1} references a missing sprite frame.`);
    if (!Number.isFinite(reference.durationMs) || reference.durationMs <= 0) problems.push(`Frame ${index + 1} has an invalid duration.`);
  });
  for (const event of clip.events ?? []) {
    if (!Number.isInteger(event.frameIndex) || event.frameIndex < 0 || event.frameIndex >= clip.frames.length) problems.push(`Animation event “${event.name}” targets an invalid frame.`);
  }
  return problems;
}

function eventsAtFrame(clip: AnimationClip, frameIndex: number): AnimationEventDefinition[] {
  return (clip.events ?? []).filter((event) => event.frameIndex === frameIndex);
}

/**
 * Advances one animation cursor by a real delta time. The function is pure and is
 * shared by the editor preview and runtime so clip timing cannot drift between them.
 */
export function advanceAnimation(
  clip: AnimationClip,
  cursor: AnimationPlaybackCursor,
  deltaSeconds: number,
): AnimationAdvanceResult {
  if (clip.frames.length === 0) {
    return {
      ...cursor,
      clipId: clip.id,
      frameIndex: 0,
      direction: 1,
      elapsedSeconds: 0,
      changedFrame: false,
      finished: true,
      crossedEvents: [],
      rootMotionX: 0,
      rootMotionY: 0,
    };
  }

  let frameIndex = cursor.clipId === clip.id ? Math.max(0, Math.min(clip.frames.length - 1, cursor.frameIndex)) : 0;
  let direction: 1 | -1 = cursor.clipId === clip.id ? cursor.direction : 1;
  let elapsed = cursor.clipId === clip.id ? Math.max(0, cursor.elapsedSeconds) : 0;
  let remaining = Math.max(0, deltaSeconds);
  let changedFrame = cursor.clipId !== clip.id;
  let finished = false;
  let rootMotionX = 0;
  let rootMotionY = 0;
  const crossedEvents: AnimationEventDefinition[] = cursor.clipId === clip.id ? [] : eventsAtFrame(clip, 0);
  let safety = 0;

  while (remaining > 0 && safety++ < 256) {
    const reference = clip.frames[frameIndex];
    const duration = Math.max(0.016, (reference.durationMs || 1000 / Math.max(1, clip.framesPerSecond)) / 1000);
    const untilBoundary = Math.max(0, duration - elapsed);
    if (remaining < untilBoundary) {
      elapsed += remaining;
      remaining = 0;
      break;
    }

    remaining -= untilBoundary;
    elapsed = 0;
    rootMotionX += Number(reference.rootMotionX ?? 0);
    rootMotionY += Number(reference.rootMotionY ?? 0);

    let next = frameIndex + direction;
    if (clip.pingPong && clip.frames.length > 1) {
      if (next >= clip.frames.length) {
        if (!clip.loop) {
          frameIndex = clip.frames.length - 1;
          finished = true;
          remaining = 0;
          break;
        }
        direction = -1;
        next = Math.max(0, clip.frames.length - 2);
      } else if (next < 0) {
        if (!clip.loop) {
          frameIndex = 0;
          finished = true;
          remaining = 0;
          break;
        }
        direction = 1;
        next = Math.min(clip.frames.length - 1, 1);
      }
    } else if (next >= clip.frames.length) {
      if (!clip.loop) {
        frameIndex = clip.frames.length - 1;
        finished = true;
        remaining = 0;
        break;
      }
      next = 0;
    } else if (next < 0) {
      if (!clip.loop) {
        frameIndex = 0;
        finished = true;
        remaining = 0;
        break;
      }
      next = clip.frames.length - 1;
    }

    frameIndex = next;
    changedFrame = true;
    crossedEvents.push(...eventsAtFrame(clip, frameIndex));
  }

  return {
    clipId: clip.id,
    frameIndex,
    direction,
    elapsedSeconds: elapsed,
    changedFrame,
    finished,
    crossedEvents,
    rootMotionX,
    rootMotionY,
  };
}
