import { SparkThoughtJournal, type SparkThoughtBlock, type SparkThoughtToolResult } from './spark-thought';
import { SparkActionBatchJournal, type SparkActionBatch } from './spark-action-batches';
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
  sourceWrites?: number;
  sourceFiles?: string[];
  /** Durable independent action decisions; populated by Round B. */
  thoughts?: SparkThoughtBlock[];
  /** Durable action groups spanning one or more tool turns; verified writes mark boundaries. */
  batches?: SparkActionBatch[];
}
const stepNames: readonly [SpicaStepId, string][] = [
  ['inspect','Inspect project'], ['discover','Discover compatible blocks'],
  ['compose','Compose and apply'], ['verify','Build and verify'],
];
const inspectionTools = new Set(['read_spica_graph', 'inspect_spica_target']);
const discoveryTools = new Set(['resolve_spica_capabilities','search_spica_warehouse','search_spica_runtime_blocks','search_spica_catalog',
  'inspect_spica_component','inspect_spica_runtime_block','inspect_spica_runtime_blocks','inspect_spica_wiring']);
const commitTools = new Set(['create_spica_app','edit_spica_graph','migrate_spica_v2_graph',
  'compose_spica_v2_graph','history_spica_v2_graph']);
export function createSpicaPlan(taskId: string, sessionId: string, projectId: string, goal: string, graphRevision: number | null): SpicaTaskPlan {
  return {taskId, sessionId, projectId, goal, status:'active', graphRevision, lastTool:null,
    checkpointAt:new Date().toISOString(), cycles:[], verifiedChanges:0, inspections:0, sourceWrites:0, sourceFiles:[], thoughts:[], batches:[],
    steps:stepNames.map(([id,title],index)=>({id,title,state:index===0?'active':'pending',evidence:[]}))};
}
export class SpicaTaskOrchestrator {
  private current: SpicaTaskPlan;
  private readonly thoughtJournal: SparkThoughtJournal;
  private readonly batchJournal: SparkActionBatchJournal;
  constructor(initial: SpicaTaskPlan) {
    this.current = structuredClone(initial);
    this.thoughtJournal = new SparkThoughtJournal(initial.thoughts ?? []);
    this.batchJournal = new SparkActionBatchJournal(initial.batches ?? []);
    this.current.thoughts = this.thoughtJournal.history;
    this.current.batches = this.batchJournal.history;
  }
  private refreshThoughts(): void {
    this.current.thoughts = this.thoughtJournal.history;
    this.current.batches = this.batchJournal.history;
    this.current.checkpointAt = new Date().toISOString();
  }
  beginThought(index: number, budget: number, offeredTools: readonly string[]): SparkThoughtBlock {
    const stage = this.nextStep ?? 'verify';
    const objective = this.current.steps.find(s => s.id === stage)?.title ?? 'Verify the actual outcome';
    const last = this.thoughtJournal.latest;
    if (last && index <= last.index) throw Error('Thought Block indices must advance across resumes.');
    const nextIndex=index??(last?.index??0)+1;
    this.batchJournal.enter(stage,`${objective} — ${this.current.goal}`.slice(0,180),this.current.graphRevision,nextIndex);
    const thought = this.thoughtJournal.begin(stage, objective, this.current.graphRevision, budget, offeredTools,index);
    this.refreshThoughts();
    return thought;
  }
  captureThought(data: Parameters<SparkThoughtJournal['captureModel']>[0]): SparkThoughtBlock {
    const thought = this.thoughtJournal.captureModel(data);
    this.batchJournal.recordUsage(data.promptTokens,data.outputTokens);
    this.refreshThoughts(); return thought;
  }
  recordThoughtTool(result: SparkThoughtToolResult): SparkThoughtBlock {
    const thought = this.thoughtJournal.recordTool(result);
    this.batchJournal.recordTool(result.name,result.status,result.status==='completed'?undefined:result.evidence);
    this.refreshThoughts(); return thought;
  }
  finishThought(): SparkThoughtBlock {
    const thought = this.thoughtJournal.settle();
    this.batchJournal.checkpoint({revision:this.current.graphRevision,verified:this.current.status==='completed',
      stage:this.nextStep??'verify',stepEvidence:this.current.steps.flatMap(s=>s.evidence.slice(-1)),lastTool:this.current.lastTool});
    this.refreshThoughts(); return thought;
  }
  interruptThought(reason: string, status: 'paused' | 'blocked'): void {
    this.thoughtJournal.interrupt(reason,status); this.batchJournal.interrupt(reason,status); this.refreshThoughts();
  }
  get lastThought(): SparkThoughtBlock | null { return this.thoughtJournal.latest; }
  get currentBatch(): SparkActionBatch | null {return this.batchJournal.current;}
  get onionCheckpoint(): string | null {return this.batchJournal.lastCheckpoint();}
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
  /** A real source read settles discovery, never construction or verification. */
  recordSourceInspection(path:string):void {
    if(!path.trim())return;
    this.current.inspections++;
    this.complete('inspect',`Read actual project source: ${path}`);
    this.complete('discover','Selected native source construction tools are available');
    this.current.checkpointAt=new Date().toISOString();
  }
  /** Called only after the native linked-project backend confirms committed files.
   * A source write advances Compose, but can never mark Build & Verify complete. */
  recordSourceWrite(paths: readonly string[], sourceRevision: number): void {
    if(!paths.length || !Number.isSafeInteger(sourceRevision) || sourceRevision<=0) return;
    this.current.sourceWrites=(this.current.sourceWrites??0)+paths.length;
    this.current.sourceFiles=[...new Set([...(this.current.sourceFiles??[]),...paths])].slice(-40);
    this.complete('inspect','Native linked-project source was inspected and modified');
    this.complete('discover','Native source construction tools are available');
    this.complete('compose',`Committed ${paths.length} project source file(s), source revision ${sourceRevision}`);
    this.current.status='verifying';
    this.batchJournal.recordSourceWrite(paths,sourceRevision);
    this.current.checkpointAt=new Date().toISOString();
  }
  /** No success claim on a merely accepted call: graph writes require a confirmed new revision. */
  observe(tool: string, status: 'completed'|'failed'|'denied', options: {graphRevision?:number|null; verified?:boolean; evidence?:string; discovered?:boolean; migrationOnly?:boolean} = {}): SpicaTaskPlan {
    this.current.lastTool=tool;
    this.current.checkpointAt=new Date().toISOString();
    if(status==='denied') {this.current.status='blocked';this.current.lastError=`Permission denied for ${tool}`;return this.plan;}
    if(status==='failed') {this.current.lastError=options.evidence?.slice(0,800)??`${tool} failed`;return this.plan;}
    // An unrelated successful read does not repair a failed edit/check.
    if(['inspect_spica_tool','inspect_solarium_tool','inspect_params','check_spica_tool_call','validate_spica_edit','validate_spica_composition'].includes(tool)){
      this.current.lastError=undefined;
    }
    if(inspectionTools.has(tool)) {
      this.current.inspections++;
      this.complete('inspect',options.evidence??`Read actual graph with ${tool}`);
    }
    if(discoveryTools.has(tool) && options.discovered===true) {
      this.current.inspections++;
      this.complete('inspect','Project capability discovery succeeded');
      this.complete('discover',options.evidence??`Inspected registered capability with ${tool}`);
    }
    if(commitTools.has(tool)) {
      if(typeof options.graphRevision==='number' &&
        (this.current.graphRevision===null || options.graphRevision>this.current.graphRevision)) {
        this.current.verifiedChanges++;
        this.current.graphRevision=options.graphRevision;
        this.current.inspections=0;
        this.current.lastError=undefined;
        this.complete('inspect','Current project graph exists');
        if (options.migrationOnly) {
          // A format migration does not establish block discovery or implement a requested feature.
          this.current.lastError=undefined;
        } else {
          this.complete('discover','Compatible block graph operation was accepted');
          this.complete('compose',`Saved graph revision ${options.graphRevision} via ${tool}`);
          this.current.status='verifying';
        }
      } else {
        this.current.lastError=`${tool} did not demonstrate a new graph revision; no feature completion recorded.`;
      }
    }
    if((tool==='verify_spica_app'||tool==='complete_project_task') && options.verified===true && this.current.steps.find(s=>s.id==='compose')?.state==='completed') {
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
    if(status==='paused'||status==='blocked'||status==='cancelled')this.batchJournal.interrupt(reason??status,status==='blocked'?'blocked':'paused');
    this.refreshThoughts();
    this.current.checkpointAt=new Date().toISOString();
    return this.plan;
  }
  /** A compact, evidence-derived context for subsequent genuine tool turns. */
  context(maxChars=1400): string {
    const plan=this.current;
    return (`SPICA SAVED TASK (authoritative, not a fresh user command): ${plan.goal}\n`+
      `Status: ${plan.status}; graph revision: ${plan.graphRevision??'none'}; next unfinished step: ${this.nextStep??'none'}; verified graph writes: ${plan.verifiedChanges}; committed source writes: ${plan.sourceWrites??0}; source files: ${(plan.sourceFiles??[]).slice(-5).join(',')||'none'}.\n`+
      plan.steps.map(s=>`${s.id}: ${s.state}${s.evidence.length?'; evidence: '+s.evidence.at(-1):''}`).join('\n')+
      (plan.lastError?`\nLast failure: ${plan.lastError}`:'')+
      '\nPerform the next required REGISTERED TOOL operation; tool inspections are not completed application features. Do not narrate intentions as finished work.').slice(0,maxChars);
  }
}
