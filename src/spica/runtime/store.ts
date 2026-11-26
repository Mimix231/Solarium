import type { SpicaRuntimeStore, SpicaStorageTransaction } from './adapter';

/** Isolated development/test store. It is NOT durable application storage. */
export class SpicaMemoryStore implements SpicaRuntimeStore {
  private readonly rows = new Map<string, unknown>();
  async begin(): Promise<SpicaStorageTransaction> {
    const staged = new Map<string, unknown>();
    const deleted = new Set<string>();
    let ended = false;
    const ensure = () => { if (ended) throw Error('Storage transaction already closed.'); };
    const address = (collection: string, key: string) => {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(collection) || !/^[a-z][a-z0-9_]{0,79}$/.test(key)) {
        throw Error('Invalid runtime record address.');
      }
      return `${collection}:${key}`;
    };
    return {
      read: async (collection, key) => { ensure(); const id = address(collection,key); return deleted.has(id) ? undefined : structuredClone(staged.has(id) ? staged.get(id) : this.rows.get(id)); },
      put: async (collection, key, value) => { ensure(); const id=address(collection,key);deleted.delete(id);staged.set(id,structuredClone(value)); },
      delete: async (collection, key) => { ensure(); const id=address(collection,key);staged.delete(id);deleted.add(id); },
      list: async (collection, limit) => {
        ensure();address(collection,'sample');
        if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error('Record list limit must be 1–500.');
        const prefix=`${collection}:`;
        const keys=new Set([...this.rows.keys(),...staged.keys()].filter(k=>k.startsWith(prefix)));
        return [...keys].filter(key=>!deleted.has(key)).sort().slice(0,limit)
          .map(key=>({key:key.slice(prefix.length),value:structuredClone(staged.has(key)?staged.get(key):this.rows.get(key))}));
      },
      commit: async () => { ensure(); for (const id of deleted)this.rows.delete(id);for (const [key,value] of staged) this.rows.set(key,structuredClone(value)); ended = true; staged.clear();deleted.clear(); },
      rollback: async () => { if (!ended) { ended = true; staged.clear();deleted.clear(); } },
    };
  }
  /** An explicit read helper for tests and interactive state inspection. */
  read(collection: string, key: string): unknown { return structuredClone(this.rows.get(`${collection}:${key}`)); }
}
