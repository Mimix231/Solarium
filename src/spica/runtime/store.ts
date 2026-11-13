import type { SpicaRuntimeStore, SpicaStorageTransaction } from './adapter';

/** Isolated development/test store. It is NOT durable application storage. */
export class SpicaMemoryStore implements SpicaRuntimeStore {
  private readonly rows = new Map<string, unknown>();
  async begin(): Promise<SpicaStorageTransaction> {
    const staged = new Map<string, unknown>();
    let ended = false;
    const ensure = () => { if (ended) throw Error('Storage transaction already closed.'); };
    const address = (collection: string, key: string) => {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(collection) || !/^[a-z][a-z0-9_]{0,79}$/.test(key)) {
        throw Error('Invalid runtime record address.');
      }
      return `${collection}:${key}`;
    };
    return {
      read: async (collection, key) => { ensure(); const id = address(collection,key); return structuredClone(staged.has(id) ? staged.get(id) : this.rows.get(id)); },
      put: async (collection, key, value) => { ensure(); staged.set(address(collection,key),structuredClone(value)); },
      commit: async () => { ensure(); for (const [key,value] of staged) this.rows.set(key,structuredClone(value)); ended = true; staged.clear(); },
      rollback: async () => { if (!ended) { ended = true; staged.clear(); } },
    };
  }
  /** An explicit read helper for tests and interactive state inspection. */
  read(collection: string, key: string): unknown { return structuredClone(this.rows.get(`${collection}:${key}`)); }
}
