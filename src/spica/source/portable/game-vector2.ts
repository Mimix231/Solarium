/** New portable gameplay primitive, not a pre-existing executable SPICA game block. */
export interface Vector2 { x: number; y: number }
export function vector2(x=0,y=0): Vector2 { if(!Number.isFinite(x)||!Number.isFinite(y)) throw Error('Non-finite vector'); return {x,y}; }
