import type { SpicaGraphV2 } from './graph-v2/types';
import { spicaEditOperationSchema, v2EditOperations } from './edit-schemas';
import { listRuntimeBlocks } from './runtime/registry';
import { makeRuntimeNode } from './runtime/executor';
import { spicaTypeAssignable } from './graph-v2/validation';

/** Exact V2 operation contracts, derived from the SAME schema the agent must
 * submit to edit_spica_graph. No speculative node ports or synthetic blocks.
 */
export function inspectSpicaV2Parameters(graph:SpicaGraphV2|undefined,revision:number,operation?:string) {
  const context={revision,view:'v2',hasV2:Boolean(graph),
    scopes:graph?.scopes.map(item=>item.id)??[],
    nodes:graph?.nodes.map(item=>({id:item.id,blockId:item.block.id,readonly:Boolean(item.metadata?.readonly),
      inputs:item.inputs.map(port=>port.id),outputs:item.outputs.map(port=>port.id)}))??[],
    edges:graph?.edges.map(item=>({id:item.id,from:item.from,to:item.to}))??[],
    registeredBlockCount:listRuntimeBlocks().length};
  if(!operation)return {tool:'edit_spica_graph',view:'v2',revision,operations:v2EditOperations,context,
    workflow:['read_spica_graph view:v2','inspect_params view:v2 operation:<operation>',
      'validate_spica_edit view:v2','edit_spica_graph view:v2','read_spica_graph view:v2'],
    next:graph?'inspect_params':'migrate_spica_v2_graph'};
  const schema=spicaEditOperationSchema('v2',operation);
  if(!schema)return {ok:false,view:'v2',operation,allowedOperations:v2EditOperations};
  const block=listRuntimeBlocks()[0];
  const freshId=(name:string,ids:string[])=>{
    let candidate=name,index=2;while(ids.includes(candidate))candidate=`${name}_${index++}`;return candidate;
  };
  const node=graph?.nodes.find(item=>!item.metadata?.readonly);
  const addedNode=block?makeRuntimeNode(freshId('newblock',graph?.nodes.map(item=>item.id)??[]),block.id,block.exampleConfig??{}):null;
  const edge=graph?.edges.find(item=>!graph.nodes.some(n=>n.metadata?.readonly && (n.id===item.from.node||n.id===item.to.node)));
  const candidate=graph?.nodes.flatMap(from=>from.metadata?.readonly?[]:from.outputs.flatMap(output=>graph.nodes.flatMap(to=>
    to.metadata?.readonly||to.id===from.id||to.scope!==from.scope?[]:to.inputs.filter(input=>
      spicaTypeAssignable(output.type,input.type) && !graph.edges.some(edge=>edge.to.node===to.id&&edge.to.port===input.id))
      .map(input=>({from,output,to,input})))))?.[0];
  const connection=candidate?{id:freshId('edge',graph?.edges.map(e=>e.id)??[]),
    kind:candidate.output.type.kind==='event'?'event':candidate.output.type.kind==='reference'?'reference':'data',
    from:{node:candidate.from.id,port:candidate.output.id},to:{node:candidate.to.id,port:candidate.input.id}}:null;
  const unusedScope=graph?.scopes.find(scope=>scope.id!=='root'&&
    !graph.nodes.some(node=>node.scope===scope.id)&&!graph.scopes.some(item=>item.parent===scope.id));
  const examples:Record<string,unknown>={
    rename:{op:'rename',name:'Updated app'},
    add_scope:{op:'add_scope',scope:{id:freshId('panel',context.scopes),parent:'root',label:'Panel'}},
    remove_scope:{op:'remove_scope',id:unusedScope?.id},
    add_block:{op:'add_block',id:freshId('block',graph?.nodes.map(n=>n.id)??[]),blockId:block?.id,version:'1',config:block?.exampleConfig??{},scope:'root'},
    add_node:{op:'add_node',node:addedNode},
    remove_node:{op:'remove_node',id:node?.id},
    set_node_config:{op:'set_node_config',id:node?.id,config:node?.config??{}},
    move_node:{op:'move_node',id:node?.id,x:(node?.metadata?.x??0)+40,y:(node?.metadata?.y??0)+40},
    connect:{op:'connect',edge:connection},
    disconnect:{op:'disconnect',id:edge?.id},
  };
  const prerequisites:Record<string,boolean>={
    remove_scope:Boolean(unusedScope),
    add_node:Boolean(addedNode),remove_node:Boolean(node),set_node_config:false,move_node:Boolean(node),
    connect:Boolean(connection),disconnect:Boolean(edge),add_block:Boolean(block),
  };
  const available=Boolean(graph) && (prerequisites[operation]??true);
  const example=available?{revision,view:'v2',edits:[examples[operation]]}:null;
  return {tool:'edit_spica_graph',view:'v2',operation,revision,available,
    schema,example,context,next:!graph?'migrate_spica_v2_graph':available?'validate_spica_edit':'search_spica_runtime_blocks',
    note:'Examples are illustrations only. Inspect the exact block ports/config and actual graph IDs before saving.'};
}
