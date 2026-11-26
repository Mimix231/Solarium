import type { SpicaGraphV2 } from './graph-v2/types';
import { spicaCanonicalJson } from './graph-v2/serialization';
import { listRuntimeBlocks, getRuntimeBlock } from './runtime/registry';
import { runtimeBlockAliases } from './runtime/aliases';
import { executeSpicaGraphV2 } from './runtime/executor';

export type ImpactDirection='upstream'|'downstream'|'both';
/** Unlike inspect_spica_wiring, this inspects ACTUAL saved graph edges, not
 * hypothetical type-compatible connections. Read-only and bounded. */
export function inspectGraphImpact(graph:SpicaGraphV2, ids:readonly string[],direction:ImpactDirection='downstream',depth=5){
  const vertices=new Map(graph.nodes.map(node=>[node.id,node]));
  const missing=ids.filter(id=>!vertices.has(id));
  if(missing.length)return {ok:false,code:'UNKNOWN_GRAPH_NODES',missing,availableNodes:graph.nodes.slice(0,30).map(n=>n.id)};
  const frontier=ids.map(id=>({id,depth:0}));
  const seen=new Map(ids.map(id=>[id,0]));
  const traversed=new Set<string>();
  while(frontier.length){
    const item=frontier.shift()!;
    if(item.depth>=depth)continue;
    for(const edge of graph.edges){
      const next=edge.from.node===item.id&&direction!=='upstream'?edge.to.node:
        edge.to.node===item.id&&direction!=='downstream'?edge.from.node:null;
      if(!next)continue;
      traversed.add(edge.id);
      if(seen.has(next)||seen.size>=96)continue;
      seen.set(next,item.depth+1);frontier.push({id:next,depth:item.depth+1});
    }
  }
  return {ok:true,graphId:graph.id,roots:[...ids],direction,
    impacted:[...seen].map(([id,steps])=>({id,steps,blockId:vertices.get(id)!.block.id})),
    connections:graph.edges.filter(edge=>traversed.has(edge.id)).map(edge=>({id:edge.id,from:edge.from,to:edge.to,kind:edge.kind})),
    truncated:seen.size>=96};
}

export interface SpicaBehaviorAssertion {
  nodeId:string;
  port:string;
  condition:'exists'|'equals'|'contains'|'length';
  expected?:unknown;
}
/** Runs the real V2 evaluator with ZERO external grants, then asserts its
 * actual typed results. It is not verify_spica_app (native compiler/tests). */
export async function runSpicaBehaviorAssertions(graph:SpicaGraphV2,checks:readonly SpicaBehaviorAssertion[],target:'desktop'|'web'='desktop'){
  const result=await executeSpicaGraphV2(graph,{target,grants:new Set(),maxOperations:256,excludeIsolatedLegacy:true});
  if(result.state!=='passed')return {ok:false,state:result.state,error:result.error,executedOperations:result.operations,checks:[]};
  const reports=checks.map(check=>{
    if(check.condition!=='exists' && check.expected===undefined) return {nodeId:check.nodeId,port:check.port,condition:check.condition,passed:false,code:'MISSING_EXPECTED_VALUE'};
    const exists=result.outputs[check.nodeId] && Object.hasOwn(result.outputs[check.nodeId]!,check.port);
    const value=exists?result.outputs[check.nodeId]![check.port]:undefined;
    const passed=check.condition==='exists'?Boolean(exists):!exists?false:
      check.condition==='equals'?spicaCanonicalJson(value)===spicaCanonicalJson(check.expected):
      check.condition==='contains'?(typeof value==='string'&&typeof check.expected==='string'&&value.includes(check.expected)):
      Array.isArray(value)&&value.length===check.expected;
    return {nodeId:check.nodeId,port:check.port,condition:check.condition,passed:Boolean(passed),
      ...(passed?{}:{actual:typeof value==='string'?value.slice(0,240):value??null,expected:check.expected??null})};
  });
  return {ok:reports.every(item=>item.passed),state:result.state,storage:result.storage,
    executedOperations:result.operations,passed:reports.filter(item=>item.passed).length,total:reports.length,checks:reports};
}

/** Real runtime-contract health, distinct from discovery/listing. Tests that
 * every selected adapter's bundled example validates and aliases resolve. */
export function inspectRuntimeRegistryHealth(category?:string,limit=60){
  const adapters=listRuntimeBlocks().filter(item=>!category||item.category===category).slice(0,limit);
  const findings:Array<{id:string;code:string;detail:string}>=[];
  for(const adapter of adapters){
    try{adapter.validateConfig(adapter.exampleConfig??{});}catch(error){findings.push({id:adapter.id,code:'INVALID_EXAMPLE_CONFIG',detail:String(error).slice(0,240)});}
    if(adapter.kind==='pure'&&adapter.permissions.length) findings.push({id:adapter.id,code:'INVALID_PURE_PERMISSION',detail:'Pure blocks cannot request external permissions.'});
  }
  for(const [alias,canonical] of Object.entries(runtimeBlockAliases))if(!category||getRuntimeBlock(canonical,'1')?.category===category){
    if(getRuntimeBlock(alias,'1')?.id!==canonical)findings.push({id:alias,code:'BROKEN_ALIAS',detail:`Must resolve to ${canonical}`});
  }
  return {ok:findings.length===0,checked:adapters.length,totalMatching:listRuntimeBlocks().filter(item=>!category||item.category===category).length,
    registeredTotal:listRuntimeBlocks().length,category:category??'all',findings};
}
