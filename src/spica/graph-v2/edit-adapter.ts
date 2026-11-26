import { getRuntimeBlock } from '../runtime/registry';
import { spicaCanonicalJson } from './serialization';
import { makeRuntimeNode } from '../runtime/executor';
import type { SpicaGraphNode, SpicaGraphV2, SpicaGraphV2Edit } from './types';

/** Make a registered runtime block into a full authoring node. This is an
 * explicit `add_block` graph edit, not a feature-specific construction path.
 * The runtime adapter remains the only source of its actual port contracts.
 */
export function expandSpicaV2Edits(edits:readonly Record<string,unknown>[]):SpicaGraphV2Edit[]{
  return edits.map(edit=>{
    if(edit.op==='add_node') {
      const raw=edit.node;
      if(raw&&typeof raw==='object'&&!Array.isArray(raw)) {
        const node=raw as SpicaGraphNode;
        if(node.block?.availability==='registered') {
          const adapter=getRuntimeBlock(node.block.id,node.block.version);
          if(adapter&&adapter.id!==node.block.id) return {op:'add_node',node:{...node,block:{...node.block,id:adapter.id}}};
        }
      }
    }
    if(edit.op!=='add_block')return edit as SpicaGraphV2Edit;
    const {id,blockId}=edit;
    if(typeof id!=='string'||typeof blockId!=='string')throw Error('add_block requires id and blockId strings.');
    const version=edit.version??'1';
    if(version!=='1')throw Error(`Unsupported block version ${String(version)}.`);
    const adapter=getRuntimeBlock(blockId,version);
    if(!adapter)throw Error(`Executable block ${blockId}@${version} is not registered.`);
    const config=edit.config??{};
    if(!config||typeof config!=='object'||Array.isArray(config))throw Error('add_block config must be an object.');
    adapter.validateConfig(config as Record<string,unknown>);
    const node=makeRuntimeNode(id,blockId,config as Record<string,unknown>);
    if(edit.scope!==undefined){if(typeof edit.scope!=='string')throw Error('add_block scope must be a string.');node.scope=edit.scope;}
    if(edit.label!==undefined){if(typeof edit.label!=='string')throw Error('add_block label must be a string.');node.metadata={...node.metadata,label:edit.label};}
    return {op:'add_node',node} as SpicaGraphV2Edit;
  });
}

/** Runtime contracts must remain valid through authoring edits, not only at
 * execution time. This applies to add_node and set_node_config just as it does
 * to add_block. Legacy schema-1 source adapters and non-executable projection
 * placeholders are checked by the Graph V2 validator, not this runtime check.
 */
export function assertSpicaRuntimeNodeContracts(graph:SpicaGraphV2):void {
  for(const node of graph.nodes){
    if(node.block.availability!=='registered')continue;
    const adapter=getRuntimeBlock(node.block.id,node.block.version);
    if(!adapter)continue; // Schema-1 source adapter: it is not a runnable V2 adapter.
    if(spicaCanonicalJson(node.inputs)!==spicaCanonicalJson(adapter.inputs) ||
       spicaCanonicalJson(node.outputs)!==spicaCanonicalJson(adapter.outputs)) {
      throw Error(`CONTRACT_MISMATCH: Node ${node.id} ports differ from ${adapter.id}@${adapter.version}. Use add_block to derive registered ports.`);
    }
    try {adapter.validateConfig(node.config);} catch(error){
      throw Error(`INVALID_BLOCK_CONFIG: ${node.id} (${adapter.id}@${adapter.version}): ${error instanceof Error?error.message:String(error)}`);
    }
  }
}
