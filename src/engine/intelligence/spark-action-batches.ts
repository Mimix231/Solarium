/** A durable SPICA action batch spans multiple natural model/tool turns.
 * It is NOT an inference reset or a substitute for a real graph transaction.
 * Inspections alone never complete a batch. */
export type SparkActionBatchStatus = 'active' | 'checkpointed' | 'paused' | 'blocked';
export interface SparkActionBatch {
  index: number;
  objective: string;
  stage: string;
  status: SparkActionBatchStatus;
  fromRevision: number | null;
  toRevision: number | null;
  thoughtIndices: number[];
  toolCalls: number;
  inspections: number;
  failures: number;
  sourceFiles?: string[];
  sourceRevisions?: number[];
  promptTokens: number;
  outputTokens: number;
  measuredPromptTurns: number;
  measuredOutputTurns: number;
  startedAt: string;
  finishedAt?: string;
  /** Small evidence-based carry-forward; never a copy of model reasoning. */
  checkpoint?: string;
  lastDiagnostic?: string;
}
const MAX_BATCHES = 32;
const MAX_CHECKPOINT = 1450;
const inspection = /^(?:inspect_|read_|search_|list_|resolve_|spica_next_action|check_spica_tool_call|validate_)/;
export class SparkActionBatchJournal {
  private records: SparkActionBatch[];
  constructor(saved: readonly SparkActionBatch[] = []) {
    this.records = structuredClone(saved).slice(-MAX_BATCHES);
    const last=this.records.at(-1);
    if(last?.status==='active') {
      last.status='paused';
      last.finishedAt??=new Date().toISOString();
      last.lastDiagnostic='Interrupted action batch: inspect current graph before resuming; no pending write is replayed.';
    }
  }
  get history(): SparkActionBatch[] {return structuredClone(this.records);}
  get current(): SparkActionBatch|null {return structuredClone(this.records.at(-1)??null);}
  /** A new batch begins only after a checkpoint or an interrupted/blocked boundary. */
  enter(stage:string,objective:string,revision:number|null,thoughtIndex:number):SparkActionBatch {
    let current=this.records.at(-1);
    if(!current||current.status!=='active') {
      current={index:(current?.index??0)+1,objective,stage,status:'active',fromRevision:revision,toRevision:revision,
        thoughtIndices:[],toolCalls:0,inspections:0,failures:0,promptTokens:0,outputTokens:0,
        measuredPromptTurns:0,measuredOutputTurns:0,startedAt:new Date().toISOString()};
      this.records.push(current);
      this.records=this.records.slice(-MAX_BATCHES);
    }
    if(current.thoughtIndices.includes(thoughtIndex))throw Error('A Thought Block may be attached to only one action batch.');
    current.thoughtIndices.push(thoughtIndex);
    return structuredClone(current);
  }
  recordUsage(prompt:number|null,output:number|null):SparkActionBatch {
    const current=this.active();
    if(typeof prompt==='number'&&Number.isFinite(prompt)&&prompt>=0){current.promptTokens+=prompt;current.measuredPromptTurns++;}
    if(typeof output==='number'&&Number.isFinite(output)&&output>=0){current.outputTokens+=output;current.measuredOutputTurns++;}
    return structuredClone(current);
  }
  recordTool(name:string,status:'completed'|'failed'|'denied',diagnostic?:string):SparkActionBatch {
    const current=this.active();current.toolCalls++;
    if(inspection.test(name))current.inspections++;
    if(status!=='completed') {current.failures++;current.lastDiagnostic=`${name}: ${diagnostic??status}`.slice(0,400);}
    return structuredClone(current);
  }
  /** Confirmed native source changes are a checkpoint boundary even when the
   * SPICA graph revision is unchanged; verification remains a separate stage. */
  recordSourceWrite(paths: readonly string[], sourceRevision: number): void {
    const current=this.active();
    if (!paths.length || !Number.isSafeInteger(sourceRevision) || sourceRevision<=0) return;
    current.sourceFiles=[...new Set([...(current.sourceFiles??[]),...paths])].slice(-40);
    current.sourceRevisions=[...(current.sourceRevisions??[]),sourceRevision].slice(-16);
  }
  /** The caller supplies an authoritative revision or completed verification.
   * Never infer success from discovery, empty validation or model text. */
  checkpoint(options:{revision:number|null;verified:boolean;stage:string;stepEvidence:readonly string[];lastTool:string|null}):SparkActionBatch|null {
    const current=this.records.at(-1);
    if(!current||current.status!=='active')return null;
    const revisionAdvanced=typeof options.revision==='number'&&
      (current.fromRevision===null||options.revision>current.fromRevision);
    if(!revisionAdvanced&&!options.verified&&!(current.sourceFiles?.length))return null;
    current.status='checkpointed';current.toRevision=options.revision;current.finishedAt=new Date().toISOString();
    const evidence=options.stepEvidence.filter(Boolean).slice(-3).map(x=>x.slice(0,250));
    current.checkpoint=JSON.stringify({goal:current.objective,stage:options.stage,
      fromRevision:current.fromRevision,toRevision:current.toRevision,verified:options.verified,
      actionCount:current.toolCalls,inspections:current.inspections,failures:current.failures,
      lastTool:options.lastTool,sourceFiles:current.sourceFiles,sourceRevisions:current.sourceRevisions,evidence}).slice(0,MAX_CHECKPOINT);
    return structuredClone(current);
  }
  interrupt(reason:string,status:'paused'|'blocked'):SparkActionBatch|null {
    const current=this.records.at(-1);
    if(!current||current.status!=='active')return this.current;
    current.status=status;current.finishedAt=new Date().toISOString();current.lastDiagnostic=reason.slice(0,400);
    return structuredClone(current);
  }
  /** Only verified facts cross batch boundaries; never private reasoning. */
  lastCheckpoint():string|null {
    return [...this.records].reverse().find(record=>record.status==='checkpointed')?.checkpoint??null;
  }
  private active():SparkActionBatch {
    const current=this.records.at(-1);
    if(!current||current.status!=='active')throw Error('No active Spark action batch.');
    return current;
  }
}
