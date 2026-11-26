/** New portable event-based keyboard-state adapter. Host owns event registration. */
export interface InputSnapshot { horizontal:number; jump:boolean }
export function keyboardSnapshot(keys: ReadonlySet<string>): InputSnapshot {
  const right = keys.has('ArrowRight') || keys.has('KeyD');
  const left = keys.has('ArrowLeft') || keys.has('KeyA');
  return {horizontal:Number(right)-Number(left),jump:keys.has('Space') || keys.has('ArrowUp')};
}
