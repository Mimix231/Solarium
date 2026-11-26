import { listRuntimeBlocks, getRuntimeBlock } from './registry';
import { runtimeBlockAliasNames } from './aliases';
import type { SpicaRuntimeTarget } from './adapter';

/** Capability discovery is based on real registered executable adapters, NEVER synthetic warehouse descriptions. */
export function searchExecutableBlocks(request: { query: string; category?: string; target?: SpicaRuntimeTarget; limit?: number }) {
  const readableQuery=request.query.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_./-]+/g,' ');
  const words = (readableQuery.toLowerCase().match(/[a-z0-9]+/g) ?? []).slice(0,12).filter(word=>word.length>1);
  // Discovery synonyms expand search terms ONLY. They never create callable
  // names, invent IDs, or change which blocks are executable in the registry.
  const related:Readonly<Record<string,readonly string[]>>={
    recent:['sort','date','timestamp','list','take'],recents:['sort','date','timestamp','list','take'],
    history:['sort','date','timestamp','list'],notes:['note','record','list'],note:['record'],
    markdown:['markdown','text'],richtext:['markdown','editor'],rich:['markdown','editor'],
    database:['record','storage'],storage:['record','read'],search:['filter','contains','query'],
    save:['record','write','event'],persist:['record','write'],click:['event','button'],
    page:['ui','navigation','layout'],screen:['ui','navigation','layout'],delete:['delete'],
  };
  const expanded=[...new Set(words.flatMap(word=>[word,...(related[word]??[])]))];
  const target = request.target ?? 'desktop';
  const limit = Math.min(20,Math.max(1,request.limit??12));
  const matches = listRuntimeBlocks().filter(block=>block.targets.includes(target) &&
    (!request.category || block.category === request.category || block.id.split('.').at(-1)?.startsWith(request.category)));
  const ranked = matches.map(block=>{
    const name = block.id.split('.').at(-1)!.replaceAll('_',' ');
    const text = `${name} ${block.category??''} ${block.description??''} ${runtimeBlockAliasNames(block.id).join(' ')}`.toLowerCase();
    const score = !words.length ? 1 : expanded.reduce((total,word)=>total+
      (name.includes(word)?(words.includes(word)?8:4):0)+
      (text.includes(word)?(words.includes(word)?3:1):0),0);
    return {block,score};
  }).filter(({score})=>score>0).sort((a,b)=>b.score-a.score||a.block.id.localeCompare(b.block.id));
  return { query:request.query, target, total:ranked.length,
    results:ranked.slice(0,limit).map(({block})=>({id:block.id,version:block.version,
      category:block.category??'legacy-runtime',description:block.description??block.id,kind:block.kind,
      inputPorts:block.inputs.map(p=>p.id),outputPorts:block.outputs.map(p=>p.id),permissions:block.permissions,
      exampleConfig:block.exampleConfig??{},aliases:runtimeBlockAliasNames(block.id)})) };
}
export function inspectExecutableBlock(id:string,version='1') {
  const block=getRuntimeBlock(id,version);
  if(!block)throw Error(`No registered executable SPICA block ${id}@${version}. Search executable blocks first.`);
  return {id:block.id,version:block.version,requestedId:id,resolvedAlias:id!==block.id,aliases:runtimeBlockAliasNames(block.id),category:block.category??'legacy-runtime',
    description:block.description??'Executable V2 adapter; inspect typed ports and validate configuration.',
    kind:block.kind,trust:block.trust,targets:block.targets,permissions:block.permissions,
    inputs:block.inputs,outputs:block.outputs,exampleConfig:block.exampleConfig??{},
    configSchema:block.configSchema??null,
    interaction:typeof block.exampleConfig?.eventId==='string'?{eventId:block.exampleConfig.eventId,
      sourceBlockId:'spica.runtime.ui_event_binding',link:'Use the same eventId in the UI component and the event-source block. UI events are delivered only by the host.'}:null,
    graphNodeExample:{id:'my_node',blockId:block.id,config:block.exampleConfig??{}},
    runtimeOnly:true,standaloneExport:false,
    note:'Use validate_spica_composition before compose_spica_v2_graph. Runtime V2 outputs do not yet compile into a standalone application.'};
}
