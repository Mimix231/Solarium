import { sha256Source } from '../loader';
import type { SourceBlockKind, SourceTarget } from '../types';
import {sanitizeIndexedCapability} from './contracts';
import type { IndexedCapability, WarehouseIndexBuildResult, WarehouseIndexManifest, WarehouseShard, WarehouseShardSummary } from './contracts';

const MAX_INDEX_ENTRIES = 500_000;
const MIN_SHARDS = 1;
const MAX_SHARDS = 4096;
const TERM_RE = /[a-z0-9]+/g;
// Curated lexical variants only. Never claim a capability exists because its
// description resembles an unsupported feature (e.g. swimming != jumping).
const TERM_ALIASES:Readonly<Record<string,string>>={
  jumping:'jump',jumps:'jump',moving:'movement',movements:'movement',
  collisions:'collision',collecting:'collectibles',animations:'animation',
  buttons:'button',sorting:'sort',records:'record',
};
export function tokenizeCapability(text: string): readonly string[] {
  const words=text.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().match(TERM_RE) ?? [];
  return [...new Set(words.filter(token=>token.length>=2).map(token=>TERM_ALIASES[token]??token))];
}
export function capabilityTerms(entry: IndexedCapability): readonly string[] {
  return tokenizeCapability([entry.id,entry.category,entry.description,...entry.exports.map(x=>x.name),
    ...entry.requires.map(x=>x.id)].join(' '));
}
/** Non-cryptographic partitioning; SHA-256 separately checks integrity. */
export function shardForIdentity(identity: string, shardCount: number): string {
  if (!Number.isSafeInteger(shardCount) || shardCount < MIN_SHARDS || shardCount > MAX_SHARDS) {
    throw Error('Invalid warehouse shard count');
  }
  let hash = 2166136261;
  for (let i=0;i<identity.length;i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619);
  return String((hash >>> 0) % shardCount).padStart(4,'0');
}
export function serializeWarehouseShard(shard: WarehouseShard): string {
  return JSON.stringify(shard);
}
export function validateWarehouseManifest(manifest: WarehouseIndexManifest): void {
  if (!manifest || manifest.schemaVersion !== 1 || !Number.isSafeInteger(manifest.count) || manifest.count < 0 ||
      !Number.isSafeInteger(manifest.shardCount) || manifest.shardCount < 1 || manifest.shardCount > MAX_SHARDS ||
      !Array.isArray(manifest.shards) || manifest.shards.length > manifest.shardCount ||
      !manifest.postings || typeof manifest.postings !== 'object' || Array.isArray(manifest.postings)) throw Error('Invalid warehouse manifest');
  const counts=manifest.countsByKind;
  if(!counts || Object.keys(counts).length!==4 ||
      !['portable-source','source-generator','host-runtime','knowledge-descriptor'].every(k=>Object.hasOwn(counts,k)) ||
      Object.values(counts).some(value=>!Number.isSafeInteger(value)||value<0) ||
      Object.values(counts).reduce((total,value)=>total+value,0)!==manifest.count){
    throw Error('Warehouse manifest kind-count mismatch');
  }
  const ids = new Set<string>();let counted=0;
  for (const shard of manifest.shards) {
    if (!shard || !/^\d{4}$/.test(shard.id) || ids.has(shard.id) ||
        !Number.isSafeInteger(shard.count) || shard.count < 1 || !/^[a-f0-9]{64}$/.test(shard.sha256) ||
        Number(shard.id)>=manifest.shardCount ||
        !Array.isArray(shard.kinds)||shard.kinds.some((kind:SourceBlockKind)=>!(kind in counts))||
        !Array.isArray(shard.categories)||shard.categories.some((value:string)=>typeof value!=='string')||
        !Array.isArray(shard.targets)||shard.targets.some((value:SourceTarget)=>!['typescript-web','typescript-desktop'].includes(value))) {
      throw Error('Invalid warehouse shard manifest');
    }
    ids.add(shard.id);counted+=shard.count;
  }
  if (counted !== manifest.count) throw Error('Warehouse manifest count mismatch');
  for (const [term,shards] of Object.entries(manifest.postings)) {
    if (!/^[a-z0-9]+$/.test(term) || !Array.isArray(shards) ||
        shards.some(id=>typeof id!=='string'||!ids.has(id)) || new Set(shards).size!==shards.length) {
      throw Error('Invalid warehouse term posting');
    }
  }
}
export class WarehouseIndexer {
  static async build(entries: Iterable<IndexedCapability>, shardCount=64): Promise<WarehouseIndexBuildResult> {
    shardForIdentity('test',shardCount);
    const buckets = new Map<string,IndexedCapability[]>();
    const identities = new Set<string>();
    const countsByKind: Record<SourceBlockKind, number> = {
      'portable-source':0,'source-generator':0,'host-runtime':0,'knowledge-descriptor':0,
    };
    let count=0;
    for (const raw of entries) {
      const entry=sanitizeIndexedCapability(raw);
      const identity=`${entry.id}@${entry.version}`;
      if (identities.has(identity)) throw Error(`Duplicate indexed capability: ${identity}`);
      identities.add(identity);
      if (++count > MAX_INDEX_ENTRIES) throw Error('Warehouse index exceeds configured capacity');
      const shardId=shardForIdentity(identity,shardCount);
      const bucket=buckets.get(shardId)??[];
      bucket.push(entry);buckets.set(shardId,bucket);
      countsByKind[entry.kind]++;
    }
    const postings = new Map<string,Set<string>>();
    const shards: WarehouseShard[]=[];const summaries: WarehouseShardSummary[]=[];
    for (const [id,items] of [...buckets].sort(([a],[b])=>a.localeCompare(b))) {
      const sorted=items.sort((a,b)=>a.id.localeCompare(b.id)||a.version.localeCompare(b.version));
      const shard:WarehouseShard={id,entries:sorted};
      shards.push(shard);
      const kinds=new Set<typeof sorted[number]['kind']>();
      const categories=new Set<string>();
      const targets=new Set<typeof sorted[number]['targets'][number]>();
      for (const item of sorted) {
        kinds.add(item.kind);categories.add(item.category);item.targets.forEach(t=>targets.add(t));
        for(const term of capabilityTerms(item)) {
          let ids=postings.get(term);
          if (!ids) {ids=new Set();postings.set(term,ids);}
          ids.add(id);
        }
      }
      summaries.push({id,count:sorted.length,sha256:await sha256Source(serializeWarehouseShard(shard)),
        kinds:[...kinds].sort(),categories:[...categories].sort(),targets:[...targets].sort()});
    }
    const dictionary:Record<string,readonly string[]> = Object.create(null);
    for(const [term,ids] of [...postings].sort(([a],[b])=>a.localeCompare(b))) dictionary[term]=[...ids].sort();
    const manifest:WarehouseIndexManifest={schemaVersion:1,count,shardCount,countsByKind,
      shards:summaries,postings:dictionary};
    validateWarehouseManifest(manifest);
    return {manifest,shards};
  }
}
