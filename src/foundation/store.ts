import type { LibraryScope, RecordDelete, RecordStore, RecordWrite, StoredRecord, StoreFilter } from './types';
import { MAX_BODY } from './types';

const desktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
async function native<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}
let browserDb: Promise<IDBDatabase> | undefined;
function indexedDb(): Promise<IDBDatabase> {
  return browserDb ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('solarium-foundation-v1', 1);
    request.onupgradeneeded = () => {
      const records = request.result.createObjectStore('records', { keyPath: 'id' });
      records.createIndex('scope', ['scope.kind', 'scope.id']);
      request.result.createObjectStore('bodies');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
const requestValue = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? Error('Storage transaction cancelled.')); });
}
function checkWrites(puts: RecordWrite[]): void {
  for (const {record, body} of puts) {
    if (!record.id || record.id.length > 180 || !record.collection || !record.scope?.id || !['chat','project','library'].includes(record.scope.kind) || record.version < 1) throw Error('Invalid storage record.');
    if (body !== undefined && (typeof body !== 'string' || body.length > MAX_BODY)) throw Error('Content exceeds 2 MB.');
  }
  if (new Set(puts.map(p => p.record.id)).size !== puts.length) throw Error('Duplicate IDs in storage transaction.');
}
/** Browser development uses IndexedDB (50 MB guard); Desktop uses native SQLite transactions. */
export const foundationStore: RecordStore = {
  async list<T>(filter: StoreFilter): Promise<StoredRecord<T>[]> {
    if (!filter.scopes.length) return [];
    if (desktop()) return native('foundation_list', { filter });
    const db = await indexedDb(); const tx = db.transaction('records', 'readonly');
    const records = (await Promise.all(filter.scopes.map(scope => requestValue(tx.objectStore('records').index('scope').getAll([scope.kind, scope.id]))))).flat() as StoredRecord<T>[];
    return records.filter(r => (!filter.collection || r.collection === filter.collection) && (!filter.storyId || r.storyId === filter.storyId) && (!filter.query || `${r.title} ${JSON.stringify(r.data)}`.toLowerCase().includes(filter.query.toLowerCase())));
  },
  async body(id: string, scopes: LibraryScope[]): Promise<string | null> {
    if (desktop()) return native('foundation_body', { id, scopes });
    const db = await indexedDb(); const tx = db.transaction(['records','bodies'], 'readonly');
    const rec = await requestValue(tx.objectStore('records').get(id)) as StoredRecord | undefined;
    if (!rec || !scopes.some(s => s.id === rec.scope.id && s.kind === rec.scope.kind)) return null;
    return (await requestValue(tx.objectStore('bodies').get(id)) as string | undefined) ?? null;
  },
  async batch(puts: RecordWrite[], deletes: RecordDelete[] = []): Promise<void> {
    checkWrites(puts);
    if (desktop()) return native('foundation_batch', { puts, deletes });
    const db = await indexedDb(); const tx = db.transaction(['records','bodies'], 'readwrite'); const done = transactionDone(tx);
    const records = tx.objectStore('records'), bodies = tx.objectStore('bodies');
    let failure: Error | null = null;
    // IDB transactions must enqueue subsequent work from request callbacks, never after an unrelated await.
    const operations = [...puts.map(p => ({ id: p.record.id, expected: p.expected, put: p })), ...deletes.map(d => ({ ...d, put: null }))];
    if (operations.length > 20_000) { tx.abort(); throw Error('Too many records in one import.'); }
    for (const op of operations) {
      const request = records.get(op.id);
      request.onsuccess = () => {
        const current = request.result as StoredRecord | undefined;
        if ((current?.version ?? null) !== op.expected) { failure = Error('Revision conflict: this item changed. Reload before saving.'); tx.abort(); return; }
        if (op.put) {
          records.put(op.put.record);
          if (op.put.body !== undefined) bodies.put(op.put.body, op.id);
        } else { records.delete(op.id); bodies.delete(op.id); }
      };
    }
    const allRecords=records.getAll();
    allRecords.onsuccess=()=>{const allBodies=bodies.getAll();allBodies.onsuccess=()=>{const size=JSON.stringify(allRecords.result).length+allBodies.result.reduce((n:number,b:unknown)=>n+(typeof b==='string'?b.length:0),0);if(size>50_000_000){failure=Error('Browser development library exceeds its 50 MB limit. Export or remove old items, or use Desktop storage.');tx.abort();}};};
    try { await done; } catch (error) { throw failure ?? error; }
  },
};

/** All operations use the same CAS/atomic boundary, including imports and revisions. */
export const newRecord = <T>(collection: string, id: string, scope: LibraryScope, title: string, data: T, storyId?: string | null): StoredRecord<T> =>
  ({ collection, id, scope, title, data, storyId, version: 1, updatedAt: new Date().toISOString() });

export async function exportFoundation(store: RecordStore, scopes: LibraryScope[]): Promise<{ schemaVersion: 1; records: {record: StoredRecord; body: string | null}[] }> {
  const records = await store.list({ scopes });
  return { schemaVersion: 1, records: await Promise.all(records.map(async record => ({ record, body: await store.body(record.id, scopes) }))) };
}
