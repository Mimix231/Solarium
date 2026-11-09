export const CODE_LINE_HEIGHT=20;
/** Rendering window only: the source and its complete line index are never shortened. */
export function codeWindow(lines:readonly string[],scrollTop:number,viewportHeight=410){
  const visible=Math.max(40,Math.ceil(viewportHeight/CODE_LINE_HEIGHT)+16),start=Math.min(Math.max(0,lines.length-visible),Math.max(0,Math.floor(scrollTop/CODE_LINE_HEIGHT)-8));
  const end=Math.min(lines.length,start+visible);
  return {start,end,rows:lines.slice(start,end),top:start*CODE_LINE_HEIGHT,bottom:(lines.length-end)*CODE_LINE_HEIGHT};
}
