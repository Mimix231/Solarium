import { collectionUpgrade, stableGraphJson, type AppPlan, type Collection, type CollectionField, type RecordValue, type Value } from './graph';
import { allCollections, checkCapability, matchesRecord, recordDefaults, recordProblem, validRecordCondition, validRecordSort, type RecordCondition, type RecordSort } from './program';

export interface CollectionRecord {
  id: number; revision: number; archived: boolean; values: Record<string, RecordValue>;
}
export interface CollectionQuery {
  collection?: string; query: string; archived: boolean; filter: string | null; offset: number;
  where?: RecordCondition; sort?: RecordSort;
}
export interface RecordWrite { collection?: string; id: number | null; expected: number | null; archived: boolean; values: Record<string, RecordValue> }
export interface CollectionStore {
  list(query: CollectionQuery): Promise<{ rows: CollectionRecord[]; more: boolean }>;
  save(record: RecordWrite): Promise<CollectionRecord>;
  import?(collection: string, rows: Record<string, RecordValue>[]): Promise<number>;
}
interface DataBucket { schema: Collection; nextId: number; rows: CollectionRecord[] }
interface AppData { buckets: Record<string, DataBucket>; preferences: Record<string, Value>; revision: number }
type Transaction = <T>(mutate: (data: AppData) => T) => Promise<T>;
const newAppData = (): AppData => ({ buckets: {}, preferences: {}, revision: 0 });

function sortValues(left: RecordValue | undefined, right: RecordValue | undefined) {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (typeof left === 'string' && typeof right === 'string') {
    const a = Array.from(left), b = Array.from(right);
    const unequal = a.findIndex((letter, index) => index < b.length && letter !== b[index]);
    return unequal < 0 ? a.length - b.length : a[unequal]!.codePointAt(0)! - b[unequal]!.codePointAt(0)!;
  }
  return Number(left) - Number(right);
}

export function createAppAdapters(plan: AppPlan, transact: Transaction) {
  const collections = allCollections(plan);
  function bucket(data: AppData, id = plan.collection?.id): DataBucket {
    const schema = collections.find(collection => collection.id === id);
    if (!schema) throw Error('Unknown collection.');
    const current = data.buckets[schema.id];
    if (!current) return data.buckets[schema.id] = { schema, nextId: 1, rows: [] };
    if (stableGraphJson(schema) !== stableGraphJson(current.schema)) {
      const added = collectionUpgrade(current.schema, schema);
      current.schema = schema;
      if (added.length) current.rows = current.rows.map(row => ({ ...row, revision: row.revision + 1,
        values: { ...Object.fromEntries(added.map(field => [field.key, field.initial])), ...row.values } }));
    }
    return current;
  }
  function write(data: AppData, record: RecordWrite) {
    const target = bucket(data, record.collection);
    const invalid = recordProblem(target.schema, record.values);
    if (invalid) throw Error(invalid);
    for (const field of target.schema.fields) {
      if (field.type === 'reference' && record.values[field.key] !== null &&
          !bucket(data, field.collection).rows.some(row => row.id === record.values[field.key])) throw Error(`The ${field.label} record does not exist.`);
    }
    const previous = target.rows.find(row => row.id === record.id);
    if (record.id === null ? record.expected !== null || record.archived : !previous || previous.revision !== record.expected) {
      throw Error('The record changed. Reload it before saving.');
    }
    const saved = { id: previous?.id ?? target.nextId++, revision: (previous?.revision ?? 0) + 1,
      archived: record.archived, values: { ...record.values } };
    target.rows = [saved, ...target.rows.filter(row => row.id !== saved.id)];
    return saved;
  }
  const records: CollectionStore = {
    list: query => transact(data => {
      const target = bucket(data, query.collection);
      if (!Number.isSafeInteger(query.offset) || query.offset < 0 || query.query.length > 256 ||
          (query.filter && !target.schema.fields.some(field => field.type === 'boolean' && field.key === query.filter)) ||
          (query.where !== undefined && !validRecordCondition(target.schema, query.where)) ||
          (query.sort !== undefined && !validRecordSort(target.schema, query.sort))) throw Error('Invalid record query.');
      const needle = query.query.trim().toLowerCase();
      const matching = target.rows.filter(row => row.archived === query.archived && (!query.filter || row.values[query.filter] === true) &&
        (!query.where || matchesRecord(row.values, query.where)) &&
        (!needle || Object.values(row.values).some(value => typeof value === 'string' && value.toLowerCase().includes(needle))));
      const sort = query.sort;
      if (sort) matching.sort((a, b) => (sort.direction === 'asc' ? 1 : -1) *
        sortValues(a.values[sort.field], b.values[sort.field]) || b.id - a.id);
      return { rows: matching.slice(query.offset, query.offset + 50), more: matching.length > query.offset + 50 };
    }),
    save: record => transact(data => { checkCapability(plan.program, 'records.write'); return write(data, record); }),
    import: (collection, rows) => transact(data => {
      checkCapability(plan.program, 'files.open');
      checkCapability(plan.program, 'records.write');
      if (!rows.length || rows.length > 1000) throw Error('Import 1 to 1,000 records per transaction.');
      for (const values of rows) write(data, { collection, id: null, expected: null, archived: false, values });
      return rows.length;
    }),
  };
  let revision = -1;
  const storage = {
    async load() {
      const saved = await transact(data => ({ revision: data.revision, values: data.preferences }));
      revision = saved.revision;
      return saved.values;
    },
    async save(values: Record<string, Value>) {
      revision = await transact(data => {
        if (revision !== data.revision) throw Error('Preferences changed elsewhere. Reopen before saving.');
        data.preferences = { ...values };
        return ++data.revision;
      });
    },
  };
  return { records, storage };
}

