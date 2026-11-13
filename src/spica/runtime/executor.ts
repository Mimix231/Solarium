import type { SpicaGraphEdge, SpicaGraphNode, SpicaGraphV2 } from '../graph-v2/types';
import { assertSpicaGraphV2 } from '../graph-v2/validation';
import { spicaCanonicalJson } from '../graph-v2/serialization';
import type { SpicaBlockAdapter, SpicaRuntimePermission, SpicaRuntimeStore, SpicaRuntimeTarget } from './adapter';
import { getRuntimeBlock } from './registry';
import { checkRuntimeBlockPermission, type SpicaRuntimeGrantBroker } from './permissions';
import { SpicaMemoryStore } from './store';
import type { SpicaExecutionSummary, SpicaExecutionTraceEntry } from './trace';
import { spicaRuntimeClone, spicaRuntimeValueMatches } from './value';

export class SpicaExecutionError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = 'SpicaExecutionError'; }
}
export interface SpicaRunOptions {
  target: SpicaRuntimeTarget;
  /** Explicitly approved grants, never inferred from an LLM's requested tool arguments. */
  grants: ReadonlySet<SpicaRuntimePermission>;
  broker?: SpicaRuntimeGrantBroker;
  store?: SpicaRuntimeStore;
  signal?: AbortSignal;
  maxOperations?: number;
  maxFeedbackRounds?: number;
  /** Deliver real events to a UI workbench, never synthetic progress percentages. */
  onTrace?: (event: SpicaExecutionTraceEntry) => void;
  /** Project migration placeholder nodes are excluded only if readonly and wholly disconnected from runtime nodes. */
  excludeIsolatedLegacy?: boolean;
}
const RUN_ID_PREFIX = 'spica-run-';
let sequence = 0;
function nextRunId(): string { return `${RUN_ID_PREFIX}${Date.now()}-${++sequence}`; }
const cancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new SpicaExecutionError('CANCELLED','SPICA execution was cancelled.');
};

/** Refuse to silently execute or ignore user-authored unregistered nodes. */
function executableGraph(graph: SpicaGraphV2, excludeIsolatedLegacy: boolean): { graph: SpicaGraphV2; omitted: number } {
  if (!excludeIsolatedLegacy) return {graph,omitted:0};
  const legacy = new Set(graph.nodes.filter(node => node.block.availability === 'placeholder' && node.metadata?.readonly === true &&
    node.block.id.startsWith('spica.legacy.') && graph.migration?.strategy === 'readonly-snapshot').map(node => node.id));
  if (graph.edges.some(edge => legacy.has(edge.from.node) !== legacy.has(edge.to.node))) throw new SpicaExecutionError('UNSUPPORTED_BRIDGE','Legacy placeholders cannot connect to executable runtime nodes.');
  return { graph: { ...graph, nodes:graph.nodes.filter(node => !legacy.has(node.id)), edges:graph.edges.filter(edge => !legacy.has(edge.from.node) && !legacy.has(edge.to.node)) }, omitted:legacy.size };
}

/** Deterministic topological order; feedback event edges are handled in explicit bounded rounds. */
function schedule(graph: SpicaGraphV2): SpicaGraphNode[] {
  const nodes = new Map(graph.nodes.map(node => [node.id,node]));
  const count = new Map(graph.nodes.map(node => [node.id,0]));
  const outgoing = new Map<string,string[]>();
  for (const edge of graph.edges) {
    if (edge.feedback) continue;
    count.set(edge.to.node,(count.get(edge.to.node) ?? 0)+1);
    outgoing.set(edge.from.node,[...(outgoing.get(edge.from.node) ?? []),edge.to.node]);
  }
  const queue=[...count].filter(([,v])=>v===0).map(([id])=>id).sort();
  const ordered:SpicaGraphNode[]=[];
  while(queue.length){
    const id=queue.shift()!;
    ordered.push(nodes.get(id)!);
    for(const next of outgoing.get(id)??[]){
      const n=(count.get(next)??0)-1;count.set(next,n);
      if(n===0){queue.push(next);queue.sort();}
    }
  }
  if(ordered.length!==graph.nodes.length)throw new SpicaExecutionError('CYCLE','Unbounded graph cycle detected.');
  return ordered;
}

export function makeRuntimeNode(id:string,blockId:string,config:Record<string,unknown>={}):SpicaGraphNode {
  const adapter=getRuntimeBlock(blockId,'1');
  if(!adapter)throw new SpicaExecutionError('UNREGISTERED_BLOCK',`No executable block ${blockId}@1.`);
  return {id,scope:'root',block:{id:adapter.id,version:adapter.version,availability:'registered'},
    inputs:structuredClone([...adapter.inputs]),outputs:structuredClone([...adapter.outputs]),config:structuredClone(config)};
}

