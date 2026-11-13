import { getRuntimeBlock } from '../runtime/registry';
import { makeRuntimeNode } from '../runtime/executor';
import type { SpicaGraphV2Edit } from './types';

/** Make a registered runtime block into a full authoring node. This is an
 * explicit `add_block` graph edit, not a feature-specific construction path.
 * The runtime adapter remains the only source of its actual port contracts.
 */
export function expandSpicaV2Edits(edits:readonly Record<string,unknown>[]):SpicaGraphV2Edit[]{
  return edits.map(edit=>{
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
