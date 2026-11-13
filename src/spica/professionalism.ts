import type { Graph } from './graph';

export type SpicaQualitySeverity = 'error' | 'warning';
export interface SpicaQualityFinding {
  code: string; severity: SpicaQualitySeverity; target: string; message: string; suggestion: string;
}
export interface SpicaQualityReport {
  revisionIndependent: true; checked: number; passed: boolean; errors: number; warnings: number;
  findings: SpicaQualityFinding[];
}
function luminance(color: string): number {
  const values = [1,3,5].map(position => {
    const channel = Number.parseInt(color.slice(position, position+2),16)/255;
    return channel <= .04045 ? channel/12.92 : ((channel+.055)/1.055)**2.4;
  });
  return values[0]!*0.2126 + values[1]!*0.7152 + values[2]!*0.0722;
}
/** WCAG contrast of two validated hex tokens; null means unspecified, not an automatic pass. */
export function spicaContrast(foreground: unknown, background: unknown): number | null {
  if(typeof foreground!=='string'||typeof background!=='string'||
    !/^#[0-9a-fA-F]{6}$/.test(foreground)||!/^#[0-9a-fA-F]{6}$/.test(background)) return null;
  const a=luminance(foreground), b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
/** Pure design-time audit. DOM focus/overflow still requires the mounted scenario audit. */
export function auditSpicaDesign(graph: Graph): SpicaQualityReport {
  const findings:SpicaQualityFinding[]=[];
  let checked=0;
  const add=(code:string,severity:SpicaQualitySeverity,target:string,message:string,suggestion:string) =>
    findings.push({code,severity,target,message,suggestion});
  const reviewLabel=(label:string,target:string)=>{
    checked++;
    if(!label.trim()) add('MISSING_LABEL','error',target,'Control has no accessible name.','Set a descriptive, nonempty label.');
    else if(label.trim().length>80)add('LONG_LABEL','warning',target,'Control label exceeds 80 characters.','Use a concise visible label.');
    else if(/^(?:click here|button|input|select)$/i.test(label.trim()))add('GENERIC_LABEL','warning',target,'Control label is ambiguous.','Name the action or information the user can expect.');
  };
  for(const page of graph.pages){reviewLabel(page.label,'settings-page-'+page.id);}
  for(const control of graph.controls){reviewLabel(control.label,'setting-field-'+control.id);}
  for(const collection of [graph.collection,...(graph.collections??[])].filter((item):item is NonNullable<typeof graph.collection>=>!!item)){
    reviewLabel(collection.label,'collection-'+collection.id);
    for(const field of collection.fields)reviewLabel(field.label,'record-field-'+field.key);
  }
  const screens=graph.program?.screens??[];
  const seen=new Set<string>();
  for(const screen of screens){
    reviewLabel(screen.label,'screen-'+screen.id);
    const label=screen.label.toLocaleLowerCase().trim();
    if(seen.has(label))add('DUPLICATE_NAVIGATION','warning','screen-'+screen.id,
      'Navigation has duplicate screen labels.','Give each screen a distinct accessible label.');
    seen.add(label);
  }
  const colors=graph.appearance?.theme;
  const contrast=spicaContrast(colors?.text,colors?.background);
  if(contrast!==null){checked++;if(contrast<4.5)add('LOW_CONTRAST','error','app',
    `Foreground and background contrast is ${contrast.toFixed(2)}:1.`,
    'Adjust appearance.text/background to at least 4.5:1 for normal text.');}
  checked++;if(!screens.length&&!graph.collection&&!graph.controls.length)
    add('EMPTY_INTERFACE','warning','app','Application has no authored screens, records, or settings.','Add a screen or input controls.');
  return {revisionIndependent:true,checked,passed:findings.every(item=>item.severity!=='error'),
    errors:findings.filter(item=>item.severity==='error').length,
    warnings:findings.filter(item=>item.severity==='warning').length,findings};
}
