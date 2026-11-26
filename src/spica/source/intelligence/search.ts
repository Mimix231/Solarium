import { sha256Source } from '../loader';
import type { SourceBlockKind, SourceTarget, SourceLanguage, SourceSymbol } from '../types';
import {sanitizeIndexedCapability} from './contracts';
import type { IndexedCapability, WarehouseIndexManifest, WarehouseIndexProvider, WarehouseShard } from './contracts';
import { capabilityTerms, serializeWarehouseShard, shardForIdentity, tokenizeCapability, validateWarehouseManifest } from './indexer';

export interface CapabilitySearchQuery {
  readonly query: string;
  readonly kind?: SourceBlockKind;
  readonly target?: SourceTarget;
  readonly category?: string;
  readonly version?: string;
  readonly language?: SourceLanguage;
  /** Exact exported symbol (case-sensitive), not fuzzy name matching. */
  readonly symbol?: string;
  readonly symbolKind?: SourceSymbol['kind'];
  readonly limit?: number;
  /** Explicit bound on I/O; when reached, results are labelled incomplete. */
  readonly maxShardReads?: number;
  /** Bound expensive per-entry scoring in large or semantic searches. */
  readonly maxEntriesScored?: number;
}
/** Optional host-owned semantic index. It supplies trusted shard IDs and scores;
 * model-generated metadata never supplies callbacks or arbitrary disk paths. */
export interface SemanticCapabilityProvider {
  candidateShards(query:string,limit:number):Promise<readonly string[]>;
  relevance?(query:string,capability:IndexedCapability):number|Promise<number>;
}
export interface CapabilitySearchResult {
  readonly matches: readonly {readonly capability:IndexedCapability;readonly score:number}[];
  readonly shardsRead: number;
  readonly candidateShards: number;
  readonly incomplete: boolean;
}
const MAX_CACHE_SHARDS=12;
const DEFAULT_READ_LIMIT=128;
const MAX_READ_LIMIT=4096;
const MAX_RESULT_LIMIT=100;