/** An in-memory workspace survives graph revisions in the same app without ever touching user data.
 * Changing to a different app resets the owner's handle in SpicaPreview.
 */
export interface SpicaPreviewMemory { snapshot?: unknown }
export function memoryAdapters(plan: AppPlan, sample = false, memory?: SpicaPreviewMemory) {
  let data = (memory?.snapshot as AppData | undefined) ?? newAppData();
  if (sample && !Object.keys(data.buckets).length && plan.collection && plan.collection.id !== 'models') {
    const schema = plan.collection;
    const filter = schema.fields.find(field => field.type === 'boolean' && field.filter)?.key;
    const row = (id: number, title: string, body: string, archived = false): CollectionRecord => ({ id, revision: 1, archived, values: {
      ...recordDefaults(schema), title, ...(schema.fields.some(field => field.key === 'body') ? { body } : {}),
      ...(filter && id === 1 ? { [filter]: true } : {}),
    } });
    data.buckets[schema.id] = { schema, nextId: 4, rows: [row(1, 'Plan the week', 'Pick a few things to finish before Friday.'),
      row(2, 'Ideas to revisit', 'Set aside an afternoon for a small project.'), row(3, 'Last week', 'Keep this around for reference.', true)] };
  }
  return createAppAdapters(plan, async mutate => {
    const candidate = structuredClone(data);
    const result = mutate(candidate);
    data = candidate;
    if (memory) memory.snapshot = structuredClone(candidate);
    return structuredClone(result);
  });
}

export function webAdapters(plan: AppPlan, namespace: string) {
  const db = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('spica-' + namespace, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('app');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Close the other app window before updating its store.'));
  });
  return createAppAdapters(plan, async <T>(mutate: (data: AppData) => T) => {
    const database = await db;
    return new Promise<T>((resolve, reject) => {
      const tx = database.transaction('app', 'readwrite');
      const store = tx.objectStore('app');
      const read = store.get('data');
      let result: T;
      let failure: unknown;
      read.onsuccess = () => {
        try {
          const data = read.result as AppData | undefined ?? newAppData();
          result = mutate(data);
          store.put(data, 'data');
        } catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? Error('The storage operation was cancelled.'));
    });
  });
}

