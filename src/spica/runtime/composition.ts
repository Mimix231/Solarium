import type { SpicaGraphV2, SpicaGraphValidation } from '../graph-v2/types';
import { validateSpicaGraphV2 } from '../graph-v2/validation';
import { getRuntimeBlock } from './registry';
import { makeRuntimeNode } from './executor';

export interface SpicaComposeNode {
  id: string; blockId: string; version?: string; config?: Record<string,unknown>;
  label?: string;
}
export interface SpicaComposeConnection {
  from: string; output: string; to: string; input: string;
}
export interface SpicaComposition {
  nodes: SpicaComposeNode[]; connections: SpicaComposeConnection[];
}
export interface SpicaCompositionReview {
  graph: SpicaGraphV2; diagnostics: SpicaGraphValidation;
  newNodes: string[]; newConnections: string[]; complete: boolean;
}
const idValid = (value:unknown) => typeof value==='string' && /^[a-z][a-z0-9_.:-]{0,119}$/.test(value);
/** Atomic graph-building plan. The Spark chooses blocks and wiring; NO request-keyword feature implementation exists. */
export function previewSpicaComposition(source:SpicaGraphV2, plan:SpicaComposition):SpicaCompositionReview {
  if(!plan || !Array.isArray(plan.nodes) || !Array.isArray(plan.connections) || !plan.nodes.length ||
      plan.nodes.length>48 || plan.connections.length>96)throw Error('A composition needs 1–48 nodes and at most 96 connections.');
  const next:SpicaGraphV2=structuredClone(source);
  const newNodes:string[]=[],newConnections:string[]=[];
  for(const entry of plan.nodes){
    if(!entry || !idValid(entry.id) || !idValid(entry.blockId) || entry.version && entry.version!=='1' ||
        (entry.config!==undefined && (entry.config===null || typeof entry.config!=='object' || Array.isArray(entry.config))))
      throw Error('Each node needs a safe id, registered blockId, optional version 1, and plain configuration.');
    if(next.nodes.some(node=>node.id===entry.id))throw Error(`Node ${entry.id} already exists. Choose another ID.`);
    const adapter=getRuntimeBlock(entry.blockId,entry.version??'1');
    if(!adapter)throw Error(`Block ${entry.blockId}@${entry.version??'1'} is not executable. Search registered blocks.`);
    const config=entry.config??{};
    adapter.validateConfig(config);
    const node=makeRuntimeNode(entry.id,entry.blockId,config);
    if(entry.label!==undefined){if(typeof entry.label!=='string'||entry.label.length>100)throw Error('Node label must be at most 100 characters.');node.metadata={label:entry.label};}
    next.nodes.push(node);newNodes.push(node.id);
  }
  for(const link of plan.connections){
    if(!link || ![link.from,link.output,link.to,link.input].every(idValid))throw Error('A connection needs from/output/to/input identifiers.');
    const from=next.nodes.find(node=>node.id===link.from),to=next.nodes.find(node=>node.id===link.to);
    if(!from||!to)throw Error(`Unknown connection endpoint ${link.from} → ${link.to}.`);
    const output=from.outputs.find(port=>port.id===link.output),input=to.inputs.find(port=>port.id===link.input);
    if(!output||!input)throw Error(`Unknown connection port ${link.from}.${link.output} → ${link.to}.${link.input}. Inspect the block ports.`);
    const id=`edge_${next.edges.length+1}`;
    const kind=output.type.kind==='event'?'event':output.type.kind==='reference'?'reference':'data';
    next.edges.push({id,kind,from:{node:link.from,port:link.output},to:{node:link.to,port:link.input}});
    newConnections.push(id);
  }
  const diagnostics=validateSpicaGraphV2(next,{resolveBlock:(id,version)=>Boolean(getRuntimeBlock(id,version))});
  if(!diagnostics.valid)throw Error(`Composition rejected: ${diagnostics.errors.slice(0,5).map(e=>`${e.code} (${e.path}): ${e.message}`).join('; ')}`);
  const complete=!diagnostics.warnings.some(w=>w.code==='UNCONNECTED_REQUIRED_PORT');
  return {graph:next,diagnostics,newNodes,newConnections,complete};
}
