import type { SourceBlockDefinition, PortableSourceBlock, SourceTarget } from './types';
import { validateSourceBlockDefinition } from './validator';

/** Reviewed contracts are deep-frozen: no caller can mutate validated nested port or target data. */
function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    const object = value as object;
    if (seen.has(object)) return value;
    seen.add(object);
    for (const item of Object.values(object)) deepFreeze(item,seen);
    Object.freeze(object);
  }
  return value;
}
/** Read-only registry; source files are NOT loaded or executed during discovery. */
export class SourceBlockRegistry {
  private readonly records = new Map<string, SourceBlockDefinition>();
  constructor(definitions: readonly SourceBlockDefinition[]) {
    for (const definition of definitions) {
      validateSourceBlockDefinition(definition);
      const key = `${definition.id}@${definition.version}`;
      if (this.records.has(key)) throw Error(`Duplicate source-block identity: ${key}`);
      this.records.set(key,deepFreeze(definition));
    }
  }
  get(id: string,version='1.0.0'): SourceBlockDefinition | undefined { return this.records.get(`${id}@${version}`); }
  list(kind?: SourceBlockDefinition['kind']): readonly SourceBlockDefinition[] {
    const entries = [...this.records.values()];return kind ? entries.filter(item=>item.kind===kind) : entries;
  }
  portableForTarget(target: SourceTarget): readonly PortableSourceBlock[] {
    return this.list('portable-source').filter((item):item is PortableSourceBlock=>item.kind==='portable-source'&&item.targets.includes(target));
  }
}