/** Fully isolated Graph V2 evaluator. NEVER emits standalone source or executes user JS strings. */
export async function executeSpicaGraphV2(source:SpicaGraphV2, options:SpicaRunOptions):Promise<SpicaExecutionSummary> {
  const runId=nextRunId();
  const trace:SpicaExecutionTraceEntry[]=[];
  const emit=(nodeId:string,blockId:string,state:SpicaExecutionTraceEntry['state'],message?:string)=>{
    const item:SpicaExecutionTraceEntry={runId,nodeId,blockId,state,at:new Date().toISOString(),...(message?{message:message.slice(0,500)}:{})};
    if(trace.length<1024) trace.push(item);
    try { options.onTrace?.(item); } catch { /* telemetry must not break app execution */ }
  };
  const {graph,omitted}=executableGraph(source,options.excludeIsolatedLegacy===true);
  let operations=0;
  let resultBytes=0;
  let committed=false;
  const outputs:Record<string,Record<string,unknown>>={};
  const store=options.store??new SpicaMemoryStore();
  const storage=options.store?'host-transaction' as const:'isolated-memory' as const;
  let tx:Awaited<ReturnType<SpicaRuntimeStore['begin']>>|undefined;
  const adapters=new Map<string,SpicaBlockAdapter>();
  const maxOperations=Math.min(Math.max(options.maxOperations??256,1),1024);
  const maxRounds=Math.min(Math.max(options.maxFeedbackRounds??32,1),100);
  const counts=new Map<string,number>();
  const pureCache=new Map<string,{signature:string;result:Record<string,unknown>}>();
  try {
    cancelled(options.signal);
    assertSpicaGraphV2(graph,{requireComplete:true,resolveBlock:(id,version)=>Boolean(getRuntimeBlock(id,version))});
    if(!graph.nodes.length)throw new SpicaExecutionError('EMPTY_RUNTIME','There are no executable V2 nodes to run.');
    for(const node of graph.nodes){
      if(node.block.availability!=='registered')throw new SpicaExecutionError('NON_EXECUTABLE',`Node ${node.id} is a placeholder, not an executable adapter.`);
      const adapter=getRuntimeBlock(node.block.id,node.block.version);
      if(!adapter)throw new SpicaExecutionError('UNREGISTERED_BLOCK',`No executable adapter for ${node.block.id}@${node.block.version}.`);
      if(spicaCanonicalJson(node.inputs)!==spicaCanonicalJson(adapter.inputs) || spicaCanonicalJson(node.outputs)!==spicaCanonicalJson(adapter.outputs)) {
        throw new SpicaExecutionError('CONTRACT_MISMATCH',`Ports for ${node.id} do not match ${adapter.id}@${adapter.version}.`);
      }
      adapter.validateConfig(node.config);
      checkRuntimeBlockPermission(adapter,options.target,options.grants,options.broker);
      adapters.set(node.id,adapter);
    }
    tx=await store.begin();
    const order=schedule(graph);
    const incoming=new Map<string,SpicaGraphEdge[]>();
    for(const edge of graph.edges)incoming.set(edge.to.node,[...(incoming.get(edge.to.node)??[]),edge]);
    const feedbackDelivered=new Map<string,unknown>();
    let round=0;
    do {
      const nextFeedback=new Map<string,unknown>();
      for(const node of order){
        cancelled(options.signal);
        const adapter=adapters.get(node.id)!;
        const inputs:Record<string,unknown>={};
        let missing=false;
        const eventInputs=node.inputs.filter(port=>port.type.kind==='event');
        for(const port of node.inputs){
          const links=(incoming.get(node.id)??[]).filter(edge=>edge.to.port===port.id);
          if(!links.length){if(port.required)missing=true;continue;}
          // Prefer an actually delivered bounded feedback event over the initial event seed.
          const from=links.find(edge=>edge.feedback && feedbackDelivered.has(edge.id)) ?? links.find(edge=>!edge.feedback) ?? links[0]!;
          const value=from.feedback?feedbackDelivered.get(from.id):outputs[from.from.node]?.[from.from.port];
          if(value===undefined){missing=true;continue;}
          if(!spicaRuntimeValueMatches(value,port.type))throw new SpicaExecutionError('INVALID_INPUT',`${node.id}.${port.id} received invalid data.`);
          inputs[port.id]=spicaRuntimeClone(value);
        }
        if(eventInputs.length && !eventInputs.every(port=>inputs[port.id]!==undefined))missing=true;
        if(missing){emit(node.id,adapter.id,'skipped','A dependency or event trigger was not available.');continue;}
        if(++operations>maxOperations)throw new SpicaExecutionError('BUDGET_EXHAUSTED',`Execution exceeded ${maxOperations} operations.`);
        emit(node.id,adapter.id,'started');
        const context={runId,nodeId:node.id,target:options.target,signal:options.signal??new AbortController().signal,
          storage:{read:(collection:string,key:string)=>{if(!adapter.permissions.includes('records.read'))throw new SpicaExecutionError('PERMISSION_DENIED',`${adapter.id} cannot read records.`);return tx!.read(collection,key);},
            put:(collection:string,key:string,value:unknown)=>{if(!adapter.permissions.includes('records.write'))throw new SpicaExecutionError('PERMISSION_DENIED',`${adapter.id} cannot write records.`);return tx!.put(collection,key,value);}},
          requirePermission:(permission:SpicaRuntimePermission)=>{
            if(!adapter.permissions.includes(permission))throw new SpicaExecutionError('PERMISSION_DENIED',`${adapter.id} did not declare ${permission}.`);
            checkRuntimeBlockPermission(adapter,options.target,options.grants,options.broker);
          }};
        try {
          const cacheable=adapter.kind==='pure' && adapter.outputs.every(port=>port.type.kind!=='event');
          const signature=cacheable?spicaCanonicalJson({config:node.config,inputs}):'';
          const cached=cacheable?pureCache.get(node.id):undefined;
          const result=cached?.signature===signature ? spicaRuntimeClone(cached.result) :
            await adapter.execute(context,inputs,spicaRuntimeClone(node.config));
          cancelled(options.signal);
          if(!result || typeof result!=='object' || Array.isArray(result) || Object.keys(result).some(name=>!adapter.outputs.some(port=>port.id===name))) {
            throw new SpicaExecutionError('INVALID_OUTPUT',`${node.id} returned an undeclared output.`);
          }
          for(const port of adapter.outputs){
            if(!Object.hasOwn(result,port.id)){
              if(port.type.kind==='event')continue;
              throw new SpicaExecutionError('MISSING_OUTPUT',`${node.id}.${port.id} is required.`);
            }
            if(!spicaRuntimeValueMatches(result[port.id],port.type))throw new SpicaExecutionError('INVALID_OUTPUT',`${node.id}.${port.id} returned the wrong type.`);
          }
          const clonedResult = spicaRuntimeClone(result);
          resultBytes += JSON.stringify(clonedResult).length;
          if (resultBytes > 4_000_000) throw new SpicaExecutionError('OUTPUT_BUDGET', 'Runtime results exceeded the 4 MB per-run output budget.');
          outputs[node.id]=clonedResult;
          if(cacheable && cached?.signature!==signature)pureCache.set(node.id,{signature,result:spicaRuntimeClone(result)});
          for(const edge of graph.edges){
            if(!edge.feedback || edge.from.node!==node.id || !Object.hasOwn(result,edge.from.port))continue;
            const total=(counts.get(edge.id)??0)+1;
            if(total>edge.feedback.maxIterations)throw new SpicaExecutionError('FEEDBACK_LIMIT',`Event feedback ${edge.id} exceeded its ${edge.feedback.maxIterations} iterations.`);
            counts.set(edge.id,total);nextFeedback.set(edge.id,spicaRuntimeClone(result[edge.from.port]));
          }
          emit(node.id,adapter.id,'completed',cached?.signature===signature?'Pure output reused from this run.':undefined);
        }catch(error){emit(node.id,adapter.id,'failed',error instanceof Error?error.message:String(error));throw error;}
        finally{await adapter.cleanup?.(context);}
      }
      round++;
      feedbackDelivered.clear();
      for(const [id,value] of nextFeedback)feedbackDelivered.set(id,value);
      if(!feedbackDelivered.size)break;
      if(round>=maxRounds)throw new SpicaExecutionError('FEEDBACK_LIMIT',`Feedback exceeded ${maxRounds} rounds.`);
    }while(true);
    cancelled(options.signal);
    await tx.commit();committed=true;
    if(omitted)emit('legacy', 'spica.legacy','skipped',`Excluded ${omitted} isolated read-only legacy projection nodes.`);
    return {runId,state:'passed',target:options.target,operations,trace,outputs,storage,committed};
  }catch(error){
    if(tx && !committed)await tx.rollback();
    const aborted=options.signal?.aborted || error instanceof SpicaExecutionError && error.code==='CANCELLED' || error instanceof DOMException && error.name==='AbortError';
    return {runId,state:aborted?'cancelled':'failed',target:options.target,operations,trace,outputs:{},storage,committed:false,
      error:error instanceof Error?error.message:String(error)};
  }
}
