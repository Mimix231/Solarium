/** Authoritative SPICA task plan. Only confirmed operations may complete steps.
 * Never infer completion from model prose or the number of tool calls. */
export type SpicaTaskStatus = 'active' | 'verifying' | 'completed' | 'paused' | 'blocked' | 'cancelled';
export type SpicaStepId = 'inspect' | 'discover' | 'compose' | 'verify';
export interface SpicaPlanStep {
  id: SpicaStepId; title: string; state: 'pending' | 'active' | 'completed';
  evidence: string[];
}
export interface SpicaContextCycle {
  index: number;
  budget: number;
  promptTokens: number | null;
  tokenSource: 'server' | 'estimate' | 'unknown';
  contextCapacity: number;
  graphRevision: number | null;
  at: string;
}
export interface SpicaTaskPlan {
  taskId: string;
  sessionId: string;
  projectId: string;
  goal: string;
  status: SpicaTaskStatus;
  steps: SpicaPlanStep[];
  graphRevision: number | null;
  lastTool: string | null;
  lastError?: string;
  checkpointAt: string;
  cycles: SpicaContextCycle[];
  verifiedChanges: number;
  inspections: number;
}
const stepNames: readonly [SpicaStepId, string][] = [
  ['inspect','Inspect project'], ['discover','Discover compatible blocks'],
  ['compose','Compose and apply'], ['verify','Build and verify'],
];
const inspectionTools = new Set(['read_spica_graph', 'inspect_spica_target']);
const discoveryTools = new Set(['search_spica_warehouse','search_spica_runtime_blocks','search_spica_catalog',
  'inspect_spica_component','inspect_spica_runtime_block','inspect_spica_runtime_blocks','inspect_spica_wiring']);
const commitTools = new Set(['create_spica_app','edit_spica_graph','migrate_spica_v2_graph',
  'compose_spica_v2_graph','history_spica_v2_graph']);
export function createSpicaPlan(taskId: string, sessionId: string, projectId: string, goal: string, graphRevision: number | null): SpicaTaskPlan {
  return {taskId, sessionId, projectId, goal, status:'active', graphRevision, lastTool:null,
    checkpointAt:new Date().toISOString(), cycles:[], verifiedChanges:0, inspections:0,
    steps:stepNames.map(([id,title],index)=>({id,title,state:index===0?'active':'pending',evidence:[]}))};
}
export class SpicaTaskOrchestrator {
  private current: SpicaTaskPlan;
  constructor(initial: SpicaTaskPlan) {this.current = structuredClone(initial);}
  get plan(): SpicaTaskPlan {return structuredClone(this.current);}
  get nextStep(): SpicaStepId | null {return this.current.steps.find(s=>s.state!=='completed')?.id??null;}
  private complete(id: SpicaStepId, evidence: string): void {
    const index=this.current.steps.findIndex(s=>s.id===id);
    if(index<0)return;
    const step=this.current.steps[index]!;
    if(!step.evidence.includes(evidence))step.evidence.push(evidence.slice(0,240));
    step.state='completed';
    const next=this.current.steps.find(s=>s.state!=='completed');
    if(next)next.state='active';
  }
  /** No success claim on a merely accepted call: graph writes require a confirmed new revision. */
  observe(tool: string, status: 'completed'|'failed'|'denied', options: {graphRevision?:number|null; verified?:boolean; evidence?:string} = {}): SpicaTaskPlan {
    this.current.lastTool=tool;
    this.current.checkpointAt=new Date().toISOString();
    if(status==='denied') {this.current.status='blocked';this.current.lastError=`Permission denied for ${tool}`;return this.plan;}
    if(status==='failed') {this.current.lastError=options.evidence?.slice(0,800)??`${tool} failed`;return this.plan;}
    this.current.lastError=undefined;
    if(inspectionTools.has(tool)) {
      this.current.inspections++;
      this.complete('inspect',options.evidence??`Read actual graph with ${tool}`);
    }
    if(discoveryTools.has(tool)) {
      this.current.inspections++;
      this.complete('inspect','Project capability discovery succeeded');
      this.complete('discover',options.evidence??`Inspected registered capability with ${tool}`);
    }
    if(commitTools.has(tool)) {
      if(typeof options.graphRevision==='number' &&
        (this.current.graphRevision===null || options.graphRevision>this.current.graphRevision)) {
        this.current.verifiedChanges++;
        this.current.graphRevision=options.graphRevision;
        this.complete('inspect','Current project graph exists');
        this.complete('discover','Compatible block graph operation was accepted');
        this.complete('compose',`Saved graph revision ${options.graphRevision} via ${tool}`);
        this.current.status='verifying';
      } else {
        this.current.lastError=`${tool} did not demonstrate a new graph revision; no feature completion recorded.`;
      }
    }
    if(tool==='verify_spica_app' && options.verified===true && this.current.steps.find(s=>s.id==='compose')?.state==='completed') {
      this.complete('verify',options.evidence??'Verified build at current graph revision');
      this.current.status='completed';
    }
    return this.plan;
  }
  cycle(cycle: SpicaContextCycle): SpicaTaskPlan {
    if(this.current.cycles.some(c=>c.index===cycle.index))return this.plan;
    this.current.cycles.push({...cycle});
    // Persist a bounded, stable checkpoint rather than an unbounded inference transcript.
    this.current.cycles=this.current.cycles.slice(-32);
    this.current.checkpointAt=new Date().toISOString();
    return this.plan;
  }
  setStatus(status: SpicaTaskStatus, reason?:string): SpicaTaskPlan {
    this.current.status=status;
    if(reason)this.current.lastError=reason.slice(0,800);
    this.current.checkpointAt=new Date().toISOString();
    return this.plan;
  }
  /** A compact, evidence-derived context for subsequent genuine tool turns. */
  context(maxChars=1400): string {
    const plan=this.current;
    return (`SPICA SAVED TASK (authoritative, not a fresh user command): ${plan.goal}\n`+
      `Status: ${plan.status}; graph revision: ${plan.graphRevision??'none'}; next unfinished step: ${this.nextStep??'none'}; verified writes: ${plan.verifiedChanges}.\n`+
      plan.steps.map(s=>`${s.id}: ${s.state}${s.evidence.length?'; evidence: '+s.evidence.at(-1):''}`).join('\n')+
      (plan.lastError?`\nLast failure: ${plan.lastError}`:'')+
      '\nPerform the next required REGISTERED TOOL operation; tool inspections are not completed application features. Do not narrate intentions as finished work.').slice(0,maxChars);
  }
}
