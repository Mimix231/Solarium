/** New portable canvas drawing helper. Host owns the canvas/context. */
export interface ColorRect { x:number; y:number; width:number; height:number; color:string }
export function drawColorRects(context: CanvasRenderingContext2D, rectangles: readonly ColorRect[]): void {
  for (const rect of rectangles) {
    if (![rect.x,rect.y,rect.width,rect.height].every(Number.isFinite) || rect.width < 0 || rect.height < 0) throw Error('Invalid rectangle');
    context.fillStyle=rect.color;context.fillRect(rect.x,rect.y,rect.width,rect.height);
  }
}
