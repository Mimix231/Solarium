import type { SourceBlockDefinition, SourceBlockKind, SourceLanguage, SourceRequirement, SourceSymbol, SourceTarget } from '../types';

/** Searchable facts only. Source text, generators and host adapters never enter the index. */
export interface IndexedCapability {
  readonly id: string;
  readonly version: string;
  readonly kind: SourceBlockKind;
  readonly category: string;
  readonly description: string;
  readonly language: SourceLanguage;
  readonly targets: readonly SourceTarget[];
  readonly exports: readonly SourceSymbol[];
  readonly requires: readonly SourceRequirement[];
  readonly provenance: 'runtime-adaptation' | 'new-implementation' | 'documentation';
}
export interface WarehouseShard {
  readonly id: string;
  readonly entries: readonly IndexedCapability[];
}
export interface WarehouseShardSummary {
  readonly id: string;
  readonly count: number;
  readonly sha256: string;
  readonly kinds: readonly SourceBlockKind[];
  readonly categories: readonly string[];
  readonly targets: readonly SourceTarget[];
}
export interface WarehouseIndexManifest {
  readonly schemaVersion: 1;
  readonly count: number;
  readonly shardCount: number;
  readonly countsByKind: Readonly<Record<SourceBlockKind, number>>;
  readonly shards: readonly WarehouseShardSummary[];
  /** Exact, normalized searchable term -> shard identifiers. No source code. */
  readonly postings: Readonly<Record<string, readonly string[]>>;
}
export interface WarehouseIndexProvider {
  readShard(id: string): Promise<WarehouseShard>;
}
export interface WarehouseIndexBuildResult {
  readonly manifest: WarehouseIndexManifest;
  readonly shards: readonly WarehouseShard[];
}
export function indexedCapability(definition: SourceBlockDefinition): IndexedCapability {
  const executable = definition.kind === 'portable-source' || definition.kind === 'source-generator';
  return {
    id: definition.id, version: definition.version, kind: definition.kind,
    category: definition.category, description: definition.description,
    language: definition.language, targets: [...definition.targets],
    exports: executable ? definition.exports.map(item => ({...item})) : [],
    requires: executable ? definition.requires.map(item => ({...item})) : [],
    provenance: definition.provenance.kind,
  };
}

/** External catalog entries are untrusted metadata, even when the SHA-256 of
 * the index later verifies. Strip executable references and reject extra fields
 * before a descriptor enters an authoritative local manifest. */
const INDEX_KEYS=new Set(['id','version','kind','category','description','language','targets','exports','requires','provenance']);
const KINDS=new Set(['portable-source','source-generator','host-runtime','knowledge-descriptor']);
const TARGETS=new Set(['typescript-web','typescript-desktop']);
const SYMBOL_KINDS=new Set(['function','type','interface','value']);
const PROVENANCE=new Set(['runtime-adaptation','new-implementation','documentation']);
const VALID_SYMBOL=/^[A-Za-z_$][A-Za-z0-9_$]*$/;
export function sanitizeIndexedCapability(entry:IndexedCapability):IndexedCapability {
  if(!entry || typeof entry!=='object' || Object.keys(entry).length!==INDEX_KEYS.size ||
    [...INDEX_KEYS].some(key=>!Object.hasOwn(entry,key)) ||
    Object.values(Object.getOwnPropertyDescriptors(entry)).some(descriptor=>!Object.hasOwn(descriptor,'value')) ||
    typeof entry.id!=='string'||entry.id.length>140||!/^source\.[a-z][a-z0-9-]*$/.test(entry.id) ||
    typeof entry.version!=='string'||!/^\d+\.\d+\.\d+$/.test(entry.version) ||
    !KINDS.has(entry.kind)|| typeof entry.category!=='string'||!/^[a-z][a-z0-9-]*$/.test(entry.category) ||
    typeof entry.description!=='string'||!entry.description.trim()||entry.description.length>2000 ||
    entry.language!=='typescript' || !PROVENANCE.has(entry.provenance) ||
    !Array.isArray(entry.targets)||entry.targets.length<1||entry.targets.length>2||
    entry.targets.some(t=>!TARGETS.has(t))||new Set(entry.targets).size!==entry.targets.length ||
    !Array.isArray(entry.exports)||entry.exports.length>128||
    !Array.isArray(entry.requires)||entry.requires.length>128) throw Error('Invalid or executable warehouse index descriptor');
  const exports=entry.exports.map(symbol=>{
    if(!symbol||typeof symbol!=='object'||(Object.keys(symbol).length!==2||!Object.hasOwn(symbol,'name')||!Object.hasOwn(symbol,'kind'))||
      Object.values(Object.getOwnPropertyDescriptors(symbol)).some(descriptor=>!Object.hasOwn(descriptor,'value'))||
      typeof symbol.name!=='string'||!VALID_SYMBOL.test(symbol.name)||!SYMBOL_KINDS.has(symbol.kind))throw Error('Invalid warehouse exported symbol');
    return Object.freeze({name:symbol.name,kind:symbol.kind});
  });
  const requires=entry.requires.map(requirement=>{
    if(!requirement||typeof requirement!=='object'||(Object.keys(requirement).length!==3||!['id','version','symbol'].every(key=>Object.hasOwn(requirement,key)))||
      Object.values(Object.getOwnPropertyDescriptors(requirement)).some(descriptor=>!Object.hasOwn(descriptor,'value'))||
      typeof requirement.id!=='string'||!/^source\.[a-z][a-z0-9-]*$/.test(requirement.id)||
      typeof requirement.version!=='string'||!/^\d+\.\d+\.\d+$/.test(requirement.version)||
      typeof requirement.symbol!=='string'||!VALID_SYMBOL.test(requirement.symbol))throw Error('Invalid indexed source dependency');
    return Object.freeze({...requirement});
  });
  if(new Set(exports.map(item=>item.name)).size!==exports.length ||
     new Set(requires.map(item=>`${item.id}@${item.version}:${item.symbol}`)).size!==requires.length)throw Error('Duplicate warehouse symbols or requirements');
  if(!['portable-source','source-generator'].includes(entry.kind)&&(exports.length||requires.length)){
    throw Error('Non-executable index descriptor cannot export source contracts');
  }
  return Object.freeze({id:entry.id,version:entry.version,kind:entry.kind,category:entry.category,
    description:entry.description,language:entry.language,targets:Object.freeze([...entry.targets]),
    exports:Object.freeze(exports),requires:Object.freeze(requires),provenance:entry.provenance});
}