function scoreCapability(entry: IndexedCapability, query: string, terms: readonly string[]): number {
  if (!terms.length) return 1;
  const id=entry.id.toLowerCase();
  const description=entry.description.toLowerCase();
  const tags=new Set(capabilityTerms(entry));
  let score=id===query?200:id.includes(query)?50:0;
  let matched=0;
  for(const term of terms){
    if(tags.has(term)) {score+=8;matched++;}
    else if(id.includes(term)){score+=6;matched++;}
    else if(description.includes(term)){score+=2;matched++;}
  }
  if(!matched && !score)return 0;
  if(matched===terms.length)score+=20;
  if(entry.kind==='portable-source')score+=4;
  else if(entry.kind==='source-generator')score+=3;
  // Non-portable search matches remain visible but must not appear executable.
  return score;
}
export class CapabilitySearchEngine {
  private readonly summaries = new Map<string,WarehouseIndexManifest['shards'][number]>();
  private readonly cache = new Map<string,WarehouseShard>();
  constructor(private readonly manifest:WarehouseIndexManifest,private readonly provider:WarehouseIndexProvider,
    private readonly semantic?:SemanticCapabilityProvider){
    validateWarehouseManifest(manifest);
    for (const summary of manifest.shards)this.summaries.set(summary.id,summary);
  }
  private async load(id:string):Promise<WarehouseShard>{
    const cached=this.cache.get(id);
    if(cached){this.cache.delete(id);this.cache.set(id,cached);return cached;}
    const summary=this.summaries.get(id);
    if(!summary)throw Error(`Unknown warehouse shard ${id}`);
    const shard=await this.provider.readShard(id);
    if(!shard||shard.id!==id||!Array.isArray(shard.entries)||shard.entries.length!==summary.count ||
        await sha256Source(serializeWarehouseShard(shard))!==summary.sha256){
      throw Error(`Warehouse shard integrity mismatch: ${id}`);
    }
    // Avoid duplicate or conflicting identities inside a single shard.
    const identities=new Set<string>();
    for(const entry of shard.entries){
      const identity=`${entry.id}@${entry.version}`;
      if(identities.has(identity))throw Error(`Duplicate warehouse index identity in ${id}`);
      identities.add(identity);
    }
    const verified:WarehouseShard=Object.freeze({id,entries:Object.freeze(shard.entries.map(sanitizeIndexedCapability))});
    // Summary metadata is used to skip shards: it must not conceal actual kinds,
    // categories or targets from the verified shard contents.
    for(const entry of verified.entries){
      if(!summary.kinds.includes(entry.kind)||!summary.categories.includes(entry.category)||
          entry.targets.some(target=>!summary.targets.includes(target)))throw Error(`Warehouse shard summary mismatch: ${id}`);
    }
    this.cache.set(id,verified);
    if(this.cache.size>MAX_CACHE_SHARDS)this.cache.delete(this.cache.keys().next().value!);
    return verified;
  }
  async search(input:CapabilitySearchQuery):Promise<CapabilitySearchResult>{
    if (!input || typeof input.query!=='string' || input.query.length>512)throw Error('Invalid warehouse search query');
    const limit=input.limit??20;
    const maxShardReads=input.maxShardReads??DEFAULT_READ_LIMIT;
    const maxEntriesScored=input.maxEntriesScored??20_000;
    if(!Number.isInteger(limit)||limit<1||limit>MAX_RESULT_LIMIT ||
       !Number.isInteger(maxShardReads)||maxShardReads<1||maxShardReads>MAX_READ_LIMIT ||
       !Number.isInteger(maxEntriesScored)||maxEntriesScored<1||maxEntriesScored>350_000){
      throw Error('Invalid warehouse search bounds');
    }
    if (input.kind && !['portable-source','source-generator','host-runtime','knowledge-descriptor'].includes(input.kind) ||
        input.target && !['typescript-web','typescript-desktop'].includes(input.target) ||
        input.category && !/^[a-z][a-z0-9-]*$/.test(input.category) ||
        input.version&&!/^\d+\.\d+\.\d+$/.test(input.version) ||
        input.symbol && !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(input.symbol) ||
        input.language && input.language!=='typescript' ||
        input.symbolKind && (!input.symbol||!['function','type','interface','value'].includes(input.symbolKind))) {
      throw Error('Invalid warehouse search filter');
    }
    const query=input.query.trim().toLowerCase();
    const terms=tokenizeCapability(query || input.symbol || '');
    const shards=new Set<string>();
    if(!terms.length){for(const s of this.manifest.shards)shards.add(s.id);}
    else for(const term of terms){
      // JSON-parsed manifests have Object.prototype: never treat inherited keys
      // like `constructor` as actual term postings.
      const postings=Object.hasOwn(this.manifest.postings,term)?this.manifest.postings[term]:undefined;
      for(const shard of postings??[])shards.add(shard);
    }
    // The optional semantic service may supply candidate shards independently
    // of exact terms. It cannot bypass manifest integrity or the I/O bound.
    if(query&&this.semantic){
      const suggested=await this.semantic.candidateShards(query,Math.min(maxShardReads,256));
      if(!Array.isArray(suggested)||suggested.length>256)throw Error('Invalid semantic shard suggestions');
      for(const id of suggested){if(typeof id!=='string'||!this.summaries.has(id))throw Error('Unknown semantic shard suggestion');shards.add(id);}
    }
    const candidates=[...shards].filter(id=>{
      const summary=this.summaries.get(id);
      return summary && (!input.kind||summary.kinds.includes(input.kind))&&
        (!input.target||summary.targets.includes(input.target))&&
        (!input.category||summary.categories.includes(input.category));
    }).sort();
    const matches:{capability:IndexedCapability;score:number}[]=[];
    let shardsRead=0,entriesScored=0,entryBudgetExceeded=false;
    searchShards:for(const shardId of candidates.slice(0,maxShardReads)){
      const shard=await this.load(shardId);
      shardsRead++;
      for(const capability of shard.entries){
        if(entriesScored>=maxEntriesScored){entryBudgetExceeded=true;break searchShards;}
        entriesScored++;
        if(input.kind&&capability.kind!==input.kind || input.target&&!capability.targets.includes(input.target) ||
          input.category&&capability.category!==input.category || input.version&&capability.version!==input.version ||
          input.language&&capability.language!==input.language ||
          input.symbol&&!capability.exports.some(x=>x.name===input.symbol&&(!input.symbolKind||x.kind===input.symbolKind)))continue;
        const lexical=scoreCapability(capability,query || input.symbol?.toLowerCase() || '',terms);
        const semantic=this.semantic?.relevance&&query ? await this.semantic.relevance(query,capability):0;
        if(typeof semantic!=='number'||!Number.isFinite(semantic)||semantic<0||semantic>100){
          throw Error('Invalid semantic relevance score');
        }
        const score=lexical+semantic;
        if(score>0)matches.push({capability,score});
      }
    }
    matches.sort((a,b)=>b.score-a.score||a.capability.id.localeCompare(b.capability.id)||
      a.capability.version.localeCompare(b.capability.version));
    return {matches:matches.slice(0,limit),shardsRead,
      candidateShards:candidates.length,incomplete:candidates.length>maxShardReads||entryBudgetExceeded};
  }
  /** No search is used as authorization: an ID match remains descriptive. */
  async exact(id:string,version='1.0.0'):Promise<IndexedCapability|undefined>{
    if(!/^source\.[a-z0-9-]+$/.test(id)||!/^\d+\.\d+\.\d+$/.test(version))return undefined;
    // No full catalog load: deterministic identity->shard mapping.
    const shardId=shardForIdentity(`${id}@${version}`,this.manifest.shardCount);
    if(!this.summaries.has(shardId))return undefined;
    return (await this.load(shardId)).entries.find(entry=>entry.id===id&&entry.version===version);
  }
}