export async function allRecords(storage: CollectionStore, collection: string, query = '', filter: string | null = null, archived = false) {
  const rows: CollectionRecord[] = [];
  for (;;) {
    const page = await storage.list({ collection, query, filter, archived, offset: rows.length });
    rows.push(...page.rows);
    if (!page.more) return rows;
    if (!page.rows.length || rows.length > 10000) throw Error('The operation exceeds 10,000 records. Narrow the selection.');
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false, endedQuote = false;
  const finish = () => { row.push(value); value = ''; endedQuote = false; };
  for (let index = text.charCodeAt(0) === 0xfeff ? 1 : 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; endedQuote = true; }
      } else value += char;
    } else if (char === ',' || char === '\r' || char === '\n') {
      finish();
      if (char !== ',') {
        rows.push(row); row = [];
        if (char === '\r' && text[index + 1] === '\n') index++;
      }
    } else if (char === '"' && value === '' && !endedQuote) quoted = true;
    else if (char === '"' || endedQuote) throw Error('Invalid CSV quoting.');
    else value += char;
    if (rows.length > 1001 || row.length > 32 || value.length > 16000) throw Error('CSV exceeds the import limits.');
  }
  if (quoted) throw Error('CSV has an unclosed quoted field.');
  if (row.length || value !== '' || endedQuote) { finish(); rows.push(row); }
  return rows;
}

export type CsvTransform = (rows: string[][]) => string[][] | Promise<string[][]>;
export async function readCsvTable(text: string, transform?: CsvTransform) {
  const parsed = parseCsv(text);
  const table = transform ? await transform(parsed) : parsed;
  if (!Array.isArray(table) || table.length > 1001 || table.some(row => !Array.isArray(row) || row.length > 32 ||
      row.some(value => typeof value !== 'string' || value.length > 16000))) throw Error('The CSV block must return a bounded array of text cells.');
  const [headers, ...rows] = table;
  if (!headers?.length || new Set(headers).size !== headers.length) throw Error('CSV needs distinct column names.');
  if (!rows.length) throw Error('Import 1 to 1,000 record objects.');
  const ragged = rows.findIndex(row => row.length !== headers.length);
  if (ragged >= 0) throw Error(`Row ${ragged + 1} has the wrong number of cells.`);
  return { headers, rows };
}

export function csvCellValue(field: CollectionField, value: string): RecordValue {
  if (field.type === 'boolean') return value === 'true' ? true : value === 'false' ? false : value;
  if (field.type === 'reference') return value === '' ? null : /^\d+$/.test(value) ? Number(value) : value;
  if (field.type === 'number' && value.trim() && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

export function stageCsvRows(collection: Collection, table: Awaited<ReturnType<typeof readCsvTable>>, mapping?: readonly string[]) {
  const columns = mapping ?? table.headers;
  const keys = columns.filter(Boolean);
  if (columns.length !== table.headers.length || new Set(keys).size !== keys.length || (mapping && !keys.includes('title'))) {
    throw Error('Map the title and use each destination field at most once.');
  }
  const fields = new Map(collection.fields.map(field => [field.key, field]));
  const unknown = (mapping ? keys : columns).find(key => !fields.has(key));
  if (unknown !== undefined) throw Error(`Unknown CSV column "${unknown}". Use the collection's field keys.`);
  const defaults = recordDefaults(collection);
  return table.rows.map(cells => ({
    ...defaults,
    ...Object.fromEntries(columns.flatMap((key, index) => key ? [[key, csvCellValue(fields.get(key)!, cells[index]!)]] : [])),
  }));
}

export async function stageImport(collection: Collection, text: string, format: 'csv' | 'json', transform?: CsvTransform) {
  if (format === 'csv') return stageCsvRows(collection, await readCsvTable(text, transform));
  const rows: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw Error('Import 1 to 1,000 record objects.');
  return rows.map((row: unknown, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error(`Row ${index + 1} must be an object.`);
    return { ...recordDefaults(collection), ...row } as Record<string, RecordValue>;
  });
}

export async function prepareImport(collection: Collection, text: string, format: 'csv' | 'json', transform?: CsvTransform) {
  const rows = await stageImport(collection, text, format, transform);
  rows.forEach((record, index) => {
    const problem = recordProblem(collection, record);
    if (problem) throw Error(`Row ${index + 1} · ${problem}`);
  });
  return rows;
}

export function exportRecords(collection: Collection, rows: CollectionRecord[], format: 'csv' | 'json') {
  if (format === 'json') return JSON.stringify(rows.map(row => row.values), null, 2) + '\n';
  const keys = collection.fields.map(field => field.key);
  const cells = [keys, ...rows.map(row => keys.map(key => String(row.values[key] ?? '')))];
  return cells.map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
}
