import type {QualityRun} from './runner';

export const interruptedQualityRun=(run:QualityRun,rendererStartedAt:number)=>run.state==='running'&&Date.parse(run.startedAt)<rendererStartedAt;

export function qualityScorecards(runs:QualityRun[],engine:string){
  const groups=new Map<string,QualityRun[]>();
  for(const run of runs){
    if(run.category!=='coding'||run.fingerprints?.engine!==engine)continue;
    const key=run.model.id+':'+run.fingerprints.conditions;
    groups.set(key,[...(groups.get(key)??[]),run]);
  }
  const median=(values:number[])=>{if(!values.length)return null;values.sort((a,b)=>a-b);const mid=Math.floor(values.length/2);return values.length%2?values[mid]!:((values[mid-1]??0)+(values[mid]??0))/2;};
  return [...groups.entries()].map(([key,items])=>{
    const finished=items.filter(r=>r.state!=='running');
    const autonomous=finished.filter(r=>!r.interventions?.length);
    return {key,model:items[0]!.model.name,attempts:finished.length,
      passed:autonomous.filter(r=>r.state==='passed').length,
      failed:autonomous.filter(r=>r.state==='failed').length,
      cancelled:finished.filter(r=>r.state==='cancelled').length,
      corrected:finished.filter(r=>Boolean(r.interventions?.length)).length,
      pending:finished.filter(r=>['needs_review','blocked'].includes(r.state)).length,
      cases:new Set(finished.map(r=>r.caseId)).size,
      medianElapsedMs:median(finished.flatMap(r=>r.finishedAt?[Date.parse(r.finishedAt)-Date.parse(r.startedAt)]:[])),
      medianFirstTokenMs:median(finished.flatMap(r=>r.metrics.flatMap(m=>m.firstTokenMs===null?[]:[m.firstTokenMs]))),
    };
  });
}
